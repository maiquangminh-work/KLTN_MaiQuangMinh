# MinSight Banking AI

**Đề tài khóa luận:** Nghiên cứu mô hình học sâu lai ghép (CNN-LSTM-Attention) dự báo biến động giá cổ phiếu và xây dựng hệ thống hỗ trợ đầu tư cho nhóm ngân hàng niêm yết Việt Nam.

---

## Phạm vi dự án

Dự án được chốt theo hai lớp phạm vi:

- **Phạm vi nghiên cứu chính:** 3 mã ngân hàng quốc doanh **VCB, BID, CTG**. Đây là nhóm dùng để trình bày trọng tâm khóa luận — đánh giá mô hình, so sánh kiến trúc, chạy walk-forward và kiểm định thống kê.
- **Phần mở rộng hệ thống demo:** Dashboard hỗ trợ thêm **MBB, TCB, VPB, ACB, HDB, SHB, VIB** để chứng minh khả năng mở rộng. Khi trình bày học thuật ưu tiên 3 mã chính; khi demo giới thiệu đủ 10 mã.

## Giới thiệu

**MinSight Banking AI** là hệ thống dự báo giá cổ phiếu ngân hàng dựa trên kiến trúc học sâu lai ghép (Hybrid Deep Learning) kết hợp ba thành phần:

- **1D-CNN:** Trích xuất đặc trưng hình thái vi mô từ chuỗi giá, lọc nhiễu thị trường.
- **LSTM:** Học các phụ thuộc chuỗi thời gian dài hạn.
- **Attention:** Phân bổ trọng số theo mốc thời gian quan trọng, hỗ trợ diễn giải mô hình (XAI).

Các cải tiến cốt lõi của luận văn:

- **VarianceMatchingMSE** (α·MSE + β·|σ̂−σ| + γ·directional) — tránh mô hình co về giá trung bình.
- **Ensemble 5-seed** (42, 123, 456, 789, 2024) — giảm phương sai theo luật số lớn (~1/√5).
- **Temperature scaling + Hybrid confidence gate** (volatility 60% + volume 40%) — hiệu chỉnh xác suất & lọc tín hiệu.
- **Walk-forward validation** 756d/126d/63d, slide +63d, H=5.
- **Statistical tests:** Diebold-Mariano, Pesaran-Timmermann, Binomial, Holm / BH-FDR.
- **Portfolio backtest** top-3 long-only, H=5 non-overlap, transaction cost 0.15%.

Sản phẩm đầu ra là **Web Application** client-server: biểu đồ kỹ thuật, quỹ đạo dự báo giá, tín hiệu đầu tư có hiệu chỉnh xác suất, và hỗ trợ phân tích tin tức theo mã.

## Công nghệ

- **Mô hình học sâu:** TensorFlow 2.x / Keras
- **Xử lý dữ liệu:** Pandas, NumPy, Scikit-learn
- **Backend API:** FastAPI + Uvicorn (SQLite)
- **Frontend:** React 18 + Vite + React Router + lightweight-charts
- **Dữ liệu thị trường:** vnstock (khớp lệnh & OHLCV)

## Cấu trúc thư mục

```text
Demo/
├── api.py                  # FastAPI backend (50+ endpoints: predict, market, news, chat, signal-history...)
├── config.py               # Danh sách mã được hỗ trợ, tên ngân hàng, logo, RSS aliases
├── requirements.txt        # Python dependencies
│
├── data/                   # (gitignored) Dữ liệu vận hành
│   ├── database/           # SQLite stock_data.db (dữ liệu OHLCV crawl từ vnstock)
│   ├── processed/          # CSV features đã tính toán (RSI, SMA, returns...)
│   ├── raw/                # Dữ liệu lịch sử thô theo mã
│   ├── confidence_logs/    # Lịch sử tín hiệu & confidence theo ngày (JSONL)
│   └── quality_logs/       # Log kiểm tra chất lượng dữ liệu
│
├── models/                 # Trọng số mô hình + kết quả thực nghiệm
│   ├── cnn_lstm_attn_*.h5  # Trọng số CNN-LSTM-Attention cho từng mã
│   ├── *_feature_scaler.pkl / *_target_scaler.pkl  # Bộ chuẩn hóa
│   ├── *_prob_*.pkl        # Probability calibrator (temperature scaling)
│   ├── probability_model_metrics.csv  # Backtest metrics dùng cho "Độ tin cậy mô hình"
│   ├── ablation/           # (gitignored) So sánh 7 biến thể kiến trúc
│   ├── backtest/           # Portfolio backtest artefacts
│   ├── walkforward/        # Walk-forward single-seed (VCB/BID/MBB)
│   ├── walkforward_ensemble/  # Walk-forward ensemble 5-seed (kết quả chính luận văn)
│   ├── ensemble/           # Checkpoints ensemble theo seed
│   ├── portfolio_backtest.md / .csv  # Báo cáo backtest danh mục
│   └── thesis_appendix.md  # Phụ lục thực nghiệm (DM/PT/Binomial tests, ablation, ensemble)
│
├── src/
│   ├── backend/            # database.py (SQLAlchemy CompanyProfile cache)
│   ├── config/             # Biến môi trường
│   ├── data_pipeline/      # auto_fetch.py (vnstock→SQLite), preprocess.py (→CSV features)
│   ├── model/              # Kiến trúc, huấn luyện, đánh giá, kiểm định
│   │   ├── architecture.py       # CNN-LSTM-Attention + AttentionLayer
│   │   ├── losses.py             # VarianceMatchingMSE
│   │   ├── train.py              # Huấn luyện đơn + ensemble
│   │   ├── probability.py        # Temperature scaling + hybrid gate
│   │   ├── train_probability.py  # Calibrator trainer
│   │   ├── evaluate.py / evaluate_walk_forward.py / evaluate_probability.py
│   │   ├── walk_forward.py       # Walk-forward engine
│   │   ├── ablation.py           # 7 biến thể kiến trúc
│   │   ├── backtest.py / portfolio_backtest.py
│   │   ├── statistical_tests.py  # DM, PT, Binomial, Holm/BH-FDR
│   │   ├── confidence.py         # Hybrid confidence gate runtime
│   │   ├── diagnostic_lag1.py    # Kiểm tra lag-1 shortcut
│   │   └── thesis_summary.py     # Gom metric xuất bảng LaTeX
│   └── frontend/           # (dự phòng) templates/helpers cũ
│
└── frontend/               # React SPA (Vite)
    ├── public/
    ├── src/
    │   ├── main.jsx / App.jsx
    │   ├── api/            # axios client + endpoints (predict, market, profile, chat, performance)
    │   ├── components/     # Chart panels, chat widget, header, footer
    │   ├── contexts/       # ThemeContext, MarketDataContext
    │   ├── hooks/          # useChartSetup, useNewsAnalytics, useChatWidget
    │   ├── pages/          # ChartPage, NewsPage, ProfilePage, AboutPage
    │   ├── styles/         # CSS modules theo chủ đề
    │   └── utils/          # formatting, recommendation, constants
    └── package.json
```

**4 route chính của SPA:**

| Route                  | Trang                 | Chức năng                                              |
|------------------------|-----------------------|--------------------------------------------------------|
| `/chart/:ticker`       | ChartPage             | Biểu đồ nến + dự báo H=1..5 + tín hiệu + attention     |
| `/info/:ticker`        | ProfilePage           | Hồ sơ ngân hàng + chỉ số cơ bản                       |
| `/news/:ticker?`       | NewsPage              | Tin tức tổng hợp + phân tích sắc thái                 |
| `/about`               | AboutPage             | Giới thiệu hệ thống & mô hình                         |

## Cài đặt & chạy

Hệ thống gồm backend (FastAPI) và frontend (Vite). Cần 2 terminal chạy song song.

### 1. Backend

```bash
# Tạo môi trường ảo
python -m venv venv
venv\Scripts\activate         # Windows
# source venv/bin/activate    # macOS / Linux

# Cài thư viện
pip install -r requirements.txt

# Chạy API (mặc định port 8000)
uvicorn api:app --reload
```

Dữ liệu trong `data/` và trọng số `models/*.h5` cần được sao chép riêng do dung lượng lớn (đã .gitignore).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # dev server (mặc định http://localhost:5173)
npm run build        # build production (kèm text-integrity check)
```

## Chạy thực nghiệm

### Walk-forward (single seed)

```bash
python src/model/evaluate_walk_forward.py --tickers VCB BID CTG --test-window-size 63
```

Kết quả: `models/walkforward/{TICKER}_windows.csv`.

### Walk-forward ensemble 5-seed (đề xuất cho báo cáo)

```bash
python src/model/walk_forward.py --tickers VCB --seeds 42 123 456 789 2024
```

Kết quả: `models/walkforward_ensemble/{TICKER}_windows.csv`.

### Kiểm định thống kê & xuất bảng LaTeX

```bash
python src/model/statistical_tests.py        # DM, PT, Binomial, Holm/BH-FDR
python src/model/thesis_summary.py           # Gom metric → phụ lục
```

### Portfolio backtest

```bash
python src/model/portfolio_backtest.py --top 3 --horizon 5 --tcost 0.0015
```

Kết quả: `models/portfolio_backtest.md` + `models/portfolio_backtest_daily.csv`.

## Tài liệu bổ sung

- `models/thesis_appendix.md` — Phụ lục đầy đủ (ablation, ensemble, DM/PT tests, portfolio backtest).
- `models/portfolio_backtest.md` — Kết quả backtest danh mục top-3.

## Ghi chú

- Startup API sẽ tự đồng bộ dữ liệu giá mới từ vnstock → SQLite → CSV features (chạy ngầm không chặn uvicorn).
- Mặc định `FAST_DEMO_MODE=1` (API đọc CSV đã tiền xử lý). Đặt `=0` để tính feature real-time.
- Backend chỉ hỗ trợ 10 mã trong `config.py`. Ticker ngoài danh sách bị từ chối ở tầng validate.
