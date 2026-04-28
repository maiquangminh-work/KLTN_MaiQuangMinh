import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { MarketDataProvider, useMarketData } from './contexts/MarketDataContext';
import { useChatWidget } from './hooks/useChatWidget';
import { formatVND, formatPercent } from './utils/formatting';
import { NEWS_BANK_ALIASES, VALID_TICKERS } from './utils/constants';
import { fetchPrediction, fetchPredictionBatch } from './api/predict';
import { fetchNews } from './api/market';

import SiteHeader from './components/SiteHeaderPro';
import ChatWidget from './components/ChatWidget';
import FooterSection from './components/FooterSectionV2';
import TickerTapeBar from './components/TickerTapeBar';

import ChartPage from './pages/ChartPage';
import NewsPage from './pages/NewsPage';
import ProfilePage from './pages/ProfilePage';
import AboutPage from './pages/AboutPage';

import './styles/global.css';

const RECOMMENDATION_COLORS = {
  positive: '#0ecb81',
  neutral: '#fcd535',
  negative: '#f6465d',
  loading: '#94a3b8',
};

const BANK_SEARCH_META = {
  VCB: { vi: 'Vietcombank', en: 'Vietcombank' },
  BID: { vi: 'BIDV', en: 'BIDV' },
  CTG: { vi: 'VietinBank', en: 'VietinBank' },
  MBB: { vi: 'MB Bank', en: 'MB Bank' },
  TCB: { vi: 'Techcombank', en: 'Techcombank' },
  VPB: { vi: 'VPBank', en: 'VPBank' },
  ACB: { vi: 'ACB', en: 'ACB' },
  HDB: { vi: 'HDBank', en: 'HDBank' },
  SHB: { vi: 'SHB', en: 'SHB' },
  VIB: { vi: 'VIB', en: 'VIB' },
};

const PAGE_SEARCH_META = {
  chart: {
    vi: 'Biểu đồ kỹ thuật',
    en: 'Technical View',
    aliases: ['chart', 'technical', 'biểu đồ', 'ky thuat', 'gia', 'phân tích'],
  },
  info: {
    vi: 'Thông tin cơ bản',
    en: 'Company Profile',
    aliases: ['info', 'profile', 'company', 'thông tin', 'co ban', 'doanh nghiệp'],
  },
  news: {
    vi: 'Tin tức thị trường',
    en: 'Market News',
    aliases: ['news', 'tin tức', 'tin tuc', 'market', 'vĩ mô', 'vi mo'],
  },
  about: {
    vi: 'Về chúng tôi',
    en: 'About Us',
    aliases: ['about', 'giới thiệu', 'gioi thieu', 'about us'],
  },
};

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getRecommendationTone(payload, fallbackRecommendation) {
  const predictedClass = String(payload?.probability_forecast?.predicted_class || '').toLowerCase();
  if (predictedClass.includes('outperform')) return 'positive';
  if (predictedClass.includes('underperform')) return 'negative';
  if (predictedClass.includes('neutral')) return 'neutral';

  const raw = String(fallbackRecommendation || payload?.recommendation || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const compact = raw.replace(/[^A-Z]/g, '');

  if (compact.includes('DANGTAI') || raw.includes('LOADING')) return 'loading';
  if (compact.includes('KEM') || compact.includes('KAM') || raw.includes('UNDERPERFORM')) return 'negative';
  if (compact.includes('KHAQUAN') || compact.includes('KHACQUAN') || raw.includes('OUTPERFORM')) return 'positive';
  return 'neutral';
}

function LegacyModelRedirect() {
  const { ticker: legacyTicker } = useParams();
  const normalizedTicker = VALID_TICKERS.includes(String(legacyTicker || '').toUpperCase())
    ? String(legacyTicker).toUpperCase()
    : VALID_TICKERS[0];

  return <Navigate to={`/chart/${normalizedTicker}`} replace />;
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme, language, setLanguage, isLightTheme } = useTheme();
  const {
    ticker, setTicker,
    data, setData,
    setLoading,
    setError,
    marketContext,
    watchlistSnapshots, setWatchlistSnapshots,
    watchlistLoading, setWatchlistLoading,
    newsData, setNewsData,
    setLoadingNews,
  } = useMarketData();

  const [searchQuery, setSearchQueryState] = useState('');
  const activeTickerRef = useRef(ticker);
  const watchlistBatchStartedRef = useRef(false);

  useEffect(() => {
    activeTickerRef.current = ticker;
  }, [ticker]);

  const routeState = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const tabCandidate = segments[0];
    const tab = ['chart', 'info', 'news', 'about'].includes(tabCandidate) ? tabCandidate : 'chart';
    const routeTicker = tab === 'about'
      ? ticker
      : (VALID_TICKERS.includes(segments[1]?.toUpperCase()) ? segments[1].toUpperCase() : ticker);
    return { tab, ticker: routeTicker };
  }, [location.pathname, ticker]);

  useEffect(() => {
    if (routeState.tab !== 'about' && routeState.ticker !== ticker) {
      setLoading(true);
      setError(null);
      setTicker(routeState.ticker);
    }
  }, [routeState.tab, routeState.ticker, ticker, setLoading, setError, setTicker]);

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
    } else {
      navigate(`/${tab}/${ticker}`);
    }
    if (tab === 'news' && newsData.length === 0) setLoadingNews(true);
  }, [routeState.tab, ticker, navigate, newsData.length, setLoadingNews]);

  const handleHeaderSearch = useCallback((query) => {
    const trimmedQuery = String(query || '').trim();
    const normalizedTicker = trimmedQuery.toUpperCase();

    if (VALID_TICKERS.includes(normalizedTicker)) {
      if (normalizedTicker !== ticker) {
        setLoading(true);
        setError(null);
        setTicker(normalizedTicker);
      }
      const targetTab = ['chart', 'info', 'news'].includes(routeState.tab) ? routeState.tab : 'chart';
      navigate(`/${targetTab}/${normalizedTicker}`);
      return;
    }

    if (trimmedQuery) {
      navigate(`/news/${ticker}?q=${encodeURIComponent(trimmedQuery)}`);
    } else {
      navigate(`/news/${ticker}`);
    }
    if (newsData.length === 0) setLoadingNews(true);
  }, [ticker, routeState.tab, navigate, newsData.length, setLoadingNews, setLoading, setError, setTicker]);

  useEffect(() => {
    const cachedSnapshot = watchlistSnapshots[ticker];
    if (cachedSnapshot) {
      setData(cachedSnapshot);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    fetchPrediction(ticker)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setWatchlistSnapshots((prev) => ({ ...prev, [ticker]: result }));
        setLoading(false);
        toast.success(`\u0110\u00e3 c\u1eadp nh\u1eadt d\u1eef li\u1ec7u ${ticker}`, { duration: 2000, id: `pred-${ticker}` });
      })
      .catch(() => {
        if (cancelled) return;
        setError('K\u1ebft n\u1ed1i backend th\u1ea5t b\u1ea1i.');
        setLoading(false);
        toast.error('Backend ch\u01b0a kh\u1edfi \u0111\u1ed9ng. Vui l\u00f2ng ch\u1ea1y api.py.', { duration: 4000, id: 'backend-error' });
      });
    return () => { cancelled = true; };
  }, [ticker, watchlistSnapshots, setData, setWatchlistSnapshots, setLoading, setError]);

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

  useEffect(() => {
    if (routeState.tab !== 'chart' && routeState.tab !== 'info' && routeState.tab !== 'about') return;
    if (watchlistBatchStartedRef.current) return;

    watchlistBatchStartedRef.current = true;
    setWatchlistLoading(true);
    fetchPredictionBatch(VALID_TICKERS)
      .then(({ snapshots, failedTickers }) => {
        if (Object.keys(snapshots).length === 0) {
          watchlistBatchStartedRef.current = false;
        } else {
          setWatchlistSnapshots((prev) => ({ ...prev, ...snapshots }));
        }
        if (failedTickers.length > 0) {
          toast.error(`Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c: ${failedTickers.join(', ')}`, {
            duration: 3500,
            id: 'watchlist-partial-failure',
          });
        }

        const activeSnapshot = snapshots[activeTickerRef.current];
        if (activeSnapshot) {
          setData(activeSnapshot);
          setLoading(false);
        }
        setWatchlistLoading(false);
      })
      .catch(() => {
        watchlistBatchStartedRef.current = false;
        setWatchlistLoading(false);
      });
  }, [routeState.tab, setWatchlistSnapshots, setWatchlistLoading, setData, setLoading]);

  const chat = useChatWidget(ticker, data, newsData, marketContext);

  const scores = useMemo(() => {
    const currentPrice = data?.current_price || 0;
    const predictedPrice = data?.predictions?.[0]?.predicted_price || 0;
    const priceDiffPercent = currentPrice ? ((predictedPrice - currentPrice) / currentPrice) * 100 : 0;
    const recommendationScore = Number(data?.recommendation_score ?? 50);
    const recommendationConfidenceScore = Number(data?.recommendation_confidence_score ?? recommendationScore);
    return { currentPrice, predictedPrice, priceDiffPercent, recommendationScore, recommendationConfidenceScore };
  }, [data]);

  const searchSuggestions = useMemo(() => {
    const rawQuery = String(searchQuery || '').trim();
    const normalizedQuery = normalizeSearchText(rawQuery);
    const normalizedUpperQuery = rawQuery.toUpperCase();

    if (!normalizedQuery) {
      return { stocks: [], pages: [], news: [], actions: [] };
    }

    const activeTab = ['chart', 'info', 'news'].includes(routeState.tab) ? routeState.tab : 'chart';
    const localizedPageName = (tab) => PAGE_SEARCH_META[tab]?.[language] || PAGE_SEARCH_META[tab]?.en || tab;

    const stocks = VALID_TICKERS.map((code) => {
      const names = BANK_SEARCH_META[code] || { vi: code, en: code };
      const aliases = NEWS_BANK_ALIASES[code] || [];
      const searchPool = [
        code,
        names.vi,
        names.en,
        ...aliases,
      ].map(normalizeSearchText);

      const exactCodeMatch = code === normalizedUpperQuery;
      const exactAliasMatch = searchPool.includes(normalizedQuery);
      const partialMatch = searchPool.some((item) => item.includes(normalizedQuery));

      if (!exactCodeMatch && !exactAliasMatch && !partialMatch) {
        return null;
      }

      let score = 0;
      if (exactCodeMatch) score += 120;
      if (exactAliasMatch) score += 90;
      if (partialMatch) score += 50;
      if (code.startsWith(normalizedUpperQuery)) score += 20;

      return {
        id: `stock-${code}`,
        type: 'ticker',
        ticker: code,
        targetTab: activeTab,
        title: `${code} · ${language === 'vi' ? names.vi : names.en}`,
        subtitle: language === 'vi'
          ? `Mở ${localizedPageName(activeTab).toLowerCase()}`
          : `Open ${localizedPageName(activeTab)}`,
        score,
      };
    })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const pages = Object.entries(PAGE_SEARCH_META)
      .map(([tab, meta]) => {
        const searchPool = [meta.vi, meta.en, ...meta.aliases].map(normalizeSearchText);
        const matches = searchPool.some((item) => item.includes(normalizedQuery));
        if (!matches) return null;

        return {
          id: `page-${tab}`,
          type: 'page',
          tab,
          title: language === 'vi' ? meta.vi : meta.en,
          subtitle: tab === 'about'
            ? (language === 'vi' ? 'Mở trang tổng quan dự án' : 'Open project overview')
            : `${ticker} · ${language === 'vi' ? 'đi tới tab này' : 'open this section'}`,
          path: tab === 'about' ? '/about' : `/${tab}/${ticker}`,
          score: searchPool[0] === normalizedQuery ? 90 : 45,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const news = (normalizedQuery.length >= 2 ? newsData : [])
      .map((article, index) => {
        const title = normalizeSearchText(article?.title);
        const description = normalizeSearchText(article?.description || article?.cleanDescription);
        const source = normalizeSearchText(article?.source);

        let score = 0;
        if (title.includes(normalizedQuery)) score += 100;
        if (description.includes(normalizedQuery)) score += 40;
        if (source.includes(normalizedQuery)) score += 12;

        if (score === 0) {
          return null;
        }

        return {
          id: `news-${index}`,
          type: 'news',
          title: article.title,
          subtitle: [article.source, article.published].filter(Boolean).join(' · '),
          link: article.link,
          score,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const actions = [{
      id: `query-${normalizedQuery}`,
      type: 'query',
      title: language === 'vi'
        ? `Tìm tin tức với "${rawQuery}"`
        : `Search news for "${rawQuery}"`,
      subtitle: language === 'vi'
        ? `Mở tab Tin tức thị trường cho ${ticker}`
        : `Open Market News for ${ticker}`,
      query: rawQuery,
      ticker,
      score: 1,
    }];

    return { stocks, pages, news, actions };
  }, [language, newsData, routeState.tab, searchQuery, ticker]);

  const handleSearchSuggestionSelect = useCallback((item) => {
    if (!item) return;

    if (item.type === 'ticker') {
      if (item.ticker !== ticker) {
        setLoading(true);
        setError(null);
        setTicker(item.ticker);
      }
      navigate(`/${item.targetTab}/${item.ticker}`);
      setSearchQueryState('');
      return;
    }

    if (item.type === 'page') {
      navigate(item.path);
      setSearchQueryState('');
      if (item.tab === 'news' && newsData.length === 0) setLoadingNews(true);
      return;
    }

    if (item.type === 'news') {
      window.open(item.link, '_blank', 'noopener,noreferrer');
      return;
    }

    if (item.type === 'query') {
      navigate(`/news/${item.ticker}?q=${encodeURIComponent(item.query)}`);
      setSearchQueryState(item.query);
      if (newsData.length === 0) setLoadingNews(true);
    }
  }, [navigate, newsData.length, setError, setLoading, setLoadingNews, setTicker, ticker]);

  const watchlistItems = useMemo(() => {
    return VALID_TICKERS.map((code) => {
      const payload = code === ticker && data ? data : watchlistSnapshots[code];
      const itemCurrentPrice = payload?.current_price != null ? Number(payload.current_price) : null;
      const itemPredictedPrice = payload?.predictions?.[0]?.predicted_price != null ? Number(payload.predictions[0].predicted_price) : null;
      const itemDiffPercent = itemCurrentPrice && itemPredictedPrice
        ? ((itemPredictedPrice - itemCurrentPrice) / itemCurrentPrice) * 100
        : null;
      const itemThreshold = Number(payload?.recommendation_threshold ?? 0.008) * 0.6 * 100;
      const itemRecommendation = payload?.recommendation
        || (itemDiffPercent !== null && itemDiffPercent >= itemThreshold
          ? 'KH\u1ea2 QUAN'
          : itemDiffPercent !== null && itemDiffPercent <= -itemThreshold
            ? 'K\u00c9M KH\u1ea2 QUAN'
            : '\u0110ANG T\u1ea2I');
      const recommendationTone = !payload
        ? 'loading'
        : getRecommendationTone(payload, itemRecommendation);
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
      const color = RECOMMENDATION_COLORS[recommendationTone] || RECOMMENDATION_COLORS.neutral;
      return {
        ticker: code,
        isPending: !payload,
        currentPrice: itemCurrentPrice,
        predictedPrice: itemPredictedPrice,
        deltaPercent: itemDiffPercent,
        recommendation: itemRecommendation,
        recommendationTone,
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
        searchSuggestions={searchSuggestions}
        handleSearchSuggestionSelect={handleSearchSuggestionSelect}
      />

      {routeState.tab !== 'about' && (
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
        <Route path="/model/:ticker" element={<LegacyModelRedirect />} />
        <Route path="/model" element={<Navigate to={`/chart/${ticker}`} replace />} />
        <Route path="*" element={<Navigate to={`/chart/${ticker}`} replace />} />
      </Routes>

      <FooterSection
        language={language}
        onOpenChart={() => handleTabChange('chart')}
        onOpenInfo={() => handleTabChange('info')}
        onOpenNews={() => handleTabChange('news')}
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
