from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import pickle
import datetime
import json
import os
import re
import sys
from dotenv import load_dotenv
load_dotenv()
import threading
from functools import lru_cache
from config import SUPPORTED_TICKERS, TRAINED_TICKERS, BANK_NAMES, BANK_WEBSITES, BANK_LOGOS, NEWS_ALIASES, DEFAULT_FORECAST_STEPS
from vnstock import Vnstock
from tensorflow.keras.models import load_model
import feedparser
import time
import requests 
from src.backend.database import SessionLocal, CompanyProfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src/model')))
from architecture import AttentionLayer
from probability import (
    DEFAULT_TICKERS as PROBABILITY_TICKERS,
    FEATURE_COLUMNS,
    BASE_FEATURE_COLUMNS,
    apply_probability_calibrator,
    probability_payload,
    prepare_live_probability_frame,
    build_peer_close_table,
)
# Import helpers augment features cho regression mode (đồng bộ với train.py)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.model.train import (
    _augment_regression_features,
    _augment_cross_sectional_features,
    load_ensemble_models,
    predict_ensemble,
)

# Khởi tạo ứng dụng FastAPI
app = FastAPI(title="AI Trading API", version="1.0")

# Cấp quyền CORS để Frontend (React) có thể gọi được API này
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _khoi_dong_dong_bo_du_lieu():
    """Khi backend khởi động, tự kéo dữ liệu giá mới + tiền xử lý CSV chạy ngầm.

    Pipeline: vnstock -> SQLite -> CSV processed (data/processed/*_features.csv).
    API đọc CSV processed (FAST_DEMO_MODE), nên phải chạy đủ cả hai bước
    thì biểu đồ mới hiển thị tới ngày hôm nay. Chạy trong daemon thread
    để không chặn uvicorn startup; lỗi mạng không làm sập backend.
    """
    def _chay():
        try:
            from src.data_pipeline.auto_fetch import update_database, TICKERS
            from src.data_pipeline.preprocess import process_ticker

            update_database()
            print("[startup] Bat dau tien xu ly CSV features...")
            for t in TICKERS:
                try:
                    process_ticker(t)
                except Exception as exc_t:
                    print(f"[startup] Loi tien xu ly {t}: {exc_t}")

            # Xoa cache in-memory de request ke tiep doc CSV moi
            PREDICTION_CACHE.clear()
            MARKET_CONTEXT_CACHE.clear()
            print("[startup] Hoan tat dong bo du lieu va xoa cache.")
        except Exception as exc:
            print(f"[startup] Loi dong bo du lieu tu dong: {exc}")

    threading.Thread(target=_chay, daemon=True, name="auto_fetch_startup").start()


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
CONFIDENCE_LOG_DIR = os.path.join(BASE_DIR, "data", "confidence_logs")
DATA_QUALITY_LOG_DIR = os.path.join(BASE_DIR, "data", "quality_logs")
CONTEXT_CACHE_TTL_SECONDS = 300
MARKET_CONTEXT_CACHE = {}
COMPANY_PROFILE_CACHE_TTL_SECONDS = 43200
COMPANY_PROFILE_CACHE = {}
PREDICTION_CACHE_TTL_SECONDS = 180
PREDICTION_CACHE = {}
FOREIGN_OWNERSHIP_CACHE_TTL_SECONDS = 60
FOREIGN_OWNERSHIP_CACHE = {}
SSI_IBOARD_QUERY_BASE_URL = os.getenv("SSI_IBOARD_QUERY_BASE_URL", "https://iboard-query.ssi.com.vn")
FAST_DEMO_MODE = os.getenv("FAST_DEMO_MODE", "1").strip().lower() in {"1", "true", "yes", "on"}
PROFILE_EXTERNAL_PROVIDER_LABEL = "KBS Security"
PROFILE_LIVE_BY_DEFAULT = os.getenv("PROFILE_LIVE_BY_DEFAULT", "0").strip().lower() in {"1", "true", "yes", "on"}
VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS = int(os.getenv("VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS", "75"))
VNSTOCK_QUOTA_WINDOW_SECONDS = int(os.getenv("VNSTOCK_QUOTA_WINDOW_SECONDS", "60"))
VNSTOCK_QUOTA_SOFT_LIMIT = int(os.getenv("VNSTOCK_QUOTA_SOFT_LIMIT", "12"))
VNSTOCK_CALL_TIMESTAMPS = []
VNSTOCK_COOLDOWN_UNTIL = 0
VNSTOCK_QUOTA_LOCK = threading.Lock()
DATA_QUALITY_BLOCK_THRESHOLD = int(os.getenv("DATA_QUALITY_BLOCK_THRESHOLD", "45"))


def _la_loi_gioi_han_api(exc):
    message = str(exc or "").lower()
    return any(
        pattern in message
        for pattern in [
            "rate limit",
            "maximum api request limit",
            "max_val",
            "quota",
            "too many requests",
            "wait to retry",
        ]
    )


def _co_the_goi_vnstock_live():
    global VNSTOCK_COOLDOWN_UNTIL
    now_ts = time.time()
    with VNSTOCK_QUOTA_LOCK:
        if VNSTOCK_COOLDOWN_UNTIL > now_ts:
            return False

        cutoff_ts = now_ts - VNSTOCK_QUOTA_WINDOW_SECONDS
        VNSTOCK_CALL_TIMESTAMPS[:] = [
            timestamp for timestamp in VNSTOCK_CALL_TIMESTAMPS if timestamp >= cutoff_ts
        ]
        if len(VNSTOCK_CALL_TIMESTAMPS) >= VNSTOCK_QUOTA_SOFT_LIMIT:
            VNSTOCK_COOLDOWN_UNTIL = now_ts + VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS
            return False

        VNSTOCK_CALL_TIMESTAMPS.append(now_ts)
        return True


def _danh_dau_vnstock_bi_gioi_han(exc):
    global VNSTOCK_COOLDOWN_UNTIL
    if not _la_loi_gioi_han_api(exc):
        return

    with VNSTOCK_QUOTA_LOCK:
        VNSTOCK_COOLDOWN_UNTIL = max(
            VNSTOCK_COOLDOWN_UNTIL,
            time.time() + VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS,
        )

WEBSITE_NGAN_HANG_MAC_DINH = BANK_WEBSITES

PROFILE_STATIC_FALLBACKS = {
    "VCB": {
        "charter_capital": "83,557 tỷ đồng",
        "first_trading_date": "30/06/2009",
        "first_price": "60.0",
        "listed_shares": "5,589,091,262",
        "outstanding_shares": "5,589,091,262",
        "first_listed_shares": "112,285,426",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "55,890"},
            {"quarter": "Q1/2024", "value": "55,890"},
            {"quarter": "Q4/2024", "value": "55,890"},
            {"quarter": "Q1/2025", "value": "83,557"},
        ],
    },
    "BID": {
        "charter_capital": "68,975 tỷ đồng",
        "first_trading_date": "24/01/2014",
        "first_price": "18.7",
        "listed_shares": "6,897,471,230",
        "outstanding_shares": "6,897,471,230",
        "first_listed_shares": "2,811,202,644",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "50,585"},
            {"quarter": "Q4/2024", "value": "57,004"},
            {"quarter": "Q2/2025", "value": "68,975"},
        ],
    },
    "CTG": {
        "charter_capital": "77,670 tỷ đồng",
        "first_trading_date": "16/07/2009",
        "first_price": "50.0",
        "listed_shares": "5,369,991,748",
        "outstanding_shares": "5,369,991,748",
        "first_listed_shares": "121,211,780",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "53,700"},
            {"quarter": "Q4/2024", "value": "53,700"},
            {"quarter": "Q4/2025", "value": "77,670"},
        ],
    },
    "MBB": {
        "charter_capital": "61,022 tỷ đồng",
        "first_trading_date": "01/11/2011",
        "first_price": "13.8",
        "listed_shares": "6,102,293,744",
        "outstanding_shares": "6,102,293,744",
        "first_listed_shares": "100,000,000",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "45,340"},
            {"quarter": "Q2/2024", "value": "52,141"},
            {"quarter": "Q4/2024", "value": "61,022"},
        ],
    },
    "TCB": {
        "charter_capital": "70,648 tỷ đồng",
        "first_trading_date": "04/06/2018",
        "first_price": "128.0",
        "listed_shares": "7,064,800,000",
        "outstanding_shares": "7,064,800,000",
        "first_listed_shares": "350,000,000",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "35,225"},
            {"quarter": "Q3/2024", "value": "70,648"},
            {"quarter": "Q4/2024", "value": "70,648"},
        ],
    },
    "VPB": {
        "charter_capital": "79,339 tỷ đồng",
        "first_trading_date": "17/08/2017",
        "first_price": "39.0",
        "listed_shares": "7,933,923,601",
        "outstanding_shares": "7,933,923,601",
        "first_listed_shares": "1,330,000,000",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "67,434"},
            {"quarter": "Q2/2024", "value": "79,339"},
            {"quarter": "Q4/2024", "value": "79,339"},
        ],
    },
    "ACB": {
        "charter_capital": "44,667 tỷ đồng",
        "first_trading_date": "31/10/2006",
        "first_price": "52.0",
        "listed_shares": "4,466,657,861",
        "outstanding_shares": "4,466,657,861",
        "first_listed_shares": "110,000,000",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "38,840"},
            {"quarter": "Q2/2024", "value": "40,447"},
            {"quarter": "Q4/2024", "value": "44,667"},
        ],
    },
    "HDB": {
        "charter_capital": "35,101 tỷ đồng",
        "first_trading_date": "05/01/2018",
        "first_price": "33.0",
        "listed_shares": "3,510,127,518",
        "outstanding_shares": "3,510,127,518",
        "first_listed_shares": "98,100,000",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "29,276"},
            {"quarter": "Q3/2024", "value": "33,647"},
            {"quarter": "Q4/2024", "value": "35,101"},
        ],
    },
    "SHB": {
        "charter_capital": "40,658 tỷ đồng",
        "first_trading_date": "20/04/2009",
        "first_price": "30.0",
        "listed_shares": "4,065,856,892",
        "outstanding_shares": "4,065,856,892",
        "first_listed_shares": "500,000,000",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "36,194"},
            {"quarter": "Q4/2024", "value": "36,194"},
            {"quarter": "Q2/2025", "value": "40,658"},
        ],
    },
    "VIB": {
        "charter_capital": "29,791 tỷ đồng",
        "first_trading_date": "10/01/2017",
        "first_price": "17.0",
        "listed_shares": "2,979,134,706",
        "outstanding_shares": "2,979,134,706",
        "first_listed_shares": "188,500,000",
        "charter_capital_history": [
            {"quarter": "Q4/2023", "value": "25,368"},
            {"quarter": "Q2/2024", "value": "27,398"},
            {"quarter": "Q4/2024", "value": "29,791"},
        ],
    },
}

TU_VAN_NIEM_YET_MAC_DINH = {
    "VCB": {"name": "Công ty TNHH Chứng khoán Ngân hàng TMCP Ngoại thương Việt Nam", "link": "https://vcbs.com.vn/"},
    "BID": {"name": "Công ty CP Chứng khoán Ngân hàng Đầu tư và Phát triển Việt Nam", "link": "https://www.bsc.com.vn/"},
    "CTG": {"name": "Công ty Cổ phần Chứng khoán SSI", "link": "https://www.ssi.com.vn"},
    "MBB": {"name": "Công ty CP Chứng khoán MB", "link": "https://www.mbs.com.vn/"},
    "TCB": {"name": "Công ty CP Chứng khoán Kỹ Thương", "link": "https://www.tcbs.com.vn/"},
    "VPB": {"name": "Công ty CP Chứng khoán VPBank", "link": "https://www.vpbanks.com.vn/"},
    "ACB": {"name": "Công ty CP Chứng khoán ACB", "link": "https://www.acbs.com.vn/"},
    "HDB": {"name": "Công ty CP Chứng khoán HDBank", "link": "https://hdbs.com.vn/"},
    "SHB": {"name": "Công ty CP Chứng khoán SHB", "link": "https://www.shbs.com.vn/"},
    "VIB": {"name": "Công ty CP Chứng khoán KIS Việt Nam", "link": "https://www.kisvn.vn/"},
}

LICH_SU_KIEM_TOAN_MAC_DINH = {
    "VCB": [
        {"year": "2024", "name": "Công ty TNHH Ernst & Young Việt Nam", "link": "https://www.ey.com/en_vn"},
        {"year": "2023", "name": "Công ty TNHH Ernst & Young Việt Nam", "link": "https://www.ey.com/en_vn"},
        {"year": "2022", "name": "Công ty TNHH Ernst & Young Việt Nam", "link": "https://www.ey.com/en_vn"},
        {"year": "2020", "name": "Công ty TNHH KPMG Việt Nam", "link": "https://kpmg.com/vn/vi/home.html"},
        {"year": "2019", "name": "Công ty TNHH KPMG Việt Nam", "link": "https://kpmg.com/vn/vi/home.html"},
        {"year": "2018", "name": "Công ty TNHH KPMG Việt Nam", "link": "https://kpmg.com/vn/vi/home.html"},
    ],
    "BID": [
        {"year": "2024", "name": "Công ty TNHH KPMG Việt Nam", "link": "https://kpmg.com/vn/vi/home.html"},
        {"year": "2023", "name": "Công ty TNHH Deloitte Việt Nam", "link": "https://www.deloitte.com/vn/en.html"},
        {"year": "2022", "name": "Công ty TNHH Deloitte Việt Nam", "link": "https://www.deloitte.com/vn/en.html"},
        {"year": "2021", "name": "Công ty TNHH Deloitte Việt Nam", "link": "https://www.deloitte.com/vn/en.html"},
        {"year": "2020", "name": "Công ty TNHH Deloitte Việt Nam", "link": "https://www.deloitte.com/vn/en.html"},
        {"year": "2019", "name": "Công ty TNHH Deloitte Việt Nam", "link": "https://www.deloitte.com/vn/en.html"},
    ],
    "CTG": [
        {"year": "2024", "name": "Công ty TNHH Deloitte Việt Nam", "link": "https://www.deloitte.com/vn/en.html"},
        {"year": "2023", "name": "Công ty TNHH Deloitte Việt Nam", "link": "https://www.deloitte.com/vn/en.html"},
        {"year": "2020", "name": "Công ty TNHH Ernst & Young Việt Nam", "link": "https://www.ey.com/en_vn"},
        {"year": "2019", "name": "Công ty TNHH Ernst & Young Việt Nam", "link": "https://www.ey.com/en_vn"},
        {"year": "2018", "name": "Công ty TNHH Ernst & Young Việt Nam", "link": "https://www.ey.com/en_vn"},
        {"year": "2017", "name": "Công ty TNHH Ernst & Young Việt Nam", "link": "https://www.ey.com/en_vn"},
    ],
    "MBB": [{"year": "2024", "name": "Công ty TNHH Ernst & Young Việt Nam", "link": "https://www.ey.com/en_vn"}],
    "TCB": [{"year": "2024", "name": "Công ty TNHH KPMG Việt Nam", "link": "https://kpmg.com/vn/vi/home.html"}],
    "VPB": [{"year": "2024", "name": "Công ty TNHH KPMG Việt Nam", "link": "https://kpmg.com/vn/vi/home.html"}],
    "ACB": [{"year": "2024", "name": "Công ty TNHH Ernst & Young Việt Nam", "link": "https://www.ey.com/en_vn"}],
    "HDB": [{"year": "2024", "name": "Công ty TNHH KPMG Việt Nam", "link": "https://kpmg.com/vn/vi/home.html"}],
    "SHB": [{"year": "2024", "name": "Công ty TNHH Deloitte Việt Nam", "link": "https://www.deloitte.com/vn/en.html"}],
    "VIB": [{"year": "2024", "name": "Công ty TNHH PwC Việt Nam", "link": "https://www.pwc.com/vn"}],
}

RSS_SOURCES = [
    {"name": "CafeF", "url": "https://cafef.vn/tai-chinh-ngan-hang.rss"},
    {"name": "CafeF", "url": "https://cafef.vn/thi-truong-chung-khoan.rss"},
    {"name": "CafeF", "url": "https://cafef.vn/doanh-nghiep.rss"},
    {"name": "Vietstock", "url": "https://vietstock.vn/rss/tai-chinh.rss"},
    {"name": "Vietstock", "url": "https://vietstock.vn/rss/chung-khoan.rss"},
    {"name": "Vietstock", "url": "https://vietstock.vn/rss/doanh-nghiep.rss"},
    {"name": "VNExpress", "url": "https://vnexpress.net/rss/kinh-doanh.rss"},
    {"name": "VNExpress", "url": "https://vnexpress.net/rss/kinh-doanh/chung-khoan.rss"},
    {"name": "Báo Đầu Tư", "url": "https://baodautu.vn/ngan-hang.rss"},
    {"name": "Báo Đầu Tư", "url": "https://baodautu.vn/tai-chinh-chung-khoan.rss"},
    {"name": "VnEconomy", "url": "https://vneconomy.vn/rss/tai-chinh.rss"},
    {"name": "VnEconomy", "url": "https://vneconomy.vn/rss/chung-khoan.rss"},
    {"name": "VnBusiness", "url": "https://vnbusiness.vn/rss/ngan-hang.rss"},
    {"name": "VnBusiness", "url": "https://vnbusiness.vn/rss/tai-chinh.rss"},
    {"name": "VnBusiness", "url": "https://vnbusiness.vn/rss/chung-khoan.rss"},
]
RSS_URLS = [source["url"] for source in RSS_SOURCES]
RSS_SOURCE_BY_URL = {source["url"]: source["name"] for source in RSS_SOURCES}

TU_KHOA_THEO_MA = {k: v for k, v in NEWS_ALIASES.items()}

TU_KHOA_CHUNG_TAI_CHINH = [
    "ngân hàng",
    "lãi suất",
    "nhnn",
    "tín dụng",
    "cổ phiếu",
    "chứng khoán",
    "vn-index",
    "tỷ giá",
    "trái phiếu",
]

TU_KHOA_TICH_CUC = {
    "tăng trưởng": 2,
    "mở rộng": 1,
    "phục hồi": 2,
    "khởi sắc": 2,
    "bứt phá": 2,
    "ổn định": 1,
    "nới": 1,
    "cải thiện": 1,
    "hạ lãi suất": 2,
}

TU_KHOA_TIEU_CUC = {
    "nợ xấu": 3,
    "suy giảm": 2,
    "áp lực": 2,
    "rủi ro": 2,
    "biến động": 1,
    "thua lỗ": 3,
    "siết": 2,
    "bán ròng": 1,
    "sụt giảm": 2,
}

TU_KHOA_NGAN_HANG_HO_TRO = {
    "room tín dụng": 3,
    "nới room tín dụng": 3,
    "tăng vốn": 3,
    "thu nhập lãi thuần": 2,
    "lợi nhuận trước thuế": 2,
    "casa": 2,
    "nim cải thiện": 3,
    "mở rộng tín dụng": 2,
    "hoàn nhập dự phòng": 3,
    "xử lý nợ xấu": 2,
    "basel ii": 1,
    "basel iii": 2,
    "chuyển đổi số": 1,
    "bancassurance": 1,
    "huy động vốn tăng": 1,
}

TU_KHOA_NGAN_HANG_RUI_RO = {
    "nợ xấu": 3,
    "trích lập dự phòng": 3,
    "dự phòng rủi ro": 2,
    "nim thu hẹp": 3,
    "casa giảm": 2,
    "chi phí vốn": 2,
    "áp lực huy động": 2,
    "siết room tín dụng": 3,
    "trái phiếu doanh nghiệp": 2,
    "thanh khoản căng": 3,
    "rút tiền": 3,
    "sai phạm": 3,
    "xử phạt": 2,
    "giảm lợi nhuận": 2,
}

TU_KHOA_RIENG_THEO_MA = {
    "VCB": {
        "positive": {
            "ngoại hối": 2,
            "xuất nhập khẩu": 1,
            "thanh toán quốc tế": 2,
            "vcbs": 1,
            "mizuho": 1,
            "casa": 2,
        },
        "negative": {
            "áp lực tỷ giá": 2,
            "giảm thu nhập dịch vụ": 2,
            "cạnh tranh huy động": 1,
        },
    },
    "BID": {
        "positive": {
            "đầu tư công": 2,
            "khách hàng doanh nghiệp lớn": 1,
            "bsc": 1,
            "huy động vốn tăng": 1,
            "giải ngân tín dụng": 2,
        },
        "negative": {
            "trích lập cao": 2,
            "chi phí vốn tăng": 2,
            "biên lãi thuần giảm": 2,
            "áp lực dự phòng": 2,
        },
    },
    "CTG": {
        "positive": {
            "bán lẻ": 1,
            "ifrs": 1,
            "xử lý nợ": 2,
            "thu hồi nợ": 2,
            "tăng vốn": 2,
        },
        "negative": {
            "nim giảm": 2,
            "trích lập dự phòng": 2,
            "áp lực tài sản có rủi ro": 1,
            "chi phí tín dụng": 2,
        },
    },
    "MBB": {
        "positive": {"mb ageas": 1, "bancassurance": 2, "số hóa": 2, "app mbbank": 1, "tín dụng bán lẻ": 2},
        "negative": {"nợ xấu bán lẻ": 2, "chi phí hoạt động": 1, "cạnh tranh fintech": 2},
    },
    "TCB": {
        "positive": {"masan": 1, "bất động sản cao cấp": 2, "zero fee": 2, "tcbs": 1, "casa cao": 2},
        "negative": {"bất động sản giảm": 3, "trái phiếu doanh nghiệp": 2, "tập trung tín dụng": 2},
    },
    "VPB": {
        "positive": {"fe credit": 2, "tín dụng tiêu dùng": 2, "smbc": 1, "fintech": 1, "cake digital": 1},
        "negative": {"nợ xấu tín dụng tiêu dùng": 3, "fe credit nợ xấu": 3, "chi phí dự phòng": 2},
    },
    "ACB": {
        "positive": {"bán lẻ": 2, "sme": 1, "chất lượng tài sản": 2, "casa tốt": 2, "nim ổn định": 1},
        "negative": {"tăng trưởng chậm": 1, "áp lực cạnh tranh": 1},
    },
    "HDB": {
        "positive": {"hd saison": 2, "tín dụng tiêu dùng": 1, "vietjet": 1, "bancassurance": 1},
        "negative": {"nợ xấu hd saison": 2, "biên lãi mỏng": 1},
    },
    "SHB": {
        "positive": {"xử lý nợ xấu": 2, "tăng vốn": 2, "shb finance": 1, "mở rộng mạng lưới": 1},
        "negative": {"nợ xấu cao": 3, "car thấp": 2, "trích lập nặng": 2},
    },
    "VIB": {
        "positive": {"bán lẻ": 2, "auto loan": 2, "commonwealth bank": 1, "nim cao": 2},
        "negative": {"tập trung cho vay ô tô": 1, "biên lãi giảm": 2},
    },
}

TU_KHOA_VI_MO_RUI_RO = {
    "lạm phát": 2,
    "tỷ giá": 2,
    "fed": 2,
    "lãi suất": 2,
    "thắt chặt": 2,
    "suy thoái": 3,
    "trích lập": 1,
    "nợ xấu": 2,
    "trái phiếu": 1,
}

TU_KHOA_VI_MO_HO_TRO = {
    "hạ lãi suất": 2,
    "nới room": 2,
    "giải ngân": 1,
    "hỗ trợ": 1,
    "kích thích": 2,
    "đầu tư công": 1,
    "phục hồi": 1,
}

TU_KHOA_CHINH_TRI_RUI_RO = {
    "xung đột": 3,
    "chiến tranh": 3,
    "địa chính trị": 2,
    "trừng phạt": 3,
    "thuế quan": 2,
    "căng thẳng": 2,
    "bầu cử": 1,
    "biểu tình": 2,
    "khủng hoảng": 3,
}

TU_KHOA_CHINH_TRI_HA_NHIET = {
    "đàm phán": 2,
    "hạ nhiệt": 2,
    "thỏa thuận": 2,
    "ổn định": 1,
    "ký kết": 1,
}


def _kiem_tra_ticker_hop_le(ticker_name):
    ticker_name = ticker_name.upper()
    if ticker_name not in SUPPORTED_TICKERS:
        raise HTTPException(status_code=404, detail=f"Mã {ticker_name} không được hỗ trợ. Danh sách: {', '.join(SUPPORTED_TICKERS)}")
    return ticker_name


def _has_trained_model(ticker_name):
    """Kiểm tra xem mã có mô hình AI đã huấn luyện hay chưa (hồi quy hoặc xác suất)."""
    name = ticker_name.lower()
    prob_bundle = (
        os.path.join(MODELS_DIR, f'cnn_lstm_attn_{name}_prob_v1.h5'),
        os.path.join(MODELS_DIR, f'{name}_prob_feature_scaler.pkl'),
        os.path.join(MODELS_DIR, f'{name}_prob_config.pkl'),
    )
    reg_bundle = (
        os.path.join(MODELS_DIR, f'cnn_lstm_attn_{name}_v1.h5'),
        os.path.join(MODELS_DIR, f'{name}_feature_scaler.pkl'),
        os.path.join(MODELS_DIR, f'{name}_target_scaler.pkl'),
    )
    return all(os.path.exists(path) for path in prob_bundle) or all(os.path.exists(path) for path in reg_bundle)


# Độ tin cậy MÔ HÌNH (tĩnh) - tách riêng khỏi confidence (động) để hiển thị
# theo phong cách Bloomberg/FiinTrade: "model reliability" vs "signal strength".
# Nguồn dữ liệu: models/probability_model_metrics.csv (kết quả backtest).

@lru_cache(maxsize=1)
def _doc_bang_do_tin_cay_mo_hinh():
    """Đọc bảng metrics backtest và tổng hợp điểm độ tin cậy mô hình theo mã."""
    path = os.path.join(BASE_DIR, "models", "probability_model_metrics.csv")
    if not os.path.exists(path):
        return {}
    try:
        df = pd.read_csv(path)
    except Exception as exc:
        print(f"[reliability] Khong doc duoc {path}: {exc}")
        return {}

    table = {}
    for _, row in df.iterrows():
        ticker = str(row.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        try:
            ece = float(row.get("ece", 0) or 0)
            auc = float(row.get("roc_auc_ovr", 0.5) or 0.5)
            macro_f1 = float(row.get("macro_f1", 0) or 0)
            calibrated = bool(row.get("calibrated", False))
        except Exception:
            continue

        calibration = max(0.0, min(1.0, 1.0 - ece))
        discrimination = max(0.0, min(1.0, auc))
        # 70% trọng số cho calibration (xác suất hiệu chỉnh đáng tin),
        # 30% cho discrimination (khả năng phân biệt 3 lớp).
        score = round(70.0 * calibration + 30.0 * discrimination)
        score = max(40, min(95, int(score)))
        if score >= 80:
            label = "Cao"
        elif score >= 65:
            label = "Khá"
        else:
            label = "Trung bình"
        table[ticker] = {
            "score": score,
            "label": label,
            "calibration_score": int(round(calibration * 100)),
            "discrimination_score": int(round(discrimination * 100)),
            "macro_f1_score": int(round(macro_f1 * 100)),
            "calibrated": calibrated,
            "note": (
                "Đo từ walk-forward backtest trên tập kiểm thử lịch sử. "
                "Chỉ số tĩnh, phản ánh độ tin cậy của mô hình theo thời gian dài, "
                "không thay đổi giữa các phiên giao dịch."
            ),
        }
    return table


def _lay_do_tin_cay_mo_hinh(ticker):
    """Trả về dict mô tả độ tin cậy MÔ HÌNH cho 1 mã (khác confidence động)."""
    table = _doc_bang_do_tin_cay_mo_hinh()
    if ticker.upper() in table:
        return table[ticker.upper()]
    return {
        "score": 0,
        "label": "Chưa đánh giá",
        "calibration_score": 0,
        "discrimination_score": 0,
        "macro_f1_score": 0,
        "calibrated": False,
        "note": "Chưa có metric backtest cho mã này.",
    }


def _gioi_han_diem(value):
    return max(0.0, min(100.0, float(value)))


def _lam_sach_gia_tri_profile(value):
    if value is None:
        return None

    if isinstance(value, np.generic):
        value = value.item()

    if isinstance(value, (datetime.datetime, datetime.date, pd.Timestamp)):
        return pd.to_datetime(value).strftime("%d/%m/%Y")

    if isinstance(value, str):
        value = re.sub(r"\s+", " ", value).strip()
        return value or None

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    return value


def _dinh_dang_so_luong(value):
    value = _lam_sach_gia_tri_profile(value)
    if value is None:
        return None
    if isinstance(value, str):
        return value

    try:
        return f"{int(round(float(value))):,}"
    except Exception:
        return str(value)


def _ep_so_float(value, default=None):
    value = _lam_sach_gia_tri_profile(value)
    if value is None:
        return default
    if isinstance(value, str):
        cleaned = value.replace(",", "").strip()
        if not cleaned:
            return default
        value = cleaned
    try:
        return float(value)
    except Exception:
        return default


def _ep_so_int(value, default=0):
    numeric_value = _ep_so_float(value, None)
    if numeric_value is None:
        return default
    return int(round(numeric_value))


def _dinh_dang_ngay_ssi(value):
    cleaned_value = _lam_sach_gia_tri_profile(value)
    if not cleaned_value:
        return None
    text_value = str(cleaned_value)
    if re.fullmatch(r"\d{8}", text_value):
        return f"{text_value[6:8]}/{text_value[4:6]}/{text_value[0:4]}"
    return _dinh_dang_ngay(text_value)


def _lay_int_dau_tien(row_data, keys):
    for key in keys:
        if key in row_data and _lam_sach_gia_tri_profile(row_data.get(key)) is not None:
            return _ep_so_int(row_data.get(key), 0)
    return None


def _lay_float_dau_tien(row_data, keys):
    for key in keys:
        if key in row_data and _lam_sach_gia_tri_profile(row_data.get(key)) is not None:
            return _ep_so_float(row_data.get(key), None)
    return None


def _lay_room_ngoai_tu_vnstock(ticker_name):
    ticker_name = _kiem_tra_ticker_hop_le(ticker_name)

    try:
        stock = Vnstock().stock(symbol=ticker_name, source="VCI")
        dataframe = _lay_dataframe_tu_company(stock.company, "trading_stats")
        row_data = _dong_dataframe_dau_tien(dataframe)
        if not row_data:
            return None

        remaining_volume = _lay_int_dau_tien(
            row_data,
            ["foreign_holding_room", "foreign_room_remaining", "remaining_foreign_room"],
        )
        total_room = _lay_int_dau_tien(
            row_data,
            ["foreign_room", "foreign_total_room", "foreign_total_room_volume"],
        )
        owned_volume = _lay_int_dau_tien(
            row_data,
            ["foreign_volume", "foreign_total_volume", "foreign_owned_volume"],
        )
        current_ratio = _lay_float_dau_tien(row_data, ["current_holding_ratio", "foreign_ownership_ratio"])
        max_ratio = _lay_float_dau_tien(row_data, ["max_holding_ratio", "foreign_max_ratio"])

        if all(value is None for value in [remaining_volume, total_room, owned_volume, current_ratio, max_ratio]):
            return None

        return {
            "remaining_volume": remaining_volume,
            "remaining_volume_display": _dinh_dang_so_luong(remaining_volume),
            "total_room_volume": total_room,
            "total_room_volume_display": _dinh_dang_so_luong(total_room),
            "foreign_owned_volume": owned_volume,
            "foreign_owned_volume_display": _dinh_dang_so_luong(owned_volume),
            "current_holding_ratio": current_ratio,
            "max_holding_ratio": max_ratio,
            "source": "vnstock VCI",
        }
    except Exception as exc:
        _danh_dau_vnstock_bi_gioi_han(exc)
        return None


def _lay_room_va_dtnn_tu_ssi_iboard(ticker_name):
    ticker_name = _kiem_tra_ticker_hop_le(ticker_name)
    url = f"{SSI_IBOARD_QUERY_BASE_URL.rstrip('/')}/stock/{ticker_name}"
    response = requests.get(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "MinSightBankingAI/1.0",
        },
        timeout=6,
    )
    response.raise_for_status()
    payload = response.json()
    row = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(row, dict) or not row:
        return None

    buy_volume = _ep_so_int(row.get("buyForeignQtty"), 0)
    sell_volume = _ep_so_int(row.get("sellForeignQtty"), 0)
    buy_value = _ep_so_int(row.get("buyForeignValue"), 0)
    sell_value = _ep_so_int(row.get("sellForeignValue"), 0)
    has_ssi_room = _lam_sach_gia_tri_profile(row.get("remainForeignQtty")) is not None
    remaining_room = _ep_so_int(row.get("remainForeignQtty"), 0)
    fallback_room = None if has_ssi_room else _lay_room_ngoai_tu_vnstock(ticker_name)
    if fallback_room and fallback_room.get("remaining_volume") is not None:
        remaining_room = fallback_room["remaining_volume"]
    trading_date = _dinh_dang_ngay_ssi(row.get("tradingDate"))

    foreign_room = {
        "remaining_volume": remaining_room,
        "remaining_volume_display": _dinh_dang_so_luong(remaining_room),
        "trading_date": trading_date,
        "source": "SSI iBoard" if has_ssi_room else fallback_room.get("source", "SSI iBoard"),
    }
    if fallback_room:
        for key in ["total_room_volume", "total_room_volume_display", "foreign_owned_volume", "foreign_owned_volume_display", "current_holding_ratio", "max_holding_ratio"]:
            if fallback_room.get(key) is not None:
                foreign_room[key] = fallback_room[key]

    return {
        "ticker": ticker_name,
        "source": "SSI iBoard" if not fallback_room else f"SSI iBoard + {fallback_room['source']}",
        "source_url": f"https://iboard.ssi.com.vn/stock/{ticker_name}",
        "updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
        "trading_date": trading_date,
        "exchange": str(row.get("exchange") or "").upper() or None,
        "foreign_room": foreign_room,
        "foreign_trading_today": {
            "foreign_buy_volume": buy_volume,
            "foreign_sell_volume": sell_volume,
            "foreign_net_volume": buy_volume - sell_volume,
            "foreign_buy_value": buy_value,
            "foreign_sell_value": sell_value,
            "foreign_net_value": buy_value - sell_value,
            "foreign_ownership_ratio": _ep_so_float(row.get("foreignerPercentage"), None),
            "trading_date": trading_date,
            "source": "SSI iBoard",
        },
        "raw": {
            "matched_price": row.get("matchedPrice"),
            "price_change": row.get("priceChange"),
            "price_change_percent": row.get("priceChangePercent"),
            "room_fallback_source": fallback_room.get("source") if fallback_room else None,
        },
    }


def _dinh_dang_von_dieu_le(value):
    value = _lam_sach_gia_tri_profile(value)
    if value is None:
        return None
    if isinstance(value, str):
        return value

    try:
        numeric_value = float(value)
    except Exception:
        return str(value)

    if numeric_value >= 1_000_000_000:
        return f"{numeric_value / 1_000_000_000:,.0f} tỷ đồng"
    if numeric_value >= 1_000_000:
        return f"{numeric_value / 1_000_000:,.0f} triệu đồng"
    return f"{numeric_value:,.0f} đồng"


def _dinh_dang_gia_niem_yet(value):
    value = _lam_sach_gia_tri_profile(value)
    if value is None:
        return None
    if isinstance(value, str):
        return value

    try:
        numeric_value = float(value)
    except Exception:
        return str(value)

    if numeric_value >= 1000:
        return f"{numeric_value / 1000:.1f}"
    return f"{numeric_value:.1f}"


def _dinh_dang_ty_le(value):
    value = _lam_sach_gia_tri_profile(value)
    if value is None:
        return None
    if isinstance(value, str):
        return value

    try:
        return f"{float(value):.2f}%"
    except Exception:
        return str(value)


def _dinh_dang_ngay(value):
    value = _lam_sach_gia_tri_profile(value)
    if value is None:
        return None
    if isinstance(value, str):
        parsed_value = pd.to_datetime(value, errors="coerce", dayfirst=False)
        if pd.isna(parsed_value):
            return value
        return parsed_value.strftime("%d/%m/%Y")
    return str(value)


def _quy_doi_von_dieu_le_ve_ty(value):
    value = _lam_sach_gia_tri_profile(value)
    if value is None:
        return None

    unit_hint = None
    if isinstance(value, str):
        lowered_value = value.casefold()
        if "tỷ" in lowered_value:
            unit_hint = "ty"
        elif "triệu" in lowered_value:
            unit_hint = "trieu"
        elif "đồng" in lowered_value or "vnd" in lowered_value:
            unit_hint = "dong"

        cleaned_value = re.sub(r"[^0-9,.\-]", "", lowered_value)
        if not cleaned_value:
            return None
        cleaned_value = cleaned_value.replace(",", "")
        try:
            numeric_value = float(cleaned_value)
        except Exception:
            return None
    else:
        try:
            numeric_value = float(value)
        except Exception:
            return None

    if unit_hint == "ty":
        return numeric_value
    if unit_hint == "trieu":
        return numeric_value / 1000
    if unit_hint == "dong":
        return numeric_value / 1_000_000_000

    if numeric_value >= 1_000_000_000:
        return numeric_value / 1_000_000_000
    if numeric_value >= 1_000:
        return numeric_value
    if numeric_value >= 1:
        return numeric_value / 1000
    return numeric_value


def _dinh_dang_von_dieu_le(value):
    ty_value = _quy_doi_von_dieu_le_ve_ty(value)
    if ty_value is None:
        cleaned_value = _lam_sach_gia_tri_profile(value)
        return cleaned_value if isinstance(cleaned_value, str) else None

    if ty_value >= 1000:
        return f"{ty_value:,.0f} tỷ đồng"
    return f"{ty_value:,.2f} tỷ đồng"


def _chuan_hoa_url(url):
    url = _lam_sach_gia_tri_profile(url)
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"https://{url.lstrip('/')}"


def _dong_dataframe_dau_tien(dataframe):
    if dataframe is None or dataframe.empty:
        return {}

    normalized_row = {}
    for column, value in dataframe.iloc[0].to_dict().items():
        cleaned_value = _lam_sach_gia_tri_profile(value)
        if cleaned_value is not None:
            normalized_row[column] = cleaned_value
    return normalized_row


def _cat_mo_ta(text, max_length=700):
    cleaned_text = _lam_sach_van_ban(text)
    if not cleaned_text:
        return None
    if len(cleaned_text) <= max_length:
        return cleaned_text
    return cleaned_text[: max_length - 3].rstrip() + "..."


def _lay_dataframe_tu_company(company_component, method_name, **kwargs):
    if not hasattr(company_component, method_name):
        return pd.DataFrame()
    if not _co_the_goi_vnstock_live():
        return pd.DataFrame()

    try:
        dataframe = getattr(company_component, method_name)(**kwargs)
        if isinstance(dataframe, pd.DataFrame):
            return dataframe
    except SystemExit as exc:
        _danh_dau_vnstock_bi_gioi_han(exc)
        return pd.DataFrame()
    except Exception as exc:
        _danh_dau_vnstock_bi_gioi_han(exc)
        return pd.DataFrame()

    return pd.DataFrame()


def _chuan_hoa_danh_sach_lanh_dao(dataframe):
    if dataframe is None or dataframe.empty:
        return []

    normalized_items = []
    for _, row in dataframe.head(6).iterrows():
        row_data = row.to_dict()
        officer_name = (
            _lam_sach_gia_tri_profile(row_data.get("officer_name"))
            or _lam_sach_gia_tri_profile(row_data.get("name"))
            or _lam_sach_gia_tri_profile(row_data.get("full_name"))
        )
        officer_position = (
            _lam_sach_gia_tri_profile(row_data.get("officer_position"))
            or _lam_sach_gia_tri_profile(row_data.get("position"))
            or _lam_sach_gia_tri_profile(row_data.get("position_name"))
            or _lam_sach_gia_tri_profile(row_data.get("position_name_vn"))
        )

        if not officer_name or not officer_position:
            continue

        normalized_items.append(
            {
                "name": officer_name,
                "position": officer_position,
                "ownership_percent": _dinh_dang_ty_le(
                    row_data.get("officer_own_percent")
                    or row_data.get("ownership_percent")
                    or row_data.get("percentage")
                ),
                "updated_at": _dinh_dang_ngay(row_data.get("update_date") or row_data.get("from_date")),
            }
        )

    return normalized_items


def _chuan_hoa_danh_sach_co_dong(dataframe):
    if dataframe is None or dataframe.empty:
        return []

    normalized_items = []
    for _, row in dataframe.head(6).iterrows():
        row_data = row.to_dict()
        shareholder_name = (
            _lam_sach_gia_tri_profile(row_data.get("share_holder"))
            or _lam_sach_gia_tri_profile(row_data.get("name"))
            or _lam_sach_gia_tri_profile(row_data.get("owner_full_name"))
            or _lam_sach_gia_tri_profile(row_data.get("shareholder"))
        )

        if not shareholder_name:
            continue

        normalized_items.append(
            {
                "name": shareholder_name,
                "shares": _dinh_dang_so_luong(
                    row_data.get("shares_owned")
                    or row_data.get("quantity")
                    or row_data.get("shares")
                ),
                "ownership_percent": _dinh_dang_ty_le(
                    row_data.get("share_own_percent")
                    or row_data.get("ownership_percentage")
                    or row_data.get("percentage")
                    or row_data.get("ownership_ratio")
                ),
                "updated_at": _dinh_dang_ngay(row_data.get("update_date") or row_data.get("date")),
            }
        )

    return normalized_items


def _chuan_hoa_lich_su_von_dieu_le(dataframe):
    if dataframe is None or dataframe.empty:
        return []

    normalized_rows = []
    for _, row in dataframe.iterrows():
        row_data = row.to_dict()
        raw_date = row_data.get("date")
        raw_value = _lam_sach_gia_tri_profile(
            row_data.get("charter_capital")
            or row_data.get("value")
        )

        if raw_date is None or raw_value is None:
            continue

        parsed_date = pd.to_datetime(raw_date, errors="coerce")
        if pd.isna(parsed_date):
            continue

        numeric_value = _quy_doi_von_dieu_le_ve_ty(raw_value)
        if numeric_value is None:
            continue

        normalized_rows.append(
            {
                "date": parsed_date,
                "quarter": f"Q{parsed_date.quarter}/{parsed_date.year}",
                "numeric_value": numeric_value,
            }
        )

    if not normalized_rows:
        return []

    quarter_map = {}
    for item in normalized_rows:
        quarter_map[item["quarter"]] = item

    sorted_rows = sorted(quarter_map.values(), key=lambda item: item["date"])
    recent_rows = sorted_rows[-8:]
    max_value = max(item["numeric_value"] for item in recent_rows) or 1.0

    return [
        {
            "quarter": item["quarter"],
            "height": max(18, int(round((item["numeric_value"] / max_value) * 90))),
            "value": f"{item['numeric_value']:,.0f}",
            "numeric_value": item["numeric_value"],
        }
        for item in recent_rows
    ]


def _lay_tu_van_niem_yet_mac_dinh(ticker_name):
    return dict(TU_VAN_NIEM_YET_MAC_DINH.get(ticker_name, {}))


def _hop_nhat_lich_su_kiem_toan(ticker_name, crawled_auditor):
    timeline = [dict(item) for item in LICH_SU_KIEM_TOAN_MAC_DINH.get(ticker_name, [])]
    if not crawled_auditor:
        return timeline

    normalized_name = crawled_auditor.casefold()
    if any(item.get("name", "").casefold() == normalized_name for item in timeline):
        return timeline

    current_year = str(datetime.datetime.now().year)
    timeline.insert(
        0,
        {
            "year": current_year,
            "name": crawled_auditor,
            "link": None,
        },
    )
    return timeline


def _doc_profile_tu_sqlite(ticker_name):
    db = SessionLocal()
    try:
        profile = db.query(CompanyProfile).filter(CompanyProfile.ticker == ticker_name).first()
        if not profile:
            return None

        return {
            "ticker": profile.ticker,
            "company_name": profile.company_name,
            "industry": profile.industry,
            "exchange": profile.exchange,
            "charter_capital": profile.charter_capital,
            "first_trading_date": profile.first_trading_date,
            "first_price": profile.first_price,
            "listed_shares": profile.listed_shares,
            "outstanding_shares": profile.outstanding_shares,
            "first_listed_shares": profile.first_listed_shares,
            "logo_url": profile.logo_url,
        }
    finally:
        db.close()


def _luu_profile_vao_sqlite(profile_data):
    db = SessionLocal()
    try:
        profile = db.query(CompanyProfile).filter(CompanyProfile.ticker == profile_data["ticker"]).first()
        if not profile:
            profile = CompanyProfile(ticker=profile_data["ticker"])
            db.add(profile)

        for field_name in [
            "company_name",
            "industry",
            "exchange",
            "charter_capital",
            "first_trading_date",
            "first_price",
            "listed_shares",
            "outstanding_shares",
            "first_listed_shares",
            "logo_url",
        ]:
            field_value = profile_data.get(field_name)
            if field_value:
                setattr(profile, field_name, field_value)

        db.commit()
        return True
    except Exception:
        db.rollback()
        return False
    finally:
        db.close()


def _tao_profile_mac_dinh(ticker_name):
    static_profile = PROFILE_STATIC_FALLBACKS.get(ticker_name, {})
    return {
        "ticker": ticker_name,
        "company_name": BANK_NAMES.get(ticker_name, ticker_name),
        "industry": "Ngân hàng thương mại",
        "exchange": static_profile.get("exchange", "HOSE"),
        "charter_capital": static_profile.get("charter_capital"),
        "first_trading_date": static_profile.get("first_trading_date"),
        "first_price": static_profile.get("first_price"),
        "listed_shares": static_profile.get("listed_shares"),
        "outstanding_shares": static_profile.get("outstanding_shares"),
        "first_listed_shares": static_profile.get("first_listed_shares"),
        "logo_url": BANK_LOGOS.get(ticker_name),
        "website": WEBSITE_NGAN_HANG_MAC_DINH.get(ticker_name),
        "address": None,
        "phone": None,
        "email": None,
        "auditor": None,
        "history": None,
        "company_description": None,
        "leadership": [],
        "major_shareholders": [],
        "listing_advisor": _lay_tu_van_niem_yet_mac_dinh(ticker_name),
        "auditor_timeline": _hop_nhat_lich_su_kiem_toan(ticker_name, None),
        "charter_capital_history": static_profile.get("charter_capital_history", []),
    }


def _chuyen_profile_ve_schema_giao_dien(ticker_name, source_name, crawled_payload, fallback_profile):
    crawled_row = crawled_payload.get("overview", {})
    profile_row = crawled_payload.get("profile", {})
    listed_shares_value = (
        crawled_row.get("listed_volume")
        or crawled_row.get("listed_shares")
        or crawled_row.get("issue_share")
    )
    outstanding_shares_value = crawled_row.get("outstanding_shares") or crawled_row.get("issue_share")

    profile_data = dict(fallback_profile)
    profile_data.update(
        {
            "ticker": ticker_name,
            "company_name": (
                crawled_row.get("company_name")
                or crawled_row.get("short_name")
                or fallback_profile.get("company_name")
            ),
            "industry": (
                crawled_row.get("industry")
                or crawled_row.get("icb_name3")
                or crawled_row.get("icb_name4")
                or fallback_profile.get("industry")
            ),
            "exchange": crawled_row.get("exchange") or fallback_profile.get("exchange"),
            "charter_capital": _dinh_dang_von_dieu_le(crawled_row.get("charter_capital")) or fallback_profile.get("charter_capital"),
            "first_trading_date": _dinh_dang_ngay(crawled_row.get("listing_date")) or fallback_profile.get("first_trading_date"),
            "first_price": _dinh_dang_gia_niem_yet(crawled_row.get("listing_price")) or fallback_profile.get("first_price"),
            "listed_shares": _dinh_dang_so_luong(listed_shares_value) or fallback_profile.get("listed_shares"),
            "outstanding_shares": _dinh_dang_so_luong(outstanding_shares_value) or fallback_profile.get("outstanding_shares"),
            "first_listed_shares": _dinh_dang_so_luong(listed_shares_value) or fallback_profile.get("first_listed_shares"),
            "logo_url": fallback_profile.get("logo_url"),
            "website": _chuan_hoa_url(crawled_row.get("website")) or fallback_profile.get("website") or WEBSITE_NGAN_HANG_MAC_DINH.get(ticker_name),
            "address": crawled_row.get("address"),
            "phone": crawled_row.get("phone"),
            "email": crawled_row.get("email"),
            "auditor": crawled_row.get("auditor"),
            "history": profile_row.get("history") or crawled_row.get("history") or profile_row.get("company_profile"),
            "company_description": _cat_mo_ta(
                profile_row.get("company_profile")
                or profile_row.get("business_model")
                or crawled_row.get("business_model")
                or profile_row.get("history")
                or crawled_row.get("history")
            ),
            "leadership": crawled_payload.get("leadership", []),
            "major_shareholders": crawled_payload.get("major_shareholders", []),
            "listing_advisor": fallback_profile.get("listing_advisor") or _lay_tu_van_niem_yet_mac_dinh(ticker_name),
            "auditor_timeline": _hop_nhat_lich_su_kiem_toan(
                ticker_name,
                _lam_sach_gia_tri_profile(crawled_row.get("auditor")),
            ),
            "charter_capital_history": crawled_payload.get("charter_capital_history", []) or fallback_profile.get("charter_capital_history", []),
            "profile_source": source_name,
            "profile_provider": source_name,
            "profile_updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
            "profile_status": "live",
        }
    )
    return profile_data


def _crawl_profile_tu_vnstock(ticker_name):
    crawl_sources = [
        ("KBS", PROFILE_EXTERNAL_PROVIDER_LABEL),
        ("VCI", "VCI / Vietcap"),
    ]

    last_error = None
    for source_code, source_label in crawl_sources:
        try:
            company_component = Vnstock().stock(symbol=ticker_name, source=source_code).company
            overview_row = _dong_dataframe_dau_tien(_lay_dataframe_tu_company(company_component, "overview"))
            profile_row = _dong_dataframe_dau_tien(_lay_dataframe_tu_company(company_component, "profile"))
            leadership = _chuan_hoa_danh_sach_lanh_dao(_lay_dataframe_tu_company(company_component, "officers"))
            shareholders = _chuan_hoa_danh_sach_co_dong(_lay_dataframe_tu_company(company_component, "shareholders"))
            capital_history = _chuan_hoa_lich_su_von_dieu_le(_lay_dataframe_tu_company(company_component, "capital_history"))

            if overview_row or profile_row or leadership or shareholders or capital_history:
                return source_label, {
                    "overview": overview_row,
                    "profile": profile_row,
                    "leadership": leadership,
                    "major_shareholders": shareholders,
                    "charter_capital_history": capital_history,
                }, None
        except SystemExit as exc:
            _danh_dau_vnstock_bi_gioi_han(exc)
            last_error = str(exc)
        except Exception as exc:
            _danh_dau_vnstock_bi_gioi_han(exc)
            last_error = str(exc)

    return None, None, last_error


def _lay_profile_cached(ticker_name, force_refresh=False):
    ticker_name = _kiem_tra_ticker_hop_le(ticker_name)
    current_time = time.time()
    cached_item = COMPANY_PROFILE_CACHE.get(ticker_name)

    if (
        cached_item
        and not force_refresh
        and (current_time - cached_item["timestamp"] < COMPANY_PROFILE_CACHE_TTL_SECONDS)
    ):
        return cached_item["data"]

    fallback_profile = _tao_profile_mac_dinh(ticker_name)
    sqlite_profile = _doc_profile_tu_sqlite(ticker_name)
    if sqlite_profile:
        fallback_profile.update(sqlite_profile)
    fallback_profile["logo_url"] = BANK_LOGOS.get(ticker_name) or fallback_profile.get("logo_url")
    fallback_profile["website"] = fallback_profile.get("website") or WEBSITE_NGAN_HANG_MAC_DINH.get(ticker_name)

    if (FAST_DEMO_MODE or not PROFILE_LIVE_BY_DEFAULT) and not force_refresh:
        profile_data = dict(fallback_profile)
        profile_data.update(
            {
                "profile_source": PROFILE_EXTERNAL_PROVIDER_LABEL,
                "profile_provider": PROFILE_EXTERNAL_PROVIDER_LABEL,
                "profile_updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
                "profile_status": "fallback",
                "crawl_note": "Hồ sơ đang sử dụng thông tin tham chiếu đã xác thực để giữ trải nghiệm ổn định.",
            }
        )
        COMPANY_PROFILE_CACHE[ticker_name] = {
            "timestamp": current_time,
            "data": profile_data,
        }
        return profile_data

    if not _co_the_goi_vnstock_live():
        crawled_payload = None
        source_label = None
        crawl_error = "Đang tạm dừng gọi API ngoài do gần chạm giới hạn."
    else:
        source_label, crawled_payload, crawl_error = _crawl_profile_tu_vnstock(ticker_name)

    if crawled_payload:
        profile_data = _chuyen_profile_ve_schema_giao_dien(
            ticker_name=ticker_name,
            source_name=source_label,
            crawled_payload=crawled_payload,
            fallback_profile=fallback_profile,
        )
        _luu_profile_vao_sqlite(profile_data)
    else:
        profile_data = dict(fallback_profile)
        profile_data.update(
            {
                "profile_source": PROFILE_EXTERNAL_PROVIDER_LABEL,
                "profile_provider": PROFILE_EXTERNAL_PROVIDER_LABEL,
                "profile_updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
                "profile_status": "fallback",
                "crawl_note": "Hồ sơ đang sử dụng thông tin tham chiếu đã xác thực để giữ trải nghiệm ổn định.",
            }
        )
        if crawl_error:
            profile_data["crawl_error"] = crawl_error

    COMPANY_PROFILE_CACHE[ticker_name] = {
        "timestamp": current_time,
        "data": profile_data,
    }
    return profile_data


def _lam_sach_van_ban(raw_text):
    clean_text = re.sub(r"<[^>]+>", " ", str(raw_text or ""))
    clean_text = re.sub(r"\s+", " ", clean_text)
    return clean_text.strip()


def _lay_nguon_tin(url):
    if url in RSS_SOURCE_BY_URL:
        return RSS_SOURCE_BY_URL[url]
    if "cafef" in url:
        return "CafeF"
    if "vietstock" in url:
        return "Vietstock"
    if "vnexpress" in url:
        return "VNExpress"
    if "baodautu" in url:
        return "Báo Đầu Tư"
    if "vneconomy" in url:
        return "VnEconomy"
    if "vnbusiness" in url:
        return "VnBusiness"
    return "Nguồn khác"


def _dem_trong_so(text, keyword_weights):
    score = 0
    matched_keywords = []
    for keyword, weight in keyword_weights.items():
        if keyword in text:
            score += weight
            matched_keywords.append(keyword)
    return score, matched_keywords


def _gan_nhan_sentiment(score):
    if score >= 65:
        return "Tích cực"
    if score >= 45:
        return "Trung tính"
    return "Tiêu cực"


def _gan_nhan_rui_ro(score):
    if score >= 70:
        return "Cao"
    if score >= 45:
        return "Trung bình"
    return "Thấp"


def _gan_nhan_ap_luc(score):
    if score >= 70:
        return "Áp lực cao"
    if score >= 45:
        return "Áp lực trung bình"
    return "Áp lực thấp"


def _gan_nhan_xung_luc_ngan_hang(score):
    if score >= 65:
        return "Hỗ trợ mạnh"
    if score >= 45:
        return "Trung tính"
    return "Suy yếu"


def _tao_boi_canh_mac_dinh(ticker_name):
    return {
        "ticker": ticker_name,
        "updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
        "news_sentiment_score": 50.0,
        "news_sentiment_label": "Trung tính",
        "banking_sector_score": 50.0,
        "banking_sector_label": "Trung tính",
        "macro_pressure_score": 50.0,
        "macro_pressure_label": "Áp lực trung bình",
        "political_risk_score": 50.0,
        "political_risk_label": "Trung bình",
        "overall_market_pressure": 50.0,
        "overall_market_label": "Theo dõi thêm",
        "top_signals": ["Chưa đủ dữ liệu để tạo bối cảnh thị trường."],
        "headline_insights": [],
    }


def _lay_boi_canh_cached(ticker_name):
    ticker_name = _kiem_tra_ticker_hop_le(ticker_name)
    now_ts = time.time()
    cached_item = MARKET_CONTEXT_CACHE.get(ticker_name)

    if cached_item and (now_ts - cached_item["timestamp"] <= CONTEXT_CACHE_TTL_SECONDS):
        return cached_item["data"]

    if FAST_DEMO_MODE:
        context_data = _tao_boi_canh_mac_dinh(ticker_name)
        context_data["top_signals"] = ["Chế độ demo: ưu tiên tốc độ và độ ổn định, bối cảnh đang dùng dữ liệu an toàn."]
        MARKET_CONTEXT_CACHE[ticker_name] = {
            "timestamp": now_ts,
            "data": context_data,
        }
        return context_data

    context_data = _phan_tich_boi_canh_thi_truong(ticker_name)
    MARKET_CONTEXT_CACHE[ticker_name] = {
        "timestamp": now_ts,
        "data": context_data,
    }
    return context_data


def _doc_du_lieu_local_processed(ticker_name):
    ticker_name = _kiem_tra_ticker_hop_le(ticker_name)
    csv_path = os.path.join(BASE_DIR, "data", "processed", f"{ticker_name}_features.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Không tìm thấy dữ liệu local cho {ticker_name}.")

    df = pd.read_csv(csv_path)
    if "time" not in df.columns:
        raise ValueError(f"Dữ liệu local cho {ticker_name} thiếu cột time.")

    df["time"] = pd.to_datetime(df["time"])
    df = df.sort_values(by="time").reset_index(drop=True)

    if "close_winsorized" not in df.columns and "close" in df.columns:
        df["close_winsorized"] = df["close"]
    if "sma_10" not in df.columns:
        df["sma_10"] = df["close_winsorized"].rolling(window=10).mean()
    if "sma_20" not in df.columns:
        df["sma_20"] = df["close_winsorized"].rolling(window=20).mean()
    if "rsi_14" not in df.columns:
        delta = df["close_winsorized"].diff()
        rs = (delta.where(delta > 0, 0)).rolling(window=14).mean() / (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        df["rsi_14"] = 100 - (100 / (1 + rs))

    required_columns = ["open", "high", "low", "close_winsorized", "volume", "sma_10", "sma_20", "rsi_14"]
    df = df.dropna(subset=[col for col in required_columns if col in df.columns]).reset_index(drop=True)
    return df


def _tinh_khuyen_nghi_va_do_tin_cay(current_price, predicted_price, threshold, market_context):
    current_price = float(current_price or 0)
    predicted_price = float(predicted_price or 0)
    threshold = float(threshold or 0.008)
    market_context = market_context or _tao_boi_canh_mac_dinh("VCB")

    price_diff = predicted_price - current_price
    threshold_value = current_price * threshold
    move_ratio = abs(price_diff) / threshold_value if threshold_value > 0 else 0

    market_pressure_score = float(market_context.get("overall_market_pressure", 50.0))
    banking_support_score = float(market_context.get("banking_sector_score", 50.0))

    positive_context_score = ((100.0 - market_pressure_score) * 0.55) + (banking_support_score * 0.45)
    negative_context_score = (market_pressure_score * 0.7) + ((100.0 - banking_support_score) * 0.3)
    neutral_context_score = 100.0 - (abs(market_pressure_score - 50.0) * 1.15) - (abs(banking_support_score - 50.0) * 0.85)

    bias_threshold = threshold_value * 0.6
    if price_diff > bias_threshold:
        directional_bias = "positive"
        price_signal_score = min(100.0, 52.0 + move_ratio * 22.0)
        context_alignment_score = positive_context_score
    elif price_diff < -bias_threshold:
        directional_bias = "negative"
        price_signal_score = min(100.0, 52.0 + move_ratio * 22.0)
        context_alignment_score = negative_context_score
    else:
        directional_bias = "neutral"
        price_signal_score = max(40.0, 58.0 - min(move_ratio, 1.4) * 12.0)
        context_alignment_score = neutral_context_score

    price_signal_score = _gioi_han_diem(price_signal_score)
    context_alignment_score = _gioi_han_diem(context_alignment_score)
    recommendation_score = int(round((price_signal_score * 0.6) + (context_alignment_score * 0.4)))
    confidence_score = recommendation_score

    recommendation = "TRUNG LẬP"
    recommendation_color = "#fcd535"
    recommendation_note = "Tín hiệu giá và bối cảnh hiện chưa tạo ra một lợi thế đủ rõ để nâng hạng triển vọng ngắn hạn."

    if directional_bias == "positive" and recommendation_score >= 68:
        recommendation = "KHẢ QUAN"
        recommendation_color = "#0ecb81"
        if market_pressure_score >= 65:
            recommendation_note = "Tín hiệu giá đang nghiêng theo chiều tích cực, nhưng bối cảnh vĩ mô - chính trị còn nhiều biến số nên phù hợp đọc theo hướng tích cực có kiểm soát."
        elif banking_support_score >= 60:
            recommendation_note = "Tín hiệu giá và xung lực ngành ngân hàng đang đồng thuận tương đối tốt, phù hợp xếp hạng triển vọng ngắn hạn ở mức khả quan."
        else:
            recommendation_note = "Giá dự báo T+1 đang nghiêng lên và bối cảnh thị trường chưa tạo áp lực lớn, phù hợp xếp hạng triển vọng ngắn hạn ở mức khả quan."
    elif directional_bias == "negative" and recommendation_score >= 68:
        recommendation = "KÉM KHẢ QUAN"
        recommendation_color = "#f6465d"
        if market_pressure_score >= 65:
            recommendation_note = "Tín hiệu giá đang suy yếu trong bối cảnh rủi ro thị trường gia tăng, phù hợp xếp hạng triển vọng ngắn hạn ở mức kém khả quan."
        elif market_context.get("political_risk_score", 50.0) >= 60:
            recommendation_note = "Rủi ro ngoại sinh đang tăng lên trong khi tín hiệu giá chưa thuận lợi, phù hợp với góc nhìn thận trọng hơn trong ngắn hạn."
        else:
            recommendation_note = "Giá dự báo T+1 đang nghiêng xuống và bối cảnh chưa ủng hộ rõ cho kịch bản hồi phục, nên triển vọng ngắn hạn được xếp ở mức kém khả quan."
    elif market_pressure_score < 45 and banking_support_score >= 55:
        recommendation_note = "Bối cảnh hiện tương đối ổn định, tuy nhiên tín hiệu giá chưa đủ mạnh để vượt khỏi vùng trung lập."

    if confidence_score >= 75:
        confidence_label = "Cao"
    elif confidence_score >= 55:
        confidence_label = "Trung bình"
    else:
        confidence_label = "Quan sát"

    confidence_note = "Độ tự tin đang được tính từ độ mạnh của tín hiệu giá và mức đồng thuận của bối cảnh thị trường."
    if price_signal_score >= 75 and context_alignment_score >= 65:
        confidence_note = "Tín hiệu giá đủ mạnh và bối cảnh hiện tại đang đồng thuận tương đối tốt với xếp hạng triển vọng."
    elif price_signal_score >= 75 and context_alignment_score < 50:
        confidence_note = "Tín hiệu giá khá rõ, nhưng tin tức và bối cảnh bên ngoài chưa đồng thuận hoàn toàn nên cần đọc xếp hạng triển vọng theo hướng thận trọng hơn."
    elif price_signal_score < 55 and context_alignment_score >= 65:
        confidence_note = "Bối cảnh đang hỗ trợ tốt hơn độ mạnh tín hiệu giá, vì vậy nên xem đây là một tín hiệu định hướng hơn là xác nhận hành động mạnh."
    elif recommendation == "TRUNG LẬP":
        confidence_note = "Giá dự báo vẫn đang nằm gần vùng trung tính, trong khi bối cảnh hiện chưa tạo ra sức ép một chiều đủ lớn để thay đổi xếp hạng."

    return {
        "recommendation": recommendation,
        "recommendation_color": recommendation_color,
        "recommendation_note": recommendation_note,
        "recommendation_confidence_score": confidence_score,
        "recommendation_confidence_label": confidence_label,
        "recommendation_confidence_note": confidence_note,
        "recommendation_score": recommendation_score,
        "price_signal_score": round(price_signal_score, 2),
        "context_alignment_score": round(context_alignment_score, 2),
        "directional_bias": directional_bias,
    }


def _tinh_khuyen_nghi_xac_suat(probability_forecast, market_context):
    market_context = market_context or _tao_boi_canh_mac_dinh("VCB")
    probs = probability_forecast.get("probabilities", {})
    p_out = float(probs.get("outperform", probability_forecast.get("outperform_probability", 0.0)) or 0.0)
    p_neutral = float(probs.get("neutral", probability_forecast.get("neutral_probability", 0.0)) or 0.0)
    p_under = float(probs.get("underperform", probability_forecast.get("underperform_probability", 0.0)) or 0.0)
    probability_edge = p_out - p_under
    max_probability = max(p_out, p_neutral, p_under)
    is_calibrated = bool(probability_forecast.get("calibrated", False))
    confidence_gate = probability_forecast.get("confidence_gate", {}) or {}
    min_action_probability = float(confidence_gate.get("min_action_probability", 0.45) or 0.45)
    min_probability_edge = float(confidence_gate.get("min_probability_edge", 0.12) or 0.12)

    market_pressure_score = float(market_context.get("overall_market_pressure", 50.0))
    banking_support_score = float(market_context.get("banking_sector_score", 50.0))

    positive_context_score = ((100.0 - market_pressure_score) * 0.55) + (banking_support_score * 0.45)
    negative_context_score = (market_pressure_score * 0.7) + ((100.0 - banking_support_score) * 0.3)
    neutral_context_score = 100.0 - (abs(market_pressure_score - 50.0) * 1.15) - (abs(banking_support_score - 50.0) * 0.85)

    if probability_edge >= min_probability_edge and p_out >= min_action_probability:
        directional_bias = "positive"
        price_signal_score = 50.0 + min(45.0, abs(probability_edge) * 90.0 + max(0.0, p_out - 0.34) * 45.0)
        context_alignment_score = positive_context_score
    elif probability_edge <= -min_probability_edge and p_under >= min_action_probability:
        directional_bias = "negative"
        price_signal_score = 50.0 + min(45.0, abs(probability_edge) * 90.0 + max(0.0, p_under - 0.34) * 45.0)
        context_alignment_score = negative_context_score
    else:
        directional_bias = "neutral"
        price_signal_score = 55.0 + min(20.0, p_neutral * 25.0) - min(15.0, abs(probability_edge) * 50.0)
        context_alignment_score = neutral_context_score

    price_signal_score = _gioi_han_diem(price_signal_score)
    context_alignment_score = _gioi_han_diem(context_alignment_score)
    recommendation_score = int(round((price_signal_score * 0.65) + (context_alignment_score * 0.35)))
    strong_signal = directional_bias in ("positive", "negative")
    if strong_signal:
        confidence_score = 52.0 + (max_probability - min_action_probability) * 80.0 + abs(probability_edge) * 75.0
        confidence_score += 5.0 if is_calibrated else 0.0
    else:
        confidence_score = min(54.0, 25.0 + max_probability * 40.0 + abs(probability_edge) * 30.0)
    confidence_score = int(round(_gioi_han_diem(confidence_score)))

    recommendation = "TRUNG LẬP"
    recommendation_color = "#fcd535"
    recommendation_note = (
        f"Mô hình xác suất 5 phiên chưa tạo lợi thế đủ rõ sau bước hiệu chỉnh xác suất. "
        f"P(outperform)={p_out:.1%}, P(underperform)={p_under:.1%}."
    )

    if directional_bias == "positive" and recommendation_score >= 62:
        recommendation = "KHẢ QUAN"
        recommendation_color = "#0ecb81"
        recommendation_note = (
            f"Mô hình nghiêng về khả năng outperform peer group trong 5 phiên tới "
            f"với xác suất {p_out:.1%}; bối cảnh được dùng để hiệu chỉnh độ tin cậy."
        )
    elif directional_bias == "negative" and recommendation_score >= 62:
        recommendation = "KÉM KHẢ QUAN"
        recommendation_color = "#f6465d"
        recommendation_note = (
            f"Mô hình nghiêng về khả năng underperform peer group trong 5 phiên tới "
            f"với xác suất {p_under:.1%}; nên ưu tiên đọc theo hướng phòng thủ."
        )

    if confidence_score >= 75:
        confidence_label = "Cao"
    elif confidence_score >= 55:
        confidence_label = "Trung bình"
    else:
        confidence_label = "Quan sát"

    confidence_note = (
        "Cường độ tín hiệu phiên này được tính từ xác suất đã hiệu chỉnh, độ chênh giữa kịch bản "
        "outperform và underperform; nhãn 'Quan sát' nghĩa là mô hình chưa thấy lợi thế đủ rõ "
        "để khuyến nghị BUY/SELL — phù hợp đứng ngoài chờ tín hiệu mạnh hơn."
    )

    return {
        "recommendation": recommendation,
        "recommendation_color": recommendation_color,
        "recommendation_note": recommendation_note,
        "recommendation_confidence_score": confidence_score,
        "recommendation_confidence_label": confidence_label,
        "recommendation_confidence_note": confidence_note,
        "recommendation_score": recommendation_score,
        "price_signal_score": round(price_signal_score, 2),
        "context_alignment_score": round(context_alignment_score, 2),
        "directional_bias": directional_bias,
        "abstain_zone": {
            "active": directional_bias == "neutral",
            "min_action_probability": min_action_probability,
            "min_probability_edge": min_probability_edge,
        },
    }


def _luu_lich_su_tin_cay(ticker_name, snapshot):
    os.makedirs(CONFIDENCE_LOG_DIR, exist_ok=True)
    file_path = os.path.join(CONFIDENCE_LOG_DIR, f"{ticker_name.lower()}_confidence_history.jsonl")
    with open(file_path, "a", encoding="utf-8") as file_obj:
        file_obj.write(json.dumps(snapshot, ensure_ascii=False) + "\n")


def _doc_lich_su_tin_cay(ticker_name, limit=20):
    file_path = os.path.join(CONFIDENCE_LOG_DIR, f"{ticker_name.lower()}_confidence_history.jsonl")
    if not os.path.exists(file_path):
        return []

    rows = []
    with open(file_path, "r", encoding="utf-8") as file_obj:
        for line in file_obj:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    return rows[-limit:]


def _luu_lich_su_chat_luong_du_lieu(ticker_name, snapshot):
    os.makedirs(DATA_QUALITY_LOG_DIR, exist_ok=True)
    file_path = os.path.join(DATA_QUALITY_LOG_DIR, f"{ticker_name.lower()}_data_quality_history.jsonl")
    with open(file_path, "a", encoding="utf-8") as file_obj:
        file_obj.write(json.dumps(snapshot, ensure_ascii=False) + "\n")


def _thu_thap_tin_tuc_phuc_vu_boi_canh(ticker_name=None, limit=30):
    ticker_keywords = TU_KHOA_THEO_MA.get((ticker_name or "").upper(), [])
    base_keywords = set(
        TU_KHOA_CHUNG_TAI_CHINH
        + ticker_keywords
        + list(TU_KHOA_TICH_CUC.keys())
        + list(TU_KHOA_TIEU_CUC.keys())
        + list(TU_KHOA_NGAN_HANG_HO_TRO.keys())
        + list(TU_KHOA_NGAN_HANG_RUI_RO.keys())
        + list(TU_KHOA_VI_MO_RUI_RO.keys())
        + list(TU_KHOA_VI_MO_HO_TRO.keys())
        + list(TU_KHOA_CHINH_TRI_RUI_RO.keys())
        + list(TU_KHOA_CHINH_TRI_HA_NHIET.keys())
    )

    all_articles = []
    seen_links = set()

    for url in RSS_URLS:
        feed = feedparser.parse(url)
        for entry in getattr(feed, "entries", []):
            title = _lam_sach_van_ban(getattr(entry, "title", ""))
            description = _lam_sach_van_ban(getattr(entry, "description", ""))
            text = f"{title} {description}".lower()

            if ticker_name:
                if not any(keyword in text for keyword in base_keywords):
                    continue
            else:
                general_keywords = set(TU_KHOA_CHUNG_TAI_CHINH + [item for values in TU_KHOA_THEO_MA.values() for item in values])
                if not any(keyword in text for keyword in general_keywords):
                    continue

            link = getattr(entry, "link", "")
            if link in seen_links:
                continue
            seen_links.add(link)

            parsed_time = entry.published_parsed if hasattr(entry, "published_parsed") else time.localtime()
            all_articles.append(
                {
                    "title": title,
                    "description": description,
                    "link": link,
                    "source": _lay_nguon_tin(url),
                    "published": time.strftime("%d/%m/%Y %H:%M", parsed_time),
                    "timestamp": time.mktime(parsed_time),
                    "text": text,
                }
            )

    all_articles.sort(key=lambda item: item["timestamp"], reverse=True)
    return all_articles[:limit]


def _phan_tich_boi_canh_thi_truong(ticker_name):
    ticker_name = _kiem_tra_ticker_hop_le(ticker_name)
    articles = _thu_thap_tin_tuc_phuc_vu_boi_canh(ticker_name=ticker_name, limit=20)
    ticker_specific_keywords = TU_KHOA_RIENG_THEO_MA.get(ticker_name, {"positive": {}, "negative": {}})

    if not articles:
        return _tao_boi_canh_mac_dinh(ticker_name)

    weighted_sentiment = 0.0
    weighted_banking = 0.0
    weighted_macro = 0.0
    weighted_political = 0.0
    total_weight = 0.0
    signal_counter = {}
    headline_insights = []

    for index, article in enumerate(articles[:12]):
        article_weight = max(1.0, 12 - index)
        text = article["text"]
        ticker_hits = sum(1 for keyword in TU_KHOA_THEO_MA.get(ticker_name, []) if keyword in text)
        article_weight += ticker_hits * 2.5

        positive_score, positive_keywords = _dem_trong_so(text, TU_KHOA_TICH_CUC)
        negative_score, negative_keywords = _dem_trong_so(text, TU_KHOA_TIEU_CUC)
        bank_positive_score, bank_positive_keywords = _dem_trong_so(text, TU_KHOA_NGAN_HANG_HO_TRO)
        bank_negative_score, bank_negative_keywords = _dem_trong_so(text, TU_KHOA_NGAN_HANG_RUI_RO)
        ticker_positive_score, ticker_positive_keywords = _dem_trong_so(text, ticker_specific_keywords.get("positive", {}))
        ticker_negative_score, ticker_negative_keywords = _dem_trong_so(text, ticker_specific_keywords.get("negative", {}))
        macro_risk_score, macro_risk_keywords = _dem_trong_so(text, TU_KHOA_VI_MO_RUI_RO)
        macro_support_score, macro_support_keywords = _dem_trong_so(text, TU_KHOA_VI_MO_HO_TRO)
        political_risk_score, political_risk_keywords = _dem_trong_so(text, TU_KHOA_CHINH_TRI_RUI_RO)
        political_relief_score, political_relief_keywords = _dem_trong_so(text, TU_KHOA_CHINH_TRI_HA_NHIET)

        sentiment_score = _gioi_han_diem(
            50
            + (positive_score * 8)
            + (bank_positive_score * 5)
            + (ticker_positive_score * 5)
            - (negative_score * 8)
            - (bank_negative_score * 6)
            - (ticker_negative_score * 6)
            - (macro_risk_score * 2)
            - (political_risk_score * 3)
        )
        banking_sector_score = _gioi_han_diem(
            45
            + (bank_positive_score * 9)
            + (ticker_positive_score * 10)
            + (positive_score * 3)
            - (bank_negative_score * 11)
            - (ticker_negative_score * 12)
            - (negative_score * 3)
        )
        macro_pressure_score = _gioi_han_diem(25 + (macro_risk_score * 11) + (negative_score * 4) + (bank_negative_score * 2) + (ticker_negative_score * 2) - (macro_support_score * 9))
        political_score = _gioi_han_diem(15 + (political_risk_score * 13) - (political_relief_score * 10))

        weighted_sentiment += sentiment_score * article_weight
        weighted_banking += banking_sector_score * article_weight
        weighted_macro += macro_pressure_score * article_weight
        weighted_political += political_score * article_weight
        total_weight += article_weight

        matched_signals = (
            positive_keywords
            + negative_keywords
            + bank_positive_keywords
            + bank_negative_keywords
            + ticker_positive_keywords
            + ticker_negative_keywords
            + macro_risk_keywords
            + macro_support_keywords
            + political_risk_keywords
            + political_relief_keywords
        )

        for signal in matched_signals:
            signal_counter[signal] = signal_counter.get(signal, 0) + 1

        article_tag = "Bối cảnh chung"
        if political_risk_score > 0:
            article_tag = "Rủi ro chính trị"
        elif bank_positive_score > 0 or bank_negative_score > 0:
            article_tag = "Tín hiệu ngân hàng"
        elif macro_risk_score > 0 or macro_support_score > 0:
            article_tag = "Tín hiệu vĩ mô"
        elif negative_score > 0 or positive_score > 0:
            article_tag = "Tâm lý tin tức"

        headline_insights.append(
            {
                "title": article["title"],
                "source": article["source"],
                "published": article["published"],
                "tag": article_tag,
                "signal": ", ".join(matched_signals[:3]) if matched_signals else "Bối cảnh chung",
                "link": article["link"],
            }
        )

    news_sentiment_score = _gioi_han_diem(weighted_sentiment / total_weight)
    banking_sector_score = _gioi_han_diem(weighted_banking / total_weight)
    macro_pressure_score = _gioi_han_diem(weighted_macro / total_weight)
    political_risk_score = _gioi_han_diem(weighted_political / total_weight)
    overall_market_pressure = _gioi_han_diem(
        ((100 - news_sentiment_score) * 0.25)
        + ((100 - banking_sector_score) * 0.2)
        + (macro_pressure_score * 0.3)
        + (political_risk_score * 0.25)
    )

    if overall_market_pressure >= 70:
        overall_market_label = "Thận trọng cao"
    elif overall_market_pressure >= 45:
        overall_market_label = "Theo dõi sát"
    else:
        overall_market_label = "Tương đối ổn định"

    top_signals = [signal for signal, _ in sorted(signal_counter.items(), key=lambda item: item[1], reverse=True)[:5]]

    return {
        "ticker": ticker_name,
        "updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
        "news_sentiment_score": round(news_sentiment_score, 2),
        "news_sentiment_label": _gan_nhan_sentiment(news_sentiment_score),
        "banking_sector_score": round(banking_sector_score, 2),
        "banking_sector_label": _gan_nhan_xung_luc_ngan_hang(banking_sector_score),
        "macro_pressure_score": round(macro_pressure_score, 2),
        "macro_pressure_label": _gan_nhan_ap_luc(macro_pressure_score),
        "political_risk_score": round(political_risk_score, 2),
        "political_risk_label": _gan_nhan_rui_ro(political_risk_score),
        "overall_market_pressure": round(overall_market_pressure, 2),
        "overall_market_label": overall_market_label,
        "top_signals": top_signals if top_signals else ["Bối cảnh thị trường đang ở trạng thái trung tính."],
        "headline_insights": headline_insights[:5],
    }

def fetch_live_data(ticker_name):
    if FAST_DEMO_MODE:
        df = _doc_du_lieu_local_processed(ticker_name)
        df.attrs["data_source"] = "local_processed_fast_demo"
        return df

    today = datetime.datetime.today().strftime('%Y-%m-%d')
    try:
        if not _co_the_goi_vnstock_live():
            df = _doc_du_lieu_local_processed(ticker_name)
            df.attrs["data_source"] = "local_processed_rate_limit"
            return df
        stock = Vnstock().stock(symbol=ticker_name, source='KBS')
        df = stock.quote.history(start="2015-01-01", end=today)
        live_source = "vnstock_kbs"
    except SystemExit as exc:
        _danh_dau_vnstock_bi_gioi_han(exc)
        df = _doc_du_lieu_local_processed(ticker_name)
        df.attrs["data_source"] = "local_processed_kbs_system_exit"
        return df
    except Exception as exc:
        if _la_loi_gioi_han_api(exc):
            _danh_dau_vnstock_bi_gioi_han(exc)
            df = _doc_du_lieu_local_processed(ticker_name)
            df.attrs["data_source"] = "local_processed_kbs_rate_limit"
            return df
        try:
            if not _co_the_goi_vnstock_live():
                df = _doc_du_lieu_local_processed(ticker_name)
                df.attrs["data_source"] = "local_processed_vci_quota_guard"
                return df
            stock = Vnstock().stock(symbol=ticker_name, source='VCI')
            df = stock.quote.history(start="2015-01-01", end=today)
            live_source = "vnstock_vci"
        except SystemExit as exc:
            _danh_dau_vnstock_bi_gioi_han(exc)
            df = _doc_du_lieu_local_processed(ticker_name)
            df.attrs["data_source"] = "local_processed_vci_system_exit"
            return df
        except Exception as exc:
            _danh_dau_vnstock_bi_gioi_han(exc)
            df = _doc_du_lieu_local_processed(ticker_name)
            df.attrs["data_source"] = "local_processed_vci_error"
            return df
        
    df['time'] = pd.to_datetime(df['time'])
    df = df.sort_values(by='time').reset_index(drop=True)
    
    # Auto-Scaling
    fallback_path = f'data/processed/{ticker_name}_features.csv'
    if not os.path.exists(fallback_path):
        # Mã mới chưa có CSV → bỏ qua auto-scaling, tính features trực tiếp
        df['close'] = df['close'].interpolate(method='linear')
        df['volume'] = df['volume'].interpolate(method='linear')
        df['close_winsorized'] = np.clip(df['close'], df['close'].quantile(0.01), df['close'].quantile(0.99))
        df['sma_10'] = df['close_winsorized'].rolling(window=10).mean()
        df['sma_20'] = df['close_winsorized'].rolling(window=20).mean()
        delta = df['close_winsorized'].diff()
        rs = (delta.where(delta > 0, 0)).rolling(window=14).mean() / (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        df['rsi_14'] = 100 - (100 / (1 + rs))
        cleaned_df = df.dropna().reset_index(drop=True)
        cleaned_df.attrs["data_source"] = live_source
        return cleaned_df
    fallback_df = pd.read_csv(fallback_path)
    csv_price_max = fallback_df['close'].max()
    csv_vol_mean = fallback_df['volume'].mean()
    
    if df['close'].max() > csv_price_max * 10:
        for col in ['open', 'high', 'low', 'close']: df[col] = df[col] / 1000.0
            
    live_vol_mean = df['volume'].mean()
    if live_vol_mean > csv_vol_mean * 10 or live_vol_mean < csv_vol_mean / 10:
        ratio = live_vol_mean / csv_vol_mean
        scale_factor = 10 ** np.round(np.log10(ratio))
        df['volume'] = df['volume'] / scale_factor
        
    df['close'] = df['close'].interpolate(method='linear')
    df['volume'] = df['volume'].interpolate(method='linear')
    df['close_winsorized'] = np.clip(df['close'], df['close'].quantile(0.01), df['close'].quantile(0.99))
    df['sma_10'] = df['close_winsorized'].rolling(window=10).mean()
    df['sma_20'] = df['close_winsorized'].rolling(window=20).mean()
    delta = df['close_winsorized'].diff()
    rs = (delta.where(delta > 0, 0)).rolling(window=14).mean() / (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    df['rsi_14'] = 100 - (100 / (1 + rs))
    cleaned_df = df.dropna().reset_index(drop=True)
    cleaned_df.attrs["data_source"] = live_source
    return cleaned_df


def _danh_gia_chat_luong_du_lieu(df):
    if df is None or df.empty:
        return {
            "score": 0,
            "label": "Rất thấp",
            "issues": ["Không có dữ liệu để dự báo."],
            "source": "unknown",
        }

    issues = []
    score = 100.0
    required = ["open", "high", "low", "close_winsorized", "volume", "rsi_14"]
    missing_ratio = float(df[required].isna().mean().mean()) if all(col in df.columns for col in required) else 1.0
    if missing_ratio > 0:
        penalty = min(25.0, missing_ratio * 100.0)
        score -= penalty
        issues.append(f"Tỷ lệ thiếu dữ liệu khoảng {missing_ratio:.1%}.")

    if len(df) < 120:
        score -= 25.0
        issues.append("Số phiên dữ liệu ít, dễ làm mô hình kém ổn định.")
    elif len(df) < 260:
        score -= 10.0
        issues.append("Số phiên dữ liệu trung bình, nên theo dõi thêm.")

    close_series = pd.to_numeric(df.get("close_winsorized"), errors="coerce")
    volume_series = pd.to_numeric(df.get("volume"), errors="coerce")
    returns = close_series.pct_change()
    extreme_return_ratio = float((returns.abs() > 0.15).mean()) if len(returns) else 0.0
    if extreme_return_ratio > 0.02:
        score -= 20.0
        issues.append("Biến động giá bất thường cao, nghi ngờ dữ liệu nhiễu hoặc split chưa chuẩn.")

    non_positive_volume_ratio = float((volume_series <= 0).mean()) if len(volume_series) else 1.0
    if non_positive_volume_ratio > 0.01:
        score -= 15.0
        issues.append("Có phiên khối lượng <= 0, cần kiểm tra nguồn dữ liệu.")

    score = int(round(_gioi_han_diem(score)))
    if score >= 85:
        label = "Cao"
    elif score >= 65:
        label = "Trung bình"
    elif score >= 45:
        label = "Thấp"
    else:
        label = "Rất thấp"

    return {
        "score": score,
        "label": label,
        "issues": issues,
        "source": df.attrs.get("data_source", "unknown"),
    }


def _giam_cap_khuyen_nghi_neu_du_lieu_kem(recommendation_bundle, data_quality):
    if not recommendation_bundle:
        return recommendation_bundle
    quality_score = int(data_quality.get("score", 0))
    adjusted = dict(recommendation_bundle)
    if quality_score < DATA_QUALITY_BLOCK_THRESHOLD:
        adjusted["recommendation"] = "TRUNG LẬP"
        adjusted["recommendation_color"] = "#848e9c"
        adjusted["recommendation_confidence_label"] = "Thấp"
        adjusted["recommendation_confidence_score"] = min(
            int(adjusted.get("recommendation_confidence_score", 0)),
            35,
        )
        reason = "Dữ liệu đầu vào chất lượng thấp nên hệ thống hạ mức khuyến nghị về trung lập."
        adjusted["recommendation_note"] = reason
        adjusted["recommendation_confidence_note"] = reason
        adjusted["blocked_by_data_quality"] = True
    elif quality_score < 65:
        adjusted["recommendation_confidence_score"] = min(
            int(adjusted.get("recommendation_confidence_score", 0)),
            55,
        )
        adjusted["recommendation_confidence_note"] = (
            "Dữ liệu đầu vào còn nhiễu, hệ thống tự động hạ trần độ tin cậy để giảm rủi ro."
        )
        adjusted["blocked_by_data_quality"] = False
    else:
        adjusted["blocked_by_data_quality"] = False
    return adjusted

# Bộ nhớ Cache
AI_COMPONENTS = {}
# Cache ensemble models: load 1 lần, dùng cho mỗi request predict
ENSEMBLE_CACHE = {}

def get_regression_ensemble(ticker_name):
    """Load & cache danh sách ensemble models cho ticker (regression mode).

    Trả về list rỗng nếu ticker không có ensemble_seeds trong reg_config.
    """
    key = ticker_name.lower()
    if key not in ENSEMBLE_CACHE:
        models, _cfg = load_ensemble_models(key.upper())
        ENSEMBLE_CACHE[key] = models
    return ENSEMBLE_CACHE[key]


def get_ai_components(ticker_name):
    if ticker_name not in AI_COMPONENTS:
        model_key = ticker_name.lower()
        prob_config_path = os.path.join(MODELS_DIR, f'{model_key}_prob_config.pkl')
        prob_model_path = os.path.join(MODELS_DIR, f'cnn_lstm_attn_{model_key}_prob_v1.h5')
        prob_scaler_path = os.path.join(MODELS_DIR, f'{model_key}_prob_feature_scaler.pkl')
        prob_calibrator_path = os.path.join(MODELS_DIR, f'{model_key}_prob_calibrator.pkl')
        reg_model_path = os.path.join(MODELS_DIR, f'cnn_lstm_attn_{model_key}_v1.h5')
        reg_feature_scaler_path = os.path.join(MODELS_DIR, f'{model_key}_feature_scaler.pkl')
        reg_target_scaler_path = os.path.join(MODELS_DIR, f'{model_key}_target_scaler.pkl')
        reg_config_path = os.path.join(MODELS_DIR, f'{model_key}_reg_config.pkl')
        has_prob_bundle = all(os.path.exists(path) for path in (prob_model_path, prob_scaler_path, prob_config_path))
        has_reg_bundle = all(os.path.exists(path) for path in (reg_model_path, reg_feature_scaler_path, reg_target_scaler_path))
        if has_prob_bundle:
            model = load_model(
                prob_model_path,
                custom_objects={'AttentionLayer': AttentionLayer},
                compile=False,
            )
            with open(prob_scaler_path, 'rb') as f:
                f_scaler = pickle.load(f)
            with open(prob_config_path, 'rb') as f:
                prob_config = pickle.load(f)
            prob_calibrator = None
            if os.path.exists(prob_calibrator_path):
                with open(prob_calibrator_path, 'rb') as f:
                    prob_calibrator = pickle.load(f)
            AI_COMPONENTS[ticker_name] = (model, f_scaler, None, prob_config, prob_calibrator)
        elif has_reg_bundle:
            model = load_model(
                reg_model_path,
                custom_objects={'AttentionLayer': AttentionLayer},
                compile=False,
            )
            with open(reg_feature_scaler_path, 'rb') as f:
                f_scaler = pickle.load(f)
            with open(reg_target_scaler_path, 'rb') as f:
                t_scaler = pickle.load(f)
            reg_config = None
            if os.path.exists(reg_config_path):
                with open(reg_config_path, 'rb') as f:
                    reg_config = pickle.load(f)
            AI_COMPONENTS[ticker_name] = (model, f_scaler, t_scaler, reg_config, None)
        else:
            raise FileNotFoundError(f"Không tìm thấy bundle mô hình hợp lệ cho {ticker_name}.")
    return AI_COMPONENTS[ticker_name]

# Điểm cuối API 
@app.get("/api/predict/{ticker}")
def get_prediction(ticker: str):
    ticker = _kiem_tra_ticker_hop_le(ticker)
    now_ts = time.time()
    cached_item = PREDICTION_CACHE.get(ticker)
    if cached_item and (now_ts - cached_item["timestamp"] <= PREDICTION_CACHE_TTL_SECONDS):
        return cached_item["data"]

    try:
        df = fetch_live_data(ticker)
        data_quality = _danh_gia_chat_luong_du_lieu(df)
        _luu_lich_su_chat_luong_du_lieu(
            ticker,
            {
                "captured_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
                "ticker": ticker,
                "score": data_quality.get("score"),
                "label": data_quality.get("label"),
                "source": data_quality.get("source"),
                "issues": data_quality.get("issues", []),
                "block_threshold": DATA_QUALITY_BLOCK_THRESHOLD,
                "blocked": int(data_quality.get("score", 0)) < DATA_QUALITY_BLOCK_THRESHOLD,
            },
        )

        # Xây dựng phần chung (chart data, context)
        chart_columns = ['time', 'open', 'high', 'low', 'close_winsorized', 'volume', 'rsi_14']
        optional_history_columns = ['foreign_buy_volume', 'foreign_sell_volume', 'foreign_net_volume']
        chart_columns.extend([
            column for column in optional_history_columns
            if column in df.columns and df[column].notna().any()
        ])
        chart_data = df[chart_columns].copy()
        chart_data['time'] = chart_data['time'].astype(str)
        chart_data = chart_data.replace({np.nan: None})
        market_context = _lay_boi_canh_cached(ticker)
        
        # Nếu chưa có mô hình AI → trả data-only
        if not _has_trained_model(ticker):
            response_payload = {
                "ticker": ticker,
                "current_price": float(df['close_winsorized'].iloc[-1]),
                "current_volume": float(df['volume'].iloc[-1]),
                "rsi_14": float(df['rsi_14'].iloc[-1]),
                "latest_data_time": str(df['time'].iloc[-1]).split(' ')[0],
                "recommendation_threshold": 0.008,
                "model_available": False,
                "model_status": "Mô hình AI chưa được huấn luyện cho mã này. Chỉ hiển thị dữ liệu thị trường.",
                "data_quality": data_quality,
                "recommendation_blocked_by_data_quality": int(data_quality.get("score", 0)) < DATA_QUALITY_BLOCK_THRESHOLD,
                "predictions": [],
                "recommendation": "TRUNG LẬP",
                "recommendation_color": "#848e9c",
                "recommendation_note": "Chưa có mô hình AI — chỉ hiển thị dữ liệu lịch sử.",
                "recommendation_confidence_score": 0,
                "recommendation_confidence_label": "Không khả dụng",
                "recommendation_confidence_note": "",
                "recommendation_score": 0,
                "price_signal_score": 0,
                "context_alignment_score": 0,
                "analysis_signal_label": "",
                "analysis_signal": [],
                "market_context": market_context,
                "model_reliability": _lay_do_tin_cay_mo_hinh(ticker),
                "chart_data": chart_data.to_dict(orient="records"),
                "attention_weights": [],
            }
            PREDICTION_CACHE[ticker] = {"timestamp": now_ts, "data": response_payload}
            return response_payload

        # Có mô hình → chạy dự báo đệ quy 15 ngày
        model, feature_scaler, target_scaler, model_config, prob_calibrator = get_ai_components(ticker)
        is_probability_mode = bool(model_config and model_config.get("prediction_mode") == "alpha_probability")

        if is_probability_mode:
            features = model_config.get("feature_columns", FEATURE_COLUMNS)
            window_size = int(model_config.get("window_size", 30))
            model_input_df = prepare_live_probability_frame(
                ticker,
                df,
                tickers=tuple(model_config.get("peer_tickers", PROBABILITY_TICKERS)),
            )
        else:
            features = model_config.get("feature_columns", BASE_FEATURE_COLUMNS) if model_config else list(BASE_FEATURE_COLUMNS)
            window_size = int(model_config.get("window_size", 30)) if model_config else 30
            # Augment feature engineered nếu feature list yêu cầu (return_*, volatility_*,
            # alpha_*_vs_peer, rank_*, z_*_vs_peer...). Nếu CSV/live df chưa có các cột này,
            # gọi hàm augment để model.predict không bị KeyError.
            model_input_df = df.copy()
            needs_regression_aug = any(col in features for col in (
                'return_1d', 'return_3d', 'return_5d', 'return_10d',
                'volatility_10d', 'volatility_20d', 'drawdown_20d',
                'price_vs_sma10', 'price_vs_sma20', 'sma10_vs_sma20',
                'rsi_delta_5', 'volume_zscore_20',
            ))
            needs_cross_sectional_aug = any(col in features for col in (
                'benchmark_return_1d', 'benchmark_return_5d',
                'alpha_1d_vs_peer', 'alpha_5d_vs_peer',
                'rank_return_1d', 'rank_return_5d',
                'z_return_1d_vs_peer', 'rel_volatility_20d',
            ))
            if needs_regression_aug:
                model_input_df = _augment_regression_features(model_input_df)
            if needs_cross_sectional_aug:
                model_input_df = _augment_cross_sectional_features(model_input_df, ticker)
            # Drop NaN trên đúng subset features để tránh lỗi do foreign_* toàn NaN
            model_input_df = model_input_df.dropna(subset=[c for c in features if c in model_input_df.columns]).reset_index(drop=True)

        if len(model_input_df) < window_size:
            raise HTTPException(
                status_code=503,
                detail=f"Không đủ dữ liệu để dự báo cho {ticker}. Cần tối thiểu {window_size} phiên.",
            )

        current_unscaled_seq = model_input_df[features].tail(window_size).values.copy()
        current_price = model_input_df['close_winsorized'].iloc[-1]

        predictions = []
        probability_forecast = None
        if is_probability_mode:
            scaled_seq = feature_scaler.transform(current_unscaled_seq)
            X_in = np.array([scaled_seq])
            probabilities = model.predict(X_in, verbose=0).flatten()
            probabilities, calibrated = apply_probability_calibrator(probabilities, prob_calibrator)
            probability_forecast = probability_payload(probabilities, model_config, calibrated=calibrated)
        forecast_steps = 0 if is_probability_mode else DEFAULT_FORECAST_STEPS
        predicted_closes = list(df['close_winsorized'].tail(30).values)
        reg_target_type = (model_config or {}).get("target_type", "price_diff") if not is_probability_mode else None
        # Horizon: 1 = daily T+1, 5 = forward 5-day
        horizon_days = int((model_config or {}).get("horizon_days", 1)) if not is_probability_mode else 1
        # Map tên cột → index trong features để update đúng vị trí
        feature_idx = {name: idx for idx, name in enumerate(features)} if not is_probability_mode else {}
        # Ưu tiên ensemble averaging nếu có
        ensemble_models = get_regression_ensemble(ticker) if not is_probability_mode else []
        # Track tín hiệu gốc (raw log-return) để confidence gate dùng sau
        raw_predicted_log_return = 0.0
        starting_price = float(current_price)  # giá hiện tại (dùng cho interpolation horizon>1)

        def _set_feat(new_row, name, value):
            i = feature_idx.get(name)
            if i is not None:
                new_row[i] = value

        def _propagate_row(new_row, next_price, step_idx):
            """Cập nhật 1 row mới cho recursive forecast (horizon=1)."""
            predicted_closes.append(next_price)
            _set_feat(new_row, 'open', next_price)
            _set_feat(new_row, 'high', next_price * 1.005)
            _set_feat(new_row, 'low', next_price * 0.995)
            _set_feat(new_row, 'close_winsorized', next_price)
            if len(predicted_closes) >= 10:
                _set_feat(new_row, 'sma_10', float(np.mean(predicted_closes[-10:])))
            if len(predicted_closes) >= 20:
                _set_feat(new_row, 'sma_20', float(np.mean(predicted_closes[-20:])))
            log_prices = np.log(np.array(predicted_closes, dtype=float))
            for h in (1, 3, 5, 10):
                if len(log_prices) > h:
                    _set_feat(new_row, f'return_{h}d', float(log_prices[-1] - log_prices[-1 - h]))
            sma10_idx = feature_idx.get('sma_10')
            sma20_idx = feature_idx.get('sma_20')
            if sma10_idx is not None and new_row[sma10_idx]:
                _set_feat(new_row, 'price_vs_sma10', float(next_price / new_row[sma10_idx] - 1.0))
            if sma20_idx is not None and new_row[sma20_idx]:
                _set_feat(new_row, 'price_vs_sma20', float(next_price / new_row[sma20_idx] - 1.0))
                if sma10_idx is not None and new_row[sma20_idx]:
                    _set_feat(new_row, 'sma10_vs_sma20',
                              float(new_row[sma10_idx] / new_row[sma20_idx] - 1.0))
            return new_row

        # Nhánh A: horizon == 1 — recursive multi-step như cũ
        if not is_probability_mode and horizon_days == 1:
            for step in range(forecast_steps):
                scaled_seq = feature_scaler.transform(current_unscaled_seq)
                X_in = np.array([scaled_seq])
                if ensemble_models:
                    pred_scaled = predict_ensemble(ensemble_models, X_in)
                else:
                    pred_scaled = model.predict(X_in, verbose=0)
                pred_target = target_scaler.inverse_transform(pred_scaled).flatten()[0]
                if reg_target_type == "log_return":
                    next_price = current_price * float(np.exp(pred_target))
                    pred_diff = next_price - current_price
                    if step == 0:
                        raw_predicted_log_return = float(pred_target)
                else:
                    pred_diff = pred_target
                    next_price = current_price + pred_diff
                    if step == 0:
                        raw_predicted_log_return = (float(np.log(next_price / current_price))
                                                     if current_price > 0 else 0.0)
                predictions.append({"day": f"T+{step+1}",
                                    "predicted_diff": float(pred_diff),
                                    "predicted_price": float(next_price)})
                new_row = current_unscaled_seq[-1].copy()
                new_row = _propagate_row(new_row, next_price, step)
                current_unscaled_seq = np.vstack((current_unscaled_seq[1:], new_row))
                current_price = next_price

        # Nhánh B: horizon > 1 — single prediction + interpolation
        # Model output = log(P_{t+H}/P_t) tổng cộng H ngày. Ta phân đều thành
        # daily rate và sinh T+1..T+H (+ giữ nguyên plateau cho T+H+1..) để
        # frontend vẫn có multi-step forecast hiển thị.
        elif not is_probability_mode and horizon_days > 1:
            scaled_seq = feature_scaler.transform(current_unscaled_seq)
            X_in = np.array([scaled_seq])
            if ensemble_models:
                pred_scaled = predict_ensemble(ensemble_models, X_in)
            else:
                pred_scaled = model.predict(X_in, verbose=0)
            pred_target = target_scaler.inverse_transform(pred_scaled).flatten()[0]
            # Với horizon>1 target_type luôn là log_return (không hỗ trợ price_diff)
            total_log_return = float(pred_target)
            raw_predicted_log_return = total_log_return  # raw signal cho gate
            daily_rate = total_log_return / horizon_days
            for step in range(forecast_steps):
                # Trong H ngày đầu: tích luỹ daily_rate * (step+1)
                # Sau H ngày: giữ plateau (không có signal thêm)
                cumulative = daily_rate * min(step + 1, horizon_days)
                next_price = starting_price * float(np.exp(cumulative))
                pred_diff = next_price - starting_price
                predictions.append({"day": f"T+{step+1}",
                                    "predicted_diff": float(pred_diff),
                                    "predicted_price": float(next_price)})

        # Trích xuất Attention (tín hiệu hỗ trợ phân tích)
        last_30_df = df.tail(30).copy()
        volatility = abs(last_30_df['close_winsorized'].diff().fillna(0))
        norm_volatility = (volatility - volatility.min()) / (volatility.max() - volatility.min() + 1e-9)
        norm_volume = (last_30_df['volume'] - last_30_df['volume'].min()) / (last_30_df['volume'].max() - last_30_df['volume'].min() + 1e-9)
        raw_attention = (norm_volatility * 0.6) + (norm_volume * 0.4)
        attention_weights = (raw_attention / raw_attention.sum()).tolist()
        attention_data = [
            {"time": str(t).split(' ')[0], "weight": float(w)}
            for t, w in zip(last_30_df['time'], attention_weights)
        ]

        if probability_forecast:
            recommendation_bundle = _tinh_khuyen_nghi_xac_suat(
                probability_forecast=probability_forecast,
                market_context=market_context,
            )
        else:
            recommendation_bundle = _tinh_khuyen_nghi_va_do_tin_cay(
                current_price=float(df['close_winsorized'].iloc[-1]),
                predicted_price=float(predictions[0]["predicted_price"]),
                threshold=0.008,
                market_context=market_context,
            )
        recommendation_bundle = _giam_cap_khuyen_nghi_neu_du_lieu_kem(
            recommendation_bundle=recommendation_bundle,
            data_quality=data_quality,
        )

        # Confidence Gate: score = |pred_log_return| / ref_std_train
        # Frontend hiển thị badge "Tín hiệu mạnh" khi score >= threshold.
        confidence_gate_info = None
        if not is_probability_mode and raw_predicted_log_return is not None:
            ref_std = float((model_config or {}).get("train_log_return_std") or 0.0)
            if ref_std <= 0:
                # Fallback: ước lượng từ df (window gần nhất)
                recent_log_returns = np.log(df['close_winsorized'] / df['close_winsorized'].shift(1)).dropna()
                ref_std = float(np.std(recent_log_returns.tail(252))) if len(recent_log_returns) >= 30 else 0.02
            confidence_score = abs(float(raw_predicted_log_return)) / max(ref_std, 1e-9)
            # Threshold chuẩn theo coverage 20% (từ diagnostic): ~0.4 cho horizon=5
            gate_threshold = float((model_config or {}).get("confidence_threshold_cov20", 0.40))
            gate_passed = bool(confidence_score >= gate_threshold)
            confidence_gate_info = {
                "raw_predicted_log_return": float(raw_predicted_log_return),
                "reference_std": float(ref_std),
                "confidence_score": float(confidence_score),
                "threshold": float(gate_threshold),
                "passed": gate_passed,
                "label": ("Tín hiệu mạnh" if gate_passed else "Tín hiệu yếu — chờ thêm xác nhận"),
                "horizon_days": int(horizon_days),
            }
            # Nếu gate KHÔNG PASS và recommendation đang là KHẢ QUAN/KÉM KHẢ QUAN
            # hạ xuống TRUNG LẬP (đồng thuận với backtest: chỉ trade tín hiệu mạnh).
            if not gate_passed and recommendation_bundle.get("recommendation") in ("KHẢ QUAN", "KÉM KHẢ QUAN"):
                recommendation_bundle["recommendation"] = "TRUNG LẬP"
                recommendation_bundle["recommendation_color"] = "#fcd535"
                recommendation_bundle["recommendation_note"] = (
                    "Tín hiệu AI chưa vượt ngưỡng tự tin (confidence gate) — "
                    "ưu tiên theo dõi thêm trước khi ra quyết định."
                )
                recommendation_bundle["recommendation_confidence_label"] = "Thấp"

        _luu_lich_su_tin_cay(
            ticker,
            {
                "captured_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
                "ticker": ticker,
                "current_price": float(df['close_winsorized'].iloc[-1]),
                "predicted_price_t1": float(predictions[0]["predicted_price"]) if predictions else None,
                "prediction_mode": "alpha_probability" if probability_forecast else "price_regression",
                "outperform_probability": probability_forecast.get("outperform_probability") if probability_forecast else None,
                "neutral_probability": probability_forecast.get("neutral_probability") if probability_forecast else None,
                "underperform_probability": probability_forecast.get("underperform_probability") if probability_forecast else None,
                "recommendation": recommendation_bundle["recommendation"],
                "recommendation_confidence_score": recommendation_bundle["recommendation_confidence_score"],
                "recommendation_confidence_label": recommendation_bundle["recommendation_confidence_label"],
                "price_signal_score": recommendation_bundle["price_signal_score"],
                "context_alignment_score": recommendation_bundle["context_alignment_score"],
                "overall_market_pressure": market_context.get("overall_market_pressure", 50.0),
                "overall_market_label": market_context.get("overall_market_label", "Theo dõi thêm"),
            },
        )

        response_payload = {
            "ticker": ticker,
            "current_price": float(df['close_winsorized'].iloc[-1]),
            "current_volume": float(df['volume'].iloc[-1]),
            "rsi_14": float(df['rsi_14'].iloc[-1]),
            "latest_data_time": str(df['time'].iloc[-1]).split(' ')[0],
            "recommendation_threshold": 0.008,
            "model_available": True,
            "model_status": "Mô hình AI đã sẵn sàng và đang hoạt động ổn định.",
            "data_quality": data_quality,
            "recommendation_blocked_by_data_quality": bool(recommendation_bundle.get("blocked_by_data_quality", False)),
            "analysis_signal_label": "Tín hiệu hỗ trợ phân tích",
            "analysis_signal": attention_data,
            "market_context": market_context,
            "prediction_mode": "alpha_probability" if probability_forecast else "price_regression",
            "model_metadata": {
                "prediction_mode": "alpha_probability" if probability_forecast else "price_regression",
                "window_size": int(window_size),
                "feature_count": int(len(features)),
                "calibrated": bool(probability_forecast.get("calibrated", False)) if probability_forecast else False,
            },
            "probability_forecast": probability_forecast,
            "predictions": predictions,
            "horizon_days": int(horizon_days) if not is_probability_mode else 1,
            "confidence_gate": confidence_gate_info,
            **recommendation_bundle,
            "model_reliability": _lay_do_tin_cay_mo_hinh(ticker),
            "chart_data": chart_data.to_dict(orient="records"),
            "attention_weights": attention_data
        }
        PREDICTION_CACHE[ticker] = {
            "timestamp": now_ts,
            "data": response_payload,
        }
        return response_payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/context/{ticker}")
def get_market_context(ticker: str):
    try:
        return _lay_boi_canh_cached(ticker)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/confidence-history/{ticker}")
def get_confidence_history(ticker: str):
    ticker = _kiem_tra_ticker_hop_le(ticker)
    try:
        return {
            "ticker": ticker,
            "history": _doc_lich_su_tin_cay(ticker, limit=30),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


def _lay_anh_tu_entry_rss(entry):
    image_candidates = []

    for attr_name in ("media_content", "media_thumbnail", "enclosures"):
        attr_value = getattr(entry, attr_name, None)
        if isinstance(attr_value, list):
            for item in attr_value:
                if isinstance(item, dict):
                    candidate = item.get("url") or item.get("href")
                    if candidate:
                        image_candidates.append(candidate)

    links = getattr(entry, "links", None)
    if isinstance(links, list):
        for item in links:
            if not isinstance(item, dict):
                continue
            candidate = item.get("href")
            if candidate and str(item.get("type", "")).startswith("image/"):
                image_candidates.append(candidate)

    description = getattr(entry, "description", "") or getattr(entry, "summary", "")
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', description, flags=re.IGNORECASE)
    if match:
        image_candidates.append(match.group(1))

    for candidate in image_candidates:
        if isinstance(candidate, str) and candidate.startswith(("http://", "https://")):
            return candidate
    return None

@app.get("/api/news")
async def get_market_news(limit: int = Query(default=200, ge=20, le=400)):
    try:
        keywords = [
            'vcb', 'vietcombank', 'bid', 'bidv', 'ctg', 'vietinbank',
            'mbb', 'mb bank', 'tcb', 'techcombank', 'vpb', 'vpbank',
            'acb', 'hdb', 'hdbank', 'shb', 'vib',
            'lãi suất', 'nhnn', 'tín dụng', 'ngân hàng',
            'cổ phiếu', 'chứng khoán', 'vn-index',
        ]
        
        all_articles = []
        for source_config in RSS_SOURCES:
            url = source_config["url"]
            source = source_config["name"]
            try:
                feed = feedparser.parse(url)
            except Exception:
                continue

            source_articles = []
            for entry in getattr(feed, "entries", []):
                title = getattr(entry, "title", "")
                description = getattr(entry, "description", "") if hasattr(entry, "description") else ""
                title_lower = title.lower()
                desc_lower = description.lower()
                
                if any(kw in title_lower or kw in desc_lower for kw in keywords):
                    parsed_time = entry.published_parsed if hasattr(entry, 'published_parsed') else time.localtime()
                    source_articles.append({
                        "title": title,
                        "link": getattr(entry, "link", ""),
                        "published": time.strftime('%d/%m/%Y %H:%M', parsed_time),
                        "description": description,
                        "source": source,
                        "image_url": _lay_anh_tu_entry_rss(entry),
                        "timestamp": time.mktime(parsed_time)
                    })

            if source_articles:
                all_articles.extend(source_articles)
        
        all_articles.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Nâng số lượng tin tức lên 50 để đa dạng hơn, sau đó frontend có thể chọn lọc hiển thị
        deduped_articles = []
        seen_links = set()
        seen_title_time = set()
        for article in all_articles:
            article_link = (article.get("link") or "").strip()
            article_key = (
                (article.get("title") or "").strip().lower(),
                article.get("timestamp"),
            )
            if article_link and article_link in seen_links:
                continue
            if article_key in seen_title_time:
                continue
            if article_link:
                seen_links.add(article_link)
            seen_title_time.add(article_key)
            deduped_articles.append(article)

        return {"status": "success", "news": deduped_articles[:limit]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Gemini settings

@app.post("/api/chat")
async def ai_assistant(request: Request):
    try:
        body = await request.json()
        user_msg = body.get("message")
        ticker = body.get("ticker")
        current_data = body.get("current_data")

        context = f"""
        Bạn là một Chuyên gia Kinh tế trưởng, Giám đốc Đầu tư, đồng thời là một Nhà phân tích Địa chính trị quốc tế xuất sắc.

        QUY TẮC TRÌNH BÀY (BẮT BUỘC):
        - Dùng format ngắn gọn, chia đoạn 2-3 câu. Trình bày rành mạch.
        - Dùng gạch đầu dòng để bài viết sinh động.

        PHẠM VI TRẢ LỜI:
        - Sẵn sàng bàn luận sâu về TẤT CẢ các chủ đề: Chính trị thế giới (Ví dụ: Bầu cử Mỹ, xung đột quân sự, FED...), kinh tế toàn cầu, tin tức xã hội Việt Nam.
        - Nghệ thuật liên kết: Sau khi phân tích tình hình thế giới/Việt Nam, hãy luôn TÌM CÁCH LIÊN KẾT khéo léo xem sự kiện đó tác động thế nào đến nền kinh tế vĩ mô hoặc nhóm Big4 Ngân hàng (VCB, BID, CTG).
        - Nếu người dùng hỏi các câu thuần túy về lịch sử/đời sống, hãy cứ trả lời tự nhiên như một cuốn bách khoa toàn thư đa năng.

        [TÀI NGUYÊN THỜI GIAN THỰC]
        - Cổ phiếu người dùng đang xem: {ticker} (Giá: {current_data['price']}, Tín hiệu xu hướng AI: {current_data['predict']}). 
        - Điểm tin hôm nay: {current_data['news_summary']}
        - Bối cảnh thị trường: {current_data.get('market_context', 'Chưa có dữ liệu bối cảnh')}
        """
        
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        if not GROQ_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="Chưa cấu hình GROQ_API_KEY trên máy chủ."
            )
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": context},
                {"role": "user", "content": user_msg}
            ],
            "temperature": 0.7
        }
        
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Gửi lệnh đi và chờ kết quả
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            reply_text = result['choices'][0]['message']['content']
            return {"reply": reply_text}
        else:
            print("\n LỖI TỪ GROQ API:", response.text)
            raise HTTPException(status_code=response.status_code, detail="Lỗi phía server Groq")

    except Exception as e:
        print("\n LỖI HỆ THỐNG BACKEND:", str(e))
        raise HTTPException(status_code=500, detail="Mất kết nối API")
    
# API lấy thông tin doanh nghiệp
@app.get("/api/profile-live/{ticker}")
def get_company_profile_live(ticker: str, refresh: bool = False):
    try:
        return _lay_profile_cached(ticker_name=ticker.upper(), force_refresh=refresh)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/profile/{ticker}")
def get_company_profile(ticker: str):
    db = SessionLocal()
    try:
        profile = db.query(CompanyProfile).filter(CompanyProfile.ticker == ticker.upper()).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Không tìm thấy thông tin doanh nghiệp")
        
        return {
            "ticker": profile.ticker,
            "company_name": profile.company_name,
            "industry": profile.industry,
            "exchange": profile.exchange,
            "charter_capital": profile.charter_capital,
            "first_trading_date": profile.first_trading_date,
            "first_price": profile.first_price,
            "listed_shares": profile.listed_shares,
            "outstanding_shares": profile.outstanding_shares,
            "first_listed_shares": profile.first_listed_shares,
            "logo_url": BANK_LOGOS.get(profile.ticker) or profile.logo_url
        }
    finally:
        db.close()


# PHASE 2: Model Performance & Signal History 

def _doc_toan_bo_lich_su_tin_cay(ticker_name):
    """Đọc TOÀN BỘ confidence history (không giới hạn limit) cho performance analysis."""
    file_path = os.path.join(CONFIDENCE_LOG_DIR, f"{ticker_name.lower()}_confidence_history.jsonl")
    if not os.path.exists(file_path):
        return []
    rows = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def _parse_captured_at(date_str):
    """Parse ngày DD/MM/YYYY HH:MM:SS → datetime object."""
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            continue
    return None


def _safe_float(value, default=None):
    try:
        if value is None:
            return default
        if isinstance(value, str) and not value.strip():
            return default
        number = float(value)
        if np.isfinite(number):
            return number
        return default
    except (TypeError, ValueError):
        return default


def _bo_dau_tieng_viet(text):
    replacements = {
        "À": "A", "Á": "A", "Ả": "A", "Ã": "A", "Ạ": "A", "Ă": "A", "Ằ": "A", "Ắ": "A", "Ẳ": "A", "Ẵ": "A", "Ặ": "A", "Â": "A", "Ầ": "A", "Ấ": "A", "Ẩ": "A", "Ẫ": "A", "Ậ": "A",
        "È": "E", "É": "E", "Ẻ": "E", "Ẽ": "E", "Ẹ": "E", "Ê": "E", "Ề": "E", "Ế": "E", "Ể": "E", "Ễ": "E", "Ệ": "E",
        "Ì": "I", "Í": "I", "Ỉ": "I", "Ĩ": "I", "Ị": "I",
        "Ò": "O", "Ó": "O", "Ỏ": "O", "Õ": "O", "Ọ": "O", "Ô": "O", "Ồ": "O", "Ố": "O", "Ổ": "O", "Ỗ": "O", "Ộ": "O", "Ơ": "O", "Ờ": "O", "Ớ": "O", "Ở": "O", "Ỡ": "O", "Ợ": "O",
        "Ù": "U", "Ú": "U", "Ủ": "U", "Ũ": "U", "Ụ": "U", "Ư": "U", "Ừ": "U", "Ứ": "U", "Ử": "U", "Ữ": "U", "Ự": "U",
        "Ỳ": "Y", "Ý": "Y", "Ỷ": "Y", "Ỹ": "Y", "Ỵ": "Y", "Đ": "D",
    }
    normalized = str(text or "").upper()
    for src, dst in replacements.items():
        normalized = normalized.replace(src, dst)
    return normalized


def _lay_tone_tin_hieu(entry, current_price=None, predicted_price=None):
    predicted_class = str(entry.get("predicted_class") or entry.get("probability_predicted_class") or "").lower()
    if predicted_class == "outperform":
        return "positive"
    if predicted_class == "underperform":
        return "negative"
    if predicted_class == "neutral":
        return "neutral"

    raw = _bo_dau_tieng_viet(entry.get("recommendation", ""))
    if "KEM KHA QUAN" in raw or "BAN" in raw or "UNDERPERFORM" in raw:
        return "negative"
    if "KHA QUAN" in raw or "MUA" in raw or "OUTPERFORM" in raw:
        return "positive"
    if "TRUNG" in raw or "GIU" in raw or "HOLD" in raw or "NEUTRAL" in raw:
        return "neutral"

    p_out = _safe_float(entry.get("outperform_probability"))
    p_under = _safe_float(entry.get("underperform_probability"))
    if p_out is not None or p_under is not None:
        edge = (p_out or 0.0) - (p_under or 0.0)
        if edge >= 0.12:
            return "positive"
        if edge <= -0.12:
            return "negative"
        return "neutral"

    if current_price and predicted_price:
        change_ratio = (predicted_price - current_price) / current_price
        if change_ratio >= 0.001:
            return "positive"
        if change_ratio <= -0.001:
            return "negative"
    return "neutral"


def _direction_from_tone(tone):
    if tone == "positive":
        return "up"
    if tone == "negative":
        return "down"
    return "neutral"


def _actual_direction_from_return(return_percent, neutral_band=0.5):
    if return_percent is None:
        return "neutral"
    if return_percent >= neutral_band:
        return "up"
    if return_percent <= -neutral_band:
        return "down"
    return "neutral"


def _signal_result(signal_tone, actual_return_percent, neutral_band=0.5):
    actual_direction = _actual_direction_from_return(actual_return_percent, neutral_band)
    expected_direction = _direction_from_tone(signal_tone)
    return "correct" if expected_direction == actual_direction else "incorrect"


@app.get("/api/signal-history/{ticker}")
def get_signal_history(ticker: str, days: int = 90):
    """Trả về lịch sử tín hiệu BUY/SELL/HOLD với kết quả thực tế."""
    ticker = _kiem_tra_ticker_hop_le(ticker)
    try:
        rows = _doc_toan_bo_lich_su_tin_cay(ticker)
        if not rows:
            raise HTTPException(status_code=404, detail="Chưa có dữ liệu tín hiệu cho mã này.")

        # Parse, sort, deduplicate by day
        parsed = []
        for row in rows:
            dt = _parse_captured_at(row.get("captured_at", ""))
            if dt is None:
                continue
            parsed.append({**row, "_dt": dt})
        parsed.sort(key=lambda x: x["_dt"])

        daily = {}
        for entry in parsed:
            day_key = entry["_dt"].strftime("%Y-%m-%d")
            daily[day_key] = entry
        sorted_days = sorted(daily.keys())

        # Filter by number of days
        cutoff = datetime.datetime.now() - datetime.timedelta(days=days)
        filtered_days = [d for d in sorted_days if datetime.datetime.strptime(d, "%Y-%m-%d") >= cutoff]

        signals = []
        for i, day in enumerate(filtered_days):
            entry = daily[day]
            current = _safe_float(entry.get("current_price"), 0)
            predicted = _safe_float(entry.get("predicted_price_t1"))
            recommendation = entry.get("recommendation", "")
            confidence = _safe_float(entry.get("recommendation_confidence_score"), 50)
            signal_tone = _lay_tone_tin_hieu(entry, current, predicted)

            # Tìm actual price từ ngày tiếp theo
            day_idx = sorted_days.index(day)
            actual = None
            error_pct = None
            actual_return_pct = None
            actual_direction = None
            evaluation_date = None
            result = None
            if day_idx + 1 < len(sorted_days):
                next_entry = daily[sorted_days[day_idx + 1]]
                evaluation_date = sorted_days[day_idx + 1]
                actual = _safe_float(next_entry.get("current_price"))
                if actual and actual > 0 and current and current > 0:
                    if predicted and predicted > 0:
                        error_pct = round(abs(predicted - actual) / actual * 100, 4)
                    actual_return_pct = round(((actual - current) / current) * 100, 4)
                    actual_direction = _actual_direction_from_return(actual_return_pct)
                    result = _signal_result(signal_tone, actual_return_pct)

            signals.append({
                "date": day,
                "evaluation_date": evaluation_date,
                "recommendation": recommendation,
                "signal_tone": signal_tone,
                "confidence_score": confidence,
                "current_price": round(current, 2),
                "predicted_price": round(predicted, 2) if predicted else None,
                "actual_price": round(actual, 2) if actual else None,
                "actual_return_percent": actual_return_pct,
                "actual_direction": actual_direction,
                "error_percent": error_pct,
                "result": result,
                "prediction_mode": entry.get("prediction_mode") or "price_regression",
                "outperform_probability": _safe_float(entry.get("outperform_probability")),
                "neutral_probability": _safe_float(entry.get("neutral_probability")),
                "underperform_probability": _safe_float(entry.get("underperform_probability")),
            })

        # Summary
        evaluated = [s for s in signals if s["result"] is not None]
        correct = sum(1 for s in evaluated if s["result"] == "correct")
        win_rate = (correct / len(evaluated) * 100) if evaluated else 0

        return {
            "ticker": ticker,
            "days": days,
            "total_signals": len(signals),
            "evaluated": len(evaluated),
            "correct": correct,
            "win_rate_percent": round(win_rate, 2),
            "signals": list(reversed(signals)),  # Mới nhất trước
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# Endpoint: Sở hữu nước ngoài (Foreign Ownership) 
@app.get("/api/foreign-ownership/{ticker}")
def get_foreign_ownership(ticker: str):
    """Trả về cơ cấu sở hữu, cổ đông lớn và giao dịch khối ngoại."""
    ticker = _kiem_tra_ticker_hop_le(ticker)
    now_ts = time.time()
    cached_item = FOREIGN_OWNERSHIP_CACHE.get(ticker)
    if cached_item and (now_ts - cached_item["timestamp"] <= FOREIGN_OWNERSHIP_CACHE_TTL_SECONDS):
        return cached_item["data"]

    try:
        ssi_payload = _lay_room_va_dtnn_tu_ssi_iboard(ticker)
        if ssi_payload:
            FOREIGN_OWNERSHIP_CACHE[ticker] = {"timestamp": now_ts, "data": ssi_payload}
            return ssi_payload
    except Exception:
        pass

    try:
        stock = Vnstock().stock(symbol=ticker, source='KBS')

        # Cơ cấu sở hữu theo loại hình
        ownership_data = []
        try:
            df_own = stock.company.ownership()
            if df_own is not None and not df_own.empty:
                ownership_data = df_own.to_dict(orient='records')
        except Exception:
            pass

        # Danh sách cổ đông lớn
        shareholders_data = []
        try:
            df_sh = stock.company.shareholders()
            if df_sh is not None and not df_sh.empty:
                shareholders_data = df_sh.to_dict(orient='records')
        except Exception:
            pass

        # Khối lượng mua/bán nước ngoài hôm nay
        foreign_trading = {}
        try:
            from vnstock.explorer.kbs.trading import Trading as KBSTrading
            df_board = KBSTrading(ticker).price_board([ticker], get_all=True)
            if df_board is not None and not df_board.empty:
                row = df_board.iloc[0].to_dict()
                buy_volume = _ep_so_int(row.get("foreign_buy_volume"), 0)
                sell_volume = _ep_so_int(row.get("foreign_sell_volume"), 0)
                foreign_trading = {
                    "foreign_buy_volume": buy_volume,
                    "foreign_sell_volume": sell_volume,
                    "foreign_net_volume": buy_volume - sell_volume,
                    "foreign_ownership_ratio": row.get("foreign_ownership_ratio", None),
                    "source": PROFILE_EXTERNAL_PROVIDER_LABEL,
                }
        except Exception:
            pass

        foreign_room = _lay_room_ngoai_tu_vnstock(ticker) or {}

        response_payload = {
            "ticker": ticker,
            "source": PROFILE_EXTERNAL_PROVIDER_LABEL,
            "updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
            "foreign_room": foreign_room,
            "ownership_structure": ownership_data,
            "major_shareholders": shareholders_data,
            "foreign_trading_today": foreign_trading,
        }
        FOREIGN_OWNERSHIP_CACHE[ticker] = {"timestamp": now_ts, "data": response_payload}
        return response_payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi truy vấn dữ liệu sở hữu: {str(e)}")
