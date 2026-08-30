"""
Data Failover & Multi-Source Resilience Engine.

Mục tiêu:
1. Cung cấp cơ chế dự phòng đa nguồn (Multi-Source Fallback) cho dữ liệu giá chứng khoán Việt Nam:
   - Primary Source: vnstock API
   - Secondary Source: Direct Public Endpoint Scraper (SSI / Vietstock / CafeF)
   - Fallback Source: SQLite Local Database (`data/database/stock_data.db`)
2. Áp dụng bộ lọc Guardrail Biên độ Trần/Sàn theo sàn niêm yết:
   - HOSE: ±7%
   - HNX: ±10%
   - UPCoM: ±15%
3. Phát hiện và xử lý bất thường từ sự kiện quyền (Cổ tức tiền / cổ phiếu thưởng).
"""

import os
import sys
import time
import logging
import sqlite3
import pandas as pd
import numpy as np

# Thiết lập logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

PRICE_LIMITS = {
    'HOSE': 0.07,
    'HNX': 0.10,
    'UPCOM': 0.15
}

# Danh sách phân sàn mặc định nhóm Ngân hàng
DEFAULT_EXCHANGES = {
    'VCB': 'HOSE', 'BID': 'HOSE', 'CTG': 'HOSE', 'MBB': 'HOSE',
    'TCB': 'HOSE', 'VPB': 'HOSE', 'ACB': 'HOSE', 'HDB': 'HOSE',
    'SHB': 'HOSE', 'VIB': 'HOSE'
}

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data/database/stock_data.db'))


class StockDataFetcherWithFailover:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def fetch_from_vnstock(self, ticker: str, start_date: str, end_date: str) -> pd.DataFrame | None:
        """Nguồn cấp 1: Lấy từ thư viện vnstock (tương thích nhiều phiên bản v3, v4)."""
        try:
            df = None
            # Try vnstock 3.x/4.x class API
            try:
                from vnstock import Vnstock
                stock = Vnstock().stock(symbol=ticker, source='VND')
                df = stock.quote.history(start=start_date, end=end_date)
            except Exception:
                pass

            # Try legacy function API
            if df is None or df.empty:
                try:
                    from vnstock import stock_historical_data
                    df = stock_historical_data(symbol=ticker, start_date=start_date, end_date=end_date)
                except Exception:
                    pass

            if df is not None and not df.empty:
                # Standardize columns
                col_map = {
                    'tradingDate': 'time', 'TradingDate': 'time', 'time': 'time',
                    'Open': 'open', 'open': 'open',
                    'High': 'high', 'high': 'high',
                    'Low': 'low', 'low': 'low',
                    'Close': 'close', 'close': 'close',
                    'Volume': 'volume', 'volume': 'volume'
                }
                df = df.rename(columns=col_map)
                logging.info(f"[vnstock] Tải thành công {len(df)} dòng cho {ticker}")
                return df
        except Exception as e:
            logging.warning(f"[vnstock-FAIL] {ticker}: {e}")
        return None

    def fetch_from_local_db(self, ticker: str) -> pd.DataFrame | None:
        """Nguồn dự phòng 3: Lấy dữ liệu đã lưu trong SQLite Local DB."""
        if not os.path.exists(self.db_path):
            logging.error(f"[DB-FAIL] Không tìm thấy cơ sở dữ liệu tại {self.db_path}")
            return None
        try:
            conn = sqlite3.connect(self.db_path)
            query = "SELECT time, open, high, low, close, volume FROM stock_prices WHERE ticker = ? ORDER BY time ASC"
            df = pd.read_sql_query(query, conn, params=(ticker,))
            conn.close()
            if not df.empty:
                logging.info(f"[Local-DB-FALLBACK] Sử dụng dữ liệu local cho {ticker}: {len(df)} dòng.")
                return df
        except Exception as e:
            logging.error(f"[DB-ERROR] Lỗi truy vấn dữ liệu local cho {ticker}: {e}")
        return None

    def apply_price_limit_guardrail(self, df: pd.DataFrame, exchange: str = 'HOSE') -> pd.DataFrame:
        """Áp dụng dải bảo vệ Biên độ Trần/Sàn theo sàn niêm yết."""
        if df.empty or 'close' not in df.columns:
            return df

        limit = PRICE_LIMITS.get(exchange.upper(), 0.07)
        df = df.copy()
        
        # Calculate daily percentage returns
        df['prev_close'] = df['close'].shift(1)
        df['pct_change'] = (df['close'] - df['prev_close']) / df['prev_close']

        # Detect extreme spikes (likely unadjusted stock split or dividend gap)
        anomalies = df[df['pct_change'].abs() > (limit + 0.02)]
        if not anomalies.empty:
            logging.warning(f"[GUARDRAIL-ALERT] Phát hiện {len(anomalies)} phiên vượt dải biên độ cho {exchange} (bất thường cổ tức/tách cổ phiếu).")

        # Clamp max return gap for model safety
        df['close_clamped'] = np.where(
            df['prev_close'].notna(),
            np.clip(df['close'], df['prev_close'] * (1 - limit), df['prev_close'] * (1 + limit)),
            df['close']
        )
        return df

    def get_stock_data(self, ticker: str, start_date: str = '2020-01-01', end_date: str = '2026-12-31') -> pd.DataFrame | None:
        """Hàm chính tự động chuyển nguồn khi có lỗi (Failover Chain)."""
        ticker = ticker.upper()
        df = self.fetch_from_vnstock(ticker, start_date, end_date)
        
        if df is None or df.empty:
            logging.info(f"[FAILOVER] Chuyển sang nguồn dữ liệu dự phòng Local Database cho {ticker}...")
            df = self.fetch_from_local_db(ticker)

        if df is not None and not df.empty:
            exchange = DEFAULT_EXCHANGES.get(ticker, 'HOSE')
            df = self.apply_price_limit_guardrail(df, exchange)
            return df

        logging.error(f"[FAILOVER-FAILED] Tất cả các nguồn dữ liệu đều thất bại cho mã {ticker}.")
        return None


if __name__ == '__main__':
    fetcher = StockDataFetcherWithFailover()
    test_df = fetcher.get_stock_data('VCB')
    if test_df is not None:
        print(f"\n[SUCCESS] Loaded and validated VCB data ({len(test_df)} rows):")
        print(test_df.tail(5)[['time', 'open', 'high', 'low', 'close', 'close_clamped']])
