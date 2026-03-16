import os
from sqlalchemy import create_engine, Column, String, Float, Integer, Date
from sqlalchemy.orm import declarative_base, sessionmaker

# Tạo thư mục chứa database nếu chưa có
os.makedirs('data/database', exist_ok=True)

# Kết nối với SQLite Database (lưu tại file stock_data.db)
DATABASE_URL = "sqlite:///data/database/stock_data.db"
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Định nghĩa cấu trúc bảng lưu lịch sử giá (Table Schema)
class StockPrice(Base):
    __tablename__ = "stock_prices"
    
    id = Integer()
    ticker = Column(String(10), primary_key=True, index=True)
    time = Column(Date, primary_key=True, index=True) # Ngày giao dịch
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Integer)

# Tạo bảng trong Database
Base.metadata.create_all(bind=engine)