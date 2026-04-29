import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import numpy as np
import pandas as pd
import pickle
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
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

def create_sequences(data, target, window_size=30):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i:(i + window_size)])
        y.append(target[i + window_size])
    return np.array(X), np.array(y)

def evaluate_model(ticker='VCB'):
    print(f"Đang đánh giá và tái tạo đồ thị cho {ticker}...\n")
    
    df = pd.read_csv(f'data/processed/{ticker}_features.csv')

    # Đọc feature list từ reg_config.pkl (mặc định DEFAULT_FEATURES nếu config chưa có)
    cfg_path = f'models/{ticker.lower()}_reg_config.pkl'
    if os.path.exists(cfg_path):
        with open(cfg_path, 'rb') as f:
            features = list(pickle.load(f).get('feature_columns', DEFAULT_FEATURES))
    else:
        features = list(DEFAULT_FEATURES)
    target_col = 'log_return'
    price_col = 'close_winsorized' # Lấy cột giá tuyệt đối để làm cơ sở tái tạo

    # Bổ sung feature engineered nếu CSV chưa có
    df = _augment_regression_features(df)
    # Cross-sectional đã rollback — chỉ gọi nếu config model có yêu cầu cột đó
    if any(col in features for col in ('benchmark_return_1d', 'rank_return_1d', 'alpha_1d_vs_peer')):
        df = _augment_cross_sectional_features(df, ticker)
    df['log_return'] = np.log(df['close_winsorized'] / df['close_winsorized'].shift(1))
    df.dropna(subset=features + [target_col, price_col], inplace=True)
    df.reset_index(drop=True, inplace=True)
    
    data_values = df[features].values
    target_values = df[[target_col]].values
    price_values = df[price_col].values
    
    # Chia dữ liệu thành train, validation và test
    n = len(df)
    val_end = int(n * 0.9)
    
    test_data = data_values[val_end:]
    test_target = target_values[val_end:]
    test_prices = price_values[val_end:]
    
    # Lấy ngày tháng cho phần test để vẽ đồ thị
    test_dates = pd.to_datetime(df['time'].iloc[val_end:]).reset_index(drop=True)
    
    # Tải scaler đã lưu từ quá trình huấn luyện
    with open(f'models/{ticker.lower()}_feature_scaler.pkl', 'rb') as f:
        feature_scaler = pickle.load(f)
    with open(f'models/{ticker.lower()}_target_scaler.pkl', 'rb') as f:
        target_scaler = pickle.load(f)
        
    scaled_test_data = feature_scaler.transform(test_data)
    scaled_test_target = target_scaler.transform(test_target)
    
    X_test, _ = create_sequences(scaled_test_data, scaled_test_target, window_size=30)
    
    # Ưu tiên ensemble nếu có, fallback single model
    ensemble_models, _cfg = load_ensemble_models(ticker)
    if ensemble_models:
        print(f"[ENSEMBLE] Đánh giá với {len(ensemble_models)} models")
        predicted_scaled = predict_ensemble(ensemble_models, X_test)
    else:
        model = load_model(f'models/cnn_lstm_attn_{ticker.lower()}_v1.h5',
                           custom_objects={'AttentionLayer': AttentionLayer},
                           compile=False)
        predicted_scaled = model.predict(X_test)
    predicted_log_return = target_scaler.inverse_transform(predicted_scaled).flatten()

    # Tái tạo giá từ log-return: P_t = P_{t-1} * exp(pred_log_return)
    previous_prices = test_prices[29 : 29 + len(predicted_log_return)]
    actual_prices = test_prices[30 : 30 + len(predicted_log_return)]  # ground truth

    predicted_prices = previous_prices * np.exp(predicted_log_return)
    predicted_diff = predicted_prices - previous_prices  # delta giá dùng để tính DA

    # Tính RMSE, MAE, R², MAPE, DA trên tập test
    rmse = np.sqrt(mean_squared_error(actual_prices, predicted_prices))
    mae = mean_absolute_error(actual_prices, predicted_prices)
    r2 = r2_score(actual_prices, predicted_prices)
    mape = np.mean(np.abs((actual_prices - predicted_prices) / actual_prices)) * 100
    # Tính Directional Accuracy (DA): so sánh dấu của delta giá
    actual_diff = actual_prices - previous_prices          # ground-truth price change
    da = np.mean(np.sign(actual_diff) == np.sign(predicted_diff)) * 100
    
    plot_dates = test_dates[30 : 30 + len(predicted_diff)] # Ngày tháng tương ứng với phần test đã tái tạo
    
    print("\n" + "="*40)
    print(f"KẾT QUẢ ĐÁNH GIÁ ĐÃ KHẮC PHỤC ĐỘ TRỄ ({ticker})")
    print("="*40)
    print(f"🔹 RMSE : {rmse:.2f} VNĐ")
    print(f"🔹 MAE  : {mae:.2f} VNĐ")
    print(f"🔹 MAPE : {mape:.2f} %")
    print(f"🔹 R²   : {r2:.4f}")
    print("="*40 + "\n")
    print(f"🔹 DA   : {da:.2f} %")
    
    plt.figure(figsize=(14, 7))
    plt.plot(plot_dates, actual_prices, color='blue', label='Giá Thực Tế')
    plt.plot(plot_dates, predicted_prices, color='red', linestyle='--', label='AI Dự Báo (Sai phân tái tạo)')
    
    plt.title(f'So sánh Giá Thực tế và Dự báo({ticker})', fontsize=16)
    plt.xlabel('Thời gian', fontsize=12)
    plt.ylabel('Giá đóng cửa (VNĐ)', fontsize=12)
    plt.legend(fontsize=12)
    plt.grid(True, linestyle=':', alpha=0.7)
    
    plot_path = f'models/{ticker.lower()}_final_plot.png'
    ax = plt.gca() # Định dạng trục y để hiển thị giá theo chuẩn VNĐ
    formatter = mticker.FuncFormatter(lambda x, pos: f"{int(x * 1000):,} VNĐ".replace(',', '.'))
    ax.yaxis.set_major_formatter(formatter)
    
    plt.savefig(plot_path)
    plt.show()

if __name__ == "__main__":
    tickers = ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB']
    for ticker in tickers:
        evaluate_model(ticker)
