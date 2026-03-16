import { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';

const formatVND = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(val) || 0));

const BANK_PROFILES = {
  'VCB': {
    logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/02/Logo-Vietcombank.png',
    name: 'Ngân hàng Thương mại cổ phần Ngoại thương Việt Nam',
    ma_cp: 'VCB', san_gd: 'HOSE', nhom_nganh: 'Ngân hàng thương mại',
    ngay_gd_dau: '30/06/2009', gia_dau: '60.0',
    von_dieu_le: '83,557 tỷ đồng', kl_niem_yet: '8,355,675,094', kl_luu_hanh: '8,355,675,094', kl_lan_dau: '112,285,426',
    tu_van: { name: 'Công ty TNHH Chứng khoán Ngân hàng TMCP Ngoại thương Việt Nam', link: 'https://vcbs.com.vn/' },
    auditors: [
      { year: '2024', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2023', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2022', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2020', name: 'Công ty TNHH KPMG Việt Nam', link: 'https://kpmg.com/xx/en.html' },
      { year: '2019', name: 'Công ty TNHH KPMG Việt Nam', link: 'https://kpmg.com/xx/en.html' },
      { year: '2018', name: 'Công ty TNHH KPMG Việt Nam', link: 'https://kpmg.com/xx/en.html' }
    ],
    chartData: [
      { quarter: 'Q4/2023', height: 65, value: '55,890' }, { quarter: 'Q1/2024', height: 65, value: '55,890' },
      { quarter: 'Q3/2024', height: 65, value: '55,890' }, { quarter: 'Q4/2024', height: 65, value: '55,890' },
      { quarter: 'Q1/2025', height: 90, value: '83,557' }, { quarter: 'Q2/2025', height: 90, value: '83,557' },
      { quarter: 'Q3/2025', height: 90, value: '83,557' }, { quarter: 'Q4/2025', height: 90, value: '83,557' }
    ]
  },
  'BID': {
    logo: 'https://news.mbbank.com.vn/file-service/uploads/v1/images/c21788de-1a22-48e0-a4ca-7bda44d5b2b4-logo-bidv-20220426071253.jpg?width=947&height=366',
    name: 'Ngân hàng Thương mại cổ phần Đầu tư và Phát triển Việt Nam',
    ma_cp: 'BID', san_gd: 'HOSE', nhom_nganh: 'Ngân hàng thương mại',
    ngay_gd_dau: '24/01/2014', gia_dau: '18.8',
    von_dieu_le: '68,975 tỷ đồng', kl_niem_yet: '7,021,361,917', kl_luu_hanh: '7,021,361,917', kl_lan_dau: '2,811,202,644',
    tu_van: { name: 'Công ty CP Chứng khoán Ngân hàng Đầu tư và Phát triển Việt Nam', link: 'https://www.bsc.com.vn/' },
    auditors: [
      { year: '2024', name: 'Công ty TNHH KPMG Việt Nam', link: 'https://kpmg.com/xx/en.html' },
      { year: '2023', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2022', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2021', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2020', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2019', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' }
    ],
    chartData: [
      { quarter: 'Q4/2023', height: 60, value: '50,585' }, { quarter: 'Q1/2024', height: 60, value: '50,585' },
      { quarter: 'Q3/2024', height: 60, value: '50,585' }, { quarter: 'Q4/2024', height: 75, value: '57,004' },
      { quarter: 'Q1/2025', height: 75, value: '57,004' }, { quarter: 'Q2/2025', height: 90, value: '68,975' },
      { quarter: 'Q3/2025', height: 90, value: '68,975' }, { quarter: 'Q4/2025', height: 90, value: '68,975' }
    ]
  },
  'CTG': {
    logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-VietinBank-CTG-Slo.png',
    name: 'Ngân hàng Thương mại cổ phần Công thương Việt Nam',
    ma_cp: 'CTG', san_gd: 'HOSE', nhom_nganh: 'Ngân hàng thương mại',
    ngay_gd_dau: '16/07/2009', gia_dau: '40.1',
    von_dieu_le: '77,670 tỷ đồng', kl_niem_yet: '7,766,944,637', kl_luu_hanh: '7,766,944,637', kl_lan_dau: '121,211,780',
    tu_van: { name: 'Công ty Cổ phần Chứng khoán SSI', link: 'https://www.ssi.com.vn' },
    auditors: [
      { year: '2024', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2023', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2020', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2019', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2018', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2017', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' }
    ],
    chartData: [
      { quarter: 'Q4/2023', height: 60, value: '53,700' }, { quarter: 'Q1/2024', height: 60, value: '53,700' },
      { quarter: 'Q3/2024', height: 60, value: '53,700' }, { quarter: 'Q4/2024', height: 60, value: '53,700' },
      { quarter: 'Q1/2025', height: 60, value: '53,700' }, { quarter: 'Q2/2025', height: 60, value: '53,700' },
      { quarter: 'Q3/2025', height: 60, value: '53,700' }, { quarter: 'Q4/2025', height: 85, value: '77,670' }
    ]
  }
};

function App() {
  const [ticker, setTicker] = useState('VCB');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [activeTab, setActiveTab] = useState('chart'); 
  const [newsData, setNewsData] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState('All');

  // --- PHẦN THÊM MỚI 1: STATE CHO CHATBOT ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'Chào Minh! Tôi đã nắm được dữ liệu Big4 hôm nay. Bạn cần giải thích gì không?' }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // --- HỆ THỐNG KÉO KÍCH THƯỚC GÓC TRÊN TRÁI ---
  const [chatSize, setChatSize] = useState({ width: 360, height: 550 }); // Kích thước mặc định

  const startResize = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    
    const handleMouseMove = (e) => {
      const newWidth = window.innerWidth - e.clientX - 25; 
      const newHeight = window.innerHeight - e.clientY - 105; 
      
      setChatSize({
        width: Math.max(320, Math.min(newWidth, 800)), // Ép giới hạn: Nhỏ nhất 320px, to nhất 800px
        height: Math.max(400, Math.min(newHeight, window.innerHeight - 100)) // Cao nhất không vượt quá trần
      });
    };

    const handleMouseUp = () => {
      // Hủy theo dõi chuột khi người dùng nhả click
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Bật chế độ theo dõi chuột toàn màn hình khi đang kéo
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const chatEndRef = useRef(null);

  const chartContainerRef = useRef(); 
  const attentionContainerRef = useRef(); 
  const tooltipRef = useRef(); 
  const attnTooltipRef = useRef();

  const handleBankChange = (bank) => {
    if (bank === ticker) return;
    setLoading(true); setError(null); setTicker(bank);
    setFilterMonth('All'); setFilterYear('All');
  };

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === 'news' && newsData.length === 0) setLoadingNews(true);
  };

  // Logic gửi tin nhắn và nhận phản hồi từ AI
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const currentPrice = data?.current_price || 0;
      const predictPrice = data?.predictions?.[0]?.predicted_price || 0;
      const newsSummary = newsData.slice(0, 3).map(n => n.title).join(". ");

      const res = await axios.post('http://127.0.0.1:8000/api/chat', {
        message: userMsg,
        ticker: ticker,
        current_data: {
          price: formatVND(currentPrice * 1000),
          predict: formatVND(predictPrice * 1000),
          news_summary: newsSummary
        }
      });
      setChatHistory(prev => [...prev, { role: 'ai', text: res.data.reply }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Mất kết nối với bộ não AI...' }]);
    } finally {
      setIsTyping(false);
    }
  };


  useEffect(() => {
    let isMounted = true;
    axios.get(`http://127.0.0.1:8000/api/predict/${ticker}`)
      .then(response => { if (isMounted) { setData(response.data); setLoading(false); } })
      .catch(() => { if (isMounted) { setError("Kết nối Backend thất bại."); setLoading(false); } });
    return () => { isMounted = false; };
  }, [ticker]);

  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'news' && newsData.length === 0) {
      axios.get(`http://127.0.0.1:8000/api/news`)
        .then(response => { if (isMounted) { setNewsData(response.data.news || []); setLoadingNews(false); } })
        .catch(() => { if (isMounted) setLoadingNews(false); });
    }
    return () => { isMounted = false; };
  }, [activeTab, newsData.length]);

  // =========================================================================
  // Xử lý dữ liệu và lọc trong dữ liệu để hiển thị

  const { sortedFullData, enrichedFullData, availableYears, availableMonths } = useMemo(() => {
    const safeChartData = Array.isArray(data?.chart_data) ? data.chart_data : [];
    const uniqueDataMap = new Map();
    
    safeChartData.forEach(item => {
      const rawTime = item.time || item.Time || "";
      const parsedTime = String(rawTime).split(' ')[0];
      if (parsedTime && parsedTime.length >= 8) {
         uniqueDataMap.set(parsedTime, {
          time: parsedTime, 
          open: (Number(item.open) || 0) * 1000, 
          high: (Number(item.high) || 0) * 1000, 
          low: (Number(item.low) || 0) * 1000, 
          close: (Number(item.close_winsorized || item.close) || 0) * 1000,
          volume: Number(item.volume) || 0,
          rsi_14: Number(item.rsi_14) || 50
        });
      }
    });

    const sortedData = Array.from(uniqueDataMap.values()).sort((a, b) => a.time.localeCompare(b.time));
    
    const enrichedData = sortedData.map((row, i, arr) => {
      const currentClose = row.close;
      const prevClose = i > 0 ? arr[i-1].close : currentClose;
      let colorClass = "text-yellow";
      if (currentClose > prevClose) colorClass = "text-green";
      if (currentClose < prevClose) colorClass = "text-red";
      
      const dateParts = row.time.split('-');
      return { ...row, colorClass, year: dateParts[0], month: dateParts[1] };
    });

    const years = [...new Set(enrichedData.map(d => d.year))].filter(Boolean).sort((a, b) => b - a); 
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    return { sortedFullData: sortedData, enrichedFullData: enrichedData, availableYears: years, availableMonths: months };
  }, [data]); // Tính toán lại 1 lần duy nhất khi data thay đổi

  const displayTableData = useMemo(() => {
    if (!enrichedFullData) return [];
    return enrichedFullData.filter(row => {
      const matchYear = filterYear === 'All' || row.year === filterYear;
      const matchMonth = filterMonth === 'All' || row.month === filterMonth;
      return matchYear && matchMonth;
    }).reverse(); 
  }, [enrichedFullData, filterYear, filterMonth]); // Chạy lại khi đổi filter hoặc data đã được enrich

  useEffect(() => {
    if (activeTab !== 'chart' || !data || !chartContainerRef.current || !attentionContainerRef.current) return;
    
    let mainChart, attnChart;
    let resizeObserver; 
    
    try {
      mainChart = createChart(chartContainerRef.current, {
        layout: { background: { type: 'solid', color: '#161a1e' }, textColor: '#848e9c' },
        grid: { vertLines: { color: '#2b3139' }, horzLines: { color: '#2b3139' } },
        width: chartContainerRef.current.clientWidth,
        height: 400,
        timeScale: { borderColor: '#2b3139' },
        crosshair: { mode: 1 } 
      });
      
      const candlestickSeries = mainChart.addSeries(CandlestickSeries, {
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false,
        wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
      });

      attnChart = createChart(attentionContainerRef.current, {
        layout: { background: { type: 'solid', color: '#161a1e' }, textColor: '#848e9c' },
        grid: { vertLines: { color: '#2b3139', visible: false }, horzLines: { color: '#2b3139', visible: false } },
        width: attentionContainerRef.current.clientWidth,
        height: 150,
        timeScale: { borderColor: '#2b3139' },
        crosshair: { mode: 1 },
        rightPriceScale: { visible: true, borderColor: '#2b3139' }, 
        leftPriceScale: { visible: false } 
      });

      const volumeSeries = attnChart.addSeries(HistogramSeries, { 
        priceFormat: { type: 'volume' },
        priceScaleId: 'right',
        scaleMargins: { top: 0.2, bottom: 0 },
      });

      const attentionLineSeries = attnChart.addSeries(LineSeries, { 
        color: '#f6465d', 
        lineWidth: 2, 
        crosshairMarkerVisible: true,
        priceScaleId: 'left' 
      });
      
      const recentChartData = sortedFullData.slice(-300);

      if (recentChartData.length > 0) {
        candlestickSeries.setData(recentChartData); 
        
        const volumeData = recentChartData.map(candle => ({
            time: candle.time,
            value: candle.volume,
            color: candle.close >= candle.open ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)'
        }));
        volumeSeries.setData(volumeData);
        
        try {
          if (data.attention_weights && Array.isArray(data.attention_weights)) {
            const uniqueAttnMap = new Map();
            data.attention_weights.forEach(item => {
               const rawTime = String(item.time || "").split(' ')[0];
               if (rawTime && rawTime.length >= 8) {
                   uniqueAttnMap.set(rawTime, { time: rawTime, value: (Number(item.weight) || 0) * 100 });
               }
            });

            const syncedAttnData = recentChartData.map(candle => {
              if (uniqueAttnMap.has(candle.time)) return uniqueAttnMap.get(candle.time);
              return { time: candle.time }; 
            });
            attentionLineSeries.setData(syncedAttnData);
          }
        } catch (attnErr) { console.error("Lỗi vẽ XAI:", attnErr); }

        mainChart.timeScale().subscribeVisibleLogicalRangeChange(timeRange => { if (timeRange !== null) attnChart.timeScale().setVisibleLogicalRange(timeRange); });
        attnChart.timeScale().subscribeVisibleLogicalRangeChange(timeRange => { if (timeRange !== null) mainChart.timeScale().setVisibleLogicalRange(timeRange); });

        if (recentChartData.length > 60) {
          mainChart.timeScale().setVisibleLogicalRange({ from: recentChartData.length - 60, to: recentChartData.length - 1 });
        } else { mainChart.timeScale().fitContent(); }

        mainChart.subscribeCrosshairMove(param => {
          if (!tooltipRef.current) return; 
          if (param.point === undefined || !param.time || param.point.x < 0 || param.point.x > chartContainerRef.current.clientWidth || param.point.y < 0 || param.point.y > chartContainerRef.current.clientHeight) {
            tooltipRef.current.style.display = 'none'; 
          } else {
            const candleData = param.seriesData.get(candlestickSeries);
            if (candleData) {
              tooltipRef.current.style.display = 'flex'; 
              tooltipRef.current.innerHTML = `
                <div><span style="color: #848e9c">Ngày:</span> ${param.time}</div>
                <div><span style="color: #848e9c">Mở:</span> <span style="color: #eaecef">${formatVND(candleData.open)}</span></div>
                <div><span style="color: #848e9c">Cao:</span> <span style="color: #0ecb81">${formatVND(candleData.high)}</span></div>
                <div><span style="color: #848e9c">Thấp:</span> <span style="color: #f6465d">${formatVND(candleData.low)}</span></div>
                <div><span style="color: #848e9c">Đóng:</span> <span style="font-weight: bold; color: #fcd535">${formatVND(candleData.close)}</span></div>
              `;
            }
          }
        });

        attnChart.subscribeCrosshairMove(param => {
          if (!attnTooltipRef.current) return; 
          if (param.point === undefined || !param.time || param.point.x < 0 || param.point.x > attentionContainerRef.current.clientWidth || param.point.y < 0 || param.point.y > attentionContainerRef.current.clientHeight) {
            attnTooltipRef.current.style.display = 'none'; 
          } else {
            const volData = param.seriesData.get(volumeSeries);
            const attnData = param.seriesData.get(attentionLineSeries);

            let html = '';
            if (volData) html += `<div style="margin-bottom: 5px;"><span style="color: #848e9c">Khối lượng: </span> <span style="color: #eaecef; font-weight: bold;">${formatVND(volData.value)}</span></div>`;
            if (attnData && attnData.value !== undefined) html += `<div><span style="color: #848e9c">Trọng số AI: </span> <span style="color: #f6465d; font-weight: bold;">${attnData.value.toFixed(2)}%</span></div>`;

            if (html) {
              attnTooltipRef.current.style.display = 'flex'; 
              attnTooltipRef.current.style.flexDirection = 'column';
              attnTooltipRef.current.innerHTML = html;
            } else { attnTooltipRef.current.style.display = 'none'; }
          }
        });
      }

      resizeObserver = new ResizeObserver(() => {
        if (chartContainerRef.current && mainChart) {
          mainChart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
        if (attentionContainerRef.current && attnChart) {
          attnChart.applyOptions({ width: attentionContainerRef.current.clientWidth });
        }
      });
      
      if (chartContainerRef.current) resizeObserver.observe(chartContainerRef.current);
      if (attentionContainerRef.current) resizeObserver.observe(attentionContainerRef.current);

    } catch (err) { console.error("Crash:", err); }
    
    return () => { 
      if (resizeObserver) resizeObserver.disconnect();
      if (mainChart) mainChart.remove(); 
      if (attnChart) attnChart.remove(); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeTab]); 

  const filteredNews = useMemo(() => {
    return newsData.filter(article => 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (article.description && article.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [newsData, searchQuery]);

  const cssStyles = `
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #2b3139; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #4b535d; }
    * { scrollbar-width: thin; scrollbar-color: #2b3139 transparent; }

    .app-container { min-height: 100vh; display: flex; flex-direction: column; background-color: #0b0e11; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif; }
    .header { padding: 15px 20px; border-bottom: 1px solid #2b3139; margin-bottom: 15px; }
    .header h1 { color: #eaecef; margin: 0; font-size: 20px; display: flex; align-items: center; gap: 10px; }
    .header span { color: #848e9c; font-size: 14px; font-weight: normal; }
    
    .btn-group { padding: 0 20px; margin-bottom: 15px; display: flex; gap: 10px; }
    .btn { background: #1e2329; color: #848e9c; border: 1px solid #2b3139; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: all 0.2s; }
    .btn:hover { background: #2b3139; color: #eaecef; }
    .btn.active { background: #fcd535; color: #1e2329; border-color: #fcd535; }
    
    .main-grid { display: grid; grid-template-columns: minmax(0, 2.4fr) minmax(0, 1fr); gap: 20px; padding: 0 20px; flex: 1; margin-bottom: 20px; }
    @media (max-width: 1100px) { .main-grid { grid-template-columns: 1fr; } } 
    
    .chart-section { min-width: 0; display: flex; flex-direction: column; } 
    .chart-section h2 { margin-top: 0; color: #eaecef; font-size: 18px; }
    
    .panel-section { min-width: 0; display: flex; flex-direction: column; gap: 15px; }
    .card { background: #1e2329; border-radius: 8px; border: 1px solid #2b3139; }
    .card h3 { color: #848e9c; font-size: 13px; margin: 0 0 10px 0; letter-spacing: 0.5px; }
    .price { font-size: 24px; font-weight: bold; color: #eaecef; }

    .text-green { color: #0ecb81 !important; } 
    .text-red { color: #f6465d !important; } 
    .text-yellow { color: #fcd535 !important; }
    
    .order-book { flex: 1; display: flex; flex-direction: column; min-height: 0; } 
    .order-book-scroll { flex: 1; overflow-y: auto; overflow-x: auto; padding-right: 5px; margin-top: 10px; }
    .order-book table { width: 100%; border-collapse: collapse; text-align: right; }
    .order-book th { text-align: right; color: #848e9c; padding-bottom: 10px; font-weight: normal; font-size: 12px; position: sticky; top: 0; background: #1e2329; z-index: 1; border-bottom: 1px solid #2b3139; }
    .order-book td { padding: 8px 4px; font-size: 13px; color: #eaecef; white-space: nowrap; border-bottom: 1px solid rgba(43, 49, 57, 0.3); } 
    .order-book th:first-child, .order-book td:first-child { text-align: left; }

    .filter-select { background: #161a1e; color: #eaecef; border: 1px solid #2b3139; padding: 4px 8px; border-radius: 4px; outline: none; font-size: 12px; cursor: pointer; }
    .filter-select:hover { border-color: #fcd535; }

    .nav-tabs { display: flex; gap: 20px; border-bottom: 1px solid #2b3139; margin-bottom: 20px; padding-left: 20px; }
    .nav-tab { padding: 10px 15px; cursor: pointer; color: #848e9c; font-weight: bold; border-bottom: 2px solid transparent; transition: all 0.2s; }
    .nav-tab:hover { color: #eaecef; }
    .nav-tab.active { color: #fcd535; border-bottom: 2px solid #fcd535; }
    
    .news-header { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; margin-bottom: 20px; }
    .search-input { background: #1e2329; border: 1px solid #2b3139; color: #eaecef; padding: 10px 15px; border-radius: 6px; width: 300px; outline: none; transition: border 0.2s; }
    .search-input:focus { border-color: #fcd535; }
    
    .news-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; padding: 0 20px; }
    .news-card { background: #1e2329; border-radius: 8px; overflow: hidden; border: 1px solid #2b3139; transition: transform 0.2s; display: flex; flexDirection: column; }
    .news-card:hover { transform: translateY(-5px); border-color: #fcd535; }
    .news-card a { text-decoration: none; color: inherit; display: block; padding: 15px; }
    .news-card h3 { color: #eaecef; font-size: 16px; margin: 0 0 10px 0; line-height: 1.4; }
    .news-meta { display: flex; justify-content: space-between; color: #848e9c; font-size: 12px; margin-bottom: 10px; }
    .news-source { color: #fcd535; font-weight: bold; }
    .news-card .desc { color: #848e9c; font-size: 13px; line-height: 1.5; }
    .news-card img { max-width: 100%; border-radius: 4px; margin-bottom: 10px; }

    .company-profile { background: #1e2329; border-radius: 8px; padding: 20px; margin: 0 20px; color: #eaecef; border: 1px solid #2b3139; }
    .cp-header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; border-bottom: 1px solid #2b3139; padding-bottom: 15px; flex-wrap: wrap; }
    .cp-logo-container { width: 120px; height: 120px; background: white; border-radius: 8px; display: flex; justify-content: center; align-items: center; overflow: hidden; padding: 10px; flex-shrink: 0; }
    .cp-logo { max-width: 100%; max-height: 100%; object-fit: contain; }
    .cp-title-group h2 { color: #f6465d; font-size: 24px; margin: 0 0 5px 0; }
    .cp-title-group p { color: #848e9c; margin: 0; font-size: 14px; }
    
    .cp-body { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 30px; }
    @media (max-width: 900px) { .cp-body { grid-template-columns: 1fr; } .cp-left { border-right: none !important; padding-right: 0 !important; border-bottom: 1px solid #2b3139; padding-bottom: 20px; } }
    
    .cp-left { border-right: 1px solid #2b3139; padding-right: 30px; }
    .cp-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); column-gap: 50px; row-gap: 15px; margin-bottom: 30px; }
    .stat-item { display: flex; justify-content: space-between; border-bottom: 1px dashed #2b3139; padding-bottom: 5px; }
    .stat-label { color: #848e9c; font-weight: bold; font-size: 14px; }
    .stat-value { font-weight: bold; text-align: right; font-size: 14px; }
    .val-blue { color: #2962ff; }
    
    .cp-chart-container { margin-top: 20px; overflow-x: auto; padding-bottom: 10px; }
    .cp-chart-title { text-align: center; font-weight: bold; margin-bottom: 20px; font-size: 16px; }
    .cp-bar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 150px; border-bottom: 1px solid #848e9c; border-left: 1px solid #848e9c; padding-bottom: 5px; margin-left: 40px; position: relative; min-width: 500px; }
    .cp-bar { width: 30px; background-color: #0b4a7b; transition: all 0.3s; position: relative; cursor: pointer; border-radius: 2px 2px 0 0; }
    .cp-bar:hover { background-color: #fcd535; }
    .bar-tooltip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: rgba(30, 35, 41, 0.95); border: 1px solid #2b3139; color: #eaecef; padding: 8px 12px; border-radius: 6px; font-size: 13px; white-space: nowrap; opacity: 0; pointer-events: none; transition: all 0.2s ease-in-out; margin-bottom: 5px; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    .cp-bar:hover .bar-tooltip { opacity: 1; bottom: calc(100% + 5px); }
    .cp-y-axis { position: absolute; left: -40px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #848e9c; text-align: right; width: 30px; }
    .cp-x-axis { display: flex; justify-content: space-around; margin-top: 5px; font-size: 11px; color: #848e9c; margin-left: 40px; min-width: 500px; }
    
    .cp-right h4 { margin-top: 0; color: #848e9c; font-size: 14px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
    .audit-list { display: flex; flex-direction: column; gap: 10px; }
    .audit-item { display: flex; justify-content: space-between; padding: 12px 15px; background: #161a1e; border-radius: 6px; border: 1px solid #2b3139; align-items: center; transition: border-color 0.2s; }
    .audit-item:hover { border-color: #fcd535; }
    .audit-year { font-weight: bold; color: #eaecef; width: 50px; font-size: 14px; }
    a.audit-name { color: #2962ff; font-weight: 500; font-size: 13px; text-align: right; text-decoration: none; transition: color 0.2s; }
    a.audit-name:hover { color: #fcd535; text-decoration: underline; }

    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .loader-spinner { border: 4px solid rgba(252, 213, 53, 0.2); border-top: 4px solid #fcd535; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; }
    
    // CSS chatbot
    .chat-widget { position: fixed; bottom: 25px; right: 25px; z-index: 9999; }
    .chat-bubble { width: 60px; height: 60px; background: #fcd535; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; border: none; box-shadow: 0 8px 24px rgba(0,0,0,0.5); transition: 0.3s; }
    .chat-bubble:hover { transform: scale(1.1); }
    .chat-window { 
      position: absolute; bottom: 80px; right: 0; 
      background: #1e2329; border: 1px solid #2b3139; border-radius: 12px; 
      display: flex; flex-direction: column; overflow: hidden; 
      box-shadow: 0 12px 40px rgba(0,0,0,0.6); 
    }
    .chat-header { background: #2b3139; padding: 15px; color: #fcd535; font-weight: bold; display: flex; justify-content: space-between; border-bottom: 1px solid #fcd535; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px; }
    .msg { max-width: 80%; padding: 10px; border-radius: 8px; font-size: 13px; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap; }
    .msg.user { align-self: flex-end; background: #fcd535; color: #000; border-bottom-right-radius: 0; }
    .msg.ai { align-self: flex-start; background: #2b3139; color: #eee; border-bottom-left-radius: 0; }
    .chat-input-area { padding: 12px; background: #161a1e; display: flex; gap: 10px; }
    .chat-input-area input { flex: 1; background: #2b3139; border: 1px solid #3b424a; color: #fff; padding: 8px; border-radius: 6px; outline: none; }
    .send-btn { background: #fcd535; border: none; padding: 0 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }
    `;

  if (error && activeTab === 'chart') return (
    <div style={{ background: '#0b0e11', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#f6465d' }}>
      <h1> {error}</h1>
      <button className="btn" onClick={() => window.location.reload()}>THỬ LẠI</button>
    </div>
  );

  const currentPrice = data?.current_price || 0;
  const predictedPrice = data?.predictions?.[0]?.predicted_price || 0;
  const priceDiff = predictedPrice - currentPrice;
  let recommendation = "GIỮ CỔ PHIẾU";
  let recColor = "#fcd535"; 
  // Để biên độ là 0.8% để hệ thống nhạy bén hơn với các biến động nhỏ
  if (priceDiff > currentPrice * 0.008) { 
      recommendation = "MUA VÀO"; 
      recColor = "#0ecb81"; 
  } 
  else if (priceDiff < -currentPrice * 0.008) { 
      recommendation = "BÁN RA"; 
      recColor = "#f6465d"; 
  }

  const profile = BANK_PROFILES[ticker];

  return (
    <div className="app-container">
      <style>{cssStyles}</style>
      
      {// Giao diện chatbot 
      }
      <div className="chat-widget">
        {isChatOpen && (
          <div className="chat-window" style={{ width: `${chatSize.width}px`, height: `${chatSize.height}px` }}>
            
            {/* Mở rộng kích thước boxchat */}
            <div 
              onMouseDown={startResize}
              style={{
                position: 'absolute', top: 0, left: 0, 
                width: '40px', height: '40px', 
                cursor: 'nwse-resize', zIndex: 9999
              }}
              title="Kéo để đổi kích thước"
            />
            {/* Icon kéo */}
            <div style={{ position: 'absolute', top: '8px', left: '10px', pointerEvents: 'none', color: '#fcd535', fontSize: '18px', zIndex: 10000, fontWeight: 'bold'}}>
              ↖
            </div>

            <div className="chat-header">
               <span style={{marginLeft: '25px'}}> TRỢ LÝ AI BANK</span>
               <button onClick={() => setIsChatOpen(false)} style={{background:'none', border:'none', color:'#848e9c', cursor:'pointer', fontSize: '20px'}}>×</button>
            </div>
            <div className="chat-messages">
              {chatHistory.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>{m.text}</div>
              ))}
              {isTyping && <div style={{fontSize:11, color:'#848e9c'}}>AI đang phân tích...</div>}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input-area">
              <input 
                type="text" 
                placeholder="Hỏi AI..." 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
              />
              <button className="send-btn" onClick={handleSendMessage}>GỬI</button>
            </div>
          </div>
        )}
        <button className="chat-bubble" onClick={() => setIsChatOpen(!isChatOpen)}>
          <span style={{fontSize:24}}>{isChatOpen ? '↓' : '💬'}</span>
        </button>
      </div>

      <div className="header">
        <h1>HỆ THỐNG AI HỖ TRỢ NGƯỜI DÙNG DỰ ĐOÁN CỔ PHIẾU <span>| Kỹ thuật: CNN-LSTM-Attention</span></h1>
      </div>
      
      <div className="nav-tabs">
        <div className={`nav-tab ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => handleTabChange('chart')}>
          BIỂU ĐỒ KỸ THUẬT
        </div>
        <div className={`nav-tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => handleTabChange('info')}>
          THÔNG TIN CƠ BẢN
        </div>
        <div className={`nav-tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => handleTabChange('news')}>
          TIN TỨC THỊ TRƯỜNG
        </div>
      </div>

      {(activeTab === 'chart' || activeTab === 'info') && (
        <div className="btn-group">
          {['VCB', 'BID', 'CTG'].map(bank => (
            <button key={bank} className={`btn ${ticker === bank ? 'active' : ''}`} onClick={() => handleBankChange(bank)}>
              {bank}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'chart' && (
        <div style={{ position: 'relative' }}>
          
          {loading && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(22, 26, 30, 0.65)', backdropFilter: 'blur(3px)', zIndex: 100,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              borderRadius: '12px'
            }}>
              <div className="loader-spinner"></div>
              <h3 style={{ color: '#fcd535', marginTop: '20px', letterSpacing: '1px' }}>⏳ ĐANG PHÂN TÍCH {ticker}...</h3>
            </div>
          )}

          <div className="main-grid" style={{ pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.5 : 1 }}>
            <div className="chart-section">
              <h2 style={{ marginBottom: '15px' }}>{ticker} / VNĐ</h2>
              <div style={{ position: 'relative', width: '100%', marginBottom: '15px' }}>
                <div ref={tooltipRef} style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, backgroundColor: 'rgba(30, 35, 41, 0.85)', padding: '10px', borderRadius: '6px', border: '1px solid #2b3139', fontSize: '13px', display: 'none', gap: '15px', pointerEvents: 'none' }}></div>
                <div ref={chartContainerRef} style={{ width: '100%' }}></div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '5px' }}>
                 <h4 style={{ color: '#848e9c', margin: 0, fontSize: '13px', letterSpacing: '1px' }}>KHỐI LƯỢNG GIAO DỊCH & ATTENTION HEATMAP</h4>
                 <div style={{ display: 'flex', gap: '15px' }}>
                   <span style={{ fontSize: '11px', color: '#0ecb81' }}>■ Vol Tăng</span>
                   <span style={{ fontSize: '11px', color: '#f6465d' }}>■ Vol Giảm</span>
                   <span style={{ fontSize: '11px', color: '#f6465d', fontWeight: 'bold' }}>— Line Đỏ (AI Attention)</span>
                 </div>
              </div>

              <div style={{ position: 'relative', width: '100%', borderTop: '1px solid #2b3139', paddingTop: '10px' }}>
                 <div ref={attnTooltipRef} style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, backgroundColor: 'rgba(30, 35, 41, 0.85)', padding: '8px 12px', borderRadius: '6px', border: '1px solid #2b3139', fontSize: '13px', display: 'none', gap: '10px', pointerEvents: 'none' }}></div>
                <div ref={attentionContainerRef} style={{ width: '100%' }}></div>
              </div>
            </div>

            <div className="panel-section">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="card" style={{ padding: '15px' }}>
                  <h3>THỊ GIÁ HIỆN TẠI</h3>
                  <div className="price">{formatVND(currentPrice * 1000)}</div>
                </div>
                <div className="card" style={{ padding: '15px' }}>
                  <h3>DỰ BÁO T+1</h3>
                  <div className="price" style={{ color: '#eaecef' }}>{formatVND(predictedPrice * 1000)}</div>
                </div>
              </div>

              <div className="card" style={{ padding: '10px 20px', border: `1px solid ${recColor}` }}>
                <h3 style={{ marginBottom: '5px' }}>HỆ THỐNG KHUYẾN NGHỊ</h3>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: recColor, letterSpacing: '2px' }}>{recommendation}</div>
              </div>

              <div className="card order-book" style={{ padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2b3139', paddingBottom: '10px' }}>
                  <h3 style={{ margin: 0 }}>LỊCH SỬ THỊ TRƯỜNG</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select className="filter-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                      <option value="All">Tất cả tháng</option>
                      {availableMonths.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                    </select>
                    <select className="filter-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                      <option value="All">Tất cả năm</option>
                      {availableYears.map(y => <option key={y} value={y}>Năm {y}</option>)}
                    </select>
                  </div>
                </div>

                <div className="order-book-scroll" style={{ maxHeight: '350px' }}>
                  {displayTableData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#848e9c' }}>Không có dữ liệu giao dịch trong thời gian này.</div>
                  ) : (
                    <table>
                      <thead>
                        <tr><th>Ngày</th><th>Mở</th><th>Cao</th><th>Thấp</th><th>Đóng</th><th>Vol (K)</th><th>RSI</th></tr>
                      </thead>
                      <tbody>
                        {displayTableData.slice(0, 100).map((row, i) => {
                          const dateParts = row.time.split('-');
                          const displayDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                          return (
                            <tr key={i}>
                              <td style={{ color: '#848e9c' }}>{displayDate}</td>
                              <td>{formatVND(row.open)}</td>
                              <td>{formatVND(row.high)}</td>
                              <td>{formatVND(row.low)}</td>
                              <td className={row.colorClass} style={{ fontWeight: 'bold' }}>{formatVND(row.close)}</td>
                              <td>{formatVND(row.volume / 1000)}</td>
                              <td style={{ color: (row.rsi_14 > 70) ? '#f6465d' : (row.rsi_14 < 30) ? '#0ecb81' : '#eaecef' }}>{Number(row.rsi_14).toFixed(1)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="company-profile">
          <div className="cp-header">
            <div className="cp-logo-container">
              <img src={profile.logo} alt={ticker} className="cp-logo" />
            </div>
            <div className="cp-title-group">
              <h2>{profile.name}</h2>
              <p>Cổ phiếu được giao dịch ký quỹ theo Thông báo của HSX ↗</p>
            </div>
          </div>

          <div className="cp-body">
            <div className="cp-left">
              <div className="cp-stats-grid">
                <div className="stat-item"><span className="stat-label">Mã cổ phiếu</span><span className="stat-value val-blue">{profile.ma_cp}</span></div>
                <div className="stat-item"><span className="stat-label">Vốn điều lệ</span><span className="stat-value">{profile.von_dieu_le}</span></div>
                
                <div className="stat-item"><span className="stat-label">Sàn giao dịch</span><span className="stat-value val-blue">{profile.san_gd}</span></div>
                <div className="stat-item"><span className="stat-label">KL CP đang niêm yết</span><span className="stat-value">{profile.kl_niem_yet}</span></div>
                
                <div className="stat-item"><span className="stat-label">Nhóm ngành</span><span className="stat-value val-blue">{profile.nhom_nganh}</span></div>
                <div className="stat-item" style={{alignItems: 'center'}}><span className="stat-label">KL CP đang lưu hành</span>
                  <div style={{textAlign: 'right'}}><span className="stat-value">{profile.kl_luu_hanh}</span><br/><span style={{fontSize: '11px', color: '#848e9c'}}>(100%)</span></div>
                </div>
                
                <div className="stat-item"><span className="stat-label">Ngày giao dịch đầu tiên</span><span className="stat-value">{profile.ngay_gd_dau}</span></div>
                <div className="stat-item"><span className="stat-label">KL cổ phiếu niêm yết lần đầu</span><span className="stat-value">{profile.kl_lan_dau}</span></div>
                
                <div className="stat-item"><span className="stat-label">Giá đóng cửa phiên GD đầu tiên</span><span className="stat-value">{profile.gia_dau}</span></div>
              </div>

              <div className="cp-chart-container">
                <div className="cp-chart-title">Biểu đồ biến đổi vốn điều lệ</div>
                <div className="cp-bar-chart">
                  <div className="cp-y-axis"><span>100k</span><span>75k</span><span>50k</span><span>25k</span><span>0</span></div>
                  {profile.chartData.map((item, idx) => (
                    <div key={idx} className="cp-bar" style={{ height: `${item.height}%` }}>
                      <div className="bar-tooltip">
                        <strong style={{ color: '#fcd535' }}>{item.quarter}</strong><br/>
                        {item.value} tỷ VNĐ
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cp-x-axis">
                  {profile.chartData.map((item, idx) => (
                    <span key={idx}>{item.quarter}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="cp-right">
              <h4>Tổ chức tư vấn niêm yết</h4>
              <div className="audit-item" style={{marginBottom: '20px'}}>
                <a href={profile.tu_van.link} target="_blank" rel="noopener noreferrer" className="audit-name">
                  {profile.tu_van.name} ↗
                </a>
              </div>
              
              <h4>Tổ chức kiểm toán</h4>
              <div className="audit-list">
                {profile.auditors.map((auditor, i) => (
                  <div key={i} className="audit-item">
                    <span className="audit-year">{auditor.year}</span>
                    <a href={auditor.link} target="_blank" rel="noopener noreferrer" className="audit-name">
                      {auditor.name} ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'news' && (
        <div style={{ paddingBottom: '50px' }}>
          <div className="news-header">
            <h2 style={{ margin: 0, color: '#eaecef' }}>ĐIỂM TIN VĨ MÔ & NGÀNH NGÂN HÀNG</h2>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Tìm kiếm từ khóa (VD: Lãi suất, VCB, Khối ngoại)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {loadingNews ? (
             <div style={{ textAlign: 'center', color: '#fcd535', marginTop: '50px' }}>Đang tổng hợp tin tức từ CafeF, Vietstock, VNExpress...</div>
          ) : filteredNews.length === 0 ? (
             <div style={{ textAlign: 'center', color: '#848e9c', marginTop: '50px' }}>Không tìm thấy bài báo nào khớp với từ khóa "{searchQuery}".</div>
          ) : (
            <div className="news-grid">
              {filteredNews.map((article, index) => (
                <div key={index} className="news-card">
                  <a href={article.link} target="_blank" rel="noopener noreferrer">
                    <h3>{article.title}</h3>
                    <div className="news-meta">
                      <span className="news-source">[{article.source}]</span>
                      <span>{article.published}</span>
                    </div>
                    <div className="desc" dangerouslySetInnerHTML={{ __html: article.description }}></div>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default App;