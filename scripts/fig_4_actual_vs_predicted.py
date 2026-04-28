"""
fig_4_actual_vs_predicted.py
-----------------------------
Tạo biểu đồ thesis-quality: So sánh giá đóng cửa thực tế và dự báo
cho 3 mã ngân hàng nhà nước: VCB, BID, CTG.

Chạy từ thư mục Demo/:
    python scripts/fig_4_actual_vs_predicted.py

Output: scripts/figures/hinh_4_x_actual_vs_predicted_{ticker}.png  (300 DPI)
"""

import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np
import pandas as pd
import pickle
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import matplotlib.dates as mdates

# --- Cài Times New Roman ---
plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "DejaVu Serif"],
    "font.size": 13,
    "axes.titlesize": 15,
    "axes.labelsize": 13,
    "legend.fontsize": 12,
    "xtick.labelsize": 11,
    "ytick.labelsize": 11,
})

from src.model.architecture import AttentionLayer
from src.model.train import (
    REGRESSION_FEATURE_COLUMNS as DEFAULT_FEATURES,
    _augment_regression_features,
    _augment_cross_sectional_features,
    load_ensemble_models,
    predict_ensemble,
)
from tensorflow.keras.models import load_model

OUT_DIR = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(OUT_DIR, exist_ok=True)


def create_sequences(data, target, window_size=30):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i : i + window_size])
        y.append(target[i + window_size])
    return np.array(X), np.array(y)


def generate_plot(ticker: str):
    print(f"\n[{ticker}] Dang tai du lieu va mo hinh...")

    # ---------- 1. Load data ----------
    df = pd.read_csv(f"data/processed/{ticker}_features.csv")

    cfg_path = f"models/{ticker.lower()}_reg_config.pkl"
    if os.path.exists(cfg_path):
        with open(cfg_path, "rb") as f:
            features = list(pickle.load(f).get("feature_columns", DEFAULT_FEATURES))
    else:
        features = list(DEFAULT_FEATURES)

    target_col = "log_return"
    price_col = "close_winsorized"

    df = _augment_regression_features(df)
    if any(c in features for c in ("benchmark_return_1d", "rank_return_1d", "alpha_1d_vs_peer")):
        df = _augment_cross_sectional_features(df, ticker)

    df["log_return"] = np.log(df["close_winsorized"] / df["close_winsorized"].shift(1))
    df.dropna(subset=features + [target_col, price_col], inplace=True)
    df.reset_index(drop=True, inplace=True)

    # ---------- 2. Chia tập test (last 10%) ----------
    n = len(df)
    val_end = int(n * 0.9)

    test_data   = df[features].values[val_end:]
    test_target = df[[target_col]].values[val_end:]
    test_prices = df[price_col].values[val_end:]
    test_dates  = pd.to_datetime(df["time"].iloc[val_end:]).reset_index(drop=True)

    # ---------- 3. Scale ----------
    with open(f"models/{ticker.lower()}_feature_scaler.pkl", "rb") as f:
        feat_scaler = pickle.load(f)
    with open(f"models/{ticker.lower()}_target_scaler.pkl", "rb") as f:
        tgt_scaler = pickle.load(f)

    scaled_feat = feat_scaler.transform(test_data)
    scaled_tgt  = tgt_scaler.transform(test_target)

    X_test, _ = create_sequences(scaled_feat, scaled_tgt, window_size=30)

    # ---------- 4. Predict ----------
    ensemble_models, _cfg = load_ensemble_models(ticker)
    if ensemble_models:
        print(f"  => Ensemble {len(ensemble_models)} models")
        pred_scaled = predict_ensemble(ensemble_models, X_test)
    else:
        model = load_model(
            f"models/cnn_lstm_attn_{ticker.lower()}_v1.h5",
            custom_objects={"AttentionLayer": AttentionLayer},
            compile=False,
        )
        pred_scaled = model.predict(X_test)

    pred_log_return = tgt_scaler.inverse_transform(pred_scaled).flatten()

    # ---------- 5. Reconstruct prices ----------
    # predicted_price_t = price_{t-1} * exp(log_return_pred_t)
    prev_prices   = test_prices[29 : 29 + len(pred_log_return)]
    actual_prices = test_prices[30 : 30 + len(pred_log_return)]
    pred_prices   = prev_prices * np.exp(pred_log_return)
    plot_dates    = test_dates[30 : 30 + len(pred_log_return)]

    # ---------- 6. Metrics ----------
    from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
    rmse = np.sqrt(mean_squared_error(actual_prices, pred_prices))
    mae  = mean_absolute_error(actual_prices, pred_prices)
    r2   = r2_score(actual_prices, pred_prices)
    mape = np.mean(np.abs((actual_prices - pred_prices) / actual_prices)) * 100
    actual_diff = actual_prices - prev_prices
    pred_diff   = pred_prices   - prev_prices
    da   = np.mean(np.sign(actual_diff) == np.sign(pred_diff)) * 100
    print(f"  RMSE={rmse:.2f} VND | MAE={mae:.2f} | MAPE={mape:.2f}% | R2={r2:.4f} | DA={da:.2f}%")

    # ---------- 7. Plot ----------
    fig, ax = plt.subplots(figsize=(13, 5.5))

    ax.plot(plot_dates, actual_prices, color="#1a56db", linewidth=1.6,
            label=u"Giá đóng cửa thực tế")
    ax.plot(plot_dates, pred_prices, color="#e53e3e", linewidth=1.3,
            linestyle="--", dashes=(6, 2),
            label=u"Giá dự báo (CNN-LSTM-Attention Ensemble)")

    # Y-axis: format VND (giá lưu dưới dạng nghìn đồng → × 1000)
    ax.yaxis.set_major_formatter(
        mticker.FuncFormatter(
            lambda x, _: f"{int(x * 1000):,}".replace(",", ".") + u" VNĐ"
        )
    )
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%m/%Y"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    fig.autofmt_xdate(rotation=30, ha="right")

    ax.set_title(
        u"So sánh giá đóng cửa thực tế và dự báo — Mã chứng khoán " + ticker,
        pad=10,
    )
    ax.set_xlabel(u"Thời gian")
    ax.set_ylabel(u"Giá đóng cửa (VNĐ)")
    ax.legend(loc="upper left", framealpha=0.85)
    ax.grid(True, linestyle=":", alpha=0.55, color="#aaaaaa")
    ax.set_xlim(plot_dates.iloc[0], plot_dates.iloc[-1])

    # Annotation: metrics box (RMSE convert × 1000 → đơn vị VNĐ thực)
    rmse_vnd = int(rmse * 1000)
    info_text = (
        f"RMSE = {rmse_vnd:,} VNĐ\n".replace(",", ".")
        + f"MAPE = {mape:.2f}%\n"
        + f"R²   = {r2:.4f}\n"
        + f"DA   = {da:.2f}%"
    )
    ax.text(
        0.985, 0.97, info_text,
        transform=ax.transAxes, fontsize=10,
        va="top", ha="right",
        bbox=dict(boxstyle="round,pad=0.4", facecolor="white", alpha=0.85, edgecolor="#cccccc"),
    )

    fig.tight_layout()

    # Save high-res
    out_path = os.path.join(OUT_DIR, f"hinh_4_actual_vs_predicted_{ticker}.png")
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  => Saved: {out_path}")
    return rmse, mae, mape, r2, da


if __name__ == "__main__":
    tickers = ["VCB", "BID", "CTG"]
    results = {}
    for t in tickers:
        try:
            results[t] = generate_plot(t)
        except Exception as e:
            print(f"[ERROR] {t}: {e}")
            import traceback; traceback.print_exc()

    print("\n========== TOM TAT ==========")
    for t, v in results.items():
        if v:
            print(f"  {t}: RMSE={v[0]:.2f} | MAPE={v[2]:.2f}% | R2={v[3]:.4f} | DA={v[4]:.2f}%")
