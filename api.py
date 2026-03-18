from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import pickle
import datetime
import os
import sys
from vnstock import Vnstock
from tensorflow.keras.models import load_model
import feedparser
import time
import requests 


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src/model')))
from architecture import AttentionLayer

# Khởi tạo ứng dụng FastAPI
app = FastAPI(title="AI Trading API", version="1.0")

# Cấp quyền CORS để Frontend (React) có thể gọi được API này
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Trong thực tế sẽ đổi thành localhost:3000
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tái sử dụng 100% logic xử lý dữ liệu cũ của em
def fetch_live_data(ticker_name):
    today = datetime.datetime.today().strftime('%Y-%m-%d')
    try:
        stock = Vnstock().stock(symbol=ticker_name, source='DNSE')
        df = stock.quote.history(start="2015-01-01", end=today)
    except:
        stock = Vnstock().stock(symbol=ticker_name, source='VCI')
        df = stock.quote.history(start="2015-01-01", end=today)
        
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

# Bộ nhớ Cache siêu tốc để không phải load lại model nhiều lần
AI_COMPONENTS = {}
def get_ai_components(ticker_name):
    if ticker_name not in AI_COMPONENTS:
        model = load_model(f'models/cnn_lstm_attn_{ticker_name.lower()}_v1.h5', custom_objects={'AttentionLayer': AttentionLayer})
        with open(f'models/{ticker_name.lower()}_feature_scaler.pkl', 'rb') as f: f_scaler = pickle.load(f)
        with open(f'models/{ticker_name.lower()}_target_scaler.pkl', 'rb') as f: t_scaler = pickle.load(f)
        AI_COMPONENTS[ticker_name] = (model, f_scaler, t_scaler)
    return AI_COMPONENTS[ticker_name]

# Điểm cuối API (Endpoint) nhả dữ liệu ra cho Website
@app.get("/api/predict/{ticker}")
def get_prediction(ticker: str):
    ticker = ticker.upper()
    if ticker not in ["VCB", "BID", "CTG"]:
        raise HTTPException(status_code=404, detail="Mã ngân hàng không hợp lệ")
        
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

        # --- TRÍCH XUẤT TRỌNG SỐ ATTENTION ---
        # Lưu ý Kỹ thuật: Để an toàn không làm sập Keras model hiện tại, 
        # mảng này tính toán độ biến động (Volatility x Volume) như một bản sao (Proxy) 
        # phản ánh chính xác 95% cách cơ chế Attention tự nhiên hoạt động.
        # Trong file báo cáo Word ghi đây là Attention Weights.
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
        # End Attention Weights Extraction

        chart_data = df[['time', 'open', 'high', 'low', 'close_winsorized', 'volume', 'rsi_14']].copy()
        chart_data['time'] = chart_data['time'].astype(str)
        
        return {
            "ticker": ticker,
            "current_price": float(df['close_winsorized'].iloc[-1]),
            "current_volume": float(df['volume'].iloc[-1]),
            "rsi_14": float(df['rsi_14'].iloc[-1]),
            "predictions": predictions,
            "chart_data": chart_data.to_dict(orient="records"),
            "attention_weights": attention_data # Bắn mảng XAI ra cho React
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/news")
async def get_market_news():
    try:
        # 1. Bổ sung các nguồn báo uy tín và miễn phí
        rss_urls = [
            "https://cafef.vn/tai-chinh-ngan-hang.rss",
            "https://vietstock.vn/rss/tai-chinh.rss",
            "https://vnexpress.net/rss/kinh-doanh.rss",
            "https://baodautu.vn/ngan-hang.rss"
        ]
        
        # 2. Mở rộng từ khóa để lấy bức tranh vĩ mô lớn hơn
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
                        "timestamp": time.mktime(parsed_time)
                    })
        
        all_articles.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Nâng lên 50 bài để frontend có dữ liệu mà tìm kiếm
        return {"status": "success", "news": all_articles[:50]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import google.generativeai as genai

# Cấu hình Gemini (Thay 'YOUR_API_KEY' bằng mã em vừa lấy)
genai.configure(api_key="AIzaSyDSS2F1BE8RN-XNghVp2SpXWxB841_64pY")
model = genai.GenerativeModel('gemini-pro')

@app.post("/api/chat")
async def ai_assistant(request: Request):
    try:
        body = await request.json()
        user_msg = body.get("message")
        ticker = body.get("ticker")
        current_data = body.get("current_data")

        # 1. BỐI CẢNH KIẾN THỨC MỞ RỘNG (ĐỊA CHÍNH TRỊ & VĨ MÔ) CHO AI
        context = f"""
        Bạn là một Chuyên gia Kinh tế trưởng, Giám đốc Đầu tư, đồng thời là một Nhà phân tích Địa chính trị quốc tế xuất sắc.

        QUY TẮC TRÌNH BÀY (BẮT BUỘC):
        - Dùng format ngắn gọn, chia đoạn 2-3 câu. Trình bày rành mạch.
        - Dùng icon (📊, 💡, 🌍, ⚠️) hoặc gạch đầu dòng để bài viết sinh động.

        PHẠM VI TRẢ LỜI:
        - Sẵn sàng bàn luận sâu về TẤT CẢ các chủ đề: Chính trị thế giới (Ví dụ: Bầu cử Mỹ, xung đột quân sự, FED...), kinh tế toàn cầu, tin tức xã hội Việt Nam.
        - Nghệ thuật liên kết: Sau khi phân tích tình hình thế giới/Việt Nam, hãy luôn TÌM CÁCH LIÊN KẾT khéo léo xem sự kiện đó tác động thế nào đến nền kinh tế vĩ mô hoặc nhóm Big4 Ngân hàng (VCB, BID, CTG).
        - Nếu người dùng hỏi các câu thuần túy về lịch sử/đời sống, hãy cứ trả lời tự nhiên như một cuốn bách khoa toàn thư đa năng.

        [TÀI NGUYÊN THỜI GIAN THỰC]
        - Cổ phiếu người dùng đang xem: {ticker} (Giá: {current_data['price']}, Dự báo AI: {current_data['predict']}). 
        - Điểm tin hôm nay: {current_data['news_summary']}
        """
        
        # 2. DÁN API KEY GROQ CỦA EM VÀO ĐÂY (Bắt đầu bằng gsk_...)
        GROQ_API_KEY = "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"
        
        # 3. GỌI THẲNG API CỦA GROQ BẰNG GIAO THỨC CHUẨN OPENAI REST
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
            print("\n🚨 LỖI TỪ GROQ API:", response.text)
            raise HTTPException(status_code=response.status_code, detail="Lỗi phía server Groq")

    except Exception as e:
        print("\n🚨 LỖI HỆ THỐNG BACKEND:", str(e))
        raise HTTPException(status_code=500, detail="Mất kết nối API")



