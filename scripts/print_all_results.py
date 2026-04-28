"""
In toàn bộ số liệu cần thiết cho Chapter IV.
Chạy từ thư mục Demo/:
    python scripts/print_all_results.py
"""
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np
import pandas as pd
import pickle

# ─────────────────────────────────────────────────────────────
# BẢNG 4.1 — Kết quả hồi quy (RMSE, MAE, MAPE, R²)
# Source: chạy inference ensemble trên tập test 10%
# ─────────────────────────────────────────────────────────────
print("=" * 60)
print("BANG 4.1: Ket qua du bao hoi quy (tap test ngoai mau)")
print("=" * 60)

from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
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
        X.append(data[i:i+window_size])
        y.append(target[i+window_size])
    return np.array(X), np.array(y)

def get_regression_metrics(ticker):
    df = pd.read_csv(f"data/processed/{ticker}_features.csv")
    cfg_path = f"models/{ticker.lower()}_reg_config.pkl"
    features = list(pickle.load(open(cfg_path,"rb")).get("feature_columns", DEFAULT_FEATURES)) \
               if os.path.exists(cfg_path) else list(DEFAULT_FEATURES)
    df = _augment_regression_features(df)
    if any(c in features for c in ("benchmark_return_1d","rank_return_1d","alpha_1d_vs_peer")):
        df = _augment_cross_sectional_features(df, ticker)
    df["log_return"] = np.log(df["close_winsorized"] / df["close_winsorized"].shift(1))
    df.dropna(subset=features+["log_return","close_winsorized"], inplace=True)
    df.reset_index(drop=True, inplace=True)
    n = len(df); val_end = int(n*0.9)
    test_data   = df[features].values[val_end:]
    test_target = df[["log_return"]].values[val_end:]
    test_prices = df["close_winsorized"].values[val_end:]
    feat_scaler = pickle.load(open(f"models/{ticker.lower()}_feature_scaler.pkl","rb"))
    tgt_scaler  = pickle.load(open(f"models/{ticker.lower()}_target_scaler.pkl","rb"))
    X_test, _ = create_sequences(feat_scaler.transform(test_data),
                                  tgt_scaler.transform(test_target))
    models, _ = load_ensemble_models(ticker)
    pred_scaled = predict_ensemble(models, X_test)
    pred_lr  = tgt_scaler.inverse_transform(pred_scaled).flatten()
    prev_p   = test_prices[29:29+len(pred_lr)]
    actual_p = test_prices[30:30+len(pred_lr)]
    pred_p   = prev_p * np.exp(pred_lr)
    rmse = np.sqrt(mean_squared_error(actual_p, pred_p))
    mae  = mean_absolute_error(actual_p, pred_p)
    mape = np.mean(np.abs((actual_p-pred_p)/actual_p))*100
    r2   = r2_score(actual_p, pred_p)
    da   = np.mean(np.sign(actual_p-prev_p)==np.sign(pred_p-prev_p))*100
    # Giá lưu đơn vị nghìn đồng → × 1000 ra VND thực
    return rmse*1000, mae*1000, mape, r2, da

print(f"{'Ma CK':<8} {'RMSE (VND)':>12} {'MAE (VND)':>12} {'MAPE (%)':>10} {'R2':>8} {'DA (%)':>8}")
print("-"*60)
for t in ["VCB","BID","CTG"]:
    rmse, mae, mape, r2, da = get_regression_metrics(t)
    print(f"{t:<8} {rmse:>12,.0f} {mae:>12,.0f} {mape:>10.2f} {r2:>8.4f} {da:>8.2f}")

# ─────────────────────────────────────────────────────────────
# BẢNG 4.2 & 4.3 — Walk-Forward DA_full và DA@cov20
# Source: models/walkforward_ensemble/{ticker}_windows.csv
# ─────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("BANG 4.2: DA_full (%) tung cua so Walk-Forward")
print("=" * 60)

wf = {}
for t in ["VCB","BID","CTG"]:
    wf[t] = pd.read_csv(f"models/walkforward_ensemble/{t}_windows.csv")

print(f"{'Cua so':<10}", end="")
for t in ["VCB","BID","CTG"]:
    print(f"{t:>10}", end="")
print()
print("-"*40)
for w in range(5):
    print(f"W{w+1:<9}", end="")
    for t in ["VCB","BID","CTG"]:
        val = wf[t]["da_full"].iloc[w]*100
        print(f"{val:>9.1f}%", end="")
    print()
print("-"*40)
print(f"{'TB':.<10}", end="")
for t in ["VCB","BID","CTG"]:
    avg = wf[t]["da_full"].mean()*100
    print(f"{avg:>9.1f}%", end="")
print()

print()
print("=" * 60)
print("BANG 4.3: DA@cov20 (%) + Temperature Scaling (CTG)")
print("=" * 60)
print(f"{'Cua so':<10}", end="")
for t in ["VCB","BID","CTG"]:
    print(f"{t:>10}", end="")
print(f"{'T_CTG':>10}")
print("-"*50)
for w in range(5):
    print(f"W{w+1:<9}", end="")
    for t in ["VCB","BID","CTG"]:
        val = wf[t]["da_cov20"].iloc[w]*100
        print(f"{val:>9.1f}%", end="")
    t_ctg = wf["CTG"]["temperature"].iloc[w]
    print(f"{t_ctg:>10.3f}")
print("-"*50)
print(f"{'TB':.<10}", end="")
for t in ["VCB","BID","CTG"]:
    avg = wf[t]["da_cov20"].mean()*100
    print(f"{avg:>9.1f}%", end="")
print()

# ─────────────────────────────────────────────────────────────
# BẢNG 4.4 / 4.5 / 4.6 — Ablation Study
# Source: models/ablation/{ticker}/{ticker}_ablation_results.csv
# ─────────────────────────────────────────────────────────────
label_map = {
    "lstm_only":          "LSTM only",
    "cnn_only":           "CNN only",
    "attention_only":     "Attention only",
    "cnn_lstm":           "CNN + LSTM",
    "lstm_attention":     "LSTM + Attention",
    "cnn_attention":      "CNN + Attention",
    "cnn_lstm_attention": "CNN-LSTM-Attention (*)",
}

for t in ["VCB","BID","CTG"]:
    print()
    print("=" * 70)
    print(f"BANG 4.{['VCB','BID','CTG'].index(t)+4}: Ablation Study — Ma {t}")
    print("=" * 70)
    df = pd.read_csv(f"models/ablation/{t}/{t}_ablation_results.csv")
    print(f"{'Bien the':<26} {'RMSE':>8} {'MAE':>8} {'MAPE(%)':>9} {'R2':>8} {'DA(%)':>8}")
    print("-"*70)
    for _, row in df.iterrows():
        label = label_map.get(row["model_name"], row["model_name"])
        marker = " <-- de xuat" if row["model_name"]=="cnn_lstm_attention" else ""
        print(f"{label:<26} {row['RMSE']:>8.4f} {row['MAE']:>8.4f} "
              f"{row['MAPE']:>9.4f} {row['R2']:>8.4f} {row['DA']:>8.2f}{marker}")

print()
print("=" * 60)
print("XONG — Tat ca so lieu cho 6 bang Chapter IV")
print("=" * 60)
