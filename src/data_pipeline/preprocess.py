"""
Script tạo file features.csv cho mỗi mã cổ phiếu.
Đọc từ database SQLite → tính các chỉ báo kỹ thuật → lưu ra CSV.

Cách chạy:
    python src/data_pipeline/preprocess.py                  # Tất cả mã
    python src/data_pipeline/preprocess.py --tickers MBB TCB # Chỉ MBB, TCB
"""
import os
import sys
import numpy as np
import pandas as pd

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from src.backend.database import SessionLocal, StockPrice

TICKERS = ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB']
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '../../data/processed')
OPTIONAL_FOREIGN_COLUMNS = ['foreign_buy_volume', 'foreign_sell_volume', 'foreign_net_volume']


def compute_rsi(series, period=14):
    """Tính RSI theo phương pháp trung bình lũy thừa."""
    delta = series.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def causal_winsorize(series, window=252, lower_q=0.01, upper_q=0.99, min_periods=20):
    """
    Winsorize theo cửa sổ lùi (chỉ dùng dữ liệu quá khứ) để giảm leakage.
    """
    rolling_lower = series.rolling(window=window, min_periods=min_periods).quantile(lower_q)
    rolling_upper = series.rolling(window=window, min_periods=min_periods).quantile(upper_q)
    lower = rolling_lower.combine_first(series.expanding(min_periods=1).min())
    upper = rolling_upper.combine_first(series.expanding(min_periods=1).max())
    return series.clip(lower=lower, upper=upper)


def process_ticker(ticker):
    """Tiền xử lý dữ liệu cho một mã cổ phiếu."""
    print(f"  Đang xử lý {ticker}...")
    db = SessionLocal()

    records = (
        db.query(StockPrice)
        .filter(StockPrice.ticker == ticker)
        .order_by(StockPrice.time.asc())
        .all()
    )
    db.close()

    if not records:
        print(f"  ⚠️ {ticker}: Không có dữ liệu trong database. Bỏ qua.")
        return False

    df = pd.DataFrame([{
        'time': r.time,
        'open': r.open,
        'high': r.high,
        'low': r.low,
        'close': r.close,
        'volume': r.volume,
        'foreign_buy_volume': getattr(r, 'foreign_buy_volume', None),
        'foreign_sell_volume': getattr(r, 'foreign_sell_volume', None),
        'foreign_net_volume': getattr(r, 'foreign_net_volume', None),
    } for r in records])

    df = df.sort_values('time').reset_index(drop=True)

    # Điền dữ liệu theo chiều thời gian để không nhìn tương lai.
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
        df[col] = df[col].ffill()

    for col in OPTIONAL_FOREIGN_COLUMNS:
        if col in df.columns and not df[col].isna().all():
            df[col] = df[col].fillna(0).astype(int)

    # Loại dòng chưa đủ dữ liệu sau ffill.
    df = df.dropna(subset=['open', 'high', 'low', 'close', 'volume']).reset_index(drop=True)

    # Winsorization nhân quả (rolling past-only) để tránh leakage.
    df['close_winsorized'] = causal_winsorize(df['close'])

    # Chỉ báo kỹ thuật
    df['sma_10'] = df['close_winsorized'].rolling(window=10).mean()
    df['sma_20'] = df['close_winsorized'].rolling(window=20).mean()
    df['rsi_14'] = compute_rsi(df['close_winsorized'], 14)

    # Bỏ NaN do rolling
    required_columns = ['open', 'high', 'low', 'close', 'volume', 'close_winsorized', 'sma_10', 'sma_20', 'rsi_14']
    df = df.dropna(subset=required_columns).reset_index(drop=True)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f'{ticker}_features.csv')
    df.to_csv(out_path, index=False)
    print(f"  ✅ {ticker}: Lưu {len(df)} dòng → {out_path}")
    return True


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Tiền xử lý dữ liệu cổ phiếu ngân hàng')
    parser.add_argument('--tickers', nargs='+', default=TICKERS, help='Danh sách mã (mặc định: tất cả)')
    args = parser.parse_args()

    print("🔄 Bắt đầu tiền xử lý dữ liệu...\n")
    success = 0
    for t in args.tickers:
        if process_ticker(t.upper()):
            success += 1
    print(f"\n🎉 Hoàn tất! {success}/{len(args.tickers)} mã được xử lý thành công.")
