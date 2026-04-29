import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import numpy as np
import pandas as pd
import pickle
import tensorflow as tf
import random
from sklearn.preprocessing import MinMaxScaler, MaxAbsScaler
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from src.model.architecture import build_cnn_lstm_attention_model
from src.model.losses import VarianceMatchingMSE
from src.model.probability import build_peer_close_table

SEED = 42
WINDOW_SIZE = 30
# Multi-seed ensemble: 5 seeds để giảm variance prediction (~1/√5)
ENSEMBLE_SEEDS = [42, 123, 456, 789, 2024]
# Horizon: 1 = daily T+1 (truyền thống); 5 = T+5 forward return
# (SNR cao hơn daily — Signal-to-Noise Ratio lớn hơn vì noise trung bình triệt tiêu).
HORIZON_DAYS_DEFAULT = 1
# Feature set: 20 cols (đã validate ở baseline DA 44.3%)
# Cross-sectional features bị rollback do gây collapse variance.
REGRESSION_FEATURE_COLUMNS = [
    # Nhóm giá & volume gốc
    'open', 'high', 'low', 'close_winsorized', 'volume',
    'sma_10', 'sma_20', 'rsi_14',
    # Nhóm động lượng (return ngắn / trung hạn)
    'return_1d', 'return_3d', 'return_5d', 'return_10d',
    # Nhóm biến động (volatility / drawdown)
    'volatility_10d', 'volatility_20d', 'drawdown_20d',
    # Nhóm vị trí giá so với MA và vol bất thường
    'price_vs_sma10', 'price_vs_sma20', 'sma10_vs_sma20',
    'rsi_delta_5', 'volume_zscore_20',
]


def _augment_regression_features(df: pd.DataFrame) -> pd.DataFrame:
    """Bổ sung các cột feature engineered mà preprocess.py chưa tính.

    Giữ tương thích ngược: nếu cột đã có sẵn trong CSV, không ghi đè.
    """
    close = df['close_winsorized']

    # return ngắn & trung hạn (log-return rolling)
    log_price = np.log(close)
    for horizon in (1, 3, 5, 10):
        col = f'return_{horizon}d'
        if col not in df.columns:
            df[col] = log_price.diff(horizon)

    # volatility (rolling std of log-return 1d)
    ret_1d = log_price.diff(1)
    for horizon in (10, 20):
        col = f'volatility_{horizon}d'
        if col not in df.columns:
            df[col] = ret_1d.rolling(horizon).std()

    # drawdown rolling 20d (giá hiện tại so với peak 20 phiên trước)
    if 'drawdown_20d' not in df.columns:
        df['drawdown_20d'] = close / close.rolling(20).max() - 1.0

    # Vị trí giá so với MA
    if 'price_vs_sma10' not in df.columns:
        df['price_vs_sma10'] = close / df['sma_10'] - 1.0
    if 'price_vs_sma20' not in df.columns:
        df['price_vs_sma20'] = close / df['sma_20'] - 1.0
    if 'sma10_vs_sma20' not in df.columns:
        df['sma10_vs_sma20'] = df['sma_10'] / df['sma_20'] - 1.0

    # Thay đổi RSI 5 phiên
    if 'rsi_delta_5' not in df.columns:
        df['rsi_delta_5'] = df['rsi_14'].diff(5)

    # Volume bất thường (z-score 20 phiên)
    if 'volume_zscore_20' not in df.columns:
        vol_mean = df['volume'].rolling(20).mean()
        vol_std = df['volume'].rolling(20).std()
        df['volume_zscore_20'] = (df['volume'] - vol_mean) / (vol_std + 1e-8)

    return df


def _augment_cross_sectional_features(df: pd.DataFrame,
                                      ticker: str,
                                      peer_close_table: pd.DataFrame | None = None,
                                      data_dir: str = 'data/processed') -> pd.DataFrame:
    """Thêm 8 cross-sectional features dùng log-return của peer group.

    Các feature được tính:
      - benchmark_return_1d / 5d : trung bình log-return peer (không gồm ticker)
      - alpha_1d_vs_peer / alpha_5d_vs_peer : ticker return - benchmark return
      - rank_return_1d / 5d : percentile rank (0..1) trong nhóm 10 mã
      - z_return_1d_vs_peer : z-score vs phân phối peer theo ngày
      - rel_volatility_20d : volatility ticker / volatility benchmark

    Yêu cầu: df đã chạy _augment_regression_features để có return_1d/5d,
    volatility_20d.
    """
    ticker = ticker.upper()
    result = df.copy()

    # Chuẩn hóa time sang string YYYY-MM-DD để merge khớp với peer_close_table
    if 'time' in result.columns:
        result['time'] = pd.to_datetime(result['time']).dt.strftime('%Y-%m-%d')

    if peer_close_table is None:
        peer_close_table = build_peer_close_table(data_dir=data_dir)

    peer_table = peer_close_table.copy()
    peer_table['time'] = pd.to_datetime(peer_table['time']).dt.strftime('%Y-%m-%d')

    # Lấy tất cả cột ticker trong peer_table
    all_ticker_cols = [c for c in peer_table.columns if c != 'time']
    peer_only_cols = [c for c in all_ticker_cols if c != ticker]
    if not peer_only_cols:  # safety fallback
        peer_only_cols = all_ticker_cols

    # Log-return cho toàn bộ mã (dùng log để nhất quán với target log_return)
    all_prices = peer_table[all_ticker_cols].astype(float).replace(0, np.nan)
    all_log_prices = np.log(all_prices)

    # Benchmark return (mean log-return peer, EXCLUDING ticker)
    benchmark = peer_table[['time']].copy()
    for horizon in (1, 5):
        peer_log_returns = all_log_prices[peer_only_cols].diff(horizon)
        benchmark[f'benchmark_return_{horizon}d'] = peer_log_returns.mean(axis=1, skipna=True)

    # Benchmark daily volatility 20d (std của mean peer log-return)
    peer_daily_log_ret = all_log_prices[peer_only_cols].diff(1)
    benchmark['benchmark_volatility_20d'] = (
        peer_daily_log_ret.mean(axis=1, skipna=True).rolling(20).std()
    )

    # Rank cross-sectional (percentile 0..1) INCLUDING ticker
    ranks = peer_table[['time']].copy()
    for horizon in (1, 5):
        log_returns_all = all_log_prices.diff(horizon)
        rank_pct = log_returns_all.rank(axis=1, pct=True)
        if ticker in rank_pct.columns:
            ranks[f'rank_return_{horizon}d'] = rank_pct[ticker].values
        else:
            ranks[f'rank_return_{horizon}d'] = 0.5  # neutral fallback

    # Z-score daily return vs peer distribution
    z_scores = peer_table[['time']].copy()
    daily_log_ret_all = all_log_prices.diff(1)
    mean_all = daily_log_ret_all.mean(axis=1, skipna=True)
    std_all = daily_log_ret_all.std(axis=1, skipna=True).replace(0, np.nan)
    if ticker in daily_log_ret_all.columns:
        z_series = (daily_log_ret_all[ticker] - mean_all) / std_all
        z_scores['z_return_1d_vs_peer'] = z_series.values
    else:
        z_scores['z_return_1d_vs_peer'] = 0.0

    # Merge
    result = result.merge(benchmark, on='time', how='left')
    result = result.merge(ranks, on='time', how='left')
    result = result.merge(z_scores, on='time', how='left')

    # Alpha (ticker return - benchmark return)
    for horizon in (1, 5):
        ret_col = f'return_{horizon}d'
        bench_col = f'benchmark_return_{horizon}d'
        if ret_col in result.columns and bench_col in result.columns:
            result[f'alpha_{horizon}d_vs_peer'] = result[ret_col] - result[bench_col]

    # Relative volatility (ticker vol / benchmark vol)
    if 'volatility_20d' in result.columns and 'benchmark_volatility_20d' in result.columns:
        result['rel_volatility_20d'] = (
            result['volatility_20d'] / result['benchmark_volatility_20d'].replace(0, np.nan)
        )

    return result


def set_global_seed(seed=SEED):
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)

def create_sequences(data, target, window_size=30):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i:(i + window_size)])
        y.append(target[i + window_size])
    return np.array(X), np.array(y)

def train_model(ticker='VCB'):
    print(f"Huấn luyện cấu trúc Log-Return cho {ticker}...\n")

    df = pd.read_csv(f'data/processed/{ticker}_features.csv')

    # Bổ sung feature engineered (return/volatility/price-vs-MA) nếu CSV chưa có
    df = _augment_regression_features(df)
    # Cross-sectional đã rollback — hàm _augment_cross_sectional_features còn trong code
    # để sau này có thể thử lại nếu cần (kèm rescale riêng / variance_weight cao hơn).

    # Sử dụng feature set mở rộng và biến mục tiêu là log_return
    features = list(REGRESSION_FEATURE_COLUMNS)
    target_col = 'log_return' # Biến mục tiêu là log-return (stationary)

    # Tạo biến mục tiêu là log-return (chuỗi stationary, tránh persistence problem)
    df['log_return'] = np.log(df['close_winsorized'] / df['close_winsorized'].shift(1))
    # Chỉ drop NaN trên các cột thực sự dùng (tránh drop nhầm vì cột foreign_* toàn NaN)
    df.dropna(subset=features + [target_col], inplace=True)
    df.reset_index(drop=True, inplace=True)
    
    data_values = df[features].values
    target_values = df[[target_col]].values
    
    n = len(df)
    train_end = int(n * 0.8) # 80% dữ liệu dùng để huấn luyện
    val_end = int(n * 0.9) # 10% tiếp theo dùng để validation, 10% cuối cùng để test
    
    train_data = data_values[:train_end]
    val_data = data_values[train_end:val_end]
    train_target = target_values[:train_end]
    val_target = target_values[train_end:val_end]
    
    # Feature scale bình thường; target dùng MaxAbsScaler để ZERO ĐƯỢC GIỮ NGUYÊN
    # (điều kiện cho direction-penalty trong VarianceMatchingMSE tính đúng dấu)
    feature_scaler = MinMaxScaler(feature_range=(0, 1))
    target_scaler = MaxAbsScaler()
    
    # Transform dữ liệu và lưu scaler để tái sử dụng
    scaled_train_data = feature_scaler.fit_transform(train_data)
    scaled_train_target = target_scaler.fit_transform(train_target)
    scaled_val_data = feature_scaler.transform(val_data)
    scaled_val_target = target_scaler.transform(val_target)
    
    # Lưu scaler để tái sử dụng khi đánh giá và dự báo
    os.makedirs('models', exist_ok=True)
    with open(f'models/{ticker.lower()}_feature_scaler.pkl', 'wb') as f:
        pickle.dump(feature_scaler, f)
    with open(f'models/{ticker.lower()}_target_scaler.pkl', 'wb') as f:
        pickle.dump(target_scaler, f)
        
    # Tạo chuỗi dữ liệu cho mô hình LSTM-Attention
    window_size = WINDOW_SIZE
    X_train, y_train = create_sequences(scaled_train_data, scaled_train_target, window_size)
    X_val, y_val = create_sequences(scaled_val_data, scaled_val_target, window_size)
    
    # Khởi tạo CNN-LSTM-Attention
    model = build_cnn_lstm_attention_model((window_size, len(features)))
    # Ghi đè loss MSE mặc định bằng VarianceMatchingMSE (chống flat prediction + tăng DA)
    # Sau thử nghiệm: w=1.5/0.3 overfit; quay về mức trung bình + kỳ vọng feature mới đóng vai trò chính
    custom_loss = VarianceMatchingMSE(
        variance_weight=0.5,
        direction_weight=0.15,
        direction_temp=20.0,
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss=custom_loss,
        metrics=['mae'],
    )

    early_stop = EarlyStopping(monitor='val_loss', patience=20, restore_best_weights=True, verbose=1)
    checkpoint = ModelCheckpoint(f'models/cnn_lstm_attn_{ticker.lower()}_v1.h5', 
                                 monitor='val_loss', save_best_only=True, verbose=1)
    reduce_lr = ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=10, min_lr=0.00001, verbose=1)
    
    print("\n AI đang học cách nhận diện biên độ dao động...")
    model.fit(X_train, y_train,
              validation_data=(X_val, y_val),
              epochs=150,
              batch_size=16,
              callbacks=[early_stop, checkpoint, reduce_lr],
              verbose=1)
    config_payload = {
        "prediction_mode": "price_regression",
        "ticker": ticker.upper(),
        "window_size": int(window_size),
        "feature_columns": list(features),
        "target_column": target_col,
        "target_type": "log_return",   # Để api.py/evaluate.py biết cách inverse: next_price = prev * exp(pred)
        "seed": int(SEED),
        "target_scaler_range": [-1, 1],
    }
    with open(f'models/{ticker.lower()}_reg_config.pkl', 'wb') as f:
        pickle.dump(config_payload, f)


# ---------------------------------------------------------------------------
# Ensemble: train N models (N seeds khác nhau) → average prediction để giảm
# variance và cải thiện DA 2-4 điểm % (theo lý thuyết Law of Large Numbers).
# ---------------------------------------------------------------------------

def train_model_ensemble(ticker: str = 'VCB',
                         seeds: list | None = None,
                         horizon_days: int = HORIZON_DAYS_DEFAULT):
    """Huấn luyện N models (mỗi seed 1 model) → ensemble averaging.

    Scaler (feature + target) được fit 1 LẦN trên toàn bộ train set, dùng chung
    cho mọi seed để các prediction average có cùng không gian scale.

    Target:
      - horizon_days=1 : log(P_t / P_{t-1})     — backward 1-day (T+1 prediction)
      - horizon_days=5 : log(P_{t+5} / P_t)     — forward 5-day (T+5 prediction)
        SNR cao hơn: daily noise trung bình triệt tiêu, tín hiệu tích lũy → DA cao hơn.

    Models lưu tại: models/ensemble/cnn_lstm_attn_{ticker}_v1_s{seed}.h5
                   (horizon_days>1 → suffix _h{horizon}: vd _v1_h5_s42.h5)
    Config lưu: models/{ticker}_reg_config.pkl
    """
    seeds = seeds or list(ENSEMBLE_SEEDS)
    horizon_days = int(horizon_days)
    print(f"\n[ENSEMBLE] Huấn luyện {len(seeds)} seeds cho {ticker} "
          f"(horizon={horizon_days} ngày): {seeds}\n")

    df = pd.read_csv(f'data/processed/{ticker}_features.csv')
    df = _augment_regression_features(df)

    features = list(REGRESSION_FEATURE_COLUMNS)
    target_col = 'log_return'
    if horizon_days == 1:
        # Target backward: log(P_t / P_{t-1}) = log-return 1-day đã quan sát tại time t.
        # Model dự báo tại window kết thúc tại t-1 → giá trị của log_return tại t.
        df['log_return'] = np.log(df['close_winsorized'] / df['close_winsorized'].shift(1))
    else:
        # Target forward: log(P_{t+horizon} / P_t). Window kết thúc tại t → dự báo
        # tổng log-return H ngày tiếp theo. Drop NaN cuối (horizon rows mất target).
        df['log_return'] = np.log(
            df['close_winsorized'].shift(-horizon_days) / df['close_winsorized']
        )
    df.dropna(subset=features + [target_col], inplace=True)
    df.reset_index(drop=True, inplace=True)

    data_values = df[features].values
    target_values = df[[target_col]].values

    n = len(df)
    train_end = int(n * 0.8)
    val_end = int(n * 0.9)
    train_data = data_values[:train_end]
    val_data = data_values[train_end:val_end]
    train_target = target_values[:train_end]
    val_target = target_values[train_end:val_end]

    # Fit scaler 1 lần — dùng chung cho tất cả seeds
    feature_scaler = MinMaxScaler(feature_range=(0, 1))
    target_scaler = MaxAbsScaler()
    scaled_train_data = feature_scaler.fit_transform(train_data)
    scaled_train_target = target_scaler.fit_transform(train_target)
    scaled_val_data = feature_scaler.transform(val_data)
    scaled_val_target = target_scaler.transform(val_target)

    os.makedirs('models', exist_ok=True)
    os.makedirs('models/ensemble', exist_ok=True)
    with open(f'models/{ticker.lower()}_feature_scaler.pkl', 'wb') as f:
        pickle.dump(feature_scaler, f)
    with open(f'models/{ticker.lower()}_target_scaler.pkl', 'wb') as f:
        pickle.dump(target_scaler, f)

    window_size = WINDOW_SIZE
    X_train, y_train = create_sequences(scaled_train_data, scaled_train_target, window_size)
    X_val, y_val = create_sequences(scaled_val_data, scaled_val_target, window_size)

    # Suffix file checkpoint để tách biệt models theo horizon
    h_suffix = "" if horizon_days == 1 else f"_h{horizon_days}"

    best_val_losses = []
    for seed in seeds:
        print(f"\n[ENSEMBLE] {ticker} — horizon={horizon_days} seed={seed} ...")
        set_global_seed(seed)  # seed toàn cục để init weights + shuffle ổn định

        model = build_cnn_lstm_attention_model((window_size, len(features)))
        custom_loss = VarianceMatchingMSE(
            variance_weight=0.5,
            direction_weight=0.15,
            direction_temp=20.0,
        )
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss=custom_loss,
            metrics=['mae'],
        )

        ckpt_path = f'models/ensemble/cnn_lstm_attn_{ticker.lower()}_v1{h_suffix}_s{seed}.h5'
        early_stop = EarlyStopping(monitor='val_loss', patience=20,
                                   restore_best_weights=True, verbose=1)
        checkpoint = ModelCheckpoint(ckpt_path, monitor='val_loss',
                                     save_best_only=True, verbose=1)
        reduce_lr = ReduceLROnPlateau(monitor='val_loss', factor=0.5,
                                      patience=10, min_lr=0.00001, verbose=1)

        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=150,
            batch_size=16,
            callbacks=[early_stop, checkpoint, reduce_lr],
            verbose=1,
        )
        best_val_loss = float(min(history.history.get('val_loss', [float('inf')])))
        best_val_losses.append(best_val_loss)
        print(f"[ENSEMBLE] {ticker} seed={seed} best_val_loss={best_val_loss:.4f}")

    # Thống kê log-return train + tính threshold confidence gate (coverage 20%)
    train_log_return_clean = train_target.flatten()
    train_log_return_clean = train_log_return_clean[~np.isnan(train_log_return_clean)]
    train_log_return_std = float(np.std(train_log_return_clean)) if train_log_return_clean.size > 0 else 0.0

    # Compute confidence threshold ở coverage 20% trên VAL set (sau khi train xong)
    # Dùng model cuối cùng để prediction (đại diện đủ tốt cho ensemble average).
    # Tránh reload toàn bộ ensemble → chỉ dùng 1 model cho threshold calibration.
    threshold_cov20 = 0.40  # default fallback
    try:
        val_pred = model.predict(X_val, verbose=0)
        val_pred_log = target_scaler.inverse_transform(val_pred).flatten()
        if train_log_return_std > 0 and val_pred_log.size > 0:
            conf_scores = np.abs(val_pred_log) / max(train_log_return_std, 1e-9)
            threshold_cov20 = float(np.quantile(conf_scores, 0.80))  # top 20% threshold
    except Exception as _e:
        print(f"[ENSEMBLE] threshold calibration skipped: {_e}")

    config_payload = {
        "prediction_mode": "price_regression",
        "ticker": ticker.upper(),
        "window_size": int(window_size),
        "feature_columns": list(features),
        "target_column": target_col,
        "target_type": "log_return",
        "seed": int(SEED),
        "target_scaler_range": [-1, 1],
        # Danh sách seeds để downstream tools load ensemble
        "ensemble_seeds": [int(s) for s in seeds],
        "ensemble_best_val_losses": best_val_losses,
        "ensemble_dir": "models/ensemble",
        # Horizon: 1 = T+1 daily, 5 = T+5 forward
        "horizon_days": int(horizon_days),
        "ensemble_file_suffix": h_suffix,  # để downstream build đúng path
        # Confidence gate metadata
        "train_log_return_std": train_log_return_std,
        "confidence_threshold_cov20": threshold_cov20,
    }
    with open(f'models/{ticker.lower()}_reg_config.pkl', 'wb') as f:
        pickle.dump(config_payload, f)

    print(f"\n[ENSEMBLE] Done {ticker} (horizon={horizon_days}). "
          f"Best val_losses = {best_val_losses}")
    print(f"[ENSEMBLE] train_log_return_std={train_log_return_std:.5f} "
          f"conf_threshold_cov20={threshold_cov20:.4f}")


def load_ensemble_models(ticker: str):
    """Load tất cả models trong ensemble cho ticker (nếu config có ensemble_seeds).

    Returns:
        (models_list, model_config) — models_list rỗng nếu ticker không có ensemble.
    """
    # Import lazy để tránh vòng import khi train.py bị import từ api.py
    from tensorflow.keras.models import load_model as _load_model
    from src.model.architecture import AttentionLayer as _AttentionLayer

    cfg_path = f'models/{ticker.lower()}_reg_config.pkl'
    if not os.path.exists(cfg_path):
        return [], None
    with open(cfg_path, 'rb') as f:
        cfg = pickle.load(f)

    seeds = cfg.get('ensemble_seeds')
    if not seeds:
        return [], cfg

    ensemble_dir = cfg.get('ensemble_dir', 'models/ensemble')
    h_suffix = cfg.get('ensemble_file_suffix', '')  # suffix theo horizon
    models = []
    for seed in seeds:
        path = f'{ensemble_dir}/cnn_lstm_attn_{ticker.lower()}_v1{h_suffix}_s{seed}.h5'
        if os.path.exists(path):
            models.append(_load_model(path,
                                      custom_objects={'AttentionLayer': _AttentionLayer},
                                      compile=False))
    return models, cfg


def predict_ensemble(models: list, X: np.ndarray) -> np.ndarray:
    """Trung bình prediction của tất cả models trong ensemble.

    Args:
        models: danh sách từ load_ensemble_models.
        X: input đã scaled, shape (N, window, n_features).
    Returns:
        Mean prediction (N, 1) trong không gian scaled của target.
    """
    if not models:
        raise ValueError("Ensemble rỗng — không có model nào được load.")
    preds = np.stack([m.predict(X, verbose=0) for m in models], axis=0)  # (n_models, N, 1)
    return preds.mean(axis=0)


# ---------------------------------------------------------------------------
# Multi-task head: model học đồng thời regression (log-return) + classification
# (direction 3-class). Composite loss giúp backbone học signal phục vụ cả hai
# task → DA kỳ vọng tăng 3-5 điểm %.
# ---------------------------------------------------------------------------

def _build_direction_labels(log_return: np.ndarray, neutral_band: float = 0.001) -> np.ndarray:
    """Sinh direction label 3-class từ log-return.

    Args:
        log_return: array 1D log-return values
        neutral_band: ngưỡng flat — |r| <= band → class 1 (flat).
                      Mặc định 0.001 ≈ 0.1% (phù hợp daily). Với horizon=5,
                      nên dùng 0.005-0.01.
    Returns:
        Labels int array: 0=down, 1=flat, 2=up
    """
    lr = np.asarray(log_return, dtype=float).flatten()
    labels = np.ones_like(lr, dtype=np.int64)  # default flat
    labels[lr < -neutral_band] = 0
    labels[lr > neutral_band] = 2
    return labels


def train_model_multitask(ticker: str = 'VCB',
                          seed: int = SEED,
                          horizon_days: int = HORIZON_DAYS_DEFAULT,
                          neutral_band: float | None = None):
    """Huấn luyện model multi-task: regression + direction classifier.

    Args:
        ticker: mã cổ phiếu.
        seed: random seed.
        horizon_days: 1 = daily T+1; 5 = forward T+5.
        neutral_band: ngưỡng flat cho direction label.
                      None → auto: 0.001 cho horizon=1, 0.005 cho horizon=5.

    Model checkpoint: models/multitask/cnn_lstm_attn_mt_{ticker}_v1{h_suffix}.h5
    Config:         models/{ticker}_mt_config.pkl
    """
    from src.model.architecture import build_cnn_lstm_attention_multitask_model

    print(f"\n[MULTITASK] Train {ticker} horizon={horizon_days} seed={seed}\n")
    set_global_seed(seed)

    if neutral_band is None:
        neutral_band = 0.005 if horizon_days >= 5 else 0.001

    df = pd.read_csv(f'data/processed/{ticker}_features.csv')
    df = _augment_regression_features(df)

    features = list(REGRESSION_FEATURE_COLUMNS)
    target_col = 'log_return'
    if horizon_days == 1:
        df['log_return'] = np.log(df['close_winsorized'] / df['close_winsorized'].shift(1))
    else:
        df['log_return'] = np.log(
            df['close_winsorized'].shift(-horizon_days) / df['close_winsorized']
        )
    df.dropna(subset=features + [target_col], inplace=True)
    df.reset_index(drop=True, inplace=True)

    data_values = df[features].values
    target_values = df[[target_col]].values
    # Direction labels từ RAW log-return (không scale)
    direction_labels = _build_direction_labels(target_values.flatten(), neutral_band=neutral_band)

    n = len(df)
    train_end = int(n * 0.8)
    val_end = int(n * 0.9)
    train_data, val_data = data_values[:train_end], data_values[train_end:val_end]
    train_target, val_target = target_values[:train_end], target_values[train_end:val_end]
    train_dir, val_dir = direction_labels[:train_end], direction_labels[train_end:val_end]

    # Báo cáo phân bố direction để debug imbalance
    for name, arr in (('train', train_dir), ('val', val_dir)):
        unique, counts = np.unique(arr, return_counts=True)
        ratios = {int(k): f"{c/arr.size*100:.1f}%" for k, c in zip(unique, counts)}
        print(f"[MULTITASK] {name} direction dist (down/flat/up): {ratios}")

    feature_scaler = MinMaxScaler(feature_range=(0, 1))
    target_scaler = MaxAbsScaler()
    scaled_train_data = feature_scaler.fit_transform(train_data)
    scaled_train_target = target_scaler.fit_transform(train_target)
    scaled_val_data = feature_scaler.transform(val_data)
    scaled_val_target = target_scaler.transform(val_target)

    os.makedirs('models/multitask', exist_ok=True)
    # Scaler dùng chung với ensemble (đã có pkl từ ensemble train) —
    # nếu chưa có thì ghi scaler mới.
    feat_scaler_path = f'models/{ticker.lower()}_feature_scaler.pkl'
    tgt_scaler_path = f'models/{ticker.lower()}_target_scaler.pkl'
    if not os.path.exists(feat_scaler_path):
        with open(feat_scaler_path, 'wb') as f:
            pickle.dump(feature_scaler, f)
    if not os.path.exists(tgt_scaler_path):
        with open(tgt_scaler_path, 'wb') as f:
            pickle.dump(target_scaler, f)

    window_size = WINDOW_SIZE
    X_train, y_train_reg = create_sequences(scaled_train_data, scaled_train_target, window_size)
    X_val, y_val_reg = create_sequences(scaled_val_data, scaled_val_target, window_size)
    # Direction labels aligned với target sequences: y tại index i = target[i+window_size]
    y_train_dir = train_dir[window_size:window_size + len(y_train_reg)]
    y_val_dir = val_dir[window_size:window_size + len(y_val_reg)]

    model = build_cnn_lstm_attention_multitask_model((window_size, len(features)))

    h_suffix = "" if horizon_days == 1 else f"_h{horizon_days}"
    ckpt_path = f'models/multitask/cnn_lstm_attn_mt_{ticker.lower()}_v1{h_suffix}.h5'
    early_stop = EarlyStopping(monitor='val_loss', patience=20,
                               restore_best_weights=True, verbose=1)
    checkpoint = ModelCheckpoint(ckpt_path, monitor='val_loss',
                                 save_best_only=True, verbose=1)
    reduce_lr = ReduceLROnPlateau(monitor='val_loss', factor=0.5,
                                  patience=10, min_lr=0.00001, verbose=1)

    history = model.fit(
        X_train,
        {'regression_output': y_train_reg, 'direction_output': y_train_dir},
        validation_data=(X_val,
                         {'regression_output': y_val_reg, 'direction_output': y_val_dir}),
        epochs=150,
        batch_size=16,
        callbacks=[early_stop, checkpoint, reduce_lr],
        verbose=1,
    )
    best_val_loss = float(min(history.history.get('val_loss', [float('inf')])))
    best_val_dir_acc = float(max(history.history.get('val_direction_output_accuracy',
                                                      [0.0])))
    print(f"[MULTITASK] {ticker} best val_loss={best_val_loss:.4f} "
          f"best val_dir_acc={best_val_dir_acc*100:.2f}%")

    config_payload = {
        "prediction_mode": "multitask_regression_direction",
        "ticker": ticker.upper(),
        "window_size": int(window_size),
        "feature_columns": list(features),
        "target_column": target_col,
        "target_type": "log_return",
        "seed": int(seed),
        "target_scaler_range": [-1, 1],
        "horizon_days": int(horizon_days),
        "neutral_band": float(neutral_band),
        "multitask_model_path": ckpt_path,
        "multitask_best_val_loss": best_val_loss,
        "multitask_best_val_dir_acc": best_val_dir_acc,
        "ensemble_file_suffix": h_suffix,
    }
    with open(f'models/{ticker.lower()}_mt_config.pkl', 'wb') as f:
        pickle.dump(config_payload, f)
    print(f"[MULTITASK] Saved {ckpt_path}")


def load_multitask_model(ticker: str):
    """Load multitask model + config nếu tồn tại.

    Returns:
        (model, cfg) — model None nếu chưa train.
    """
    from tensorflow.keras.models import load_model as _load_model
    from src.model.architecture import AttentionLayer as _AttentionLayer

    cfg_path = f'models/{ticker.lower()}_mt_config.pkl'
    if not os.path.exists(cfg_path):
        return None, None
    with open(cfg_path, 'rb') as f:
        cfg = pickle.load(f)
    path = cfg.get('multitask_model_path')
    if not path or not os.path.exists(path):
        return None, cfg
    model = _load_model(path,
                        custom_objects={'AttentionLayer': _AttentionLayer},
                        compile=False)
    return model, cfg


def predict_multitask(model, X: np.ndarray) -> dict:
    """Multitask prediction → {'regression': (N,1), 'direction_probs': (N,3),
                               'direction_class': (N,)}"""
    out = model.predict(X, verbose=0)
    # Keras dict-output: out là dict {'regression_output': ..., 'direction_output': ...}
    reg = out.get('regression_output') if isinstance(out, dict) else out[0]
    dir_probs = out.get('direction_output') if isinstance(out, dict) else out[1]
    dir_class = np.argmax(dir_probs, axis=1)
    return {
        'regression': reg,
        'direction_probs': dir_probs,
        'direction_class': dir_class,
    }


if __name__ == "__main__":
    # Mặc định: train ensemble cho cả 10 mã (dùng ENSEMBLE_SEEDS).
    # Nếu muốn single-seed baseline, gọi train_model(ticker) thay vì train_model_ensemble.
    tickers = ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB']
    for ticker in tickers:
        print(f"\n{'='*50}")
        print(f"Bắt đầu huấn luyện ENSEMBLE cho mã: {ticker}")
        print(f"{'='*50}\n")
        train_model_ensemble(ticker)

# python src\model\train.py (command to run the training)
