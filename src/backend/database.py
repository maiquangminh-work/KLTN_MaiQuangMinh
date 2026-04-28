import os
from sqlalchemy import create_engine, Column, String, Float, Integer, Date
from sqlalchemy.orm import declarative_base, sessionmaker

os.makedirs('data/database', exist_ok=True)

DATABASE_URL = "sqlite:///data/database/stock_data.db"
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class StockPrice(Base):
    __tablename__ = "stock_prices"
    
    id = Integer()
    ticker = Column(String(10), primary_key=True, index=True)
    time = Column(Date, primary_key=True, index=True) 
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Integer)
    foreign_buy_volume = Column(Integer, nullable=True)
    foreign_sell_volume = Column(Integer, nullable=True)
    foreign_net_volume = Column(Integer, nullable=True)
    foreign_data_source = Column(String(50), nullable=True)

class CompanyProfile(Base):
    __tablename__ = "company_profiles"
    
    ticker = Column(String(10), primary_key=True, index=True) 
    company_name = Column(String(255))      
    industry = Column(String(255))          
    exchange = Column(String(50))           
    charter_capital = Column(String(100))   
    first_trading_date = Column(String(50)) 
    first_price = Column(String(50))        
    listed_shares = Column(String(100))     
    outstanding_shares = Column(String(100))
    first_listed_shares = Column(String(100))
    logo_url = Column(String(500))          

Base.metadata.create_all(bind=engine)


def ensure_optional_stock_price_columns():
    optional_columns = {
        "foreign_buy_volume": "INTEGER",
        "foreign_sell_volume": "INTEGER",
        "foreign_net_volume": "INTEGER",
        "foreign_data_source": "VARCHAR(50)",
    }

    with engine.begin() as connection:
        existing_columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(stock_prices)").fetchall()
        }

        for column_name, column_type in optional_columns.items():
            if column_name not in existing_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE stock_prices ADD COLUMN {column_name} {column_type}"
                )


ensure_optional_stock_price_columns()

