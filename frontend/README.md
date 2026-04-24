# MinSight Banking AI — Frontend

Single-page application (React + Vite) cho hệ thống dự báo giá cổ phiếu ngân hàng.

## Công nghệ

- **React 18** + **Vite** (dev server, HMR, production build)
- **React Router v6** — điều hướng 4 trang chính
- **lightweight-charts** — biểu đồ nến & overlay dự báo
- **axios** — gọi backend FastAPI

## Cấu trúc

```text
frontend/src/
├── main.jsx / App.jsx          # Entry + layout shell + routes
├── api/                        # axios client + endpoints
├── components/                 # Header, Footer, ChatWidget, Panels
├── contexts/                   # Theme, MarketData
├── hooks/                      # useChartSetup, useNewsAnalytics, useChatWidget
├── pages/                      # ChartPage, NewsPage, ProfilePage, AboutPage
├── styles/                     # CSS modules
└── utils/                      # formatting, recommendation, constants
```

## Route

| Path                | Trang         | Mô tả                                    |
|---------------------|---------------|------------------------------------------|
| `/chart/:ticker`    | ChartPage     | Nến + dự báo H=1..5 + attention          |
| `/info/:ticker`     | ProfilePage   | Hồ sơ ngân hàng & chỉ số cơ bản         |
| `/news/:ticker?`    | NewsPage      | Tin tức tổng hợp theo mã                 |
| `/about`            | AboutPage     | Giới thiệu hệ thống                      |

## Lệnh phát triển

```bash
npm install        # cài deps
npm run dev        # dev server (http://localhost:5173)
npm run build      # production build (kèm text-integrity check)
npm run preview    # preview bản build
```

## Kết nối backend

Frontend gọi API tại `http://localhost:8000` (FastAPI). Cấu hình base URL ở `src/api/index.js` nếu deploy khác domain.
