"""
Hình 2.3: So sánh tính dừng giữa chuỗi giá gốc và chuỗi log-return của VCB.

Minh họa trực quan tính phi dừng của chuỗi giá tuyệt đối và tính gần dừng
của chuỗi log-return, sử dụng trong mục 2.1.5 của báo cáo KLTN.
Kết quả kiểm định Augmented Dickey-Fuller được hiển thị trực tiếp trên hình.

Cách chạy:
    cd D:/.vscode/KLTN/Demo/scripts
    PYTHONIOENCODING=utf-8 python fig_2_3_stationarity.py

Kết quả:
    scripts/figures/hinh_2_3_stationarity.png
"""
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from statsmodels.tsa.stattools import adfuller

# Tự xác định thư mục gốc dự án (cha của scripts/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
os.chdir(PROJECT_ROOT)

# Cấu hình font hỗ trợ tiếng Việt có dấu
plt.rcParams["font.family"] = "DejaVu Sans"
plt.rcParams["axes.unicode_minus"] = False

# Đọc dữ liệu giá VCB và tính log-return
csv_path = os.path.join("data", "processed", "VCB_features.csv")
df = pd.read_csv(csv_path)
df["time"] = pd.to_datetime(df["time"])
df["log_return"] = np.log(df["close"] / df["close"].shift(1))
df = df.dropna(subset=["log_return"]).reset_index(drop=True)

# Kiểm định Augmented Dickey-Fuller cho cả hai chuỗi
adf_gia = adfuller(df["close"].dropna())
adf_logret = adfuller(df["log_return"].dropna())

# Tạo thư mục lưu hình
out_dir = os.path.join("scripts", "figures")
os.makedirs(out_dir, exist_ok=True)

# Vẽ biểu đồ hai panel chia sẻ trục thời gian
fig, axes = plt.subplots(2, 1, figsize=(12, 7), sharex=True)

# Panel A: Chuỗi giá gốc (không dừng)
ax1 = axes[0]
ax1.plot(df["time"], df["close"], color="#c0392b", linewidth=1.2)
ax1.set_title("Panel A: Chuỗi giá đóng cửa VCB (chuỗi không dừng)",
              fontsize=12, fontweight="bold")
ax1.set_ylabel("Giá (nghìn đồng)", fontsize=11)
ax1.grid(True, alpha=0.3, linestyle="--")

# Hộp kết quả ADF cho panel A
text_adf_gia = (f"Kiểm định ADF:\n"
                f"  Statistic: {adf_gia[0]:.4f}\n"
                f"  p-value:   {adf_gia[1]:.4f}\n"
                f"  Kết luận:  Không dừng")
ax1.text(0.99, 0.97, text_adf_gia, transform=ax1.transAxes,
         verticalalignment="top", horizontalalignment="right",
         fontsize=9, family="DejaVu Sans",
         bbox=dict(boxstyle="round,pad=0.5", facecolor="#fdebd0",
                   edgecolor="#e67e22", alpha=0.95))

# Panel B: Chuỗi log-return (gần dừng)
ax2 = axes[1]
ax2.plot(df["time"], df["log_return"], color="#1f4e79",
         linewidth=0.6, alpha=0.8)
ax2.axhline(y=0, color="black", linewidth=0.5, alpha=0.5)
ax2.set_title("Panel B: Chuỗi log-return VCB (chuỗi gần dừng)",
              fontsize=12, fontweight="bold")
ax2.set_ylabel("Log-return", fontsize=11)
ax2.set_xlabel("Thời gian", fontsize=11)
ax2.grid(True, alpha=0.3, linestyle="--")

# Hộp kết quả ADF cho panel B
text_adf_logret = (f"Kiểm định ADF:\n"
                   f"  Statistic: {adf_logret[0]:.4f}\n"
                   f"  p-value:   {adf_logret[1]:.4f}\n"
                   f"  Kết luận:  Dừng")
ax2.text(0.99, 0.97, text_adf_logret, transform=ax2.transAxes,
         verticalalignment="top", horizontalalignment="right",
         fontsize=9, family="DejaVu Sans",
         bbox=dict(boxstyle="round,pad=0.5", facecolor="#d5f5e3",
                   edgecolor="#27ae60", alpha=0.95))

# Định dạng trục thời gian theo năm
ax2.xaxis.set_major_locator(mdates.YearLocator())
ax2.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))

plt.tight_layout()

# Lưu hình ra file
out_path = os.path.join(out_dir, "hinh_2_3_stationarity.png")
plt.savefig(out_path, dpi=200, bbox_inches="tight")

# In kết quả ra console
print(f"[Đã lưu hình]: {out_path}")
print(f"Số quan sát: {len(df)}")
print()
print(f"Kiểm định ADF — Chuỗi giá gốc:")
print(f"  Statistic = {adf_gia[0]:.4f}, p-value = {adf_gia[1]:.4f}")
print(f"  Ngưỡng 5%: {adf_gia[4]['5%']:.4f}")
ket_luan_gia = "KHÔNG dừng (chuỗi có nghiệm đơn vị)" if adf_gia[1] > 0.05 else "DỪNG"
print(f"  Kết luận: {ket_luan_gia}")
print()
print(f"Kiểm định ADF — Chuỗi log-return:")
print(f"  Statistic = {adf_logret[0]:.4f}, p-value = {adf_logret[1]:.4f}")
print(f"  Ngưỡng 5%: {adf_logret[4]['5%']:.4f}")
ket_luan_logret = "KHÔNG dừng" if adf_logret[1] > 0.05 else "DỪNG (bác bỏ giả thuyết có nghiệm đơn vị)"
print(f"  Kết luận: {ket_luan_logret}")
