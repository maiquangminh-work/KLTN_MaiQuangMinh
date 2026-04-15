import { useState, useEffect, useMemo, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { MarketDataProvider, useMarketData } from './contexts/MarketDataContext';
import { useChatWidget } from './hooks/useChatWidget';
import { formatVND, formatPercent } from './utils/formatting';
import { VALID_TICKERS } from './utils/constants';
import { fetchPrediction } from './api/predict';
import { fetchNews } from './api/market';

import SiteHeader from './components/SiteHeaderPro';
import ChatWidget from './components/ChatWidget';
import FooterSection from './components/FooterSectionV2';
import TickerTapeBar from './components/TickerTapeBar';

import ChartPage from './pages/ChartPage';
import NewsPage from './pages/NewsPage';
import ProfilePage from './pages/ProfilePage';
import AboutPage from './pages/AboutPage';
import ModelPerformancePage from './pages/ModelPerformancePage';

import './styles/global.css';

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme, language, setLanguage, isLightTheme } = useTheme();
  const {
    ticker, setTicker,
    data, setData,
    loading, setLoading,
    error, setError,
    marketContext,
    watchlistSnapshots, setWatchlistSnapshots,
    watchlistLoading, setWatchlistLoading,
    newsData, setNewsData,
    loadingNews, setLoadingNews,
  } = useMarketData();

  const [searchQuery, setSearchQueryState] = useState('');

  // Parse current route
  const routeState = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const tabCandidate = segments[0];
    const tab = ['chart', 'info', 'news', 'about', 'model'].includes(tabCandidate) ? tabCandidate : 'chart';
    const routeTicker = (tab === 'about' || tab === 'model')
      ? ticker
      : (VALID_TICKERS.includes(segments[1]?.toUpperCase()) ? segments[1].toUpperCase() : ticker);
    return { tab, ticker: routeTicker };
  }, [location.pathname, ticker]);

  // Sync ticker from URL
  useEffect(() => {
    if (routeState.tab !== 'about' && routeState.ticker !== ticker) {
      setLoading(true);
      setError(null);
      setTicker(routeState.ticker);
    }
  }, [routeState.tab, routeState.ticker, ticker, setLoading, setError, setTicker]);

  // Navigation handlers
  const handleBankChange = useCallback((bank) => {
    if (bank === ticker) return;
    setLoading(true);
    setError(null);
    setTicker(bank);
    const tab = routeState.tab === 'about' ? 'chart' : routeState.tab;
    navigate(`/${tab}/${bank}`);
  }, [ticker, routeState.tab, navigate, setLoading, setError, setTicker]);

  const handleTabChange = useCallback((tab) => {
    if (tab === routeState.tab) return;
    if (tab === 'about') {
      navigate('/about');
    } else if (tab === 'model') {
      navigate('/model');
    } else {
      navigate(`/${tab}/${ticker}`);
    }
    if (tab === 'news' && newsData.length === 0) setLoadingNews(true);
  }, [routeState.tab, ticker, navigate, newsData.length, setLoadingNews]);

  const handleHeaderSearch = useCallback(() => {
    navigate(`/news/${ticker}`);
    if (newsData.length === 0) setLoadingNews(true);
  }, [ticker, navigate, newsData.length, setLoadingNews]);

  // Fetch prediction data
  useEffect(() => {
    let cancelled = false;
    fetchPrediction(ticker)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setWatchlistSnapshots((prev) => ({ ...prev, [ticker]: result }));
        setLoading(false);
        toast.success(`Đã cập nhật dữ liệu ${ticker}`, { duration: 2000, id: `pred-${ticker}` });
      })
      .catch(() => {
        if (cancelled) return;
        setError('Kết nối backend thất bại.');
        setLoading(false);
        toast.error('Backend chưa khởi động. Vui lòng chạy api.py.', { duration: 4000, id: 'backend-error' });
      });
    return () => { cancelled = true; };
  }, [ticker, setData, setWatchlistSnapshots, setLoading, setError]);

  // Fetch news data
  useEffect(() => {
    if (newsData.length > 0) return;
    if (routeState.tab !== 'news' && routeState.tab !== 'chart') return;
    let cancelled = false;
    setLoadingNews(true);
    fetchNews()
      .then((news) => { if (!cancelled) { setNewsData(news); setLoadingNews(false); } })
      .catch(() => { if (!cancelled) setLoadingNews(false); });
    return () => { cancelled = true; };
  }, [routeState.tab, newsData.length, setNewsData, setLoadingNews]);

  // Fetch watchlist snapshots for other tickers
  useEffect(() => {
    if (routeState.tab !== 'chart' && routeState.tab !== 'about') return;
    let cancelled = false;
    const missingTickers = VALID_TICKERS.filter((code) => !watchlistSnapshots[code]);
    if (missingTickers.length === 0) {
      setWatchlistLoading(false);
      return;
    }
    setWatchlistLoading(true);
    Promise.allSettled(missingTickers.map((code) => fetchPrediction(code)))
      .then((results) => {
        if (cancelled) return;
        const snapshots = {};
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') snapshots[missingTickers[index]] = result.value;
        });
        setWatchlistSnapshots((prev) => ({ ...prev, ...snapshots }));
        setWatchlistLoading(false);
      })
      .catch(() => { if (!cancelled) setWatchlistLoading(false); });
    return () => { cancelled = true; };
  }, [routeState.tab, watchlistSnapshots, setWatchlistSnapshots, setWatchlistLoading]);

  // Chat widget
  const chat = useChatWidget(ticker, data, newsData, marketContext);

  // Watchlist items for TickerTape
  const scores = useMemo(() => {
    const currentPrice = data?.current_price || 0;
    const predictedPrice = data?.predictions?.[0]?.predicted_price || 0;
    const priceDiffPercent = currentPrice ? ((predictedPrice - currentPrice) / currentPrice) * 100 : 0;
    const recommendationScore = Number(data?.recommendation_score ?? 50);
    const recommendationConfidenceScore = Number(data?.recommendation_confidence_score ?? recommendationScore);
    return { currentPrice, predictedPrice, priceDiffPercent, recommendationScore, recommendationConfidenceScore };
  }, [data]);

  const watchlistItems = useMemo(() => {
    return VALID_TICKERS.map((code) => {
      const payload = code === ticker && data ? data : watchlistSnapshots[code];
      const itemCurrentPrice = payload?.current_price != null ? Number(payload.current_price) : null;
      const itemPredictedPrice = payload?.predictions?.[0]?.predicted_price != null ? Number(payload.predictions[0].predicted_price) : null;
      const itemDiffPercent = itemCurrentPrice && itemPredictedPrice
        ? ((itemPredictedPrice - itemCurrentPrice) / itemCurrentPrice) * 100
        : null;
      const itemThreshold = Number(payload?.recommendation_threshold ?? 0.0004) * 0.6 * 100;
      const itemRecommendation = payload?.recommendation
        || (itemDiffPercent !== null && itemDiffPercent >= itemThreshold
          ? 'KHẢ QUAN'
          : itemDiffPercent !== null && itemDiffPercent <= -itemThreshold
            ? 'KÉM KHẢ QUAN'
            : 'ĐANG TẢI');
      const itemScore = Number(
        code === ticker
          ? scores.recommendationScore
          : payload?.recommendation_score ?? payload?.recommendation_confidence_score ?? 50
      );
      const itemConfidence = Number(
        code === ticker
          ? scores.recommendationConfidenceScore
          : payload?.recommendation_confidence_score ?? payload?.recommendation_score ?? itemScore
      );
      const color = itemRecommendation === 'KHẢ QUAN'
        ? '#0ecb81'
        : itemRecommendation === 'KÉM KHẢ QUAN'
          ? '#f6465d'
          : itemRecommendation === 'ĐANG TẢI'
            ? '#94a3b8'
            : '#fcd535';
      return {
        ticker: code,
        isPending: !payload,
        currentPrice: itemCurrentPrice,
        predictedPrice: itemPredictedPrice,
        deltaPercent: itemDiffPercent,
        recommendation: itemRecommendation,
        score: itemScore,
        confidence: itemConfidence,
        color,
        sparkline: (Array.isArray(payload?.chart_data) ? payload.chart_data : [])
          .map((point) => Number(point?.close_winsorized ?? point?.close ?? 0))
          .filter((value) => Number.isFinite(value) && value > 0)
          .slice(-7),
      };
    });
  }, [ticker, data, watchlistSnapshots, scores.recommendationScore, scores.recommendationConfidenceScore]);

  return (
    <div className={`app-container theme-${theme}`}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: isLightTheme ? '#fff' : '#1e2329',
            color: isLightTheme ? '#1e293b' : '#eaecef',
            border: `1px solid ${isLightTheme ? '#e2e8f0' : '#2b3139'}`,
            borderRadius: '10px',
            fontSize: '13px',
            maxWidth: '360px',
          },
          success: { iconTheme: { primary: '#0ecb81', secondary: '#000' } },
          error: { iconTheme: { primary: '#f6465d', secondary: '#fff' } },
        }}
      />
      <ChatWidget
        isChatOpen={chat.isChatOpen}
        setIsChatOpen={chat.setIsChatOpen}
        chatSize={chat.chatSize}
        startResize={chat.startResize}
        chatHistory={chat.chatHistory}
        isTyping={chat.isTyping}
        chatEndRef={chat.chatEndRef}
        chatInput={chat.chatInput}
        setChatInput={chat.setChatInput}
        handleSendMessage={chat.handleSendMessage}
        ticker={ticker}
        language={language}
      />

      <SiteHeader
        activeTab={routeState.tab}
        handleTabChange={handleTabChange}
        ticker={ticker}
        handleBankChange={handleBankChange}
        language={language}
        setLanguage={setLanguage}
        theme={theme}
        setTheme={setTheme}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQueryState}
        handleHeaderSearch={handleHeaderSearch}
      />

      {routeState.tab !== 'about' && routeState.tab !== 'model' && (
        <TickerTapeBar
          language={language}
          items={watchlistItems}
          loading={watchlistLoading}
          activeTicker={ticker}
          onSelectTicker={handleBankChange}
          formatVND={formatVND}
          formatPercent={formatPercent}
        />
      )}

      <Routes>
        <Route path="/chart/:ticker" element={<ChartPage />} />
        <Route path="/news/:ticker?" element={<NewsPage />} />
        <Route path="/info/:ticker" element={<ProfilePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/model" element={<ModelPerformancePage />} />
        <Route path="*" element={<Navigate to={`/chart/${ticker}`} replace />} />
      </Routes>

      <FooterSection
        language={language}
        onOpenChart={() => handleTabChange('chart')}
        onOpenInfo={() => handleTabChange('info')}
        onOpenNews={() => handleTabChange('news')}
        onOpenModel={() => handleTabChange('model')}
        onOpenAbout={() => handleTabChange('about')}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MarketDataProvider>
        <AppShell />
      </MarketDataProvider>
    </ThemeProvider>
  );
}
