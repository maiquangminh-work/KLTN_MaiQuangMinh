import { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import TechnicalDashboardCompact from './components/TechnicalDashboardCompactV2';
import MarketAnalysisSection from './components/MarketAnalysisSectionV2';
import TopNavigation from './components/TopNavigation';
import ChatWidget from './components/ChatWidget';
import ActionPlanCard from './components/ActionPlanCardV2';

const formatVND = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(val) || 0));
const formatPercent = (val, digits = 2) => `${Number(val || 0).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const buildApiUrl = (path) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
const formatCapitalBillions = (val) => Number(val || 0).toLocaleString('vi-VN', {
  minimumFractionDigits: Number(val || 0) >= 100 ? 0 : 2,
  maximumFractionDigits: Number(val || 0) >= 100 ? 0 : 2,
});
const parseCapitalValueToBillions = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value >= 1_000_000_000) return value / 1_000_000_000;
    if (value >= 1_000) return value;
    if (value >= 1) return value / 1000;
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  const numericPart = normalized.replace(/[^0-9,.-]/g, '').replace(/,/g, '');
  if (!numericPart) return null;
  const numericValue = Number(numericPart);
  if (!Number.isFinite(numericValue)) return null;

  if (normalized.includes('tỷ')) return numericValue;
  if (normalized.includes('triệu')) return numericValue / 1000;
  if (normalized.includes('đồng') || normalized.includes('vnd')) return numericValue / 1_000_000_000;
  if (numericValue >= 1_000_000_000) return numericValue / 1_000_000_000;
  if (numericValue >= 1_000) return numericValue;
  if (numericValue >= 1) return numericValue / 1000;
  return numericValue;
};
const NEWS_BANK_ALIASES = {
  ALL: [],
  VCB: ['vcb', 'vietcombank', 'ngoại thương', 'vietcom bank'],
  BID: ['bid', 'bidv', 'đầu tư và phát triển'],
  CTG: ['ctg', 'vietinbank', 'công thương', 'vietin bank'],
};

const BANK_STATIC_DATA = {
  'VCB': {
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
  const [newsFocusTicker, setNewsFocusTicker] = useState('ALL');

  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState('All');

  const [profileData, setProfileData] = useState(null);
  const [marketContext, setMarketContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState(null);

  // Hook gọi API lấy thông tin profile khi bấm sang tab thông tin cơ bản
  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'info') {
      setProfileData(null);
      axios.get(buildApiUrl(`/api/profile-live/${ticker}?refresh=true`))
        .then(response => {
          if (isMounted) setProfileData(response.data);
        })
        .catch(() => {
          axios.get(buildApiUrl(`/api/profile/${ticker}`))
            .then(response => {
              if (isMounted) setProfileData(response.data);
            })
            .catch(err => console.log("Lỗi API hồ sơ doanh nghiệp:", err));
        });
    }
    return () => { isMounted = false; };
  }, [ticker, activeTab]);

  // State và logic cho chatbot
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'Chào Minh! Tôi đã nắm được dữ liệu VCB, BID và CTG hôm nay. Bạn cần giải thích gì không?' }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // State và logic thay đổi kích thước chatbot
  const [chatSize, setChatSize] = useState({ width: 360, height: 550 }); // Kích thước mặc định

  const startResize = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    
    const handleMouseMove = (e) => {
      const newWidth = window.innerWidth - e.clientX - 25; 
      const newHeight = window.innerHeight - e.clientY - 105; 
      
      setChatSize({
        width: Math.max(320, Math.min(newWidth, 800)), // Ép giới hạn: nhỏ nhất 320px, lớn nhất 800px
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
      const marketContextSummary = marketContext
        ? `Tâm lý tin tức: ${marketContext.news_sentiment_label}; Xung lực ngân hàng: ${marketContext.banking_sector_label}; Áp lực vĩ mô: ${marketContext.macro_pressure_label}; Rủi ro chính trị: ${marketContext.political_risk_label}; Áp lực tổng thể: ${marketContext.overall_market_label}`
        : 'Chưa có dữ liệu bối cảnh thị trường.';

      const res = await axios.post(buildApiUrl('/api/chat'), {
        message: userMsg,
        ticker: ticker,
        current_data: {
          price: formatVND(currentPrice * 1000),
          predict: formatVND(predictPrice * 1000),
          news_summary: newsSummary,
          market_context: marketContextSummary
        }
      });
      setChatHistory(prev => [...prev, { role: 'ai', text: res.data.reply }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Mất kết nối với trợ lý AI...' }]);
    } finally {
      setIsTyping(false);
    }
  };


  useEffect(() => {
    let isMounted = true;
    axios.get(buildApiUrl(`/api/predict/${ticker}`))
      .then(response => { if (isMounted) { setData(response.data); setLoading(false); } })
      .catch(() => { if (isMounted) { setError('Kết nối backend thất bại.'); setLoading(false); } });
    return () => { isMounted = false; };
  }, [ticker]);

  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'news' && newsData.length === 0) {
      axios.get(buildApiUrl('/api/news'))
        .then(response => { if (isMounted) { setNewsData(response.data.news || []); setLoadingNews(false); } })
        .catch(() => { if (isMounted) setLoadingNews(false); });
    }
    return () => { isMounted = false; };
  }, [activeTab, newsData.length]);

  useEffect(() => {
    let isMounted = true;
    if (activeTab !== 'chart') return () => { isMounted = false; };

    setLoadingContext(true);
    setContextError(null);

    axios.get(buildApiUrl(`/api/context/${ticker}`))
      .then((response) => {
        if (!isMounted) return;
        setMarketContext(response.data);
        setLoadingContext(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setMarketContext(null);
        setContextError('Chưa tải được lớp bối cảnh thị trường.');
        setLoadingContext(false);
      });

    return () => { isMounted = false; };
  }, [ticker, activeTab]);

  // Xử lý dữ liệu và lọc dữ liệu để hiển thị

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
  }, [data]); // Tính toán lại một lần duy nhất khi data thay đổi

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
        color: '#e3fe1a', 
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
        } catch (attnErr) { console.error("Lá»—i váº½ XAI:", attnErr); }

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
            if (attnData && attnData.value !== undefined) html += `<div><span style="color: #848e9c">Tín hiệu phân tích: </span> <span style="color: #e3fe1a; font-weight: bold;">${attnData.value.toFixed(2)}%</span></div>`;

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
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const tokenGroups = normalizedQuery
      ? normalizedQuery
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => {
          const expanded = new Set([token]);
          Object.entries(NEWS_BANK_ALIASES).forEach(([bankCode, aliases]) => {
            const keywordPool = [bankCode.toLowerCase(), ...aliases];
            if (keywordPool.some((keyword) => token.includes(keyword) || keyword.includes(token))) {
              keywordPool.forEach((keyword) => expanded.add(keyword));
            }
          });
          return [...expanded];
        })
      : [];

    return newsData.filter((article) => {
      const haystack = `${article.title || ''} ${article.description || ''}`.toLowerCase();
      const matchQuery = !tokenGroups.length || tokenGroups.every((group) => group.some((keyword) => haystack.includes(keyword)));
      return matchQuery;
    });
  }, [newsData, searchQuery]);

  const newsInsights = useMemo(() => {
    const focusKeywords = newsFocusTicker === 'ALL'
      ? []
      : (NEWS_BANK_ALIASES[newsFocusTicker] || []);
    const focusLabel = newsFocusTicker === 'ALL' ? 'Toàn ngành' : newsFocusTicker;
    const normalizeText = (value) =>
      String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const scoreToRelevance = (score) => {
      if (score >= 90) return { label: 'Rất cao', tone: 'high' };
      if (score >= 55) return { label: 'Cao', tone: 'medium' };
      if (score >= 30) return { label: 'Theo dõi', tone: 'base' };
      return { label: 'Nền ngành', tone: 'base' };
    };

    const enrichedArticles = filteredNews.map((article) => {
      const cleanDescription = normalizeText(article.description);
      const haystack = `${article.title} ${cleanDescription}`.toLowerCase();
      const tickerMatches = focusKeywords.filter((keyword) => haystack.includes(keyword));
      const isTickerFocused = tickerMatches.length > 0;
      const isBankingRelated = Object.values(NEWS_BANK_ALIASES)
        .flat()
        .some((keyword) => haystack.includes(keyword));
      const titleLower = String(article.title || '').toLowerCase();
      const queryTokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const queryMatchCount = queryTokens.filter((token) => haystack.includes(token)).length;
      const titleMatchBoost = isTickerFocused
        ? tickerMatches.filter((keyword) => titleLower.includes(keyword)).length
        : 0;
      const relevanceScore =
        (isTickerFocused ? 72 : 0)
        + (tickerMatches.length * 10)
        + (queryMatchCount * 8)
        + (titleMatchBoost * 6)
        + (isBankingRelated ? 18 : 0);
      const relevance = scoreToRelevance(relevanceScore);
      return {
        ...article,
        cleanDescription,
        isTickerFocused,
        isBankingRelated,
        relevanceScore,
        relevanceLabel: relevance.label,
        relevanceTone: relevance.tone,
        relevanceSummary: isTickerFocused
          ? `Ưu tiên theo ${focusLabel}`
          : isBankingRelated
            ? 'Tin cùng nhóm ngân hàng'
            : 'Tin nền của thị trường',
      };
    });

    const rankedArticles = [...enrichedArticles].sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    const tickerFocusedArticles = newsFocusTicker === 'ALL'
      ? rankedArticles
      : rankedArticles.filter((article) => article.isTickerFocused);
    const sourceCounts = rankedArticles.reduce((accumulator, article) => {
      const sourceName = article.source || 'Khác';
      accumulator[sourceName] = (accumulator[sourceName] || 0) + 1;
      return accumulator;
    }, {});

    const sourceChips = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([sourceName, count]) => ({ sourceName, count }));

    const featuredArticle = tickerFocusedArticles[0] || rankedArticles[0] || null;
    const secondaryArticles = rankedArticles.filter((article) => article !== featuredArticle);

    return {
      enrichedArticles: rankedArticles,
      featuredArticle,
      secondaryArticles,
      sourceChips,
      tickerFocusedCount: tickerFocusedArticles.length,
      priorityArticlesCount: rankedArticles.filter((article) => article.relevanceScore >= 55).length,
      uniqueSourcesCount: Object.keys(sourceCounts).length,
      latestPublished: enrichedArticles[0]?.published || 'Đang cập nhật',
    };
  }, [filteredNews, newsFocusTicker, searchQuery]);

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
    
    .main-grid { display: grid; grid-template-columns: minmax(0, 1.72fr) minmax(340px, 0.88fr); gap: 20px; padding: 0 20px 20px; flex: 1; margin-bottom: 8px; align-items: start; }
    @media (max-width: 1280px) { .main-grid { grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.95fr); } }
    @media (max-width: 1100px) { .main-grid { grid-template-columns: 1fr; } } 
    
    .chart-section { min-width: 0; display: grid; gap: 16px; align-content: start; } 
    .chart-card, .signal-card { padding: 18px; }
    .chart-card-header, .signal-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
    .chart-eyebrow { color: #848e9c; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
    .chart-title { margin: 6px 0 0; color: #eaecef; font-size: 22px; font-weight: 700; letter-spacing: 0.2px; }
    .chart-subtitle { color: #94a3b8; font-size: 13px; line-height: 1.5; max-width: 420px; }
    .chart-status-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: flex-end; }
    .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; background: #161a1e; border: 1px solid #2b3139; color: #eaecef; font-size: 12px; font-weight: 600; }
    .status-pill.muted { color: #94a3b8; font-weight: 500; }
    .chart-frame { position: relative; width: 100%; background: #161a1e; border: 1px solid #2b3139; border-radius: 12px; padding: 12px; }
    .legend-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
    .legend-chip { font-size: 11px; font-weight: 600; }
    .quick-diagnosis-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .quick-diagnosis-card { background: #161a1e; border: 1px solid #2b3139; border-radius: 12px; padding: 12px; min-height: 94px; display: flex; flex-direction: column; justify-content: space-between; }
    .quick-diagnosis-label { color: #848e9c; font-size: 12px; }
    .quick-diagnosis-value { color: #eaecef; font-size: 18px; font-weight: 700; line-height: 1.35; }
    .quick-diagnosis-sub { color: #94a3b8; font-size: 12px; line-height: 1.5; }
    .panel-section { min-width: 0; display: flex; flex-direction: column; gap: 16px; align-self: start; }
    .detail-stack { display: grid; gap: 16px; padding: 0 20px 24px; }
    .detail-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); gap: 16px; align-items: start; }
    .detail-card { min-width: 0; }
    .card { background: #1e2329; border-radius: 14px; border: 1px solid #2b3139; box-shadow: 0 14px 32px rgba(0,0,0,0.18); }
    .card h3 { color: #848e9c; font-size: 13px; margin: 0 0 10px 0; letter-spacing: 0.5px; }
    .price { font-size: 24px; font-weight: bold; color: #eaecef; }
    @media (max-width: 980px) { .detail-grid { grid-template-columns: 1fr; } .quick-diagnosis-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 768px) { .chart-card, .signal-card { padding: 14px; } .chart-frame { padding: 8px; } .chart-title { font-size: 20px; } .detail-stack { padding: 0 20px 20px; } .quick-diagnosis-grid { grid-template-columns: 1fr; } }

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
    
    .news-shell { padding: 0 20px 50px 20px; display: flex; flex-direction: column; gap: 18px; }
    .news-hero { background: linear-gradient(135deg, rgba(24, 30, 37, 0.98) 0%, rgba(18, 23, 28, 0.98) 100%); border: 1px solid rgba(58, 67, 79, 0.92); border-radius: 18px; padding: 22px; box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22); display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
    .news-hero-main { display: flex; flex-direction: column; gap: 12px; max-width: 760px; }
    .news-kicker { color: #fcd535; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.9px; }
    .news-hero-title { margin: 0; color: #f3f5f7; font-size: 28px; line-height: 1.3; }
    .news-hero-subtitle { margin: 0; color: #92a2b3; font-size: 14px; line-height: 1.7; max-width: 760px; }
    .news-pill-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .news-pill { display: inline-flex; align-items: center; justify-content: center; padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(58, 67, 79, 0.92); background: rgba(31, 38, 45, 0.88); color: #d3d9df; font-size: 12px; font-weight: 600; }
    .news-pill.active { color: #fcd535; border-color: rgba(252, 213, 53, 0.25); background: rgba(252, 213, 53, 0.10); }
    .news-focus-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
    .news-focus-chip { display: inline-flex; align-items: center; justify-content: center; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(58, 67, 79, 0.92); background: rgba(24, 30, 37, 0.9); color: #cbd5e1; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .news-focus-chip:hover { border-color: rgba(252, 213, 53, 0.25); color: #f3f5f7; }
    .news-focus-chip.active { color: #fcd535; border-color: rgba(252, 213, 53, 0.3); background: rgba(252, 213, 53, 0.10); }
    .news-search-note { color: #7f91a5; font-size: 12px; line-height: 1.55; }
    .news-hero-side { display: flex; flex-direction: column; gap: 12px; min-width: 280px; flex: 1; align-items: stretch; }
    .news-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .search-input { background: #1e2329; border: 1px solid #2b3139; color: #eaecef; padding: 11px 15px; border-radius: 10px; width: 320px; max-width: 100%; outline: none; transition: border 0.2s, box-shadow 0.2s; }
    .search-input:focus { border-color: #fcd535; }
    .news-stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .news-stat-card { background: linear-gradient(180deg, rgba(22, 27, 33, 0.98), rgba(18, 23, 28, 0.98)); border: 1px solid rgba(58, 67, 79, 0.92); border-radius: 14px; padding: 15px; min-height: 92px; display: flex; flex-direction: column; justify-content: space-between; }
    .news-stat-label { color: #8fa0b2; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; }
    .news-stat-value { color: #f3f5f7; font-size: 22px; font-weight: 700; line-height: 1.35; }
    .news-stat-sub { color: #6f8093; font-size: 12px; line-height: 1.5; }
    .news-featured-card { background: linear-gradient(135deg, rgba(24, 30, 37, 0.98) 0%, rgba(18, 23, 28, 0.98) 100%); border: 1px solid rgba(58, 67, 79, 0.92); border-radius: 18px; padding: 22px; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.9fr); gap: 20px; box-shadow: 0 18px 36px rgba(0, 0, 0, 0.22); }
    .news-featured-left { display: flex; flex-direction: column; gap: 14px; }
    .news-featured-right { display: flex; flex-direction: column; gap: 12px; }
    .news-featured-image { width: 100%; min-height: 220px; border-radius: 16px; object-fit: cover; border: 1px solid rgba(58, 67, 79, 0.92); background: linear-gradient(135deg, rgba(41, 98, 255, 0.10), rgba(252, 213, 53, 0.08)); }
    .news-featured-image.placeholder { display: flex; align-items: center; justify-content: center; color: #fcd535; font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
    .news-featured-title { margin: 0; color: #f3f5f7; font-size: 24px; line-height: 1.45; }
    .news-featured-desc { margin: 0; color: #9eb0c3; font-size: 14px; line-height: 1.75; }
    .news-source-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .news-source-badge { display: inline-flex; align-items: center; justify-content: center; padding: 7px 12px; border-radius: 999px; background: rgba(41, 98, 255, 0.12); border: 1px solid rgba(41, 98, 255, 0.28); color: #a8c7ff; font-size: 12px; font-weight: 700; }
    .news-time-badge { display: inline-flex; align-items: center; justify-content: center; padding: 7px 12px; border-radius: 999px; background: rgba(252, 213, 53, 0.08); border: 1px solid rgba(252, 213, 53, 0.18); color: #f4d861; font-size: 12px; font-weight: 600; }
    .news-cta { display: inline-flex; align-items: center; justify-content: center; align-self: flex-start; padding: 10px 15px; border-radius: 999px; background: linear-gradient(135deg, rgba(41, 98, 255, 0.22), rgba(41, 98, 255, 0.1)); border: 1px solid rgba(41, 98, 255, 0.35); color: #cfe0ff; text-decoration: none; font-size: 13px; font-weight: 700; transition: transform 0.2s, border-color 0.2s; }
    .news-cta:hover { transform: translateY(-1px); border-color: rgba(252, 213, 53, 0.3); color: #fcd535; }
    .news-chip-grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .news-source-chip { display: inline-flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 120px; padding: 10px 12px; border-radius: 12px; background: rgba(29, 35, 41, 0.95); border: 1px solid rgba(58, 67, 79, 0.92); color: #d9e0e8; font-size: 13px; font-weight: 600; }
    .news-source-count { color: #fcd535; font-weight: 700; }
    
    .news-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
    .news-card { background: linear-gradient(180deg, rgba(22, 27, 33, 0.98), rgba(18, 23, 28, 0.98)); border-radius: 16px; overflow: hidden; border: 1px solid rgba(58, 67, 79, 0.92); transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; display: flex; min-height: 250px; }
    .news-card:hover { transform: translateY(-4px); border-color: rgba(252, 213, 53, 0.28); box-shadow: 0 18px 36px rgba(0, 0, 0, 0.18); }
    .news-card a { text-decoration: none; color: inherit; display: flex; flex: 1; padding: 18px; flex-direction: column; gap: 12px; }
    .news-card-image { width: 100%; height: 170px; border-radius: 12px; object-fit: cover; border: 1px solid rgba(58, 67, 79, 0.92); background: linear-gradient(135deg, rgba(41, 98, 255, 0.10), rgba(252, 213, 53, 0.08)); }
    .news-card-image.placeholder { display: flex; align-items: center; justify-content: center; color: #fcd535; font-size: 12px; font-weight: 700; letter-spacing: 0.2px; }
    .news-card h3 { color: #f3f5f7; font-size: 18px; margin: 0; line-height: 1.55; }
    .news-meta { display: flex; justify-content: space-between; gap: 10px; color: #8fa0b2; font-size: 12px; flex-wrap: wrap; }
    .news-source { color: #fcd535; font-weight: 700; letter-spacing: 0.2px; }
    .news-card .desc { color: #9aaaba; font-size: 13px; line-height: 1.75; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .news-card-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto; }
    .news-tag { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 999px; background: rgba(14, 203, 129, 0.10); border: 1px solid rgba(14, 203, 129, 0.25); color: #7ce4b5; font-size: 12px; font-weight: 700; }
    .news-tag.macro { background: rgba(252, 213, 53, 0.10); border-color: rgba(252, 213, 53, 0.22); color: #f4d861; }
    .news-tag.neutral { background: rgba(148, 163, 184, 0.10); border-color: rgba(148, 163, 184, 0.18); color: #c4ced8; }
    .news-relevance-badge { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid rgba(252, 213, 53, 0.18); background: rgba(252, 213, 53, 0.08); color: #f4d861; }
    .news-relevance-badge.high { border-color: rgba(14, 203, 129, 0.25); background: rgba(14, 203, 129, 0.10); color: #78e4b5; }
    .news-relevance-badge.medium { border-color: rgba(252, 213, 53, 0.22); background: rgba(252, 213, 53, 0.10); color: #f4d861; }
    .news-relevance-badge.base { border-color: rgba(148, 163, 184, 0.18); background: rgba(148, 163, 184, 0.10); color: #c4ced8; }
    .news-card-insight { color: #8293a8; font-size: 12px; line-height: 1.55; }
    .news-card img { max-width: 100%; border-radius: 4px; margin-bottom: 10px; }
    @media (max-width: 1100px) { .news-featured-card { grid-template-columns: 1fr; } .news-stats-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .news-shell { padding: 0 16px 50px 16px; } .news-hero { padding: 18px; } .news-hero-title { font-size: 22px; } .news-header { flex-direction: column; align-items: stretch; } .search-input { width: 100%; } }

    .company-profile { background: linear-gradient(180deg, rgba(24, 29, 35, 0.98) 0%, rgba(19, 23, 28, 0.98) 100%); border-radius: 18px; padding: 24px; margin: 0 20px; color: #eaecef; border: 1px solid rgba(62, 72, 84, 0.95); box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28); }
    .cp-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid rgba(58, 66, 76, 0.9); flex-wrap: wrap; }
    .cp-header-main { display: flex; align-items: center; gap: 18px; min-width: 0; }
    .cp-header-side { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; min-width: 240px; }
    .cp-badge-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .cp-badge { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid rgba(91, 107, 124, 0.8); background: rgba(31, 38, 45, 0.85); color: #d4d9df; }
    .cp-badge.live { color: #0ecb81; border-color: rgba(14, 203, 129, 0.35); background: rgba(14, 203, 129, 0.08); }
    .cp-badge.fallback { color: #fcd535; border-color: rgba(252, 213, 53, 0.28); background: rgba(252, 213, 53, 0.10); }
    .cp-link-chip { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 14px; border-radius: 999px; background: linear-gradient(135deg, rgba(41, 98, 255, 0.22), rgba(41, 98, 255, 0.1)); border: 1px solid rgba(41, 98, 255, 0.35); color: #a8c7ff; font-size: 12px; font-weight: 600; text-decoration: none; transition: transform 0.2s, border-color 0.2s; }
    .cp-link-chip:hover { transform: translateY(-1px); border-color: rgba(252, 213, 53, 0.35); color: #fcd535; }
    .cp-logo-container { width: 124px; height: 124px; background: linear-gradient(180deg, #ffffff 0%, #eef2f6 100%); border-radius: 16px; display: flex; justify-content: center; align-items: center; overflow: hidden; padding: 12px; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(19, 23, 28, 0.08); }
    .cp-logo { max-width: 100%; max-height: 100%; object-fit: contain; }
    .cp-title-group { min-width: 0; }
    .cp-title-group h2 { color: #f3f5f7; font-size: 28px; margin: 0 0 6px 0; line-height: 1.3; }
    .cp-title-group p { color: #92a2b3; margin: 0; font-size: 14px; line-height: 1.6; }
    .cp-highlight-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
    .cp-highlight-card { background: linear-gradient(180deg, rgba(22, 27, 33, 0.98), rgba(18, 23, 28, 0.98)); border: 1px solid rgba(58, 67, 79, 0.92); border-radius: 14px; padding: 16px; min-height: 92px; display: flex; flex-direction: column; justify-content: space-between; }
    .cp-highlight-label { color: #8fa0b2; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; }
    .cp-highlight-value { color: #f3f5f7; font-size: 18px; font-weight: 700; line-height: 1.4; }
    .cp-highlight-sub { color: #6f8093; font-size: 12px; line-height: 1.5; }
    .cp-note-banner { margin-bottom: 18px; padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(252, 213, 53, 0.25); background: linear-gradient(135deg, rgba(252, 213, 53, 0.10), rgba(252, 213, 53, 0.04)); color: #f4d861; font-size: 13px; line-height: 1.65; }
    .cp-body { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(360px, 1.05fr); gap: 20px; align-items: start; }
    @media (max-width: 1100px) { .cp-highlight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .cp-body { grid-template-columns: 1fr; } .cp-header-side { align-items: flex-start; min-width: 0; } .cp-badge-row { justify-content: flex-start; } }
    @media (max-width: 720px) { .cp-highlight-grid { grid-template-columns: 1fr; } .cp-header-main { align-items: flex-start; } .cp-logo-container { width: 96px; height: 96px; } .cp-title-group h2 { font-size: 22px; } }
    .cp-left, .cp-right { display: flex; flex-direction: column; gap: 18px; align-self: start; }
    .cp-primary-card { background: linear-gradient(180deg, rgba(23, 28, 34, 0.98), rgba(18, 23, 28, 0.98)); border: 1px solid rgba(58, 67, 79, 0.92); border-radius: 16px; padding: 18px; }
    .cp-panel-title { margin: 0 0 16px 0; color: #f3f5f7; font-size: 16px; font-weight: 700; letter-spacing: 0.2px; }
    .cp-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); column-gap: 26px; row-gap: 14px; }
    .stat-item { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px dashed rgba(68, 78, 90, 0.85); padding-bottom: 8px; min-height: 46px; }
    .stat-label { color: #8fa0b2; font-weight: 600; font-size: 13px; line-height: 1.5; }
    .stat-value { font-weight: 700; text-align: right; font-size: 14px; line-height: 1.5; color: #f3f5f7; }
    .val-blue { color: #2962ff; }
    
    .cp-chart-container { overflow-x: auto; padding-bottom: 8px; }
    .cp-chart-title { text-align: left; font-weight: 700; margin-bottom: 18px; font-size: 16px; color: #f3f5f7; }
    .cp-bar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 180px; border-bottom: 1px solid rgba(132, 142, 156, 0.45); border-left: 1px solid rgba(132, 142, 156, 0.45); padding-bottom: 8px; margin-left: 40px; position: relative; min-width: 500px; }
    .cp-bar { width: 30px; background-color: #0b4a7b; transition: all 0.3s; position: relative; cursor: pointer; border-radius: 2px 2px 0 0; }
    .cp-bar:hover { background-color: #fcd535; }
    .bar-tooltip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: rgba(30, 35, 41, 0.95); border: 1px solid #2b3139; color: #eaecef; padding: 8px 12px; border-radius: 6px; font-size: 13px; white-space: nowrap; opacity: 0; pointer-events: none; transition: all 0.2s ease-in-out; margin-bottom: 5px; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    .cp-bar:hover .bar-tooltip { opacity: 1; bottom: calc(100% + 5px); }
    .cp-y-axis { position: absolute; left: -40px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #848e9c; text-align: right; width: 30px; }
    .cp-x-axis { display: flex; justify-content: space-around; margin-top: 5px; font-size: 11px; color: #848e9c; margin-left: 40px; min-width: 500px; }
    .cp-chart-caption { margin: 12px 0 0 40px; color: #8fa0b2; font-size: 12px; line-height: 1.6; }
    
    .cp-right h4 { margin-top: 0; color: #9aaaba; font-size: 13px; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.8px; }
    .audit-list { display: flex; flex-direction: column; gap: 10px; }
    .audit-item { display: flex; justify-content: space-between; gap: 12px; padding: 12px 15px; background: rgba(29, 35, 41, 0.96); border-radius: 10px; border: 1px solid rgba(58, 67, 79, 0.92); align-items: center; transition: border-color 0.2s, transform 0.2s; }
    .audit-item:hover { border-color: #fcd535; }
    .audit-year { font-weight: 700; color: #eaecef; width: 58px; font-size: 13px; flex-shrink: 0; }
    a.audit-name, .audit-name { color: #cfd8e3; font-weight: 500; font-size: 13px; text-align: right; text-decoration: none; transition: color 0.2s; line-height: 1.6; }
    a.audit-name:hover { color: #fcd535; text-decoration: underline; }
    .cp-secondary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 24px; }
    .profile-section-card { background: linear-gradient(180deg, rgba(22, 27, 33, 0.98), rgba(18, 23, 28, 0.98)); border: 1px solid rgba(58, 67, 79, 0.92); border-radius: 16px; padding: 18px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02); }
    .profile-section-card h4 { margin: 0 0 12px 0; color: #f3f5f7; font-size: 15px; letter-spacing: 0.2px; }
    .profile-section-description { color: #9fb0c3; line-height: 1.7; font-size: 14px; margin: 0; }
    .profile-rich-list { display: flex; flex-direction: column; gap: 10px; }
    .profile-rich-item { display: flex; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 10px; background: #1d2329; border: 1px solid rgba(60, 72, 88, 0.85); }
    .profile-rich-main { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
    .profile-rich-name { color: #f3f5f7; font-size: 14px; font-weight: 600; line-height: 1.4; }
    .profile-rich-subtitle { color: #8f9fb2; font-size: 12px; line-height: 1.5; }
    .profile-rich-meta { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; text-align: right; }
    .profile-chip { display: inline-flex; align-items: center; justify-content: center; min-width: 64px; padding: 5px 9px; border-radius: 999px; background: rgba(252, 213, 53, 0.12); border: 1px solid rgba(252, 213, 53, 0.25); color: #fcd535; font-size: 12px; font-weight: 600; }
    .profile-empty { color: #7f8c9d; font-size: 13px; line-height: 1.6; margin: 0; }
    @media (max-width: 1100px) { .cp-secondary-grid { grid-template-columns: 1fr; } }

    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .loader-spinner { border: 4px solid rgba(252, 213, 53, 0.2); border-top: 4px solid #fcd535; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; }
    
    /* CSS chatbot */
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
  let recommendation = 'GIỮ CỔ PHIẾU';
  let recColor = "#fcd535"; 
  
  // Để biên độ là 0.8% để hệ thống nhạy bén hơn với các biến động nhỏ
  if (priceDiff > currentPrice * 0.008) { 
      recommendation = 'MUA VÀO'; 
      recColor = "#0ecb81"; 
  } 
  else if (priceDiff < -currentPrice * 0.008) { 
      recommendation = 'BÁN RA'; 
      recColor = "#f6465d"; 
  }

  const priceDiffPercent = currentPrice ? (priceDiff / currentPrice) * 100 : 0;
  const thresholdValue = data?.recommendation_threshold ?? 0.008;
  const fallbackRecommendation =
    priceDiff > currentPrice * thresholdValue
      ? 'MUA VÀO'
      : priceDiff < -currentPrice * thresholdValue
        ? 'BÁN RA'
        : 'GIỮ CỔ PHIẾU';

  recommendation = data?.recommendation || fallbackRecommendation;
  recColor = recommendation === 'MUA VÀO'
    ? '#0ecb81'
    : recommendation === 'BÁN RA'
      ? '#f6465d'
      : '#fcd535';

  const recommendationNote = data?.recommendation_note || 'Khuyến nghị được tổng hợp từ tín hiệu giá và lớp bối cảnh thị trường.';

  const getPositiveScoreColor = (score) => {
    if (score >= 65) return '#0ecb81';
    if (score <= 35) return '#f6465d';
    return '#fcd535';
  };

  const getRiskScoreColor = (score) => {
    if (score >= 65) return '#f6465d';
    if (score <= 35) return '#0ecb81';
    return '#fcd535';
  };

  const getConfidenceColor = (score) => {
    if (score >= 75) return '#0ecb81';
    if (score >= 55) return '#fcd535';
    return '#f6465d';
  };

  const marketPressureScore = marketContext?.overall_market_pressure ?? 50;
  const bankingSupportScore = marketContext?.banking_sector_score ?? 50;
  const moveRatio = currentPrice ? Math.abs(priceDiff) / (currentPrice * Math.max(thresholdValue, 0.0001)) : 0;
  const priceSignalScore = Number(
    data?.price_signal_score
      ?? Math.max(25, Math.min(95, 35 + moveRatio * 22))
  );
  const contextAlignmentScore = Number(
    data?.context_alignment_score
      ?? Math.max(
        20,
        Math.min(
          95,
          100 - Math.abs((marketPressureScore - (recommendation === 'MUA VÀO' ? 30 : recommendation === 'BÁN RA' ? 70 : 50))) + ((bankingSupportScore - 50) * (recommendation === 'MUA VÀO' ? 0.25 : recommendation === 'BÁN RA' ? -0.25 : 0))
        )
      )
  );
  const recommendationConfidenceScore = Number(
    data?.recommendation_confidence_score
      ?? Math.max(20, Math.min(95, (priceSignalScore * 0.55) + (contextAlignmentScore * 0.45)))
  );
  const recommendationConfidenceLabel = data?.recommendation_confidence_label
    || (recommendationConfidenceScore >= 75 ? 'Cao' : recommendationConfidenceScore >= 55 ? 'Trung bình' : 'Thận trọng');
  const recommendationConfidenceNote = data?.recommendation_confidence_note
    || (recommendation === 'MUA VÀO'
      ? 'Tín hiệu giá đang nghiêng theo chiều tăng, nhưng nên theo dõi thêm bối cảnh vĩ mô và chính trị.'
      : recommendation === 'BÁN RA'
        ? 'Tín hiệu giá đang suy yếu, phù hợp ưu tiên kiểm soát rủi ro khi bối cảnh không thuận lợi.'
        : 'Tín hiệu giá chưa tạo khác biệt đủ lớn, phù hợp quan sát thêm trước khi hành động.');

  const latestDataTime = data?.latest_data_time || 'Chưa xác định';
  const analysisSignalLabel = data?.analysis_signal_label || 'Tín hiệu hỗ trợ phân tích';
  const riskLevelLabel = marketPressureScore >= 70 ? 'Rủi ro cao' : marketPressureScore >= 55 ? 'Rủi ro trung bình' : 'Rủi ro thấp';

  const buildActionPlan = () => {
    const bandSize = Math.max(thresholdValue / 2, 0.004);
    const moveMagnitude = Math.abs(priceDiffPercent);
    const defaultReason = 'Lớp bối cảnh đang ở trạng thái trung tính, cần theo dõi thêm dữ liệu mới nhất.';

    const marketReason = (() => {
      if (!marketContext) return defaultReason;

      if (recommendation === 'MUA VÀO') {
        if ((marketContext.banking_sector_score ?? 50) >= 60) {
          return `Xung lực ngành ngân hàng đang ${String(marketContext.banking_sector_label || '').toLowerCase()}, hỗ trợ cho kịch bản tăng ngắn hạn.`;
        }
        if ((marketContext.news_sentiment_score ?? 50) >= 60) {
          return `Tâm lý tin tức đang ${String(marketContext.news_sentiment_label || '').toLowerCase()}, giúp dòng tiền dễ phản ứng tích cực hơn.`;
        }
        return `Áp lực tổng thể hiện ở mức ${String(marketContext.overall_market_label || '').toLowerCase()}, phù hợp giải ngân từng phần thay vì mua dồn.`;
      }

      if (recommendation === 'BÁN RA') {
        if ((marketContext.overall_market_pressure ?? 50) >= 65) {
          return `Áp lực tổng thể đang ${String(marketContext.overall_market_label || '').toLowerCase()}, nên ưu tiên giảm rủi ro ngắn hạn.`;
        }
        if ((marketContext.political_risk_score ?? 50) >= 60) {
          return `Rủi ro chính trị đang ${String(marketContext.political_risk_label || '').toLowerCase()}, có thể làm tín hiệu hồi phục kém bền.`;
        }
        return `Áp lực vĩ mô đang ${String(marketContext.macro_pressure_label || '').toLowerCase()}, phù hợp hạ tỷ trọng thay vì giữ vị thế lớn.`;
      }

      if (moveMagnitude < thresholdValue * 100) {
        return 'Biên dự báo chưa vượt ngưỡng quyết định, nên tiếp tục quan sát thay vì hành động mạnh.';
      }
      return `Bối cảnh hiện ở mức ${String(marketContext.overall_market_label || '').toLowerCase()}, phù hợp giữ vị thế linh hoạt và chờ thêm xác nhận.`;
    })();

    const confidenceReason = `Độ tự tin hiện đạt ${Math.round(recommendationConfidenceScore)}%, phù hợp chiến lược ${recommendationConfidenceLabel.toLowerCase()}.`;

    if (recommendation === 'MUA VÀO') {
      const entryLow = currentPrice * (1 - bandSize);
      const entryHigh = currentPrice * (1 + (bandSize * 0.6));
      const targetPrice = Math.max(predictedPrice, currentPrice * (1 + Math.max(thresholdValue, 0.01)));
      const stopLoss = currentPrice * (1 - Math.max(thresholdValue * 0.75, 0.006));

      return {
        actionTitle: recommendationConfidenceScore >= 75 ? 'MUA TÍCH LŨY' : 'MUA THĂM DÒ',
        actionSubtitle: 'Ưu tiên giải ngân từng phần khi tín hiệu giá còn duy trì trên ngưỡng quyết định.',
        suggestedWeight: recommendationConfidenceScore >= 75 ? '40% - 50% vốn kế hoạch' : recommendationConfidenceScore >= 55 ? '25% - 35% vốn kế hoạch' : '10% - 20% vốn kế hoạch',
        actionRange: `${formatVND(entryLow * 1000)} - ${formatVND(entryHigh * 1000)} VNĐ`,
        targetLabel: `${formatVND(targetPrice * 1000)} VNĐ`,
        guardrailLabel: `${formatVND(stopLoss * 1000)} VNĐ`,
        horizonLabel: recommendationConfidenceScore >= 75 ? '1 - 3 phiên' : '1 - 2 phiên',
        riskLabel: riskLevelLabel,
        reasons: [
          `Giá dự báo T+1 đang cao hơn thị giá ${formatPercent(moveMagnitude, 2)}.`,
          marketReason,
          confidenceReason
        ]
      };
    }

    if (recommendation === 'BÁN RA') {
      const actionLow = currentPrice * (1 - (bandSize * 0.5));
      const actionHigh = currentPrice * (1 + (bandSize * 0.5));
      const targetPrice = Math.min(predictedPrice, currentPrice * (1 - Math.max(thresholdValue, 0.01)));
      const invalidationPrice = currentPrice * (1 + Math.max(thresholdValue * 0.65, 0.006));

      return {
        actionTitle: recommendationConfidenceScore >= 75 ? 'GIẢM TỶ TRỌNG' : 'BÁN QUẢN TRỊ RỦI RO',
        actionSubtitle: 'Ưu tiên giảm vị thế ở các nhịp hồi ngắn thay vì chờ tín hiệu đảo chiều rõ hơn.',
        suggestedWeight: recommendationConfidenceScore >= 75 ? 'Giảm 40% - 60% vị thế' : 'Giảm 20% - 35% vị thế',
        actionRange: `${formatVND(actionLow * 1000)} - ${formatVND(actionHigh * 1000)} VNĐ`,
        targetLabel: `${formatVND(targetPrice * 1000)} VNĐ`,
        guardrailLabel: `${formatVND(invalidationPrice * 1000)} VNĐ`,
        horizonLabel: recommendationConfidenceScore >= 75 ? 'Trong phiên kế tiếp' : '1 - 2 phiên',
        riskLabel: riskLevelLabel,
        reasons: [
          `Giá dự báo T+1 đang thấp hơn thị giá ${formatPercent(moveMagnitude, 2)}.`,
          marketReason,
          confidenceReason
        ]
      };
    }

    const actionLow = currentPrice * (1 - bandSize);
    const actionHigh = currentPrice * (1 + bandSize);
    const reviewLevel = currentPrice * (1 + Math.sign(priceDiff || 1) * Math.max(thresholdValue * 0.5, 0.004));

    return {
      actionTitle: marketPressureScore >= 60 ? 'GIỮ THẬN TRỌNG' : 'GIỮ QUAN SÁT',
      actionSubtitle: 'Biên lợi thế chưa đủ rộng để mở vị thế mới, nên theo dõi thêm xác nhận trước khi hành động.',
      suggestedWeight: 'Giữ tỷ trọng hiện tại, hạn chế mua đuổi',
      actionRange: `${formatVND(actionLow * 1000)} - ${formatVND(actionHigh * 1000)} VNĐ`,
      targetLabel: `${formatVND(predictedPrice * 1000)} VNĐ`,
      guardrailLabel: `${formatVND(reviewLevel * 1000)} VNĐ`,
      horizonLabel: 'Theo dõi thêm 1 - 3 phiên',
      riskLabel: riskLevelLabel,
      reasons: [
        `Biên dự báo hiện chỉ ở mức ${formatPercent(moveMagnitude, 2)}, chưa tạo khác biệt đủ mạnh.`,
        marketReason,
        confidenceReason
      ]
    };
  };

  const actionPlan = buildActionPlan();
  const profileFallback = BANK_STATIC_DATA[ticker];
  const charterCapitalHistoryRaw = profileData?.charter_capital_history?.length
    ? profileData.charter_capital_history
    : profileFallback.chartData;
  const normalizedCharterCapitalHistory = charterCapitalHistoryRaw
    .map((item, index) => {
      const numericValue = parseCapitalValueToBillions(item.numeric_value ?? item.value);
      return {
        quarter: item.quarter || `Mốc ${index + 1}`,
        numericValue,
      };
    })
    .filter((item) => Number.isFinite(item.numericValue) && item.numericValue > 0);
  const maxCapitalValue = normalizedCharterCapitalHistory.length
    ? Math.max(...normalizedCharterCapitalHistory.map((item) => item.numericValue))
    : 1;
  const charterCapitalHistory = normalizedCharterCapitalHistory.map((item) => ({
    ...item,
    height: Math.max(18, Math.round((item.numericValue / maxCapitalValue) * 90)),
    value: formatCapitalBillions(item.numericValue),
  }));
  const capitalAxisTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => formatCapitalBillions(maxCapitalValue * ratio));
  const listingAdvisor = profileData?.listing_advisor?.name
    ? profileData.listing_advisor
    : profileFallback.tu_van;
  const auditorTimeline = profileData?.auditor_timeline?.length
    ? profileData.auditor_timeline
    : profileFallback.auditors;
  const displayCharterCapital = (() => {
    const normalizedValue = parseCapitalValueToBillions(profileData?.charter_capital);
    if (normalizedValue !== null) {
      return `${formatCapitalBillions(normalizedValue)} tỷ đồng`;
    }
    return profileData?.charter_capital || 'Đang cập nhật';
  })();
  const profileStatusClass = profileData?.profile_status === 'live' ? 'live' : 'fallback';
  const profileStatusLabel = profileData?.profile_status === 'live' ? 'Đồng bộ trực tuyến' : 'Dữ liệu dự phòng';
  const profileHighlights = [
    { label: 'Mã giao dịch', value: profileData?.ticker || ticker, sub: 'Nhóm ngân hàng theo dõi' },
    { label: 'Sàn niêm yết', value: profileData?.exchange || 'HOSE', sub: profileData?.industry || 'Ngân hàng' },
    { label: 'Vốn điều lệ', value: displayCharterCapital, sub: 'Quy mô vốn hiện tại' },
    { label: 'Ngày giao dịch đầu tiên', value: profileData?.first_trading_date || 'Đang cập nhật', sub: 'Mốc niêm yết lịch sử' },
  ];
  const latestMarketRow = sortedFullData[sortedFullData.length - 1];
  const recentVolumeSlice = sortedFullData.slice(-20);
  const averageRecentVolume = recentVolumeSlice.length
    ? recentVolumeSlice.reduce((sum, item) => sum + (Number(item.volume) || 0), 0) / recentVolumeSlice.length
    : 0;
  const volumeRatio = averageRecentVolume > 0 && latestMarketRow?.volume
    ? latestMarketRow.volume / averageRecentVolume
    : 1;
  const latestRsi = Number(latestMarketRow?.rsi_14 || 50);
  const rsiLabel = latestRsi >= 70 ? 'Quá mua' : latestRsi <= 30 ? 'Quá bán' : 'Trung tính';
  const trendLabel = priceDiffPercent >= thresholdValue * 100
    ? 'Tăng ngắn hạn'
    : priceDiffPercent <= -(thresholdValue * 100)
      ? 'Giảm ngắn hạn'
      : 'Đi ngang';
  const volumeLabel = volumeRatio >= 1.15 ? 'Cao hơn trung bình' : volumeRatio <= 0.85 ? 'Thấp hơn trung bình' : 'Cân bằng';
  const quickDiagnosisCards = [
    {
      label: 'Xu hướng ngắn hạn',
      value: trendLabel,
      sub: `Biên dự báo ${priceDiffPercent >= 0 ? '+' : ''}${formatPercent(priceDiffPercent, 2)}`,
      color: priceDiffPercent >= thresholdValue * 100 ? '#0ecb81' : priceDiffPercent <= -(thresholdValue * 100) ? '#f6465d' : '#fcd535',
    },
    {
      label: 'RSI hiện tại',
      value: `${latestRsi.toFixed(1)} • ${rsiLabel}`,
      sub: 'Theo dõi trạng thái quá mua/quá bán',
      color: latestRsi >= 70 ? '#f6465d' : latestRsi <= 30 ? '#0ecb81' : '#eaecef',
    },
    {
      label: 'Khối lượng',
      value: volumeLabel,
      sub: `So với trung bình 20 phiên: ${volumeRatio.toFixed(2)}x`,
      color: volumeRatio >= 1.15 ? '#0ecb81' : volumeRatio <= 0.85 ? '#fcd535' : '#eaecef',
    },
    {
      label: 'Bối cảnh chung',
      value: marketContext?.overall_market_label || 'Đang đồng bộ',
      sub: marketContext ? `Rủi ro chính trị: ${marketContext.political_risk_label}` : 'Chờ đồng bộ lớp bối cảnh',
      color: marketContext ? getRiskScoreColor(marketContext.overall_market_pressure) : '#eaecef',
    },
  ];

  return (
    <div className="app-container">
      <style>{cssStyles}</style>

      <ChatWidget
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        chatSize={chatSize}
        startResize={startResize}
        chatHistory={chatHistory}
        isTyping={isTyping}
        chatEndRef={chatEndRef}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleSendMessage={handleSendMessage}
      />

      <TopNavigation
        activeTab={activeTab}
        handleTabChange={handleTabChange}
        ticker={ticker}
        handleBankChange={handleBankChange}
      />

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
              <div className="card chart-card">
                <div className="chart-card-header">
                  <div>
                    <div className="chart-eyebrow">Trung tâm phân tích giá</div>
                    <h2 className="chart-title">{ticker} / VNĐ</h2>
                    <div className="chart-subtitle">Biểu đồ nến là khu vực theo dõi chính, tập trung vào biến động giá và ngưỡng ra quyết định trong ngắn hạn.</div>
                  </div>
                  <div className="chart-status-row">
                    <span className="status-pill">Tín hiệu trọng tâm T+1</span>
                    <span className="status-pill muted">{latestDataTime}</span>
                  </div>
                </div>

                <div className="chart-frame">
                  <div ref={tooltipRef} style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, backgroundColor: 'rgba(30, 35, 41, 0.85)', padding: '10px', borderRadius: '6px', border: '1px solid #2b3139', fontSize: '13px', display: 'none', gap: '15px', pointerEvents: 'none' }}></div>
                  <div ref={chartContainerRef} style={{ width: '100%' }}></div>
                </div>
              </div>

              <div className="card signal-card">
                <div className="signal-card-header">
                  <div>
                    <div className="chart-eyebrow">Bộ lọc dòng tiền</div>
                    <h3 style={{ margin: '6px 0 0', color: '#eaecef', fontSize: '18px' }}>Khối lượng giao dịch & tín hiệu hỗ trợ</h3>
                  </div>
                  <div className="legend-row">
                    <span className="legend-chip" style={{ color: '#0ecb81' }}>■ Vol tăng</span>
                    <span className="legend-chip" style={{ color: '#f6465d' }}>■ Vol giảm</span>
                    <span className="legend-chip" style={{ color: '#e3fe1a' }}>— Đường tín hiệu</span>
                  </div>
                </div>

                <div className="chart-frame">
                  <div ref={attnTooltipRef} style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, backgroundColor: 'rgba(30, 35, 41, 0.85)', padding: '8px 12px', borderRadius: '6px', border: '1px solid #2b3139', fontSize: '13px', display: 'none', gap: '10px', pointerEvents: 'none' }}></div>
                  <div ref={attentionContainerRef} style={{ width: '100%' }}></div>
                </div>
              </div>

              <div className="card signal-card">
                <div className="signal-card-header">
                  <div>
                    <div className="chart-eyebrow">Chẩn đoán nhanh</div>
                    <h3 style={{ margin: '6px 0 0', color: '#eaecef', fontSize: '18px' }}>Bảng đọc nhanh cho quyết định trong ngày</h3>
                  </div>
                  <span className="status-pill muted">Tóm tắt để đọc nhanh trước khi hành động</span>
                </div>

                <div className="quick-diagnosis-grid">
                  {quickDiagnosisCards.map((item) => (
                    <div key={item.label} className="quick-diagnosis-card">
                      <div className="quick-diagnosis-label">{item.label}</div>
                      <div className="quick-diagnosis-value" style={{ color: item.color }}>{item.value}</div>
                      <div className="quick-diagnosis-sub">{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <TechnicalDashboardCompact
              latestDataTime={latestDataTime}
              currentPrice={currentPrice}
              predictedPrice={predictedPrice}
              priceDiff={priceDiff}
              priceDiffPercent={priceDiffPercent}
              thresholdValue={thresholdValue}
              formatVND={formatVND}
              formatPercent={formatPercent}
              recColor={recColor}
              recommendation={recommendation}
              recommendationNote={recommendationNote}
              recommendationConfidenceScore={recommendationConfidenceScore}
              recommendationConfidenceLabel={recommendationConfidenceLabel}
              recommendationConfidenceNote={recommendationConfidenceNote}
              actionPlan={actionPlan}
              priceSignalScore={priceSignalScore}
              contextAlignmentScore={contextAlignmentScore}
              getPositiveScoreColor={getPositiveScoreColor}
              getConfidenceColor={getConfidenceColor}
            />
          </div>

          <div style={{ padding: '0 20px 18px' }}>
            <ActionPlanCard
              recColor={recColor}
              actionPlan={actionPlan}
            />
          </div>

          <MarketAnalysisSection
            loadingContext={loadingContext}
            contextError={contextError}
            marketContext={marketContext}
            analysisSignalLabel={analysisSignalLabel}
            getPositiveScoreColor={getPositiveScoreColor}
            getRiskScoreColor={getRiskScoreColor}
            displayTableData={displayTableData}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            availableMonths={availableMonths}
            availableYears={availableYears}
            formatVND={formatVND}
          />
        </div>
      )}

      {activeTab === 'info' && !profileData && (
        <div className="company-profile" style={{ textAlign: 'center', color: '#9fb0c3' }}>
          Đang đồng bộ hồ sơ doanh nghiệp...
        </div>
      )}

      {activeTab === 'info' && profileData && (
        <div className="company-profile">
          <div className="cp-header">
            <div className="cp-header-main">
              <div className="cp-logo-container">
                <img src={profileData.logo_url} alt={ticker} className="cp-logo" />
              </div>
              <div className="cp-title-group">
                <h2>{profileData.company_name}</h2>
                <p>
                  {profileData.profile_source
                    ? `Nguồn hồ sơ: ${profileData.profile_source} • Cập nhật: ${profileData.profile_updated_at}`
                    : 'Hồ sơ doanh nghiệp đang được đồng bộ tự động.'}
                </p>
              </div>
            </div>
            <div className="cp-header-side">
              <div className="cp-badge-row">
                <span className={`cp-badge ${profileStatusClass}`}>{profileStatusLabel}</span>
                {profileData.profile_source && (
                  <span className="cp-badge">{profileData.profile_source}</span>
                )}
              </div>
              {profileData.website && (
                <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="cp-link-chip">
                  Website chính thức ↗
                </a>
              )}
            </div>
          </div>

          <div className="cp-highlight-grid">
            {profileHighlights.map((item) => (
              <div key={item.label} className="cp-highlight-card">
                <span className="cp-highlight-label">{item.label}</span>
                <span className="cp-highlight-value">{item.value}</span>
                <span className="cp-highlight-sub">{item.sub}</span>
              </div>
            ))}
          </div>

          {profileData.crawl_note && (
            <div className="cp-note-banner">
              {profileData.crawl_note}
            </div>
          )}

          <div className="cp-body">
            <div className="cp-left">
              <div className="cp-primary-card">
                <h4 className="cp-panel-title">Thông tin niêm yết cốt lõi</h4>
                <div className="cp-stats-grid">
                  <div className="stat-item"><span className="stat-label">Mã cổ phiếu</span><span className="stat-value val-blue">{profileData.ticker}</span></div>
                  <div className="stat-item"><span className="stat-label">Vốn điều lệ</span><span className="stat-value">{displayCharterCapital}</span></div>
                  
                  <div className="stat-item"><span className="stat-label">Sàn giao dịch</span><span className="stat-value val-blue">{profileData.exchange}</span></div>
                  <div className="stat-item"><span className="stat-label">KL CP đang niêm yết</span><span className="stat-value">{profileData.listed_shares}</span></div>
                  
                  <div className="stat-item"><span className="stat-label">Nhóm ngành</span><span className="stat-value val-blue">{profileData.industry}</span></div>
                  <div className="stat-item" style={{alignItems: 'center'}}><span className="stat-label">KL CP đang lưu hành</span>
                    <div style={{textAlign: 'right'}}><span className="stat-value">{profileData.outstanding_shares}</span><br/><span style={{fontSize: '11px', color: '#848e9c'}}>(100%)</span></div>
                  </div>
                  
                  <div className="stat-item"><span className="stat-label">Ngày giao dịch đầu tiên</span><span className="stat-value">{profileData.first_trading_date}</span></div>
                  <div className="stat-item"><span className="stat-label">KL cổ phiếu niêm yết lần đầu</span><span className="stat-value">{profileData.first_listed_shares}</span></div>
                  
                  <div className="stat-item"><span className="stat-label">Giá đóng cửa phiên GD đầu tiên</span><span className="stat-value">{profileData.first_price}</span></div>
                </div>
              </div>

              <div className="cp-primary-card">
                <div className="cp-chart-container">
                  <div className="cp-chart-title">Biểu đồ biến đổi vốn điều lệ</div>
                  <div className="cp-bar-chart">
                    <div className="cp-y-axis">
                      {capitalAxisTicks.map((tick, index) => (
                        <span key={`${tick}-${index}`}>{tick}</span>
                      ))}
                    </div>
                    {charterCapitalHistory.map((item, idx) => (
                      <div key={idx} className="cp-bar" style={{ height: `${item.height}%` }}>
                        <div className="bar-tooltip">
                          <strong style={{ color: '#fcd535' }}>{item.quarter}</strong><br/>
                          {item.value} tỷ VNĐ
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="cp-x-axis">
                    {charterCapitalHistory.map((item, idx) => (
                      <span key={idx}>{item.quarter}</span>
                    ))}
                  </div>
                  <div className="cp-chart-caption">
                    Đơn vị hiển thị: tỷ đồng. Mốc mới nhất đang ở mức khoảng {charterCapitalHistory.length ? `${charterCapitalHistory[charterCapitalHistory.length - 1].value} tỷ đồng` : 'đang cập nhật'}.
                  </div>
                </div>
              </div>

              <div className="profile-section-card">
                <h4>Tổng quan doanh nghiệp</h4>
                {profileData.company_description ? (
                  <p className="profile-section-description">{profileData.company_description}</p>
                ) : (
                  <p className="profile-empty">Chưa đồng bộ được phần mô tả doanh nghiệp từ nguồn dữ liệu trực tuyến.</p>
                )}
              </div>

              <div className="cp-primary-card">
                <h4>Tổ chức tư vấn niêm yết</h4>
                <div className="audit-item">
                  {listingAdvisor?.link ? (
                    <a href={listingAdvisor.link} target="_blank" rel="noopener noreferrer" className="audit-name">
                      {listingAdvisor.name} ↗
                    </a>
                  ) : (
                    <span className="audit-name">{listingAdvisor?.name || 'Chưa có dữ liệu tư vấn niêm yết'}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="cp-right">
              <div className="cp-primary-card">
                <h4>Hồ sơ đồng bộ tự động</h4>
                <div className="audit-list">
                  {profileData.website && (
                    <div className="audit-item">
                      <span className="audit-year">Website</span>
                      <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="audit-name">
                        {profileData.website} ↗
                      </a>
                    </div>
                  )}
                  {profileData.phone && (
                    <div className="audit-item">
                      <span className="audit-year">Điện thoại</span>
                      <span className="audit-name">{profileData.phone}</span>
                    </div>
                  )}
                  {profileData.email && (
                    <div className="audit-item">
                      <span className="audit-year">Email</span>
                      <span className="audit-name">{profileData.email}</span>
                    </div>
                  )}
                  {profileData.auditor && (
                    <div className="audit-item">
                      <span className="audit-year">Kiểm toán</span>
                      <span className="audit-name">{profileData.auditor}</span>
                    </div>
                  )}
                  {profileData.address && (
                    <div className="audit-item" style={{ alignItems: 'flex-start' }}>
                      <span className="audit-year">Địa chỉ</span>
                      <span className="audit-name" style={{ textAlign: 'right', lineHeight: 1.5 }}>{profileData.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="cp-primary-card">
                <h4>Tổ chức kiểm toán</h4>
                <div className="audit-list">
                  {auditorTimeline.map((auditor, i) => (
                    <div key={i} className="audit-item">
                      <span className="audit-year">{auditor.year}</span>
                      {auditor.link ? (
                        <a href={auditor.link} target="_blank" rel="noopener noreferrer" className="audit-name">
                          {auditor.name} ↗
                        </a>
                      ) : (
                        <span className="audit-name">{auditor.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <div className="cp-secondary-grid">
            <div className="profile-section-card">
              <h4>Ban lãnh đạo nổi bật</h4>
              {profileData.leadership?.length ? (
                <div className="profile-rich-list">
                  {profileData.leadership.map((leader, index) => (
                    <div key={`${leader.name}-${index}`} className="profile-rich-item">
                      <div className="profile-rich-main">
                        <span className="profile-rich-name">{leader.name}</span>
                        <span className="profile-rich-subtitle">{leader.position}</span>
                      </div>
                      <div className="profile-rich-meta">
                        {leader.ownership_percent && <span className="profile-chip">{leader.ownership_percent}</span>}
                        {leader.updated_at && <span className="profile-rich-subtitle">{leader.updated_at}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty">Chưa có dữ liệu lãnh đạo từ nguồn crawl tại thời điểm hiện tại.</p>
              )}
            </div>

            <div className="profile-section-card">
              <h4>Cổ đông lớn</h4>
              {profileData.major_shareholders?.length ? (
                <div className="profile-rich-list">
                  {profileData.major_shareholders.map((holder, index) => (
                    <div key={`${holder.name}-${index}`} className="profile-rich-item">
                      <div className="profile-rich-main">
                        <span className="profile-rich-name">{holder.name}</span>
                        {holder.shares && <span className="profile-rich-subtitle">{holder.shares} cổ phiếu</span>}
                      </div>
                      <div className="profile-rich-meta">
                        {holder.ownership_percent && <span className="profile-chip">{holder.ownership_percent}</span>}
                        {holder.updated_at && <span className="profile-rich-subtitle">{holder.updated_at}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty">Chưa có dữ liệu cổ đông lớn từ nguồn crawl tại thời điểm hiện tại.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'news' && (
        <div className="news-shell">
          <div className="news-hero">
            <div className="news-hero-main">
              <span className="news-kicker">News Intelligence</span>
              <h2 className="news-hero-title">Trung tâm tin tức vĩ mô và ngân hàng</h2>
              <p className="news-hero-subtitle">
                Hệ thống tổng hợp tin từ nhiều nguồn và cho phép bóc riêng luồng tin của từng ngân hàng hoặc theo dõi toàn thị trường theo thời gian thực.
              </p>
              <div className="news-pill-row">
                <span className="news-pill active">Trọng tâm: {newsFocusTicker === 'ALL' ? 'Toàn ngành' : newsFocusTicker}</span>
                <span className="news-pill">Nguồn theo dõi: {newsInsights.uniqueSourcesCount}</span>
                <span className="news-pill">Cập nhật gần nhất: {newsInsights.latestPublished}</span>
              </div>
              <div className="news-focus-row">
                {['ALL', 'VCB', 'BID', 'CTG'].map((bankCode) => (
                  <button
                    key={bankCode}
                    type="button"
                    className={`news-focus-chip ${newsFocusTicker === bankCode ? 'active' : ''}`}
                    onClick={() => setNewsFocusTicker(bankCode)}
                  >
                    {bankCode === 'ALL' ? 'Toàn ngành' : bankCode}
                  </button>
                ))}
              </div>
            </div>

            <div className="news-hero-side">
              <div className="news-header">
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Tìm kiếm linh hoạt (VD: VCB, Vietcombank, lãi suất, tỷ giá)..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="news-search-note">
                Hỗ trợ alias tự động: gõ <strong>VCB</strong> vẫn hiểu là <strong>Vietcombank</strong>, tương tự với <strong>BID/BIDV</strong> và <strong>CTG/VietinBank</strong>.
              </div>

              <div className="news-stats-grid">
                <div className="news-stat-card">
                  <span className="news-stat-label">Bài đang hiển thị</span>
                  <span className="news-stat-value">{newsInsights.enrichedArticles.length}</span>
                  <span className="news-stat-sub">Sau khi áp dụng bộ lọc tìm kiếm</span>
                </div>
                <div className="news-stat-card">
                  <span className="news-stat-label">Bài liên quan {newsFocusTicker === 'ALL' ? 'trọng tâm đang chọn' : newsFocusTicker}</span>
                  <span className="news-stat-value">{newsInsights.tickerFocusedCount}</span>
                  <span className="news-stat-sub">Khi chọn ngân hàng, hệ thống ưu tiên bài liên quan nhưng vẫn giữ cả tin nền của toàn ngành</span>
                </div>
                <div className="news-stat-card">
                  <span className="news-stat-label">Bài ưu tiên</span>
                  <span className="news-stat-value">{newsInsights.priorityArticlesCount}</span>
                  <span className="news-stat-sub">Nhóm bài có mức độ liên quan cao để đọc trước</span>
                </div>
              </div>
            </div>
          </div>
          
          {loadingNews ? (
            <div className="news-featured-card" style={{ textAlign: 'center', color: '#fcd535' }}>
              Đang tổng hợp tin tức từ CafeF, Vietstock, VNExpress...
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="news-featured-card" style={{ textAlign: 'center', color: '#848e9c' }}>
              Không tìm thấy bài báo nào khớp với từ khóa "{searchQuery}".
            </div>
          ) : (
            <>
              {newsInsights.featuredArticle && (
                <div className="news-featured-card">
                  <div className="news-featured-left">
                    <div className="news-source-row">
                      <span className="news-source-badge">{newsInsights.featuredArticle.source}</span>
                      <span className="news-time-badge">{newsInsights.featuredArticle.published}</span>
                      <span className={`news-tag ${newsInsights.featuredArticle.isTickerFocused ? '' : 'macro'}`}>
                        {newsInsights.featuredArticle.isTickerFocused
                          ? `Trọng tâm ${newsFocusTicker === 'ALL' ? 'ngân hàng' : newsFocusTicker}`
                          : newsInsights.featuredArticle.isBankingRelated ? 'Tin ngân hàng' : 'Tin vĩ mô ngành'}
                      </span>
                      <span className={`news-relevance-badge ${newsInsights.featuredArticle.relevanceTone}`}>
                        Liên quan {newsInsights.featuredArticle.relevanceLabel}
                      </span>
                    </div>
                    <h3 className="news-featured-title">{newsInsights.featuredArticle.title}</h3>
                    <p className="news-featured-desc">
                      {newsInsights.featuredArticle.cleanDescription || 'Bài viết đang được theo dõi để bổ sung tín hiệu cho hệ thống khuyến nghị đầu tư.'}
                    </p>
                    <div className="news-card-insight">{newsInsights.featuredArticle.relevanceSummary}</div>
                    <a href={newsInsights.featuredArticle.link} target="_blank" rel="noopener noreferrer" className="news-cta">
                      Xem bài phân tích đầy đủ ↗
                    </a>
                  </div>

                  <div className="news-featured-right">
                    {newsInsights.featuredArticle.image_url ? (
                      <img
                        src={newsInsights.featuredArticle.image_url}
                        alt={newsInsights.featuredArticle.title}
                        className="news-featured-image"
                      />
                    ) : (
                      <div className="news-featured-image placeholder">
                        Ảnh xem trước đang được cập nhật
                      </div>
                    )}
                    <span className="news-stat-label">Nguồn đang chiếm tỷ trọng lớn</span>
                    <div className="news-chip-grid">
                      {newsInsights.sourceChips.map((item) => (
                        <div key={item.sourceName} className="news-source-chip">
                          <span>{item.sourceName}</span>
                          <span className="news-source-count">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="news-grid">
                {newsInsights.secondaryArticles.map((article, index) => (
                  <div key={`${article.link}-${index}`} className="news-card">
                    <a href={article.link} target="_blank" rel="noopener noreferrer">
                      {article.image_url ? (
                        <img src={article.image_url} alt={article.title} className="news-card-image" />
                      ) : (
                        <div className="news-card-image placeholder">
                          Chưa có ảnh xem trước
                        </div>
                      )}
                      <div className="news-meta">
                        <span className="news-source">[{article.source}]</span>
                        <span>{article.published}</span>
                      </div>
                      <h3>{article.title}</h3>
                      <div className="desc">
                        {article.cleanDescription || 'Bài viết đang được theo dõi để bổ sung bối cảnh cho mô hình dự báo.'}
                      </div>
                      <div className="news-card-insight">{article.relevanceSummary}</div>
                      <div className="news-card-footer">
                        <span className={`news-tag ${article.isTickerFocused ? '' : article.isBankingRelated ? 'macro' : 'neutral'}`}>
                          {article.isTickerFocused
                            ? `Liên quan ${newsFocusTicker === 'ALL' ? 'ngân hàng' : newsFocusTicker}`
                            : article.isBankingRelated
                              ? 'Tin ngân hàng'
                              : 'Theo dõi chung'}
                        </span>
                        <span className={`news-relevance-badge ${article.relevanceTone}`}>
                          {article.relevanceLabel}
                        </span>
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}

export default App;



