import { useEffect, useRef, useMemo, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import { useMarketData } from '../contexts/MarketDataContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatVND, formatPercent } from '../utils/formatting';
import {
  calculateScores,
  buildActionPlan,
  getDecisionGuidance,
  getImmediateAction,
  getPositiveScoreColor,
  getRiskScoreColor,
  getConfidenceColor,
} from '../utils/recommendation';
import { TIMEFRAME_OPTIONS, NEWS_BANK_ALIASES } from '../utils/constants';
import { calcEMA, calcBollingerBands, calcMACD, INDICATOR_OPTIONS } from '../utils/indicators';
import { fetchMarketContext } from '../api/market';
import TechnicalDashboardCompact from '../components/TechnicalDecisionPanelV2';
import ActionPlanCard from '../components/ActionGuidePanelV2';
import HistoryTablePanel from '../components/HistoryTablePanel';
import LoadingStatePanel from '../components/LoadingStatePanel';
import QuickStatsBanner from '../components/ui/QuickStatsBanner';
import { exportChartDataCSV, exportPredictionReportCSV } from '../utils/export';

export default function ChartPage() {
  const {
    ticker, data, loading, error,
    marketContext, setMarketContext,
    loadingContext, setLoadingContext,
    contextError, setContextError,
    newsData, profileData,
  } = useMarketData();
  const { isLightTheme, chartTheme, language } = useTheme();

  const [timeframe, setTimeframe] = useState('All');
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [activeIndicators, setActiveIndicators] = useState(new Set());

  const toggleIndicator = (id) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const chartContainerRef = useRef();
  const attentionContainerRef = useRef();
  const chartFrameRef = useRef();
  const attentionFrameRef = useRef();
  const attnTooltipRef = useRef();

  const shellCopy = {
    vi: {
      chartEyebrow: 'Trung t\u00e2m ph\u00e2n t\u00edch gi\u00e1',
      chartSubtitle: 'Bi\u1ec3u \u0111\u1ed3 n\u1ebfn l\u00e0 khu v\u1ef1c theo d\u00f5i ch\u00ednh, t\u1eadp trung v\u00e0o bi\u1ebfn \u0111\u1ed9ng gi\u00e1 v\u00e0 t\u00edn hi\u1ec7u tri\u1ec3n v\u1ecdng ng\u1eafn h\u1ea1n.',
      timeframeLabel: 'Khung nh\u00ecn',
      signalEyebrow: 'B\u1ed9 l\u1ecdc d\u00f2ng ti\u1ec1n',
      signalTitle: 'Kh\u1ed1i l\u01b0\u1ee3ng giao d\u1ecbch & t\u00edn hi\u1ec7u h\u1ed7 tr\u1ee3',
      helperEyebrow: 'Ph\u1ee5 tr\u1ee3 di\u1ec5n gi\u1ea3i',
      helperTitle: '4 t\u00edn hi\u1ec7u \u0111\u1ecdc nhanh',
      helperNote: '\u0110\u1ecdc sau k\u1ebft lu\u1eadn ch\u00ednh',
      deepEyebrow: 'Ph\u00e2n t\u00edch s\u00e2u h\u01a1n',
      deepTitle: 'Xem b\u1ed1i c\u1ea3nh th\u1ecb tr\u01b0\u1eddng',
      deepNote: 'Ch\u1ec9 m\u1edf ph\u1ea7n n\u00e0y khi b\u1ea1n mu\u1ed1n hi\u1ec3u th\u00eam v\u00ec sao h\u1ec7 th\u1ed1ng \u0111ang \u0111\u00e1nh gi\u00e1 nh\u01b0 hi\u1ec7n t\u1ea1i.',
      deepToggle: 'M\u1edf chi ti\u1ebft \u2193',
      loading: `\u23f3 \u0110ANG PH\u00c2N T\u00cdCH ${ticker}...`,
    },
    en: {
      chartEyebrow: 'Price Analysis Hub',
      chartSubtitle: 'The candlestick chart is the primary monitoring area, focused on price behavior and short-term outlook signals.',
      timeframeLabel: 'Timeframe',
      signalEyebrow: 'Flow Filter',
      signalTitle: 'Trading volume & support signals',
      helperEyebrow: 'Quick interpretation',
      helperTitle: '4 signals to scan quickly',
      helperNote: 'Read this after the main conclusion',
      deepEyebrow: 'Deep dive',
      deepTitle: 'View market context',
      deepNote: 'Open this only when you want to understand why the system currently leans this way.',
      deepToggle: 'Open details \u2193',
      loading: `\u23f3 ANALYZING ${ticker}...`,
    },
  }[language];

  // Fetch market context
  useEffect(() => {
    let cancelled = false;
    setLoadingContext(true);
    setContextError(null);
    fetchMarketContext(ticker)
      .then((res) => { if (!cancelled) { setMarketContext(res); setLoadingContext(false); } })
      .catch(() => {
        if (!cancelled) {
          setMarketContext(null);
          setContextError('Ch\u01b0a t\u1ea3i \u0111\u01b0\u1ee3c l\u1edbp b\u1ed1i c\u1ea3nh th\u1ecb tr\u01b0\u1eddng.');
          setLoadingContext(false);
        }
      });
    return () => { cancelled = true; };
  }, [ticker, setMarketContext, setLoadingContext, setContextError]);

  // Process chart data
  const { sortedFullData, enrichedFullData, availableYears, availableMonths } = useMemo(() => {
    const safeChartData = Array.isArray(data?.chart_data) ? data.chart_data : [];
    const uniqueDataMap = new Map();
    safeChartData.forEach((item) => {
      const rawTime = item.time || item.Time || '';
      const parsedTime = String(rawTime).split(' ')[0];
      if (parsedTime && parsedTime.length >= 8) {
        uniqueDataMap.set(parsedTime, {
          time: parsedTime,
          open: (Number(item.open) || 0) * 1000,
          high: (Number(item.high) || 0) * 1000,
          low: (Number(item.low) || 0) * 1000,
          close: (Number(item.close_winsorized || item.close) || 0) * 1000,
          volume: Number(item.volume) || 0,
          rsi_14: Number(item.rsi_14) || 50,
        });
      }
    });
    const sortedData = Array.from(uniqueDataMap.values()).sort((a, b) => a.time.localeCompare(b.time));
    const enrichedData = sortedData.map((row, i, arr) => {
      const prevClose = i > 0 ? arr[i - 1].close : row.close;
      let colorClass = 'text-yellow';
      if (row.close > prevClose) colorClass = 'text-green';
      if (row.close < prevClose) colorClass = 'text-red';
      const dateParts = row.time.split('-');
      return { ...row, colorClass, year: dateParts[0], month: dateParts[1] };
    });
    const years = [...new Set(enrichedData.map((d) => d.year))].filter(Boolean).sort((a, b) => b - a);
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    return { sortedFullData: sortedData, enrichedFullData: enrichedData, availableYears: years, availableMonths: months };
  }, [data]);

  const displayTableData = useMemo(() => {
    if (!enrichedFullData) return [];
    return enrichedFullData
      .filter((row) => {
        const matchYear = filterYear === 'All' || row.year === filterYear;
        const matchMonth = filterMonth === 'All' || row.month === filterMonth;
        return matchYear && matchMonth;
      })
      .reverse();
  }, [enrichedFullData, filterYear, filterMonth]);

  const visibleChartData = useMemo(() => {
    const selectedRange = TIMEFRAME_OPTIONS.find((item) => item.id === timeframe);
    if (!selectedRange?.bars) return sortedFullData;
    return sortedFullData.slice(-selectedRange.bars);
  }, [sortedFullData, timeframe]);

  // Technical indicator data (computed on full data, sliced to visible range)
  const indicatorData = useMemo(() => {
    if (!sortedFullData.length) return {};
    const ema12Full = calcEMA(sortedFullData, 12);
    const ema26Full = calcEMA(sortedFullData, 26);
    const bollFull = calcBollingerBands(sortedFullData, 20, 2);
    const macdFull = calcMACD(sortedFullData, 12, 26, 9);

    // Slice to match visibleChartData time range
    const visibleTimes = new Set(visibleChartData.map((d) => d.time));
    const slice = (arr) => arr.filter((d) => visibleTimes.has(d.time));

    return {
      ema12: slice(ema12Full),
      ema26: slice(ema26Full),
      bollUpper: slice(bollFull.upper),
      bollMiddle: slice(bollFull.middle),
      bollLower: slice(bollFull.lower),
      macdLine: slice(macdFull.macd),
      macdSignal: slice(macdFull.signal),
      macdHistogram: slice(macdFull.histogram),
    };
  }, [sortedFullData, visibleChartData]);

  // Recommendation scores
  const scores = useMemo(() => calculateScores(data, marketContext), [data, marketContext]);
  const actionPlan = useMemo(() => buildActionPlan(scores, marketContext), [scores, marketContext]);
  const decisionGuidance = useMemo(() => getDecisionGuidance(scores.recommendation), [scores.recommendation]);
  const immediateAction = useMemo(() => getImmediateAction(scores.recommendation), [scores.recommendation]);

  // Quick diagnosis
  const latestMarketRow = sortedFullData[sortedFullData.length - 1];
  const recentVolumeSlice = sortedFullData.slice(-20);
  const averageRecentVolume = recentVolumeSlice.length
    ? recentVolumeSlice.reduce((sum, item) => sum + (Number(item.volume) || 0), 0) / recentVolumeSlice.length
    : 0;
  const volumeRatio = averageRecentVolume > 0 && latestMarketRow?.volume
    ? latestMarketRow.volume / averageRecentVolume
    : 1;
  const latestRsi = Number(latestMarketRow?.rsi_14 || 50);
  const rsiLabel = latestRsi >= 70 ? 'Qu\u00e1 mua' : latestRsi <= 30 ? 'Qu\u00e1 b\u00e1n' : 'Trung t\u00ednh';
  const neutralMetricColor = isLightTheme ? 'var(--text-primary)' : '#eaecef';
  const tooltipLabelColor = isLightTheme ? '#617488' : '#848e9c';
  const tooltipValueColor = isLightTheme ? '#1b2a38' : '#eaecef';
  const trendLabel = scores.priceDiffPercent >= scores.signalBiasThreshold * 100
    ? 'Nghi\u00eang t\u0103ng'
    : scores.priceDiffPercent <= -(scores.signalBiasThreshold * 100)
      ? 'Nghi\u00eang gi\u1ea3m'
      : '\u0110i ngang';
  const volumeLabel = volumeRatio >= 1.15 ? 'Cao h\u01a1n trung b\u00ecnh' : volumeRatio <= 0.85 ? 'Th\u1ea5p h\u01a1n trung b\u00ecnh' : 'C\u00e2n b\u1eb1ng';

  const quickDiagnosisCards = [
    {
      label: 'Xu h\u01b0\u1edbng ng\u1eafn h\u1ea1n',
      value: trendLabel,
      sub: `Bi\u00ean d\u1ef1 b\u00e1o ${scores.priceDiffPercent >= 0 ? '+' : ''}${formatPercent(scores.priceDiffPercent, 2)}`,
      color: scores.priceDiffPercent >= scores.signalBiasThreshold * 100 ? '#0ecb81' : scores.priceDiffPercent <= -(scores.signalBiasThreshold * 100) ? '#f6465d' : '#fcd535',
    },
    {
      label: 'RSI hi\u1ec7n t\u1ea1i',
      value: `${latestRsi.toFixed(1)} \u2022 ${rsiLabel}`,
      sub: 'Theo d\u00f5i tr\u1ea1ng th\u00e1i qu\u00e1 mua/qu\u00e1 b\u00e1n',
      color: latestRsi >= 70 ? '#f6465d' : latestRsi <= 30 ? '#0ecb81' : neutralMetricColor,
    },
    {
      label: 'Kh\u1ed1i l\u01b0\u1ee3ng',
      value: volumeLabel,
      sub: `So v\u1edbi trung b\u00ecnh 20 phi\u00ean: ${volumeRatio.toFixed(2)}x`,
      color: volumeRatio >= 1.15 ? '#0ecb81' : volumeRatio <= 0.85 ? '#fcd535' : neutralMetricColor,
    },
    {
      label: 'X\u1ebfp h\u1ea1ng hi\u1ec7n t\u1ea1i',
      value: scores.recommendation,
      sub: `\u0110i\u1ec3m t\u1ed5ng h\u1ee3p ${Math.round(scores.recommendationScore)}/100`,
      color: scores.recColor,
    },
  ];

  // Technical references (news related to ticker)
  const technicalReferences = useMemo(() => {
    const references = [];
    const officialWebsite = profileData?.website;
    if (officialWebsite) {
      references.push({
        kind: 'official',
        label: 'Ngu\u1ed3n ch\u00ednh th\u1ee9c',
        title: `${profileData?.company_name || ticker}: Website doanh nghi\u1ec7p`,
        note: 'Theo d\u00f5i c\u00f4ng b\u1ed1 th\u00f4ng tin v\u00e0 h\u1ed3 s\u01a1 doanh nghi\u1ec7p.',
        href: officialWebsite,
      });
    }

    const currentAliases = [ticker.toLowerCase(), ...(NEWS_BANK_ALIASES[ticker] || [])];
    const normalizeText = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const bankingKeywords = Object.values(NEWS_BANK_ALIASES).flat();
    const rankedNews = newsData
      .map((article) => {
        const cleanDescription = normalizeText(article.description);
        const haystack = `${article.title || ''} ${cleanDescription}`.toLowerCase();
        const tickerMatchCount = currentAliases.filter((kw) => haystack.includes(kw)).length;
        const isTickerFocused = tickerMatchCount > 0;
        const isBankingRelated = bankingKeywords.some((kw) => haystack.includes(kw));
        const relevanceScore = (isTickerFocused ? 80 : 0) + tickerMatchCount * 12 + (isBankingRelated ? 20 : 0);
        return { ...article, cleanDescription, isTickerFocused, isBankingRelated, relevanceScore };
      })
      .filter((a) => a.isTickerFocused || a.isBankingRelated)
      .sort((a, b) => b.relevanceScore !== a.relevanceScore ? b.relevanceScore - a.relevanceScore : (b.timestamp || 0) - (a.timestamp || 0));

    const articleRefs = [];
    const seenLinks = new Set();
    rankedNews.forEach((article) => {
      if (!article.link || seenLinks.has(article.link) || articleRefs.length >= 4) return;
      seenLinks.add(article.link);
      articleRefs.push({
        kind: 'article',
        label: article.isTickerFocused ? 'Tin li\u00ean quan' : 'Tin n\u1ec1n ng\u00e0nh',
        title: article.title,
        note: `${article.source || 'Ngu\u1ed3n b\u00e1o'} \u2022 ${article.published || '\u0110ang c\u1eadp nh\u1eadt'}`,
        href: article.link,
        image_url: article.image_url || '',
        summary: article.isTickerFocused
          ? `\u01afu ti\u00ean \u0111\u1ecdc v\u00ec b\u00e0i vi\u1ebft li\u00ean quan tr\u1ef1c ti\u1ebfp \u0111\u1ebfn ${ticker}.`
          : 'B\u00e0i vi\u1ebft cung c\u1ea5p th\u00eam b\u1ed1i c\u1ea3nh chung c\u1ee7a nh\u00f3m ng\u00e2n h\u00e0ng ho\u1eb7c th\u1ecb tr\u01b0\u1eddng.',
      });
    });
    return [...references, ...articleRefs];
  }, [newsData, profileData, ticker]);

  const latestDataTime = data?.latest_data_time || 'Ch\u01b0a x\u00e1c \u0111\u1ecbnh';
  const analysisSignalLabel = data?.analysis_signal_label || 'T\u00edn hi\u1ec7u h\u1ed7 tr\u1ee3 ph\u00e2n t\u00edch';

  // Chart rendering
  useEffect(() => {
    if (!data || !chartContainerRef.current || !attentionContainerRef.current) return;
    let mainChart, attnChart, resizeObserver, syncChartSizes;

    try {
      const getFrameContentWidth = (frameEl) => {
        if (!frameEl) return 0;
        const rect = frameEl.getBoundingClientRect();
        const computed = window.getComputedStyle(frameEl);
        return Math.max(0, Math.floor(rect.width - parseFloat(computed.paddingLeft || '0') - parseFloat(computed.paddingRight || '0')));
      };

      syncChartSizes = () => {
        window.requestAnimationFrame(() => {
          if (chartContainerRef.current && mainChart) {
            const w = getFrameContentWidth(chartFrameRef.current);
            if (w) mainChart.resize(w, 400, true);
          }
          if (attentionContainerRef.current && attnChart) {
            const w = getFrameContentWidth(attentionFrameRef.current);
            if (w) attnChart.resize(w, 150, true);
          }
        });
      };

      mainChart = createChart(chartContainerRef.current, {
        layout: { background: { type: 'solid', color: chartTheme.chartBg }, textColor: chartTheme.textColor },
        grid: { vertLines: { color: chartTheme.gridColor }, horzLines: { color: chartTheme.gridColor } },
        width: getFrameContentWidth(chartFrameRef.current),
        height: 400,
        timeScale: { borderColor: chartTheme.borderColor, rightOffset: 0, fixRightEdge: true },
        crosshair: { mode: 1 },
      });

      const candlestickSeries = mainChart.addSeries(CandlestickSeries, {
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false,
        wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
      });

      // ── Prediction Zone series (T+1, T+2, T+3) ──────────────────
      const predictionLineSeries = mainChart.addSeries(LineSeries, {
        color: '#fcd535', lineWidth: 2, lineStyle: 1, // dotted
        crosshairMarkerVisible: true, lastValueVisible: false,
        title: 'Dự đoán',
      });
      const predBandSeries = mainChart.addSeries(AreaSeries, {
        lineColor: 'transparent',
        topColor: 'rgba(252, 213, 53, 0.12)',
        bottomColor: 'rgba(252, 213, 53, 0.02)',
        lineWidth: 0,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
      });

      attnChart = createChart(attentionContainerRef.current, {
        layout: { background: { type: 'solid', color: chartTheme.chartBg }, textColor: chartTheme.textColor },
        grid: { vertLines: { color: chartTheme.gridColor, visible: false }, horzLines: { color: chartTheme.gridColor, visible: false } },
        width: getFrameContentWidth(attentionFrameRef.current),
        height: 150,
        timeScale: { borderColor: chartTheme.borderColor, rightOffset: 0, fixRightEdge: true },
        crosshair: { mode: 1 },
        rightPriceScale: { visible: true, borderColor: chartTheme.borderColor },
        leftPriceScale: { visible: false },
      });

      const volumeSeries = attnChart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'right',
        scaleMargins: { top: 0.2, bottom: 0 },
      });

      const attentionLineSeries = attnChart.addSeries(LineSeries, {
        color: '#e3fe1a', lineWidth: 2, crosshairMarkerVisible: true, priceScaleId: 'left',
      });

      const recentChartData = visibleChartData;
      if (recentChartData.length > 0) {
        candlestickSeries.setData(recentChartData);
        volumeSeries.setData(recentChartData.map((c) => ({
          time: c.time, value: c.volume,
          color: c.close >= c.open ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)',
        })));

        try {
          if (data.attention_weights && Array.isArray(data.attention_weights)) {
            const uniqueAttnMap = new Map();
            data.attention_weights.forEach((item) => {
              const rawTime = String(item.time || '').split(' ')[0];
              if (rawTime && rawTime.length >= 8) {
                uniqueAttnMap.set(rawTime, { time: rawTime, value: (Number(item.weight) || 0) * 100 });
              }
            });
            const syncedAttnData = recentChartData.map((c) =>
              uniqueAttnMap.has(c.time) ? uniqueAttnMap.get(c.time) : { time: c.time }
            );
            attentionLineSeries.setData(syncedAttnData);
          }
        } catch (attnErr) { console.error('Lỗi vẽ XAI:', attnErr); }

        // ── Technical Indicators ──────────────────────────────────
        try {
          if (activeIndicators.has('ema12') && indicatorData.ema12?.length) {
            const ema12Series = mainChart.addSeries(LineSeries, {
              color: '#f97316', lineWidth: 1, title: 'EMA 12',
              crosshairMarkerVisible: false, lastValueVisible: true,
            });
            ema12Series.setData(indicatorData.ema12);
          }
          if (activeIndicators.has('ema26') && indicatorData.ema26?.length) {
            const ema26Series = mainChart.addSeries(LineSeries, {
              color: '#8b5cf6', lineWidth: 1, title: 'EMA 26',
              crosshairMarkerVisible: false, lastValueVisible: true,
            });
            ema26Series.setData(indicatorData.ema26);
          }
          if (activeIndicators.has('bollinger') && indicatorData.bollUpper?.length) {
            const bollUpperSeries = mainChart.addSeries(LineSeries, {
              color: 'rgba(59, 130, 246, 0.7)', lineWidth: 1, title: 'BB Upper',
              crosshairMarkerVisible: false, lastValueVisible: false, lineStyle: 2,
            });
            const bollMiddleSeries = mainChart.addSeries(LineSeries, {
              color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1, title: 'BB Mid',
              crosshairMarkerVisible: false, lastValueVisible: false,
            });
            const bollLowerSeries = mainChart.addSeries(LineSeries, {
              color: 'rgba(59, 130, 246, 0.7)', lineWidth: 1, title: 'BB Lower',
              crosshairMarkerVisible: false, lastValueVisible: false, lineStyle: 2,
            });
            bollUpperSeries.setData(indicatorData.bollUpper);
            bollMiddleSeries.setData(indicatorData.bollMiddle);
            bollLowerSeries.setData(indicatorData.bollLower);
          }
          if (activeIndicators.has('macd') && indicatorData.macdHistogram?.length) {
            const macdHistSeries = attnChart.addSeries(HistogramSeries, {
              color: '#0ecb81', title: 'MACD Hist', priceScaleId: 'macd',
            });
            const macdLineSeries = attnChart.addSeries(LineSeries, {
              color: '#fcd535', lineWidth: 1, title: 'MACD', priceScaleId: 'macd',
            });
            const macdSignalSeries = attnChart.addSeries(LineSeries, {
              color: '#f6465d', lineWidth: 1, title: 'Signal', priceScaleId: 'macd',
            });
            macdHistSeries.setData(indicatorData.macdHistogram);
            macdLineSeries.setData(indicatorData.macdLine);
            macdSignalSeries.setData(indicatorData.macdSignal);
          }
        } catch (indErr) { console.error('Lỗi vẽ indicators:', indErr); }

        // ── Set prediction zone data ───────────────────────────────
        try {
          if (recentChartData.length > 0 && Array.isArray(data.predictions) && data.predictions.length > 0) {
            const lastDate = recentChartData[recentChartData.length - 1].time;
            const lastPrice = recentChartData[recentChartData.length - 1].close;

            // Generate T+1, T+2, T+3 trading dates (skip weekends)
            const addTradingDays = (startDate, n) => {
              const dates = [];
              let d = new Date(startDate);
              while (dates.length < n) {
                d.setDate(d.getDate() + 1);
                const dow = d.getDay();
                if (dow !== 0 && dow !== 6) {
                  dates.push(d.toISOString().split('T')[0]);
                }
              }
              return dates;
            };

            const futureDates = addTradingDays(lastDate, data.predictions.length);
            const threshold = Number(data.recommendation_threshold || 0.0004);
            const bandPct = threshold * 3; // confidence band = ±3× threshold

            // Prediction line: starts from last actual candle → T+1 → T+2 → T+3
            const predLineData = [
              { time: lastDate, value: lastPrice },
              ...data.predictions.map((p, i) => ({
                time: futureDates[i],
                value: Number(p.predicted_price) * 1000,
              })),
            ];

            // Confidence band
            const predBandData = [
              { time: lastDate, value: lastPrice },
              ...data.predictions.map((p, i) => ({
                time: futureDates[i],
                value: Number(p.predicted_price) * 1000 * (1 + bandPct),
              })),
            ];

            predictionLineSeries.setData(predLineData);
            predBandSeries.setData(predBandData);

            // Extend time scale to show future dates
            mainChart.timeScale().applyOptions({ rightOffset: data.predictions.length + 1 });
          }
        } catch (predErr) { console.error('Lỗi vẽ Prediction Zone:', predErr); }

        mainChart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r !== null) attnChart.timeScale().setVisibleLogicalRange(r); });
        attnChart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r !== null) mainChart.timeScale().setVisibleLogicalRange(r); });

        if (recentChartData.length > 60) {
          mainChart.timeScale().setVisibleLogicalRange({ from: recentChartData.length - 60, to: recentChartData.length - 1 });
        } else { mainChart.timeScale().fitContent(); }

        attnChart.subscribeCrosshairMove((param) => {
          if (!attnTooltipRef.current) return;
          if (param.point === undefined || !param.time || param.point.x < 0 || param.point.x > attentionContainerRef.current.clientWidth || param.point.y < 0 || param.point.y > attentionContainerRef.current.clientHeight) {
            attnTooltipRef.current.style.display = 'none';
          } else {
            const volData = param.seriesData.get(volumeSeries);
            const attnData = param.seriesData.get(attentionLineSeries);
            let html = '';
            if (volData) html += `<div style="margin-bottom: 5px;"><span style="color: ${tooltipLabelColor}">Khối lượng: </span> <span style="color: ${tooltipValueColor}; font-weight: bold;">${formatVND(volData.value)}</span></div>`;
            if (attnData && attnData.value !== undefined) html += `<div><span style="color: ${tooltipLabelColor}">Tín hiệu phân tích: </span> <span style="color: #e3fe1a; font-weight: bold;">${attnData.value.toFixed(2)}%</span></div>`;
            if (html) {
              attnTooltipRef.current.style.display = 'flex';
              attnTooltipRef.current.style.flexDirection = 'column';
              attnTooltipRef.current.innerHTML = html;
            } else { attnTooltipRef.current.style.display = 'none'; }
          }
        });
      }

      resizeObserver = new ResizeObserver(() => syncChartSizes());
      if (chartContainerRef.current) resizeObserver.observe(chartContainerRef.current);
      if (attentionContainerRef.current) resizeObserver.observe(attentionContainerRef.current);
      if (chartFrameRef.current) resizeObserver.observe(chartFrameRef.current);
      if (attentionFrameRef.current) resizeObserver.observe(attentionFrameRef.current);
      if (chartContainerRef.current?.parentElement) resizeObserver.observe(chartContainerRef.current.parentElement);
      if (attentionContainerRef.current?.parentElement) resizeObserver.observe(attentionContainerRef.current.parentElement);
      window.addEventListener('resize', syncChartSizes);
      window.addEventListener('orientationchange', syncChartSizes);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', syncChartSizes);
      setTimeout(syncChartSizes, 0);
      setTimeout(syncChartSizes, 140);
    } catch (err) { console.error('Crash:', err); }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (syncChartSizes) {
        window.removeEventListener('resize', syncChartSizes);
        window.removeEventListener('orientationchange', syncChartSizes);
        if (window.visualViewport) window.visualViewport.removeEventListener('resize', syncChartSizes);
      }
      if (mainChart) mainChart.remove();
      if (attnChart) attnChart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, chartTheme, visibleChartData, activeIndicators, indicatorData]);

  if (error) {
    return (
      <div style={{ background: '#0b0e11', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#f6465d' }}>
        <h1>{error}</h1>
        <button className="btn" onClick={() => window.location.reload()}>THỬ LẠI</button>
      </div>
    );
  }

  return (
    <div className="chart-page-shell">
      {loading && !data ? (
        <LoadingStatePanel variant="chart" />
      ) : (
        <>
          {loading && (
            <div className="analysis-banner">
              <div className="analysis-banner-copy">
                <span className="analysis-banner-kicker">Đang cập nhật mô hình</span>
                <span className="analysis-banner-title">{shellCopy.loading}</span>
              </div>
              <span className="analysis-banner-chip">{ticker} đang được làm mới</span>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            {loading && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: isLightTheme ? 'rgba(255, 255, 255, 0.72)' : 'rgba(22, 26, 30, 0.65)',
                backdropFilter: 'blur(3px)', zIndex: 100,
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                borderRadius: '12px',
              }}>
                <div className="loader-spinner"></div>
              </div>
            )}

            <div className="main-grid" style={{ pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.5 : 1 }}>
              <div className="chart-section">
                <div className="card chart-card">
                  {/* ── Row 1: Ticker identity + Timeframe ── */}
                  <div className="ct-row-1">
                    <div className="ct-identity">
                      <h2 className="ct-ticker">{ticker}</h2>
                      <span className="ct-exchange">VNĐ</span>
                      <span className="ct-divider" />
                      <span className="ct-eyebrow">{shellCopy.chartEyebrow}</span>
                    </div>
                    <div className="ct-controls">
                      <div className="timeframe-group" aria-label={shellCopy.timeframeLabel}>
                        {TIMEFRAME_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`timeframe-chip ${timeframe === option.id ? 'active' : ''}`}
                            onClick={() => setTimeframe(option.id)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* ── Row 2: Indicators + Status + Export ── */}
                  <div className="ct-row-2">
                    <div className="ct-indicators">
                      {INDICATOR_OPTIONS.map((ind) => (
                        <button
                          key={ind.id}
                          type="button"
                          className={`indicator-chip ${activeIndicators.has(ind.id) ? 'active' : ''}`}
                          onClick={() => toggleIndicator(ind.id)}
                          title={ind.label}
                        >
                          {ind.label}
                        </button>
                      ))}
                    </div>
                    <div className="ct-meta">
                      <span className="ct-signal">{language === 'en' ? 'T+1' : 'T+1'}</span>
                      <span className="ct-date">{latestDataTime}</span>
                      <button
                        className="export-btn"
                        onClick={() => exportChartDataCSV(ticker, sortedFullData)}
                        title={language === 'en' ? 'Export chart data CSV' : 'Xuất dữ liệu CSV'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        CSV
                      </button>
                      <button
                        className="export-btn"
                        onClick={() => exportPredictionReportCSV(ticker, data)}
                        title={language === 'en' ? 'Export prediction report' : 'Xuất báo cáo dự đoán'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        {language === 'en' ? 'Report' : 'Báo cáo'}
                      </button>
                    </div>
                  </div>
                  <div className="chart-frame" ref={chartFrameRef}>
                    <div ref={chartContainerRef} style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}></div>
                  </div>
                </div>

                <div className="card signal-card">
                  <div className="signal-card-header">
                    <div>
                      <div className="chart-eyebrow">{shellCopy.signalEyebrow}</div>
                      <h3 style={{ margin: '6px 0 0', color: 'var(--text-primary)', fontSize: '18px' }}>{shellCopy.signalTitle}</h3>
                    </div>
                    <div className="legend-row">
                      <span className="legend-chip" style={{ color: 'var(--accent-green)' }}>{'Vol t\u0103ng'}</span>
                      <span className="legend-chip" style={{ color: 'var(--accent-red)' }}>{'Vol gi\u1ea3m'}</span>
                      <span className="legend-chip" style={{ color: '#e3fe1a' }}>{'\u0110\u01b0\u1eddng t\u00edn hi\u1ec7u'}</span>
                    </div>
                  </div>
                  <div className="chart-frame" ref={attentionFrameRef}>
                    <div ref={attnTooltipRef} style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, backgroundColor: chartTheme.tooltipBg, color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${chartTheme.tooltipBorder}`, fontSize: '13px', display: 'none', gap: '10px', pointerEvents: 'none' }}></div>
                    <div ref={attentionContainerRef} style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}></div>
                  </div>

                </div>
              </div>

              <div className="side-panel-stack">
                <TechnicalDashboardCompact
                  latestDataTime={latestDataTime}
                  currentPrice={scores.currentPrice}
                  predictedPrice={scores.predictedPrice}
                  priceDiff={scores.priceDiff}
                  priceDiffPercent={scores.priceDiffPercent}
                  recommendationScore={scores.recommendationScore}
                  formatVND={formatVND}
                  formatPercent={formatPercent}
                  recColor={scores.recColor}
                  recommendation={scores.recommendation}
                  recommendationNote={scores.recommendationNote}
                  recommendationConfidenceScore={scores.recommendationConfidenceScore}
                  recommendationConfidenceLabel={scores.recommendationConfidenceLabel}
                  recommendationConfidenceNote={scores.recommendationConfidenceNote}
                  actionPlan={actionPlan}
                  priceSignalScore={scores.priceSignalScore}
                  contextAlignmentScore={scores.contextAlignmentScore}
                  getPositiveScoreColor={getPositiveScoreColor}
                  getConfidenceColor={getConfidenceColor}
                  immediateAction={immediateAction}
                />

                <div className="card detail-card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{shellCopy.helperEyebrow}</div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>{shellCopy.helperTitle}</h3>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{shellCopy.helperNote}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    {quickDiagnosisCards.map((item) => (
                      <div key={item.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px', minHeight: '108px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{item.label}</div>
                        <div style={{ color: item.color, fontSize: '19px', fontWeight: 700, lineHeight: 1.35 }}>{item.value}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>{item.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <QuickStatsBanner ticker={ticker} language={language} />

          <div className="detail-stack">
            <ActionPlanCard
              recColor={scores.recColor}
              actionPlan={actionPlan}
              decisionGuidance={decisionGuidance}
              technicalReferences={technicalReferences}
            />
          </div>

          <HistoryTablePanel
            displayTableData={displayTableData}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            availableMonths={availableMonths}
            availableYears={availableYears}
            formatVND={formatVND}
          />
        </>
      )}
    </div>
  );
}
