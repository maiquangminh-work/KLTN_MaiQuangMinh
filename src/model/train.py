import os
import sys
import numpy as np
import pandas as pd
import pickle
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from src.model.architecture import build_cnn_lstm_attention_model

def create_sequences(data, target, window_size=30):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i:(i + window_size)])
        y.append(target[i + window_size])
    return np.array(X), np.array(y)

def train_model(ticker='VCB'):
    print(f"Huấn luyện cấu trúc Sai phân (Differencing) cho {ticker}...\n")
    
    df = pd.read_csv(f'data/processed/{ticker}_features.csv')
    
    # KỸ THUẬT CỐT LÕI: Tạo biến mục tiêu là Sự chênh lệch giá (Sai phân)
    df['price_diff'] = df['close_winsorized'].diff()
    df.dropna(inplace=True) # Xóa dòng NaN đầu tiên do phép trừ
    df.reset_index(drop=True, inplace=True)
    
    # Sử dụng 8 đặc trưng gốc làm bệ phóng
    features = ['open', 'high', 'low', 'close_winsorized', 'volume', 'sma_10', 'sma_20', 'rsi_14']
    target_col = 'price_diff' # AI giờ sẽ học cách dự báo biến động
    
    data_values = df[features].values
    target_values = df[[target_col]].values
    
    n = len(df)
    train_end = int(n * 0.8)
    val_end = int(n * 0.9)
    
    train_data = data_values[:train_end]
    val_data = data_values[train_end:val_end]
    train_target = target_values[:train_end]
    val_target = target_values[train_end:val_end]
    
    # Feature scale bình thường, Target scale từ -1 đến 1 vì biến động có thể âm/dương
    feature_scaler = MinMaxScaler(feature_range=(0, 1))
    target_scaler = MinMaxScaler(feature_range=(-1, 1)) 
    
    scaled_train_data = feature_scaler.fit_transform(train_data)
    scaled_train_target = target_scaler.fit_transform(train_target)
    scaled_val_data = feature_scaler.transform(val_data)
    scaled_val_target = target_scaler.transform(val_target)
    
    os.makedirs('models', exist_ok=True)
    with open(f'models/{ticker.lower()}_feature_scaler.pkl', 'wb') as f:
        pickle.dump(feature_scaler, f)
    with open(f'models/{ticker.lower()}_target_scaler.pkl', 'wb') as f:
        pickle.dump(target_scaler, f)
        
    window_size = 30
    X_train, y_train = create_sequences(scaled_train_data, scaled_train_target, window_size)
    X_val, y_val = create_sequences(scaled_val_data, scaled_val_target, window_size)
    
    # Khởi tạo nguyên bản kiến trúc CNN-LSTM-Attention
    model = build_cnn_lstm_attention_model((window_size, len(features)))
    
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
    
if __name__ == "__main__":
    tickers = ['VCB', 'BID', 'CTG']
    for ticker in tickers:
        print(f"\n{'='*50}")
        print(f"BẮT ĐẦU HUẤN LUYỆN TỰ ĐỘNG CHO MÃ: {ticker}")
        print(f"{'='*50}\n")
        train_model(ticker)