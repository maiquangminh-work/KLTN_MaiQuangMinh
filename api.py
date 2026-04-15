from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pandas as pd
import numpy as np
import pickle
import datetime
import json
import os
import re
import sys
from functools import lru_cache
from vnstock import Vnstock
from tensorflow.keras.models import load_model
import feedparser
import time
import requests 
from src.backend.database import SessionLocal, CompanyProfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src/model')))
from architecture import AttentionLayer

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

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
ABLATION_DIR = os.path.join(MODELS_DIR, "ablation")
ABLATION_RESULTS_PATH = os.path.join(ABLATION_DIR, "ablation_results.csv")
CONFIDENCE_LOG_DIR = os.path.join(BASE_DIR, "data", "confidence_logs")
CONTEXT_CACHE_TTL_SECONDS = 300
MARKET_CONTEXT_CACHE = {}
COMPANY_PROFILE_CACHE_TTL_SECONDS = 43200
COMPANY_PROFILE_CACHE = {}
PREDICTION_CACHE_TTL_SECONDS = 180
PREDICTION_CACHE = {}
FAST_DEMO_MODE = os.getenv("FAST_DEMO_MODE", "1").strip().lower() in {"1", "true", "yes", "on"}

WEBSITE_NGAN_HANG_MAC_DINH = {
    "VCB": "https://www.vietcombank.com.vn",
    "BID": "https://bidv.com.vn",
    "CTG": "https://www.vietinbank.vn",
}

TU_VAN_NIEM_YET_MAC_DINH = {
    "VCB": {
        "name": "Công ty TNHH Chứng khoán Ngân hàng TMCP Ngoại thương Việt Nam",
        "link": "https://vcbs.com.vn/",
    },
    "BID": {
        "name": "Công ty CP Chứng khoán Ngân hàng Đầu tư và Phát triển Việt Nam",
        "link": "https://www.bsc.com.vn/",
    },
    "CTG": {
        "name": "Công ty Cổ phần Chứng khoán SSI",
        "link": "https://www.ssi.com.vn",
    },
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
}

THU_TU_MO_HINH = {
    "lstm_only": 0,
    "cnn_only": 1,
    "attention_only": 2,
    "cnn_lstm": 3,
    "lstm_attention": 4,
    "cnn_attention": 5,
    "cnn_lstm_attention": 6,
}

TEN_HIEN_THI_MO_HINH = {
    "lstm_only": "LSTM",
    "cnn_only": "CNN",
    "attention_only": "Attention",
    "cnn_lstm": "CNN-LSTM",
    "lstm_attention": "LSTM-Attention",
    "cnn_attention": "CNN-Attention",
    "cnn_lstm_attention": "CNN-LSTM-Attention",
}

RSS_URLS = [
    "https://cafef.vn/tai-chinh-ngan-hang.rss",
    "https://cafef.vn/thi-truong-chung-khoan.rss",
    "https://cafef.vn/doanh-nghiep.rss",
    "https://vietstock.vn/rss/tai-chinh.rss",
    "https://vietstock.vn/rss/chung-khoan.rss",
    "https://vietstock.vn/rss/doanh-nghiep.rss",
    "https://vnexpress.net/rss/kinh-doanh.rss",
    "https://vnexpress.net/rss/kinh-doanh/chung-khoan.rss",
    "https://baodautu.vn/ngan-hang.rss",
    "https://baodautu.vn/tai-chinh-chung-khoan.rss",
]

TU_KHOA_THEO_MA = {
    "VCB": ["vcb", "vietcombank"],
    "BID": ["bid", "bidv"],
    "CTG": ["ctg", "vietinbank"],
}

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
    if ticker_name not in ["VCB", "BID", "CTG"]:
        raise HTTPException(status_code=404, detail="Mã ngân hàng không hợp lệ")
    return ticker_name


@lru_cache(maxsize=1)
def _doc_ket_qua_ablation():
    if not os.path.exists(ABLATION_RESULTS_PATH):
        raise FileNotFoundError("Không tìm thấy file kết quả so sánh mô hình.")
    return pd.read_csv(ABLATION_RESULTS_PATH)


def _tao_url_anh_ablation(ticker_name, image_key):
    return f"/api/ablation/{ticker_name}/images/{image_key}"


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

    try:
        dataframe = getattr(company_component, method_name)(**kwargs)
        if isinstance(dataframe, pd.DataFrame):
            return dataframe
    except Exception:
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
    return {
        "ticker": ticker_name,
        "company_name": ticker_name,
        "industry": "Ngân hàng",
        "exchange": "HOSE",
        "charter_capital": None,
        "first_trading_date": None,
        "first_price": None,
        "listed_shares": None,
        "outstanding_shares": None,
        "first_listed_shares": None,
        "logo_url": None,
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
        "charter_capital_history": [],
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
            "profile_updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
            "profile_status": "live",
        }
    )
    return profile_data


def _crawl_profile_tu_vnstock(ticker_name):
    crawl_sources = [
        ("KBS", "KBS / KB Securities"),
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
        except Exception as exc:
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
    fallback_profile["website"] = fallback_profile.get("website") or WEBSITE_NGAN_HANG_MAC_DINH.get(ticker_name)

    if FAST_DEMO_MODE and not force_refresh:
        profile_data = dict(fallback_profile)
        profile_data.update(
            {
                "profile_source": "Dá»¯ liá»‡u ná»™i bá»™ (demo)",
                "profile_updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
                "profile_status": "fallback",
                "crawl_note": "Há»‡ thá»‘ng Ä‘ang cháº¡y á»Ÿ cháº¿ Ä‘á»™ demo nÃªn Æ°u tiÃªn hiá»ƒn thá»‹ dá»¯ liá»‡u ná»™i bá»™ Ä‘á»ƒ giá»¯ tá»‘c Ä‘á»™ vÃ  Ä‘á»™ á»•n Ä‘á»‹nh.",
            }
        )
        COMPANY_PROFILE_CACHE[ticker_name] = {
            "timestamp": current_time,
            "data": profile_data,
        }
        return profile_data

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
                "profile_source": "Dữ liệu dự phòng nội bộ",
                "profile_updated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
                "profile_status": "fallback",
                "crawl_note": "Không thể cập nhật hồ sơ trực tuyến ở thời điểm hiện tại, hệ thống đang dùng dữ liệu dự phòng.",
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
    if "cafef" in url:
        return "CafeF"
    if "vietstock" in url:
        return "Vietstock"
    if "vnexpress" in url:
        return "VNExpress"
    return "Báo Đầu Tư"


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
        context_data["top_signals"] = ["Cháº¿ Ä‘á»™ demo: Æ°u tiÃªn tá»‘c Ä‘á»™ vÃ  Ä‘á»™ á»•n Ä‘á»‹nh, bá»‘i cáº£nh Ä‘ang dÃ¹ng dá»¯ liá»‡u an toÃ n."]
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
        raise FileNotFoundError(f"KhÃ´ng tÃ¬m tháº¥y dá»¯ liá»‡u local cho {ticker_name}.")

    df = pd.read_csv(csv_path)
    if "time" not in df.columns:
        raise ValueError(f"Dá»¯ liá»‡u local cho {ticker_name} thiáº¿u cá»™t time.")

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
    threshold = float(threshold or 0.0004)
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
        confidence_label = "Thấp"

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
        return _doc_du_lieu_local_processed(ticker_name)

    today = datetime.datetime.today().strftime('%Y-%m-%d')
    try:
        stock = Vnstock().stock(symbol=ticker_name, source='DNSE')
        df = stock.quote.history(start="2015-01-01", end=today)
    except Exception:
        try:
            stock = Vnstock().stock(symbol=ticker_name, source='VCI')
            df = stock.quote.history(start="2015-01-01", end=today)
        except Exception:
            return _doc_du_lieu_local_processed(ticker_name)
        
    df['time'] = pd.to_datetime(df['time'])
    df = df.sort_values(by='time').reset_index(drop=True)
    
    # Auto-Scaling
    fallback_df = pd.read_csv(f'data/processed/{ticker_name}_features.csv')
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
    return df.dropna().reset_index(drop=True)

# Bộ nhớ Cache
AI_COMPONENTS = {}
def get_ai_components(ticker_name):
    if ticker_name not in AI_COMPONENTS:
        model = load_model(f'models/cnn_lstm_attn_{ticker_name.lower()}_v1.h5', custom_objects={'AttentionLayer': AttentionLayer})
        with open(f'models/{ticker_name.lower()}_feature_scaler.pkl', 'rb') as f: f_scaler = pickle.load(f)
        with open(f'models/{ticker_name.lower()}_target_scaler.pkl', 'rb') as f: t_scaler = pickle.load(f)
        AI_COMPONENTS[ticker_name] = (model, f_scaler, t_scaler)
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
        model, feature_scaler, target_scaler = get_ai_components(ticker)
        
        features = ['open', 'high', 'low', 'close_winsorized', 'volume', 'sma_10', 'sma_20', 'rsi_14']
        current_unscaled_seq = df[features].tail(30).values.copy()
        current_price = df['close_winsorized'].iloc[-1]
        
        predictions = []
        for step in range(3): 
            scaled_seq = feature_scaler.transform(current_unscaled_seq)
            X_in = np.array([scaled_seq])
            pred_scaled_diff = model.predict(X_in, verbose=0)
            pred_diff = target_scaler.inverse_transform(pred_scaled_diff).flatten()[0]
            next_price = current_price + pred_diff
            predictions.append({"day": f"T+{step+1}", "predicted_diff": float(pred_diff), "predicted_price": float(next_price)})
            
            new_row = current_unscaled_seq[-1].copy()
            new_row[3] = next_price 
            current_unscaled_seq = np.vstack((current_unscaled_seq[1:], new_row))
            current_price = next_price

        # Trích xuất Attention
        last_30_df = df.tail(30).copy()
        volatility = abs(last_30_df['close_winsorized'].diff().fillna(0))
        norm_volatility = (volatility - volatility.min()) / (volatility.max() - volatility.min() + 1e-9)
        norm_volume = (last_30_df['volume'] - last_30_df['volume'].min()) / (last_30_df['volume'].max() - last_30_df['volume'].min() + 1e-9)
        
        # Trọng số tổng hợp (Biến động giá + Đột biến khối lượng)
        raw_attention = (norm_volatility * 0.6) + (norm_volume * 0.4)
        attention_weights = (raw_attention / raw_attention.sum()).tolist()
        
        # Gắn ngày tháng tương ứng cho 30 trọng số này
        attention_data = [
            {"time": str(t).split(' ')[0], "weight": float(w)} 
            for t, w in zip(last_30_df['time'], attention_weights)
        ]

        chart_data = df[['time', 'open', 'high', 'low', 'close_winsorized', 'volume', 'rsi_14']].copy()
        chart_data['time'] = chart_data['time'].astype(str)
        market_context = _lay_boi_canh_cached(ticker)
        recommendation_bundle = _tinh_khuyen_nghi_va_do_tin_cay(
            current_price=float(df['close_winsorized'].iloc[-1]),
            predicted_price=float(predictions[0]["predicted_price"]),
            threshold=0.0004,
            market_context=market_context,
        )

        _luu_lich_su_tin_cay(
            ticker,
            {
                "captured_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
                "ticker": ticker,
                "current_price": float(df['close_winsorized'].iloc[-1]),
                "predicted_price_t1": float(predictions[0]["predicted_price"]),
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
            "recommendation_threshold": 0.0004,
            "analysis_signal_label": "Tín hiệu hỗ trợ phân tích",
            "analysis_signal": attention_data,
            "market_context": market_context,
            "predictions": predictions,
            **recommendation_bundle,
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


@app.get("/api/ablation/{ticker}")
def get_ablation_data(ticker: str):
    ticker = _kiem_tra_ticker_hop_le(ticker)

    try:
        ablation_df = _doc_ket_qua_ablation().copy()
        ticker_df = ablation_df[ablation_df["ticker"].str.upper() == ticker].copy()

        if ticker_df.empty:
            raise HTTPException(status_code=404, detail="Chưa có dữ liệu so sánh mô hình cho mã này.")

        ticker_df["sort_order"] = ticker_df["model_name"].map(THU_TU_MO_HINH)
        ticker_df = ticker_df.sort_values(by=["sort_order", "model_name"]).reset_index(drop=True)

        metrics = []
        for _, row in ticker_df.iterrows():
            model_name = row["model_name"]
            metrics.append(
                {
                    "model_name": model_name,
                    "model_label": TEN_HIEN_THI_MO_HINH.get(model_name, model_name),
                    "rmse": float(row["RMSE"]),
                    "mae": float(row["MAE"]),
                    "mape": float(row["MAPE"]),
                    "r2": float(row["R2"]),
                    "da": float(row["DA"]),
                    "forecast_chart_url": _tao_url_anh_ablation(ticker, model_name),
                }
            )

        return {
            "ticker": ticker,
            "default_model": "cnn_lstm_attention",
            "overview_chart_url": _tao_url_anh_ablation(ticker, "overview"),
            "original_price_chart_url": _tao_url_anh_ablation(ticker, "original"),
            "metrics": metrics,
        }
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/ablation/{ticker}/images/{image_key}")
def get_ablation_image(ticker: str, image_key: str):
    ticker = _kiem_tra_ticker_hop_le(ticker)
    ticker_dir = os.path.join(ABLATION_DIR, ticker)

    image_map = {
        "overview": f"{ticker}_ablation_chart.png",
        "original": f"{ticker}_original_price_chart.png",
    }

    if image_key in TEN_HIEN_THI_MO_HINH:
        file_name = f"{image_key}_forecast_vs_actual.png"
    else:
        file_name = image_map.get(image_key)

    if not file_name:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh yêu cầu.")

    file_path = os.path.join(ticker_dir, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Ảnh so sánh mô hình chưa được tạo.")

    return FileResponse(file_path, media_type="image/png")


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
        # 1. Bổ sung các nguồn báo uy tín và miễn phí
        rss_urls = RSS_URLS
        
        # 2. Mở rộng từ khóa
        keywords = ['vcb', 'vietcombank', 'bid', 'bidv', 'ctg', 'vietinbank', 'lãi suất', 'nhnn', 'tín dụng', 'ngân hàng', 'cổ phiếu', 'chứng khoán', 'vn-index']
        
        all_articles = []
        for url in rss_urls:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                title_lower = entry.title.lower()
                desc_lower = entry.description.lower() if hasattr(entry, 'description') else ""
                
                if any(kw in title_lower or kw in desc_lower for kw in keywords):
                    parsed_time = entry.published_parsed if hasattr(entry, 'published_parsed') else time.localtime()
                    
                    # Trích xuất nguồn báo từ link để hiển thị cho đẹp
                    source = "CafeF" if "cafef" in url else "Vietstock" if "vietstock" in url else "VNExpress" if "vnexpress" in url else "Báo Đầu Tư"
                    
                    all_articles.append({
                        "title": entry.title,
                        "link": entry.link,
                        "published": time.strftime('%d/%m/%Y %H:%M', parsed_time),
                        "description": entry.description if hasattr(entry, 'description') else "",
                        "source": source,
                        "image_url": _lay_anh_tu_entry_rss(entry),
                        "timestamp": time.mktime(parsed_time)
                    })
        
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

        # 1. AI context
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
        - Cổ phiếu người dùng đang xem: {ticker} (Giá: {current_data['price']}, Dự báo AI: {current_data['predict']}). 
        - Điểm tin hôm nay: {current_data['news_summary']}
        - Bối cảnh thị trường: {current_data.get('market_context', 'Chưa có dữ liệu bối cảnh')}
        """
        
        # 2. API key
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        if not GROQ_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="Chưa cấu hình GROQ_API_KEY trên máy chủ."
            )
        
        # 3. Call API 
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
            "logo_url": profile.logo_url
        }
    finally:
        db.close()


# ─── PHASE 2: Model Performance & Signal History ──────────────────────────────

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


def _tinh_performance_metrics(rows):
    """
    Tính toán các chỉ số hiệu suất từ lịch sử dự đoán.
    So sánh predicted_price_t1 của entry[i] với current_price của entry[i+1].
    """
    if len(rows) < 2:
        return {
            "prediction_pairs": [],
            "summary": {"total_predictions": 0, "da_percent": 0, "mape_percent": 0, "hit_rate_percent": 0},
            "weekly_metrics": [],
            "confusion_matrix": {"tp": 0, "fp": 0, "tn": 0, "fn": 0},
        }

    # Parse & sort by date
    parsed = []
    for row in rows:
        dt = _parse_captured_at(row.get("captured_at", ""))
        if dt is None:
            continue
        parsed.append({**row, "_dt": dt})
    parsed.sort(key=lambda x: x["_dt"])

    # Deduplicate: giữ entry cuối cùng mỗi ngày
    daily = {}
    for entry in parsed:
        day_key = entry["_dt"].strftime("%Y-%m-%d")
        daily[day_key] = entry
    sorted_days = sorted(daily.keys())

    # Tạo prediction pairs
    pairs = []
    for i in range(len(sorted_days) - 1):
        entry = daily[sorted_days[i]]
        next_entry = daily[sorted_days[i + 1]]

        predicted = float(entry.get("predicted_price_t1", 0))
        actual = float(next_entry.get("current_price", 0))
        current = float(entry.get("current_price", 0))

        if current <= 0 or actual <= 0 or predicted <= 0:
            continue

        error = abs(predicted - actual) / actual * 100
        pred_direction = 1 if predicted >= current else -1
        actual_direction = 1 if actual >= current else -1
        is_direction_correct = pred_direction == actual_direction

        pairs.append({
            "date": sorted_days[i],
            "next_date": sorted_days[i + 1],
            "current_price": round(current, 2),
            "predicted_price": round(predicted, 2),
            "actual_price": round(actual, 2),
            "error_percent": round(error, 4),
            "pred_direction": "up" if pred_direction == 1 else "down",
            "actual_direction": "up" if actual_direction == 1 else "down",
            "direction_correct": is_direction_correct,
            "recommendation": entry.get("recommendation", ""),
            "confidence_score": float(entry.get("recommendation_confidence_score", 50)),
        })

    # Summary metrics
    total = len(pairs)
    correct_dir = sum(1 for p in pairs if p["direction_correct"])
    avg_mape = sum(p["error_percent"] for p in pairs) / total if total > 0 else 0
    da_percent = (correct_dir / total * 100) if total > 0 else 0

    # Signal hit rate (chỉ tính tín hiệu BUY/SELL, bỏ HOLD/GIỮ)
    signal_pairs = [p for p in pairs if "GIỮ" not in p["recommendation"] and "TRUNG" not in p["recommendation"]]
    signal_hits = sum(1 for p in signal_pairs if p["direction_correct"])
    signal_total = len(signal_pairs)
    hit_rate = (signal_hits / signal_total * 100) if signal_total > 0 else 0

    # Confusion matrix cho direction (UP/DOWN)
    tp = sum(1 for p in pairs if p["pred_direction"] == "up" and p["actual_direction"] == "up")
    fp = sum(1 for p in pairs if p["pred_direction"] == "up" and p["actual_direction"] == "down")
    fn = sum(1 for p in pairs if p["pred_direction"] == "down" and p["actual_direction"] == "up")
    tn = sum(1 for p in pairs if p["pred_direction"] == "down" and p["actual_direction"] == "down")

    # Weekly metrics
    weekly = {}
    for p in pairs:
        dt = datetime.datetime.strptime(p["date"], "%Y-%m-%d")
        week_key = dt.strftime("%Y-W%W")
        if week_key not in weekly:
            weekly[week_key] = {"correct": 0, "total": 0, "mape_sum": 0}
        weekly[week_key]["total"] += 1
        weekly[week_key]["mape_sum"] += p["error_percent"]
        if p["direction_correct"]:
            weekly[week_key]["correct"] += 1

    weekly_metrics = []
    for wk in sorted(weekly.keys()):
        w = weekly[wk]
        weekly_metrics.append({
            "week": wk,
            "da_percent": round(w["correct"] / w["total"] * 100, 2) if w["total"] > 0 else 0,
            "mape_percent": round(w["mape_sum"] / w["total"], 4) if w["total"] > 0 else 0,
            "sample_count": w["total"],
        })

    return {
        "prediction_pairs": pairs,
        "summary": {
            "total_predictions": total,
            "correct_directions": correct_dir,
            "da_percent": round(da_percent, 2),
            "mape_percent": round(avg_mape, 4),
            "hit_rate_percent": round(hit_rate, 2),
            "signal_total": signal_total,
            "signal_hits": signal_hits,
        },
        "weekly_metrics": weekly_metrics,
        "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
    }


@app.get("/api/performance/{ticker}")
def get_model_performance(ticker: str):
    """Trả về dữ liệu hiệu suất mô hình: predicted vs actual, DA, MAPE, confusion matrix."""
    ticker = _kiem_tra_ticker_hop_le(ticker)
    try:
        rows = _doc_toan_bo_lich_su_tin_cay(ticker)
        if not rows:
            raise HTTPException(status_code=404, detail="Chưa có dữ liệu lịch sử dự đoán cho mã này.")

        perf = _tinh_performance_metrics(rows)

        # Kèm ablation data cho model comparison
        ablation_metrics = []
        try:
            ablation_df = _doc_ket_qua_ablation().copy()
            ticker_df = ablation_df[ablation_df["ticker"].str.upper() == ticker].copy()
            if not ticker_df.empty:
                ticker_df["sort_order"] = ticker_df["model_name"].map(THU_TU_MO_HINH)
                ticker_df = ticker_df.sort_values(by=["sort_order"]).reset_index(drop=True)
                for _, row in ticker_df.iterrows():
                    ablation_metrics.append({
                        "model_name": row["model_name"],
                        "model_label": TEN_HIEN_THI_MO_HINH.get(row["model_name"], row["model_name"]),
                        "rmse": round(float(row["RMSE"]), 4),
                        "mae": round(float(row["MAE"]), 4),
                        "mape": round(float(row["MAPE"]), 4),
                        "r2": round(float(row["R2"]), 4),
                        "da": round(float(row["DA"]), 2),
                        "is_default": row["model_name"] == "cnn_lstm_attention",
                    })
        except Exception:
            pass

        return {
            "ticker": ticker,
            "prediction_pairs": perf["prediction_pairs"],
            "summary": perf["summary"],
            "weekly_metrics": perf["weekly_metrics"],
            "confusion_matrix": perf["confusion_matrix"],
            "ablation_comparison": ablation_metrics,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
            current = float(entry.get("current_price", 0))
            predicted = float(entry.get("predicted_price_t1", 0))
            recommendation = entry.get("recommendation", "")
            confidence = float(entry.get("recommendation_confidence_score", 50))

            # Tìm actual price từ ngày tiếp theo
            day_idx = sorted_days.index(day)
            actual = None
            error_pct = None
            result = None
            if day_idx + 1 < len(sorted_days):
                next_entry = daily[sorted_days[day_idx + 1]]
                actual = float(next_entry.get("current_price", 0))
                if actual > 0:
                    error_pct = round(abs(predicted - actual) / actual * 100, 4)
                    pred_dir = 1 if predicted >= current else -1
                    actual_dir = 1 if actual >= current else -1
                    result = "correct" if pred_dir == actual_dir else "incorrect"

            signals.append({
                "date": day,
                "recommendation": recommendation,
                "confidence_score": confidence,
                "current_price": round(current, 2),
                "predicted_price": round(predicted, 2),
                "actual_price": round(actual, 2) if actual else None,
                "error_percent": error_pct,
                "result": result,
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
