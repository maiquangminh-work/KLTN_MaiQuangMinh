"""
Script chẩn đoán hiện tượng lag-1 (persistence problem) của mô hình.

Mục tiêu trả lời 2 câu hỏi:
  1. Sai số T+1 (1-step-ahead) của mô hình so với GIÁ THỰC là bao nhiêu %?
  2. Mô hình có thực sự "biết dự báo" hay chỉ học pattern "ngày mai = hôm nay"?

Cách kiểm tra:
  - So sánh Mô hình AI vs Naive baseline (giả thuyết: predicted_diff = 0)
  - Nếu MAE / MAPE của AI ~ Naive  -> mô hình KHÔNG có giá trị dự báo thực
  - Nếu DA của AI > 55%             -> mô hình có signal hữu ích
  - Lag-1 correlation cao (>0.95)   -> persistence problem rõ rệt

Cách chạy:
  cd D:\\.vscode\\KLTN\\Demo
  python -m src.model.diagnostic_lag1
"""
import os
import sys
import numpy as np
import pandas as pd
import pickle
from sklearn.metrics import mean_absolute_error, mean_squared_error
from tensorflow.keras.models import load_model

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from src.model.architecture import AttentionLayer
from src.model.train import (
    REGRESSION_FEATURE_COLUMNS as DEFAULT_FEATURES,
    _augment_regression_features,
    _augment_cross_sectional_features,
    load_ensemble_models,
    predict_ensemble,
)
from src.model.confidence import (
    fit_temperature,
    compute_confidence_scores,
    find_optimal_threshold,
    evaluate_gate,
)


WINDOW_SIZE = 30
TARGET_COL = 'log_return'
PRICE_COL = 'close_winsorized'


def _resolve_features(ticker: str):
    """Đọc reg_config.pkl để biết feature list đúng của model; fallback DEFAULT_FEATURES."""
    cfg_path = f'models/{ticker.lower()}_reg_config.pkl'
    if os.path.exists(cfg_path):
        with open(cfg_path, 'rb') as f:
            cfg = pickle.load(f)
        feats = cfg.get('feature_columns')
        if feats:
            return list(feats)
    return list(DEFAULT_FEATURES)


def _resolve_horizon(ticker: str) -> int:
    """Đọc horizon_days từ reg_config.pkl. Default 1 cho backward compat."""
    cfg_path = f'models/{ticker.lower()}_reg_config.pkl'
    if os.path.exists(cfg_path):
        with open(cfg_path, 'rb') as f:
            cfg = pickle.load(f)
        return int(cfg.get('horizon_days', 1))
    return 1


def create_sequences(data, target, window_size=WINDOW_SIZE):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i:(i + window_size)])
        y.append(target[i + window_size])
    return np.array(X), np.array(y)


def metrics_block(name, actual, predicted, actual_diff, predicted_diff):
    mae = mean_absolute_error(actual, predicted)
    rmse = np.sqrt(mean_squared_error(actual, predicted))
    mape = np.mean(np.abs((actual - predicted) / actual)) * 100
    # Directional Accuracy: dự đoán đúng dấu (tăng / giảm)
    da = np.mean(np.sign(actual_diff) == np.sign(predicted_diff)) * 100
    return {
        'name': name,
        'MAE_kVND': mae,                  # đơn vị nghìn đồng
        'MAE_VND': mae * 1000,            # đơn vị đồng (dễ đọc với người dùng)
        'RMSE_VND': rmse * 1000,
        'MAPE_%': mape,
        'DA_%': da,
    }


def diagnose(ticker='VCB'):
    csv_path = f'data/processed/{ticker}_features.csv'
    model_path = f'models/cnn_lstm_attn_{ticker.lower()}_v1.h5'
    fs_path = f'models/{ticker.lower()}_feature_scaler.pkl'
    ts_path = f'models/{ticker.lower()}_target_scaler.pkl'
    cfg_path = f'models/{ticker.lower()}_reg_config.pkl'

    # Cần CSV + scalers. Model: chấp nhận single HOẶC ensemble
    # — mã mới train sau có thể chỉ có ensemble, chưa có file single.
    has_single = os.path.exists(model_path)
    has_ensemble = False
    if os.path.exists(cfg_path):
        with open(cfg_path, 'rb') as f:
            _cfg_peek = pickle.load(f)
        if _cfg_peek.get('ensemble_seeds'):
            # Kiểm tra ít nhất 1 file ensemble tồn tại
            h_suffix = _cfg_peek.get('ensemble_file_suffix', '')
            ens_dir = _cfg_peek.get('ensemble_dir', 'models/ensemble')
            for seed in _cfg_peek['ensemble_seeds']:
                ens_path = f'{ens_dir}/cnn_lstm_attn_{ticker.lower()}_v1{h_suffix}_s{seed}.h5'
                if os.path.exists(ens_path):
                    has_ensemble = True
                    break

    if not (os.path.exists(csv_path) and (has_single or has_ensemble)
            and os.path.exists(fs_path) and os.path.exists(ts_path)):
        print(f"[SKIP] {ticker}: thiếu file "
              f"(csv={os.path.exists(csv_path)}, "
              f"single={has_single}, ensemble={has_ensemble}, "
              f"fscaler={os.path.exists(fs_path)}, tscaler={os.path.exists(ts_path)}).")
        return None

    features = _resolve_features(ticker)
    horizon_days = _resolve_horizon(ticker)

    df = pd.read_csv(csv_path)
    df = _augment_regression_features(df)
    # Chỉ augment cross-sectional nếu feature list của model (đọc từ reg_config) yêu cầu
    if any(col in features for col in ('benchmark_return_1d', 'rank_return_1d', 'alpha_1d_vs_peer')):
        df = _augment_cross_sectional_features(df, ticker)
    # Target theo horizon
    if horizon_days == 1:
        df['log_return'] = np.log(df[PRICE_COL] / df[PRICE_COL].shift(1))
    else:
        df['log_return'] = np.log(df[PRICE_COL].shift(-horizon_days) / df[PRICE_COL])
    df.dropna(subset=features + [TARGET_COL, PRICE_COL], inplace=True)
    df.reset_index(drop=True, inplace=True)

    n = len(df)
    val_end = int(n * 0.9)

    test_data = df[features].values[val_end:]
    test_target = df[[TARGET_COL]].values[val_end:]
    test_prices = df[PRICE_COL].values[val_end:]

    with open(fs_path, 'rb') as f:
        feature_scaler = pickle.load(f)
    with open(ts_path, 'rb') as f:
        target_scaler = pickle.load(f)

    scaled_test_data = feature_scaler.transform(test_data)
    scaled_test_target = target_scaler.transform(test_target)
    X_test, _ = create_sequences(scaled_test_data, scaled_test_target)

    # ─── Ưu tiên ensemble nếu có, fallback single model ─────────────────
    ensemble_models, _cfg = load_ensemble_models(ticker)
    if ensemble_models:
        print(f"[ENSEMBLE] {ticker}: dùng {len(ensemble_models)} models averaging")
        out_shape = ensemble_models[0].output_shape
        if out_shape[-1] != 1:
            print(f"[SKIP] {ticker}: ensemble model[0] output_shape={out_shape} "
                  "không phải regression (phải 1D).")
            return None
        predicted_scaled = predict_ensemble(ensemble_models, X_test)
    else:
        model = load_model(model_path,
                           custom_objects={'AttentionLayer': AttentionLayer},
                           compile=False)
        out_shape = model.output_shape
        if out_shape[-1] != 1:
            print(f"[SKIP] {ticker}: {model_path} không phải model hồi quy "
                  f"(output_shape={out_shape}). Hãy huấn luyện lại bằng "
                  f"`python -m src.model.train` trước khi chạy diagnostic.")
            return None
        predicted_scaled = model.predict(X_test, verbose=0)

    # Mô hình dự đoán log_return (chuỗi stationary) — scaled → raw
    predicted_log_return_ai = target_scaler.inverse_transform(predicted_scaled).flatten()

    # ─── Xây dựng actual/previous tuỳ theo horizon ───────────────────────
    # Với horizon=1: target[i] = log(P_{i} / P_{i-1}), predict tại window ending i-1
    #   previous = price[i-1], actual = price[i]
    # Với horizon=H (H>1): target[i] = log(P_{i+H} / P_{i}), predict tại window ending i
    #   previous = price[i] (= reference), actual = price[i+H]
    N = len(predicted_log_return_ai)
    if horizon_days == 1:
        previous_prices = test_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + N]
        actual_prices = test_prices[WINDOW_SIZE: WINDOW_SIZE + N]
    else:
        # test_prices alignment: target đã shift(-H) và dropna ở trên,
        # nên test_prices[WINDOW_SIZE - 1 + k] = ref_price tại window ending k
        # và actual_prices[k] = test_prices[WINDOW_SIZE - 1 + k + H]
        previous_prices = test_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + N]
        actual_idx_end = WINDOW_SIZE - 1 + horizon_days + N
        available = len(test_prices) - (WINDOW_SIZE - 1 + horizon_days)
        N_safe = min(N, max(0, available))
        previous_prices = previous_prices[:N_safe]
        actual_prices = test_prices[WINDOW_SIZE - 1 + horizon_days:
                                    WINDOW_SIZE - 1 + horizon_days + N_safe]
        predicted_log_return_ai = predicted_log_return_ai[:N_safe]
    actual_diff = actual_prices - previous_prices

    # ── Mô hình AI: tái tạo giá qua exp(log_return) ─────────────────────
    predicted_prices_ai = previous_prices * np.exp(predicted_log_return_ai)
    predicted_diff_ai = predicted_prices_ai - previous_prices
    horizon_label = f"AI (h={horizon_days})" if horizon_days > 1 else "AI (CNN-LSTM-Attn)"
    res_ai = metrics_block(horizon_label,
                           actual_prices, predicted_prices_ai,
                           actual_diff, predicted_diff_ai)

    # ── Naive baseline: dự đoán "ngày mai = hôm nay" (log_return = 0)
    predicted_log_return_naive = np.zeros_like(predicted_log_return_ai)
    predicted_prices_naive = previous_prices * np.exp(predicted_log_return_naive)  # = previous_prices
    predicted_diff_naive = predicted_prices_naive - previous_prices
    naive_label = f"Naive (P_t+{horizon_days} = P_t)" if horizon_days > 1 else "Naive (T+1 = T)"
    res_naive = metrics_block(naive_label,
                              actual_prices, predicted_prices_naive,
                              actual_diff, predicted_diff_naive)

    # ── Drift baseline: dự đoán = trung bình log_return trên train
    train_log_return = df['log_return'].values[:val_end]
    drift = np.nanmean(train_log_return)
    predicted_log_return_drift = np.full_like(predicted_log_return_ai, drift)
    predicted_prices_drift = previous_prices * np.exp(predicted_log_return_drift)
    predicted_diff_drift = predicted_prices_drift - previous_prices
    res_drift = metrics_block('Drift (mean log-ret)',
                              actual_prices, predicted_prices_drift,
                              actual_diff, predicted_diff_drift)

    # ── Phân tích persistence ───────────────────────────────────────────
    # lag-1 correlation: nếu predicted_price(t) ≈ actual_price(t-1) thì lag-1 ~ 1
    lag1_corr = np.corrcoef(predicted_prices_ai, previous_prices)[0, 1]
    # correlation giữa predicted_diff và actual_diff
    diff_corr = np.corrcoef(predicted_diff_ai, actual_diff)[0, 1]
    # tỉ lệ predicted_diff có cùng dấu với actual_diff
    sign_match = np.mean(np.sign(predicted_diff_ai) == np.sign(actual_diff)) * 100
    # độ lớn dự báo so với độ lớn thực tế
    ai_diff_std = np.std(predicted_diff_ai) * 1000   # VND
    actual_diff_std = np.std(actual_diff) * 1000     # VND

    print("\n" + "=" * 78)
    print(f"  CHẨN ĐOÁN MÔ HÌNH — {ticker}")
    print("=" * 78)
    rows = [res_ai, res_naive, res_drift]
    print(f"{'Mô hình':<25}{'MAE (VNĐ)':>14}{'RMSE (VNĐ)':>14}{'MAPE (%)':>12}{'DA (%)':>10}")
    print("-" * 78)
    for r in rows:
        print(f"{r['name']:<25}{r['MAE_VND']:>14,.0f}{r['RMSE_VND']:>14,.0f}"
              f"{r['MAPE_%']:>12.2f}{r['DA_%']:>10.2f}")
    print("-" * 78)

    # So sánh AI với naive
    mae_ratio = res_ai['MAE_VND'] / res_naive['MAE_VND']
    print(f"\n  >> AI / Naive MAE ratio  : {mae_ratio:.3f}  "
          f"({'TỐT HƠN' if mae_ratio < 1 else 'KHÔNG tốt hơn'} naive)")
    print(f"  >> Lag-1 corr (pred vs prev_actual): {lag1_corr:.4f}  "
          f"({'PERSISTENCE rõ rệt' if lag1_corr > 0.99 else 'OK'})")
    print(f"  >> Correlation predicted_diff vs actual_diff: {diff_corr:.4f}")
    print(f"  >> Std(predicted_diff): {ai_diff_std:>9,.0f} VNĐ "
          f"|  Std(actual_diff): {actual_diff_std:>9,.0f} VNĐ")
    print(f"  >> AI dự báo biên độ chỉ bằng {ai_diff_std/actual_diff_std*100:.1f}% biên độ thực")

    if lag1_corr > 0.995 and abs(diff_corr) < 0.15:
        print(f"\n  [CẢNH BÁO] Mô hình {ticker} đang bị persistence — "
              "predicted_price gần như sao chép giá hôm trước.")
    elif res_ai['DA_%'] > 55 and mae_ratio < 0.95:
        print(f"\n  [TỐT] Mô hình {ticker} có signal dự báo thực sự "
              "(DA > 55% và MAE thấp hơn naive).")
    else:
        print(f"\n  [TRUNG BÌNH] Mô hình {ticker} có DA gần 50%, "
              "MAE tương đương naive — cần cải thiện feature engineering.")

    # ─── Confidence Gate Analysis ────────────────────────────────────────
    # Ý tưởng: lọc ra những tín hiệu có |predicted_log_return| lớn (model
    # tự tin), đo DA trên subset đó. Nếu DA tăng đáng kể → gate có giá trị
    # (filter noise, giữ signal) → model hữu ích cho giao dịch thực.
    true_log_return = np.log(actual_prices / previous_prices)
    # Reference std = std của log-return train (phân biệt rõ signal vs noise
    # theo thang đo tự nhiên của chuỗi).
    train_log_return_clean = train_log_return[~np.isnan(train_log_return)]
    ref_std = float(np.std(train_log_return_clean)) if train_log_return_clean.size > 0 else None

    # Fit temperature trên VAL set để calibrate magnitude
    val_data_vals = df[features].values[int(n * 0.8):val_end]
    val_target_vals = df[[TARGET_COL]].values[int(n * 0.8):val_end]
    val_prices = df[PRICE_COL].values[int(n * 0.8):val_end]
    scaled_val = feature_scaler.transform(val_data_vals)
    scaled_val_tgt = target_scaler.transform(val_target_vals)
    X_val, _ = create_sequences(scaled_val, scaled_val_tgt)
    if len(X_val) > 0:
        if ensemble_models:
            val_pred_scaled = predict_ensemble(ensemble_models, X_val)
        else:
            val_pred_scaled = model.predict(X_val, verbose=0)
        val_pred_log = target_scaler.inverse_transform(val_pred_scaled).flatten()
        # Val true log-return: tuỳ horizon
        Nv = len(val_pred_log)
        if horizon_days == 1:
            val_prev = val_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + Nv]
            val_act = val_prices[WINDOW_SIZE: WINDOW_SIZE + Nv]
        else:
            avail = len(val_prices) - (WINDOW_SIZE - 1 + horizon_days)
            Nv_safe = min(Nv, max(0, avail))
            val_prev = val_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + Nv_safe]
            val_act = val_prices[WINDOW_SIZE - 1 + horizon_days:
                                 WINDOW_SIZE - 1 + horizon_days + Nv_safe]
            val_pred_log = val_pred_log[:Nv_safe]
        val_true_log = np.log(val_act / val_prev) if len(val_prev) > 0 else np.array([])
        T = fit_temperature(val_pred_log, val_true_log) if val_true_log.size > 0 else 1.0
    else:
        T = 1.0
        val_pred_log = np.array([])
        val_true_log = np.array([])

    # Áp dụng temperature lên test predictions rồi phân tích gate
    scaled_pred = predicted_log_return_ai * T
    gate_results = find_optimal_threshold(
        scaled_pred, true_log_return,
        coverage_targets=(0.5, 0.3, 0.2, 0.1),
        reference_std=ref_std,
    )

    print("\n" + "─" * 78)
    print(f"  CONFIDENCE GATE ANALYSIS — {ticker} (Temperature T={T:.3f})")
    print("─" * 78)
    print(f"  {'Coverage':<18}{'Threshold':>12}{'N trades':>12}"
          f"{'Coverage act':>15}{'DA (%)':>10}")
    print("  " + "-" * 74)
    # Sort: baseline_full đầu tiên, sau đó coverage giảm dần
    order = ['baseline_full']
    for t in (50, 30, 20, 10):
        order.append(f'coverage_{t}')
    for key in order:
        if key not in gate_results:
            continue
        g = gate_results[key]
        label = 'BASELINE (full)' if key == 'baseline_full' else key.replace('_', ' ')
        print(f"  {label:<18}{g['threshold']:>12.4f}{g['n']:>12}"
              f"{g['coverage_actual']*100:>14.1f}%"
              f"{g['da']:>10.2f}")
    print("  " + "-" * 74)
    # Phân tích mức tăng DA ở coverage 20% (sweet spot thường gặp)
    if 'coverage_20' in gate_results:
        base_da = gate_results['baseline_full']['da']
        gated_da = gate_results['coverage_20']['da']
        uplift = gated_da - base_da
        flag = '🚀 GATE HỮU ÍCH' if uplift >= 3.0 else ('✓ GATE OK' if uplift >= 0 else '✗ GATE KHÔNG TĂNG DA')
        print(f"\n  >> DA uplift (cov20% vs full): {uplift:+.2f} điểm % — {flag}")

    return {
        'ticker': ticker,
        'ai': res_ai, 'naive': res_naive, 'drift': res_drift,
        'lag1_corr': lag1_corr, 'diff_corr': diff_corr,
        'sign_match': sign_match,
        'ai_diff_std': ai_diff_std, 'actual_diff_std': actual_diff_std,
        'temperature': float(T),
        'gate': gate_results,
    }


if __name__ == "__main__":
    tickers = ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB']
    summary = []
    for tk in tickers:
        try:
            r = diagnose(tk)
            if r is not None:
                summary.append(r)
        except Exception as e:
            print(f"[ERROR] {tk}: {e}")

    # Bảng tổng hợp
    if summary:
        print("\n\n" + "#" * 88)
        print("  TỔNG HỢP TOÀN BỘ MÃ")
        print("#" * 88)
        print(f"{'Ticker':<8}{'AI MAE':>10}{'Naive MAE':>12}{'AI/Naive':>10}"
              f"{'AI MAPE':>10}{'AI DA':>9}{'Lag-1':>9}{'Pred/Real σ':>12}"
              f"{'Gate20% DA':>12}")
        print("-" * 88)
        for r in summary:
            ratio = r['ai']['MAE_VND'] / r['naive']['MAE_VND']
            sigma_ratio = r['ai_diff_std'] / r['actual_diff_std'] * 100
            gate20 = r.get('gate', {}).get('coverage_20', {}).get('da')
            gate20_str = f"{gate20:>11.1f}%" if gate20 is not None else f"{'--':>12}"
            print(f"{r['ticker']:<8}"
                  f"{r['ai']['MAE_VND']:>10,.0f}"
                  f"{r['naive']['MAE_VND']:>12,.0f}"
                  f"{ratio:>10.3f}"
                  f"{r['ai']['MAPE_%']:>9.2f}%"
                  f"{r['ai']['DA_%']:>8.1f}%"
                  f"{r['lag1_corr']:>9.4f}"
                  f"{sigma_ratio:>11.1f}%"
                  f"{gate20_str}")
        print("-" * 88)
        print("\nĐỌC HIỂU:")
        print("  • AI/Naive < 1.0  -> mô hình tốt hơn baseline 'ngày mai = hôm nay'")
        print("  • DA > 55%        -> dự đoán hướng tốt hơn tung đồng xu")
        print("  • Lag-1 > 0.995   -> persistence problem (chỉ sao chép giá hôm qua)")
        print("  • Pred/Real σ     -> AI dự báo biên độ bằng bao nhiêu % biên độ thực")
        print("  • Gate20% DA      -> DA khi chỉ giao dịch 20% tín hiệu tự tin nhất")
