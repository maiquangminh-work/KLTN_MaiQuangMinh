"""
Hình 4.2: Directional Accuracy theo từng cửa sổ Walk-Forward (3 mã).
Kết quả: scripts/figures/hinh_4_2_da_results.png
"""
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
os.chdir(PROJECT_ROOT)

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["axes.unicode_minus"] = False
FONT = "Times New Roman"

tickers = ["VCB", "BID", "CTG"]
colors  = {"VCB": "#1f4e79", "BID": "#922b21", "CTG": "#117a65"}

data = {}
for t in tickers:
    df = pd.read_csv(
        os.path.join("models", "walkforward_ensemble", f"{t}_windows.csv"))
    data[t] = df

windows = [1, 2, 3, 4, 5]
x = np.arange(len(windows))
width = 0.25

fig, axes = plt.subplots(1, 2, figsize=(13, 5), sharey=False)
fig.suptitle("Hình 4.2: Directional Accuracy theo từng cửa sổ Walk-Forward",
             fontsize=12, fontweight="bold", fontfamily=FONT)

# Panel A — DA_full
ax = axes[0]
for i, t in enumerate(tickers):
    vals = data[t]["da_full"].values * 100
    bars = ax.bar(x + i * width, vals, width,
                  label=t, color=colors[t], alpha=0.85,
                  edgecolor="#2C3E50", linewidth=0.6)
    for bar, v in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.8, f"{v:.0f}",
                ha="center", va="bottom", fontsize=7.5, fontfamily=FONT)

ax.axhline(50, color="red", linewidth=1.2, linestyle="--",
           label="Ngưỡng ngẫu nhiên (50%)")
ax.set_xticks(x + width)
ax.set_xticklabels([f"Cửa sổ {w}" for w in windows],
                   fontsize=9.5, fontfamily=FONT)
ax.set_ylabel("DA (%)", fontsize=10, fontfamily=FONT)
ax.set_title("(A) Độ chính xác định hướng toàn bộ (DA_full)",
             fontsize=10.5, fontfamily=FONT)
ax.set_ylim(0, 105)
ax.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=100, decimals=0))
ax.legend(fontsize=9, prop={"family": FONT, "size": 9}, loc="upper right")
ax.grid(axis="y", alpha=0.3, linestyle="--")

# Panel B — DA@cov20
ax = axes[1]
for i, t in enumerate(tickers):
    vals = data[t]["da_cov20"].values * 100
    bars = ax.bar(x + i * width, vals, width,
                  label=t, color=colors[t], alpha=0.85,
                  edgecolor="#2C3E50", linewidth=0.6)
    for bar, v in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.8, f"{v:.0f}",
                ha="center", va="bottom", fontsize=7.5, fontfamily=FONT)

ax.axhline(50, color="red", linewidth=1.2, linestyle="--",
           label="Ngưỡng ngẫu nhiên (50%)")
ax.set_xticks(x + width)
ax.set_xticklabels([f"Cửa sổ {w}" for w in windows],
                   fontsize=9.5, fontfamily=FONT)
ax.set_ylabel("DA@cov20 (%)", fontsize=10, fontfamily=FONT)
ax.set_title("(B) Độ chính xác có lọc độ tin cậy (DA@cov20)",
             fontsize=10.5, fontfamily=FONT)
ax.set_ylim(0, 115)
ax.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=100, decimals=0))
ax.legend(fontsize=9, prop={"family": FONT, "size": 9}, loc="upper right")
ax.grid(axis="y", alpha=0.3, linestyle="--")

# Trung bình tổng hợp ghi chú dưới
avgs = {t: (data[t]["da_full"].mean()*100, data[t]["da_cov20"].mean()*100)
        for t in tickers}
note = "  |  ".join(
    f"{t}: DA={a:.1f}%  DA@cov20={b:.1f}%" for t, (a, b) in avgs.items())
fig.text(0.5, -0.01, f"Trung bình 5 cửa sổ — {note}",
         ha="center", fontsize=9, fontstyle="italic", fontfamily=FONT,
         color="#555555")

plt.tight_layout(pad=1.2)
out_dir  = os.path.join("scripts", "figures")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "hinh_4_2_da_results.png")
plt.savefig(out_path, dpi=200, bbox_inches="tight", facecolor="white")
print(f"[Saved]: {out_path}")
