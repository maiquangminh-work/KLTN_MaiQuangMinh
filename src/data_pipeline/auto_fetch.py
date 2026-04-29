import schedule
import time
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy import or_
# Nạp class cốt lõi của thế hệ thư viện mới
from vnstock import Vnstock 
import sys
import os

# Trỏ đường dẫn để Python nhận diện được thư mục src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from src.backend.database import SessionLocal, StockPrice

TICKERS = ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB']
OPTIONAL_FOREIGN_COLUMNS = ['foreign_buy_volume', 'foreign_sell_volume', 'foreign_net_volume']
BACKFILL_FOREIGN_HISTORY = os.getenv('BACKFILL_FOREIGN_HISTORY', '0').strip().lower() in {'1', 'true', 'yes', 'on'}


def _optional_int(row, column_name):
    if column_name not in row.index:
        return None
    value = row.get(column_name)
    if pd.isna(value):
        return None
    try:
        return int(round(float(value)))
    except Exception:
        return None


def _first_missing_foreign_record(db, ticker):
    return (
        db.query(StockPrice)
        .filter(StockPrice.ticker == ticker)
        .filter(
            or_(
                StockPrice.foreign_buy_volume.is_(None),
                StockPrice.foreign_sell_volume.is_(None),
            )
        )
        .order_by(StockPrice.time.asc())
        .first()
    )


def _fetch_history_with_optional_foreign(stock, start_date, end_date):
    try:
        return stock.quote.history(
            start=start_date,
            end=end_date,
            interval='1D',
            get_all=True,
        )
    except TypeError:
        return stock.quote.history(start=start_date, end=end_date, interval='1D')

def update_database():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Bắt đầu tiến trình cập nhật dữ liệu...")
    db = SessionLocal()
    
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    for ticker in TICKERS:
        try:
            # 1. Tìm ngày gần nhất đã lưu trong Database
            last_record = db.query(StockPrice).filter(StockPrice.ticker == ticker).order_by(StockPrice.time.desc()).first()
            
            if last_record:
                # Nếu đã có data, chỉ kéo từ ngày tiếp theo
                next_price_date = (last_record.time + timedelta(days=1)).strftime('%Y-%m-%d')
            else:
                # Nếu database trống, kéo từ 2016
                next_price_date = '2016-01-01'
            missing_foreign_record = _first_missing_foreign_record(db, ticker) if BACKFILL_FOREIGN_HISTORY else None
            if BACKFILL_FOREIGN_HISTORY and missing_foreign_record:
                start_date = min(next_price_date, missing_foreign_record.time.strftime('%Y-%m-%d'))
            else:
                start_date = next_price_date

            if start_date > today_str:
                print(f"{ticker}: Dữ liệu đã được cập nhật mới nhất.")
                continue
                
            # 2. Gọi API vnstock (CÚ PHÁP MỚI CỦA BẢN V3)
            print(f"Đang kéo dữ liệu {ticker} từ {start_date} đến {today_str}...")
            
            # Khởi tạo đối tượng mã chứng khoán (KBS là nguồn ổn định nhất hiện tại)
            stock = Vnstock().stock(symbol=ticker, source='KBS')
            
            # Trích xuất dữ liệu giá lịch sử
            df = _fetch_history_with_optional_foreign(stock, start_date, today_str)
            
            if df is None or df.empty:
                print(f"⚠️ {ticker}: Không có dữ liệu giao dịch mới (có thể là ngày nghỉ).")
                continue
                
            # Chuẩn hóa tên cột về chữ thường để tránh lỗi viết hoa/thường (Time vs time)
            df.columns = [col.lower() for col in df.columns]
            has_foreign_history = any(column in df.columns for column in OPTIONAL_FOREIGN_COLUMNS)
            if 'foreign_net_volume' not in df.columns and {'foreign_buy_volume', 'foreign_sell_volume'}.issubset(df.columns):
                df['foreign_net_volume'] = df['foreign_buy_volume'] - df['foreign_sell_volume']
                
            # 3. Ghi dữ liệu mới vào Database
            inserted_count = 0
            updated_count = 0
            foreign_count = 0
            for _, row in df.iterrows():
                # Xử lý linh hoạt định dạng thời gian
                time_val = row['time']
                if isinstance(time_val, str):
                    trade_date = datetime.strptime(time_val[:10], '%Y-%m-%d').date()
                else:
                    trade_date = time_val.date() # Nếu đã là object datetime
                
                record = (
                    db.query(StockPrice)
                    .filter(StockPrice.ticker == ticker, StockPrice.time == trade_date)
                    .first()
                )
                if record is None:
                    record = StockPrice(ticker=ticker, time=trade_date)
                    db.add(record)
                    inserted_count += 1
                else:
                    updated_count += 1

                record.open = row['open']
                record.high = row['high']
                record.low = row['low']
                record.close = row['close']
                record.volume = row['volume']

                foreign_buy_volume = _optional_int(row, 'foreign_buy_volume')
                foreign_sell_volume = _optional_int(row, 'foreign_sell_volume')
                foreign_net_volume = _optional_int(row, 'foreign_net_volume')
                if foreign_net_volume is None and foreign_buy_volume is not None and foreign_sell_volume is not None:
                    foreign_net_volume = foreign_buy_volume - foreign_sell_volume

                if foreign_buy_volume is not None or foreign_sell_volume is not None or foreign_net_volume is not None:
                    record.foreign_buy_volume = foreign_buy_volume
                    record.foreign_sell_volume = foreign_sell_volume
                    record.foreign_net_volume = foreign_net_volume
                    record.foreign_data_source = 'KBS'
                    foreign_count += 1
                
            db.commit()
            if has_foreign_history:
                print(f"{ticker}: Them {inserted_count}, cap nhat {updated_count}, DTNN {foreign_count} dong.")
            else:
                print(f"{ticker}: Them {inserted_count}, cap nhat {updated_count}. Nguon khong tra DTNN lich su.")
            records = [None] * inserted_count
            print(f"✅ {ticker}: Đã chèn thêm {len(records)} dòng vào Database.")
            
        except Exception as e:
            print(f"Lỗi khi cập nhật {ticker}: {e}")
            db.rollback()
            
    db.close()
    print("🎉 Hoàn tất tiến trình cập nhật!\n")

# Lập lịch tự động chạy vào 01:00 AM mỗi sáng
schedule.every().day.at("01:00").do(update_database)

if __name__ == "__main__":
    print("Hệ thống Tự động cập nhật Dữ liệu đã khởi động!")
    print("Đang chạy thử lần đầu tiên để đồng bộ Database...")
    update_database() 
    
    print("Đang chờ đến lịch chạy tiếp theo (01:00 AM hàng ngày)... Nhấn Ctrl+C để thoát.")
    while True:
        schedule.run_pending()
        time.sleep(60)
