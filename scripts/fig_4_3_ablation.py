"""
Hình 4.3: Kết quả Ablation Study — So sánh 7 biến thể mô hình (mã VCB).
Kết quả: scripts/figures/hinh_4_3_ablation.png
"""
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
os.chdir(PROJECT_ROOT)

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["axes.unicode_minus"] = False
FONT = "Times New Roman"

df = pd.read_csv(os.path.join("models", "ablation", "VCB", "VCB_ablation_results.csv"))

# Nhãn thân thiện
label_map = {
    "lstm_only":         "LSTM\n(gốc)",
    "cnn_only":          "CNN\n(gốc)",
    "attention_only":    "Attention\n(gốc)",
    "cnn_lstm":          "CNN +\nLSTM",
    "lstm_attention":    "LSTM +\nAttention",
    "cnn_attention":     "CNN +\nAttention",
    "cnn_lstm_attention":"CNN–LSTM–\nAttention\n(đề xuất)",
}
df["label"] = df["model_name"].map(label_map)

# Màu: model đề xuất nổi bật
highlight = "cnn_lstm_attention"
colors = ["#AED6F1" if m != highlight else "#1f4e79" for m in df["model_name"]]
ec     = ["#2C3E50"] * len(df)

fig, axes = plt.subplots(1, 3, figsize=(14, 5))
fig.suptitle("Hình 4.3: Ablation Study — So sánh kiến trúc mô hình (mã VCB)",
             fontsize=12, fontweight="bold", fontfamily=FONT)

# --- Panel A: RMSE ---
ax = axes[0]
bars = ax.bar(df["label"], df["RMSE"], color=colors, edgecolor=ec, linewidth=0.7)
for bar, v in zip(bars, df["RMSE"]):
    ax.text(bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.0005, f"{v:.4f}",
            ha="center", va="bottom", fontsize=7.5, fontfamily=FONT)
ax.set_title("(A) RMSE (đơn vị chuẩn hóa)",
             fontsize=10, fontfamily=FONT)
ax.set_ylabel("RMSE", fontsize=10, fontfamily=FONT)
ax.set_ylim(0.94, 0.985)
ax.grid(axis="y", alpha=0.3, linestyle="--")
ax.tick_params(axis="x", labelsize=8)

# --- Panel B: R² ---
ax = axes[1]
bars = ax.bar(df["label"], df["R2"], color=colors, edgecolor=ec, linewidth=0.7)
for bar, v in zip(bars, df["R2"]):
    ax.text(bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.00003, f"{v:.4f}",
            ha="center", va="bottom", fontsize=7.5, fontfamily=FONT)
ax.set_title("(B) Hệ số xác định R²",
             fontsize=10, fontfamily=FONT)
ax.set_ylabel("R²", fontsize=10, fontfamily=FONT)
ax.set_ylim(0.924, 0.930)
ax.grid(axis="y", alpha=0.3, linestyle="--")
ax.tick_params(axis="x", labelsize=8)

# --- Panel C: DA (%) ---
ax = axes[2]
bars = ax.bar(df["label"], df["DA"], color=colors, edgecolor=ec, linewidth=0.7)
ax.axhline(50, color="red", linewidth=1.1, linestyle="--",
           label="Ngưỡng ngẫu nhiên 50%")
for bar, v in zip(bars, df["DA"]):
    ax.text(bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.3, f"{v:.1f}",
            ha="center", va="bottom", fontsize=7.5, fontfamily=FONT)
ax.set_title("(C) Directional Accuracy (%)",
             fontsize=10, fontfamily=FONT)
ax.set_ylabel("DA (%)", fontsize=10, fontfamily=FONT)
ax.set_ylim(30, 52)
ax.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=100, decimals=0))
ax.grid(axis="y", alpha=0.3, linestyle="--")
ax.legend(fontsize=8.5, prop={"family": FONT, "size": 8.5})
ax.tick_params(axis="x", labelsize=8)

# Ghi chú mô hình đề xuất
from matplotlib.patches import Patch
legend_elem = [
    Patch(facecolor="#1f4e79", edgecolor="#2C3E50", label="Mô hình đề xuất (CNN–LSTM–Attention)"),
    Patch(facecolor="#AED6F1", edgecolor="#2C3E50", label="Biến thể ablation"),
]
fig.legend(handles=legend_elem, loc="lower center", ncol=2,
           bbox_to_anchor=(0.5, -0.06),
           prop={"family": FONT, "size": 9}, framealpha=0.9)

plt.tight_layout(pad=1.2)
out_dir  = os.path.join("scripts", "figures")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "hinh_4_3_ablation.png")
plt.savefig(out_path, dpi=200, bbox_inches="tight", facecolor="white")
print(f"[Saved]: {out_path}")
