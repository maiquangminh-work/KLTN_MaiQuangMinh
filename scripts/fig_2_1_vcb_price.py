import os
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

# Tự xác định thư mục gốc dự án (cha của scripts/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
os.chdir(PROJECT_ROOT)

# Setting tiếng việt
plt.rcParams["font.family"] = "DejaVu Sans"
plt.rcParams["axes.unicode_minus"] = False

csv_path = os.path.join("data", "processed", "VCB_features.csv")
df = pd.read_csv(csv_path)
df["time"] = pd.to_datetime(df["time"])

# Tạo output
out_dir = os.path.join("scripts", "figures")
os.makedirs(out_dir, exist_ok=True)

fig, ax = plt.subplots(figsize=(12, 4.5))
ax.plot(df["time"], df["close"], color="#1f4e79", linewidth=1.2, label="Giá đóng cửa (nghìn đồng)")

# Highlight các sự kiện quan trọng
ax.axvspan(pd.Timestamp("2020-03-01"), pd.Timestamp("2020-05-01"),
           alpha=0.15, color="red", label="COVID-19 sock")
ax.axvspan(pd.Timestamp("2022-04-01"), pd.Timestamp("2022-12-01"),
           alpha=0.15, color="orange", label="Thắt chặt tiền tệ 2022")

# Format bieu do
ax.set_title("Chuỗi giá đóng cửa của VCB (2018-2026)",
             fontsize=13, fontweight="bold", pad=12)
ax.set_xlabel("Thời gian", fontsize=11)
ax.set_ylabel("Giá (nghìn đồng)", fontsize=11)
ax.xaxis.set_major_locator(mdates.YearLocator())
ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
ax.grid(True, alpha=0.3, linestyle="--")
ax.legend(loc="upper left", fontsize=9, framealpha=0.9)

# Thêm thông tin thống kê vào góc phải trên
mean_price = df["close"].mean()
max_price = df["close"].max()
min_price = df["close"].min()
text = (f"Trung bình: {mean_price:.2f}\n"
        f"Cao nhất:  {max_price:.2f}\n"
        f"Thấp nhất: {min_price:.2f}")
ax.text(0.99, 0.97, text, transform=ax.transAxes,
        verticalalignment="top", horizontalalignment="right",
        fontsize=9, family="DejaVu Sans",
        bbox=dict(boxstyle="round,pad=0.5", facecolor="white",
                  edgecolor="gray", alpha=0.9))

plt.tight_layout()

out_path = os.path.join(out_dir, "hinh_2_1_vcb_price.png")
plt.savefig(out_path, dpi=200, bbox_inches="tight")
print(f"[Đã lưu: {out_path}")
print(f"Số quan sát: {len(df)}")
print(f"Khoảng thời gian: {df['time'].min().date()} -> {df['time'].max().date()}")
