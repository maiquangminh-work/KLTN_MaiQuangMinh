import os
import sys
import pandas as pd

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from src.backend.database import SessionLocal, CompanyProfile
from vnstock import Vnstock

TICKERS = ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB']

# Thông tin cơ bản
STATIC_INFO = {
    'VCB': {
        'name': 'Ngân hàng Thương mại cổ phần Ngoại thương Việt Nam',
        'first_listed_shares': '112,285,426',
        'logo': 'https://cdn.haitrieu.com/wp-content/uploads/2022/02/Logo-Vietcombank.png'
    },
    'BID': {
        'name': 'Ngân hàng Thương mại cổ phần Đầu tư và Phát triển Việt Nam',
        'first_listed_shares': '2,811,202,644',
        'logo': 'https://news.mbbank.com.vn/file-service/uploads/v1/images/c21788de-1a22-48e0-a4ca-7bda44d5b2b4-logo-bidv-20220426071253.jpg'
    },
    'CTG': {
        'name': 'Ngân hàng Thương mại cổ phần Công thương Việt Nam',
        'first_listed_shares': '121,211,780',
        'logo': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-VietinBank-CTG-Slo.png'
    },
    'MBB': {
        'name': 'Ngân hàng Thương mại cổ phần Quân đội',
        'first_listed_shares': '100,000,000',
        'logo': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-MB-Bank-MBB.png'
    },
    'TCB': {
        'name': 'Ngân hàng Thương mại cổ phần Kỹ thương Việt Nam',
        'first_listed_shares': '350,000,000',
        'logo': 'https://cdn.haitrieu.com/wp-content/uploads/2022/02/Logo-Techcombank-Ori.png'
    },
    'VPB': {
        'name': 'Ngân hàng Thương mại cổ phần Việt Nam Thịnh Vượng',
        'first_listed_shares': '1,330,000,000',
        'logo': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-VPBank.png'
    },
    'ACB': {
        'name': 'Ngân hàng Thương mại cổ phần Á Châu',
        'first_listed_shares': '110,000,000',
        'logo': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-ACB.png'
    },
    'HDB': {
        'name': 'Ngân hàng Thương mại cổ phần Phát triển TP. Hồ Chí Minh',
        'first_listed_shares': '98,100,000',
        'logo': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-HDBank.png'
    },
    'SHB': {
        'name': 'Ngân hàng Thương mại cổ phần Sài Gòn - Hà Nội',
        'first_listed_shares': '500,000,000',
        'logo': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-SHB.png'
    },
    'VIB': {
        'name': 'Ngân hàng Thương mại cổ phần Quốc tế Việt Nam',
        'first_listed_shares': '188,500,000',
        'logo': 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-VIB.png'
    },
}

def fetch_company_profiles():
    db = SessionLocal()
    print("Bắt đầu lấy dữ liệu từ KBS...")
    
    for ticker in TICKERS:
        try:
            print(f"Đang xử lý mã: {ticker}...")
            
            stock = Vnstock().stock(symbol=ticker, source='KBS')
            df_profile = stock.company.overview()
            
            if df_profile is not None and not df_profile.empty:
                profile_data = df_profile.iloc[0].to_dict()
                
                db_record = db.query(CompanyProfile).filter(CompanyProfile.ticker == ticker).first()
                if not db_record:
                    db_record = CompanyProfile(ticker=ticker)
                    db.add(db_record)
                
                
                # Thông tin cơ bản
                db_record.company_name = STATIC_INFO[ticker]['name']
                db_record.industry = str(profile_data.get('company_type', 'Ngân hàng thương mại'))
                db_record.exchange = str(profile_data.get('exchange', 'HOSE'))
                db_record.logo_url = STATIC_INFO[ticker]['logo']

                # Chỉ số tài chính
                capital = profile_data.get('charter_capital', 0)
                db_record.charter_capital = f"{int(capital):,} tỷ đồng" if pd.notna(capital) else "N/A"

                # Thông tin niêm yết
                db_record.first_trading_date = str(profile_data.get('listing_date', ''))

                first_price = profile_data.get('listing_price', 0)
                db_record.first_price = f"{float(first_price)/1000:,.1f}" if pd.notna(first_price) else "N/A"

                # Khối lượng cổ phiếu
                out_shares = profile_data.get('outstanding_shares', 0)
                formatted_shares = f"{int(float(out_shares)):,}" if pd.notna(out_shares) else "N/A"
                
                # Gắn chung 1 giá trị cho listed_shares và outstanding_shares vì KBS không phân biệt rõ ràng
                db_record.listed_shares = formatted_shares
                db_record.outstanding_shares = formatted_shares
                db_record.first_listed_shares = STATIC_INFO[ticker]['first_listed_shares']

                db.commit()
                print(f"Lưu thành công Profile {ticker} vào Database.")
            else:
                print(f"Không lấy được dữ liệu cho {ticker}")

        except Exception as e:
            print(f" Lỗi ở mã {ticker}: {e}")
            db.rollback()

    db.close()
    print("Hoàn tất quá trình đồng bộ Profile Doanh nghiệp!")

if __name__ == "__main__":
    fetch_company_profiles()