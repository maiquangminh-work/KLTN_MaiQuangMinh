import streamlit as st
import pandas as pd
import numpy as np
import pickle
import os
import sys
import datetime
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from vnstock import Vnstock
from tensorflow.keras.models import load_model

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src/model')))
from architecture import AttentionLayer

# =================================================================
# 1. CẤU HÌNH TRANG WEB & CSS THEME BINANCE (ĐÃ XÓA DẢI TRẮNG)
# =================================================================
st.set_page_config(page_title="AI Trading Terminal", layout="wide", page_icon="📈")

st.markdown("""
<style>
    /* Nền hệ thống & Tiêu diệt dải trắng Header mặc định */
    header[data-testid="stHeader"] { display: none !important; }
    .stApp { background-color: #0b0e11; color: #eaecef; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .block-container { padding-top: 1rem; max-width: 98%; }
    
    /* THANH BÊN */
    [data-testid="stSidebar"] { background-color: #161a1e !important; border-right: 1px solid #2b3139; }
    [data-testid="stSidebar"] p, [data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2, [data-testid="stSidebar"] h3, [data-testid="stSidebar"] label { color: #ffffff !important; }
    
    /* Tab Gradient cho Radio Button */
    div.row-widget.stRadio > div { flex-direction: column; gap: 12px; }
    div.row-widget.stRadio > div > label {
        background: linear-gradient(145deg, #1e2329 0%, #2b3139 100%);
        padding: 15px; border-radius: 8px; border: 1px solid #3b424d;
        box-shadow: 2px 4px 10px rgba(0,0,0,0.3); cursor: pointer; transition: 0.2s;
    }
    div.row-widget.stRadio > div > label:hover { border-color: #fcd535; }
    div.row-widget.stRadio > div > label[data-checked="true"] {
        background: linear-gradient(145deg, #2b3139 0%, #fcd535 100%); border-color: #fcd535;
    }
    div.row-widget.stRadio > div > label[data-checked="true"] p { color: #000000 !important; font-weight: bold; }
    
    /* KHỐI TRUNG TÂM */
    div[data-testid="metric-container"] { background-color: #1e2329; border-radius: 6px; padding: 15px; border: 1px solid #2b3139; }
    h1, h2, h3, p, label { color: #eaecef !important; }
    [data-testid="stMetricDelta"] svg { display: inline-block !important; } 
</style>
""", unsafe_allow_html=True)

# =================================================================
# 2. HÀM TIỆN ÍCH & DỮ LIỆU
# =================================================================
def format_vnd(amount):
    formatted = f"{amount * 1000:,.2f}"
    parts = formatted.split('.')
    return f"{parts[0].replace(',', '.')},{parts[1]} VNĐ"

def format_delta(amount):
    formatted = f"{amount:+,.2f}"
    parts = formatted.split('.')
    return f"{parts[0].replace(',', '.')},{parts[1]} VNĐ"

bank_profiles = {
    "VCB": {"name": "Vietcombank", "desc": "Ngân hàng TMCP Ngoại thương Việt Nam. Vị thế số 1 về chất lượng tài sản."},
    "BID": {"name": "BIDV", "desc": "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam. Quy mô tổng tài sản lớn nhất hệ thống."},
    "CTG": {"name": "VietinBank", "desc": "Ngân hàng TMCP Công Thương Việt Nam. Trụ cột nền kinh tế quốc gia."}
}

# =================================================================
# 3. THANH BÊN (SIDEBAR)
# =================================================================
st.sidebar.image("https://cdn-icons-png.flaticon.com/512/2933/2933116.png", width=60) 
st.sidebar.markdown("### 🏦 TÀI SẢN PHÂN TÍCH")
ticker = st.sidebar.radio("Chọn mã ngân hàng:", ["VCB", "BID", "CTG"], index=0, label_visibility="collapsed")
st.sidebar.markdown("---")
st.sidebar.caption("Lõi xử lý: 1D-CNN + LSTM + Attention Mechanism.")
st.sidebar.caption(bank_profiles[ticker]['desc'])

# =================================================================
# 4. HÀM KÉO DỮ LIỆU & TẢI MÔ HÌNH
# =================================================================
@st.cache_data(ttl=3600)
def fetch_live_data(ticker_name):
    try:
        today = datetime.datetime.today().strftime('%Y-%m-%d')
        try:
            stock = Vnstock().stock(symbol=ticker_name, source='DNSE')
            df = stock.quote.history(start="2015-01-01", end=today)
        except:
            stock = Vnstock().stock(symbol=ticker_name, source='VCI')
            df = stock.quote.history(start="2015-01-01", end=today)
            
        if df is None or df.empty or 'time' not in df.columns: raise ValueError("Rỗng")
        df['time'] = pd.to_datetime(df['time'])
        df = df.sort_values(by='time').reset_index(drop=True)
        
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
    except Exception as e:
        fallback_df = pd.read_csv(f'data/processed/{ticker_name}_features.csv')
        fallback_df['time'] = pd.to_datetime(fallback_df['time'])
        return fallback_df

@st.cache_resource
def load_ai_components(ticker_name):
    model = load_model(f'models/cnn_lstm_attn_{ticker_name.lower()}_v1.h5', custom_objects={'AttentionLayer': AttentionLayer})
    with open(f'models/{ticker_name.lower()}_feature_scaler.pkl', 'rb') as f: f_scaler = pickle.load(f)
    with open(f'models/{ticker_name.lower()}_target_scaler.pkl', 'rb') as f: t_scaler = pickle.load(f)
    return model, f_scaler, t_scaler

# =================================================================
# 5. LUỒNG XỬ LÝ CHÍNH & RENDER GIAO DIỆN
# =================================================================
try:
    with st.spinner('🔄 Đang tải dữ liệu thị trường và chạy AI...'):
        df = fetch_live_data(ticker)
        model, feature_scaler, target_scaler = load_ai_components(ticker)
        
    features = ['open', 'high', 'low', 'close_winsorized', 'volume', 'sma_10', 'sma_20', 'rsi_14']
    current_unscaled_seq = df[features].tail(30).values.copy()
    current_price = df['close_winsorized'].iloc[-1]
    last_date = df['time'].iloc[-1]
    
    predictions = []
    for step in range(3): 
        scaled_seq = feature_scaler.transform(current_unscaled_seq)
        X_in = np.array([scaled_seq])
        pred_scaled_diff = model.predict(X_in, verbose=0)
        pred_diff = target_scaler.inverse_transform(pred_scaled_diff).flatten()[0]
        next_price = current_price + pred_diff
        predictions.append((pred_diff, next_price))
        
        new_row = current_unscaled_seq[-1].copy()
        new_row[3] = next_price 
        current_unscaled_seq = np.vstack((current_unscaled_seq[1:], new_row))
        current_price = next_price

    diff_t1, price_t1 = predictions[0]
    diff_t3, price_t3 = predictions[2]
    diff_vnd_t1 = diff_t1 * 1000
    diff_vnd_total_t3 = (price_t3 - df['close_winsorized'].iloc[-1]) * 1000

    # BẮT ĐẦU RENDER UI TRUNG TÂM
    st.markdown(f"<h2>{ticker} / VNĐ <span style='font-size: 18px; color: #848e9c; font-weight: normal;'> | {bank_profiles[ticker]['name']}</span></h2>", unsafe_allow_html=True)
    st.markdown("---")

    # MỞ RỘNG BIỂU ĐỒ: Tỷ lệ 7.5 : 2.5
    col_main, col_side = st.columns([7.5, 2.5], gap="medium")

    with col_main:
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Thị giá (VNĐ)", format_vnd(df['close_winsorized'].iloc[-1]).replace(" VNĐ", ""))
        m2.metric("Dự báo AI T+1", format_vnd(price_t1).replace(" VNĐ", ""), delta=format_delta(diff_vnd_t1).replace(" VNĐ", ""))
        m3.metric("RSI (14)", f"{df['rsi_14'].iloc[-1]:.2f}", delta="Quá Mua" if df['rsi_14'].iloc[-1] > 70 else ("Quá Bán" if df['rsi_14'].iloc[-1] < 30 else "Trung tính"), delta_color="inverse" if df['rsi_14'].iloc[-1] > 70 else "normal")
        m4.metric("Khối lượng 24h", f"{df['volume'].iloc[-1]:,.0f}")

        # VẼ ĐỒ THỊ ĐA TRỤC
        fig = make_subplots(rows=2, cols=1, shared_xaxes=True, vertical_spacing=0.03, row_heights=[0.75, 0.25])
        fig.add_trace(go.Candlestick(x=df['time'], open=df['open']*1000, high=df['high']*1000, low=df['low']*1000, close=df['close_winsorized']*1000, name='Giá', increasing_line_color='#0ecb81', decreasing_line_color='#f6465d'), row=1, col=1)
        
        future_dates = []
        temp_date = last_date
        while len(future_dates) < 3:
            temp_date += pd.Timedelta(days=1)
            if temp_date.weekday() < 5: future_dates.append(temp_date)
            
        future_prices_vnd = [price * 1000 for _, price in predictions]
        plot_dates = [last_date] + future_dates
        plot_prices = [df['close_winsorized'].iloc[-1] * 1000] + future_prices_vnd
        
        fig.add_trace(go.Scatter(x=plot_dates, y=plot_prices, mode='lines+markers+text', name='Dự báo AI', line=dict(color='#fcd535', width=2, dash='dash'), marker=dict(size=8, color='#fcd535'), text=["", "T+1", "T+2", "T+3"], textposition="top center"), row=1, col=1)
        
        colors = ['#0ecb81' if df['close_winsorized'].iloc[i] >= df['open'].iloc[i] else '#f6465d' for i in range(len(df))]
        fig.add_trace(go.Bar(x=df['time'], y=df['volume'], marker_color=colors, name='Volume'), row=2, col=1)

        # NÂNG CẤP POPUP (HOVERMODE) VÀ TIMEFRAME (1W MẶC ĐỊNH)
        fig.update_layout(
            template="plotly_dark", height=600, margin=dict(l=0, r=0, t=10, b=0),
            paper_bgcolor="#0b0e11", plot_bgcolor="#0b0e11",
            hovermode="x unified", # Gộp tất cả thông số vào 1 popup chạy theo chuột
            hoverlabel=dict(bgcolor="#1e2329", font_size=14, font_family="Segoe UI", font_color="#ffffff", bordercolor="#fcd535"),
            xaxis=dict(
                range=[last_date - pd.Timedelta(days=7), future_dates[-1] + pd.Timedelta(days=3)], # Zoom mặc định 1 Tuần
                rangeselector=dict(
                    buttons=list([
                        dict(count=7, label="1W", step="day", stepmode="backward"),
                        dict(count=1, label="1M", step="month", stepmode="backward"),
                        dict(count=3, label="3M", step="month", stepmode="backward"),
                        dict(count=6, label="6M", step="month", stepmode="backward"),
                        dict(count=1, label="1Y", step="year", stepmode="backward"),
                        dict(count=3, label="3Y", step="year", stepmode="backward"),
                        dict(step="all", label="ALL")
                    ]),
                    bgcolor="#1e2329", activecolor="#2b3139", font=dict(color="#eaecef")
                ),
                showgrid=False
            ),
            yaxis=dict(side="right", gridcolor="#2b3139", tickformat=",.0f"),
            yaxis2=dict(side="right", gridcolor="#2b3139", showgrid=False),
            showlegend=False
        )
        st.plotly_chart(fig, width="stretch")

    with col_side:
        st.markdown("<div style='background-color: #1e2329; padding: 20px; border-radius: 8px; border: 1px solid #2b3139; text-align: center; margin-bottom: 20px;'>", unsafe_allow_html=True)
        st.markdown("<h4 style='color: #848e9c; font-size: 14px; margin-bottom: 5px;'>HỆ THỐNG KHUYẾN NGHỊ T+1</h4>", unsafe_allow_html=True)
        if diff_vnd_t1 > 200: 
            st.markdown("<h1 style='color: #0ecb81; font-size: 42px; margin: 0;'>MUA</h1>", unsafe_allow_html=True)
            st.markdown("<p style='color: #0ecb81; font-size: 14px; margin-top: 5px;'>Động lượng tăng mạnh</p>", unsafe_allow_html=True)
        elif diff_vnd_t1 < -200: 
            st.markdown("<h1 style='color: #f6465d; font-size: 42px; margin: 0;'>BÁN</h1>", unsafe_allow_html=True)
            st.markdown("<p style='color: #f6465d; font-size: 14px; margin-top: 5px;'>Cảnh báo rủi ro giảm</p>", unsafe_allow_html=True)
        else: 
            st.markdown("<h1 style='color: #fcd535; font-size: 42px; margin: 0;'>GIỮ</h1>", unsafe_allow_html=True)
            st.markdown("<p style='color: #fcd535; font-size: 14px; margin-top: 5px;'>Trạng thái tích lũy</p>", unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)
        
        # NÂNG CẤP SỔ LỆNH: Render bằng HTML 
        st.markdown("<h4 style='color: #eaecef; font-size: 15px; border-bottom: 1px solid #2b3139; padding-bottom: 10px;'>Dòng Tiền Gần Nhất</h4>", unsafe_allow_html=True)
        
        # Lấy 15 dòng dữ liệu mới nhất
        df_book = df[['time', 'close_winsorized', 'volume']].tail(15).copy()
        df_book = df_book.sort_values('time', ascending=False).reset_index(drop=True)
        
        html_table = "<div style='background-color: #0b0e11; max-height: 400px; overflow-y: auto; overflow-x: hidden;'>"
        html_table += "<table style='width:100%; border-collapse: collapse; font-family: Segoe UI, sans-serif;'>"
        html_table += "<thead><tr style='color:#848e9c; font-size:12px; border-bottom:1px solid #2b3139;'><th style='text-align:left; padding:8px 4px; font-weight:normal;'>Ngày</th><th style='text-align:right; padding:8px 4px; font-weight:normal;'>Giá</th><th style='text-align:right; padding:8px 4px; font-weight:normal;'>Vol</th></tr></thead>"
        html_table += "<tbody>"
        
        for i in range(len(df_book)):
            current_price_val = df_book['close_winsorized'].iloc[i]
            # So sánh với ngày trước đó (dòng i+1 trong bảng đã sort) để xác định màu
            prev_price_val = df_book['close_winsorized'].iloc[i+1] if i < len(df_book)-1 else current_price_val
            color = "#0ecb81" if current_price_val >= prev_price_val else "#f6465d"
            
            date_str = df_book['time'].iloc[i].strftime('%d/%m')
            price_str = f"{current_price_val * 1000:,.0f}".replace(",", ".")
            vol_str = f"{df_book['volume'].iloc[i] / 1000:,.1f}K".replace(".", ",")
            
            html_table += f"<tr style='border-bottom: 1px solid #1e2329;'>"
            html_table += f"<td style='color: #eaecef; font-size: 13px; padding: 6px 4px; text-align:left;'>{date_str}</td>"
            html_table += f"<td style='color: {color}; font-size: 13px; padding: 6px 4px; text-align:right; font-weight:500;'>{price_str}</td>"
            html_table += f"<td style='color: #eaecef; font-size: 13px; padding: 6px 4px; text-align:right;'>{vol_str}</td>"
            html_table += "</tr>"
            
        html_table += "</tbody></table></div>"
        st.markdown(html_table, unsafe_allow_html=True)

except Exception as e:
    import traceback
    st.error(f"⚠️ Đã xảy ra lỗi hệ thống: {e}")
    st.code(traceback.format_exc())