"""
Cấu hình tập trung cho hệ thống dự báo giá cổ phiếu ngân hàng.

Phạm vi nghiên cứu chính của khóa luận là 3 mã quốc doanh: VCB, BID, CTG.
Hệ thống demo mở rộng thêm 7 mã ngân hàng khác để chứng minh khả năng mở rộng.
"""

# ── Danh sách 10 mã cổ phiếu ngân hàng được hệ thống hỗ trợ ─────────────────
SUPPORTED_TICKERS = [
    'VCB', 'BID', 'CTG',           # Phạm vi nghiên cứu chính
    'MBB', 'TCB', 'VPB',           # Nhóm mở rộng demo
    'ACB', 'HDB', 'SHB', 'VIB',    # Nhóm mở rộng demo
]

# Nhóm dùng làm trọng tâm khóa luận và ablation study.
PRIMARY_RESEARCH_TICKERS = ['VCB', 'BID', 'CTG']

# Các mã hiện có model/scaler trong thư mục models.
TRAINED_TICKERS = SUPPORTED_TICKERS

# Thông tin ngân hàng 
BANK_NAMES = {
    'VCB': 'Ngân hàng TMCP Ngoại thương Việt Nam',
    'BID': 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
    'CTG': 'Ngân hàng TMCP Công thương Việt Nam',
    'MBB': 'Ngân hàng TMCP Quân đội',
    'TCB': 'Ngân hàng TMCP Kỹ thương Việt Nam',
    'VPB': 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    'ACB': 'Ngân hàng TMCP Á Châu',
    'HDB': 'Ngân hàng TMCP Phát triển TP. Hồ Chí Minh',
    'SHB': 'Ngân hàng TMCP Sài Gòn - Hà Nội',
    'VIB': 'Ngân hàng TMCP Quốc tế Việt Nam',
}

BANK_WEBSITES = {
    'VCB': 'https://www.vietcombank.com.vn',
    'BID': 'https://bidv.com.vn',
    'CTG': 'https://www.vietinbank.vn',
    'MBB': 'https://www.mbbank.com.vn',
    'TCB': 'https://techcombank.com',
    'VPB': 'https://www.vpbank.com.vn',
    'ACB': 'https://www.acb.com.vn',
    'HDB': 'https://www.hdbank.com.vn',
    'SHB': 'https://www.shb.com.vn',
    'VIB': 'https://www.vib.com.vn',
}

BANK_LOGOS = {
    'VCB': 'https://cdn.haitrieu.com/wp-content/uploads/2022/02/Logo-Vietcombank.png',
    'BID': 'https://news.mbbank.com.vn/file-service/uploads/v1/images/c21788de-1a22-48e0-a4ca-7bda44d5b2b4-logo-bidv-20220426071253.jpg',
    'CTG': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-VietinBank-CTG-Slo.png',
    'MBB': 'https://api.vietqr.io/img/MB.png',
    'TCB': 'https://api.vietqr.io/img/TCB.png',
    'VPB': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-VPBank.png',
    'ACB': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-ACB.png',
    'HDB': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-HDBank.png',
    'SHB': 'https://api.vietqr.io/img/SHB.png',
    'VIB': 'https://upload.wikimedia.org/wikipedia/commons/5/55/LOGO-VIB-Blue.png',
}

NEWS_ALIASES = {
    'VCB': ['vcb', 'vietcombank', 'ngoại thương'],
    'BID': ['bid', 'bidv', 'đầu tư và phát triển'],
    'CTG': ['ctg', 'vietinbank', 'công thương'],
    'MBB': ['mbb', 'mb bank', 'mb', 'quân đội'],
    'TCB': ['tcb', 'techcombank', 'kỹ thương'],
    'VPB': ['vpb', 'vpbank', 'việt nam thịnh vượng'],
    'ACB': ['acb', 'á châu', 'asia commercial'],
    'HDB': ['hdb', 'hdbank', 'phát triển tphcm'],
    'SHB': ['shb', 'sài gòn hà nội'],
    'VIB': ['vib', 'quốc tế'],
}

# Tham số mô hình 
DEFAULT_FORECAST_STEPS = 15   # 15 ngày giao dịch ≈ 3 tuần
WINDOW_SIZE = 30              # Cửa sổ quan sát
FEATURES = [
    'open', 'high', 'low', 'close_winsorized',
    'volume', 'sma_10', 'sma_20', 'rsi_14',
]
