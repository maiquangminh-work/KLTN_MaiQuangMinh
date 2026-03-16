# Khóa luận Tốt nghiệp: 

**Đề tài:** Nghiên cứu mô hình học sâu lai ghép (CNN-LSTM-Attention) dự báo biến động giá cổ phiếu và xây dựng hệ thống hỗ trợ đầu tư cho nhóm ngân hàng nhà nước.

---

## Giới thiệu dự án
Dự án này nghiên cứu, đề xuất và hiện thực hóa quy trình dự báo biến động giá cổ phiếu khép kín. Cốt lõi của hệ thống là **kiến trúc học sâu lai ghép (Hybrid Deep Learning)** kết hợp hiệp đồng giữa ba thành phần:
* **1D-CNN:** Trích xuất tự động các đặc trưng hình thái vi mô và lọc nhiễu dữ liệu thị trường.
* **LSTM:** Ghi nhớ và học các phụ thuộc chuỗi thời gian dài hạn.
* **Attention Mechanism:** Linh hoạt phân bổ trọng số, tập trung vào các mốc thời gian nhạy cảm có tác động lớn đến xu hướng tương lai.

Sản phẩm đầu ra là một **Web Application** độc lập (Client-Server Architecture), cung cấp biểu đồ phân tích kỹ thuật, quỹ đạo dự báo giá và tín hiệu đầu tư cho 3 mã cổ phiếu ngân hàng quốc doanh: **VCB, BID, và CTG**.

## Công nghệ sử dụng
* **Mô hình Học sâu:** TensorFlow / Keras (Python)
* **Xử lý dữ liệu:** Pandas, NumPy, Scikit-learn (Jupyter Notebook)
* **Backend API:** Python (Tích hợp SQLite để quản lý dữ liệu)
* **Frontend Web:** ReactJS + Vite (JavaScript/CSS)

## Cấu trúc thư mục hệ thống
Dự án được tổ chức theo module hóa (Microservices approach) để dễ dàng bảo trì và mở rộng:

```text
KLTN_Demo/
│
├── data/                    # (Ignored) Quản lý dữ liệu dự án
│   ├── database/            # Cơ sở dữ liệu SQLite (stock_data.db)
│   ├── processed/           # Dữ liệu đã làm sạch & tính toán đặc trưng (Features)
│   └── raw/                 # Dữ liệu lịch sử giao dịch thô
│
├── frontend/                # Mã nguồn Giao diện Web App (React/Vite)
│   ├── public/              # Tài nguyên tĩnh
│   ├── src/                 # Các component React (App.jsx, main.jsx, css...)
│   └── package.json         # Danh sách thư viện Node.js
│
├── models/                  # (Ignored) Chứa file kết quả huấn luyện
│   ├── *.h5                 # Trọng số mạng nơ-ron CNN-LSTM-Attention của VCB, BID, CTG
│   ├── *.pkl                # Các bộ chuẩn hóa dữ liệu (Feature & Target Scalers)
│   └── *.png                # Biểu đồ đánh giá kết quả (Evaluation Plots)
│
├── notebooks/               # Các file thực nghiệm khoa học dữ liệu
│   └── 01_EDA_and_Data_Cleaning.ipynb  # Khám phá và làm sạch dữ liệu
│
├── src/                     # Mã nguồn xử lý lõi (Python Backend & Pipeline)
│   ├── backend/             # Tương tác CSDL (database.py)
│   ├── config/              # Cấu hình biến môi trường
│   ├── data_pipeline/       # Tự động hóa quá trình kéo dữ liệu (auto_fetch.py)
│   └── model/               # Kiến trúc mạng (architecture.py), huấn luyện và đánh giá
│
├── api.py                   # File gốc khởi chạy Backend Server API
├── requirements.txt         # Danh sách thư viện môi trường Python
└── README.md                # Tài liệu hướng dẫn dự án


Hướng dẫn cài đặt và Khởi chạy
Hệ thống được chia làm 2 phần độc lập: Backend (AI & API) và Frontend (Giao diện), cần chạy đồng thời cả 2 môi trường.

1. Cài đặt Backend (AI & CSDL)
Mở terminal tại thư mục gốc của dự án:

# Tạo và kích hoạt môi trường ảo
python -m venv venv
venv\Scripts\activate      # Dành cho Windows
# source venv/bin/activate # Dành cho macOS/Linux

# Cài đặt thư viện AI và API
pip install -r requirements.txt

# Khởi chạy Backend Server
python api.py
(Lưu ý: Các tập dữ liệu trong thư mục data/ và trọng số mô hình trong models/ cần được tải riêng và đặt đúng vị trí do giới hạn dung lượng lưu trữ).

2. Cài đặt Frontend (Giao diện Web)
Mở một tab terminal MỚI, di chuyển vào thư mục frontend:

cd frontend

# Cài đặt các gói thư viện Node.js
npm install

# Khởi chạy giao diện Web
npm run dev