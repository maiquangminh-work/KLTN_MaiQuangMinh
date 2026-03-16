import schedule
import time
import pandas as pd
from datetime import datetime, timedelta
# Nạp class cốt lõi của thế hệ thư viện mới
from vnstock import Vnstock 
import sys
import os

# Trỏ đường dẫn để Python nhận diện được thư mục src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from src.backend.database import SessionLocal, StockPrice

TICKERS = ['VCB', 'BID', 'CTG']

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
                start_date = (last_record.time + timedelta(days=1)).strftime('%Y-%m-%d')
            else:
                # Nếu database trống, kéo từ 2016
                start_date = '2016-01-01'
                
            if start_date > today_str:
                print(f"✅ {ticker}: Dữ liệu đã được cập nhật mới nhất.")
                continue
                
            # 2. Gọi API vnstock (CÚ PHÁP MỚI CỦA BẢN V3)
            print(f"🔄 Đang kéo dữ liệu {ticker} từ {start_date} đến {today_str}...")
            
            # Khởi tạo đối tượng mã chứng khoán (Dùng nguồn dữ liệu từ VCI - Bản Việt)
            stock = Vnstock().stock(symbol=ticker, source='VCI')
            
            # Trích xuất dữ liệu giá lịch sử
            df = stock.quote.history(start=start_date, end=today_str, interval='1D')
            
            if df is None or df.empty:
                print(f"⚠️ {ticker}: Không có dữ liệu giao dịch mới (có thể là ngày nghỉ).")
                continue
                
            # Chuẩn hóa tên cột về chữ thường để tránh lỗi viết hoa/thường (Time vs time)
            df.columns = [col.lower() for col in df.columns]
                
            # 3. Ghi dữ liệu mới vào Database
            records = []
            for _, row in df.iterrows():
                # Xử lý linh hoạt định dạng thời gian
                time_val = row['time']
                if isinstance(time_val, str):
                    trade_date = datetime.strptime(time_val[:10], '%Y-%m-%d').date()
                else:
                    trade_date = time_val.date() # Nếu đã là object datetime
                
                record = StockPrice(
                    ticker=ticker,
                    time=trade_date,
                    open=row['open'],
                    high=row['high'],
                    low=row['low'],
                    close=row['close'],
                    volume=row['volume']
                )
                records.append(record)
                
            db.bulk_save_objects(records)
            db.commit()
            print(f"✅ {ticker}: Đã chèn thêm {len(records)} dòng vào Database.")
            
        except Exception as e:
            print(f"❌ Lỗi khi cập nhật {ticker}: {e}")
            db.rollback()
            
    db.close()
    print("🎉 Hoàn tất tiến trình cập nhật!\n")

# Lập lịch tự động chạy vào 01:00 AM mỗi sáng
schedule.every().day.at("01:00").do(update_database)

if __name__ == "__main__":
    print("🚀 Hệ thống Tự động cập nhật Dữ liệu đã khởi động!")
    print("Đang chạy thử lần đầu tiên để đồng bộ Database...")
    update_database() 
    
    print("⏳ Đang chờ đến lịch chạy tiếp theo (01:00 AM hàng ngày)... Nhấn Ctrl+C để thoát.")
    while True:
        schedule.run_pending()
        time.sleep(60)