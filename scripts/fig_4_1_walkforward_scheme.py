"""
Hình 4.1: Sơ đồ Walk-Forward Validation 5 cửa sổ.
Kết quả: scripts/figures/hinh_4_1_walkforward_scheme.png
"""
import os
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
os.chdir(PROJECT_ROOT)

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["axes.unicode_minus"] = False

FONT = "Times New Roman"

# Màu sắc
C_TRAIN = "#AED6F1"   # xanh dương — huấn luyện
C_VAL   = "#A9DFBF"   # xanh lá   — kiểm định
C_TEST  = "#F1948A"   # đỏ        — kiểm tra
C_EDGE  = "#2C3E50"

# 5 cửa sổ, mỗi cửa sổ gồm 3 đoạn (train 756, val 126, test 63)
# Đơn vị: ngày giao dịch (quy đổi theo tỉ lệ để vẽ)
TRAIN = 756
VAL   = 126
TEST  = 63
SLIDE = 63

fig, ax = plt.subplots(figsize=(12, 4.5))
ax.set_xlim(0, 1050)
ax.set_ylim(-0.3, 5.8)
ax.axis("off")

ax.set_title("Hình 4.1: Sơ đồ Walk-Forward Validation — 5 cửa sổ không chồng lấp",
             fontsize=12, fontweight="bold", fontfamily=FONT, pad=10)

ROW_H  = 0.72   # chiều cao mỗi cửa sổ
ROW_Y  = [4.7, 3.7, 2.7, 1.7, 0.7]  # y đáy từng hàng

SCALE  = 1050 / (TRAIN + VAL + TEST + 4 * SLIDE)   # ~1.0

for i in range(5):
    offset = i * SLIDE * SCALE
    y      = ROW_Y[i]
    label  = f"Cửa sổ {i+1}"

    # Nhãn hàng
    ax.text(-5, y + ROW_H / 2, label,
            ha="right", va="center", fontsize=9.5, fontfamily=FONT)

    # Train
    x0 = offset
    w  = TRAIN * SCALE
    ax.add_patch(mpatches.FancyBboxPatch(
        (x0, y), w, ROW_H,
        boxstyle="round,pad=0.01",
        facecolor=C_TRAIN, edgecolor=C_EDGE, lw=0.8))
    ax.text(x0 + w / 2, y + ROW_H / 2,
            f"Huấn luyện\n(756 ngày)",
            ha="center", va="center", fontsize=8.5, fontfamily=FONT)

    # Val
    x0 += w
    w   = VAL * SCALE
    ax.add_patch(mpatches.FancyBboxPatch(
        (x0, y), w, ROW_H,
        boxstyle="round,pad=0.01",
        facecolor=C_VAL, edgecolor=C_EDGE, lw=0.8))
    ax.text(x0 + w / 2, y + ROW_H / 2,
            f"Kiểm định\n(126 ngày)",
            ha="center", va="center", fontsize=8.5, fontfamily=FONT)

    # Test
    x0 += w
    w   = TEST * SCALE
    ax.add_patch(mpatches.FancyBboxPatch(
        (x0, y), w, ROW_H,
        boxstyle="round,pad=0.01",
        facecolor=C_TEST, edgecolor=C_EDGE, lw=0.8))
    ax.text(x0 + w / 2, y + ROW_H / 2,
            f"Kiểm tra\n(63 ngày)",
            ha="center", va="center", fontsize=8.5, fontfamily=FONT)

# Chú thích màu
patches = [
    mpatches.Patch(facecolor=C_TRAIN, edgecolor=C_EDGE, label="Tập huấn luyện (756 ngày)"),
    mpatches.Patch(facecolor=C_VAL,   edgecolor=C_EDGE, label="Tập kiểm định (126 ngày)"),
    mpatches.Patch(facecolor=C_TEST,  edgecolor=C_EDGE, label="Tập kiểm tra  (63 ngày)"),
]
ax.legend(handles=patches, loc="lower right",
          bbox_to_anchor=(1.0, -0.04),
          fontsize=9, framealpha=0.9,
          prop={"family": FONT, "size": 9})

# Chú thích mũi tên trượt
for i in range(4):
    x_arrow = (i * SLIDE + TRAIN + VAL + TEST / 2) * SCALE
    ax.annotate("", xy=(x_arrow + SLIDE * SCALE, ROW_Y[i + 1] + ROW_H + 0.05),
                xytext=(x_arrow, ROW_Y[i] - 0.05),
                arrowprops=dict(arrowstyle="-|>", color="#888888",
                                lw=1.0, connectionstyle="arc3,rad=0.3"))

ax.text(530, 0.1, "← Trượt tiến 63 ngày sau mỗi cửa sổ →",
        ha="center", va="center", fontsize=9,
        fontstyle="italic", fontfamily=FONT, color="#555555")

plt.tight_layout(pad=0.5)
out_dir  = os.path.join("scripts", "figures")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "hinh_4_1_walkforward_scheme.png")
plt.savefig(out_path, dpi=200, bbox_inches="tight", facecolor="white")
print(f"[Đã lưu]: {out_path}")
