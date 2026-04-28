import { useEffect, useRef, useMemo, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, AreaSeries, createSeriesMarkers } from 'lightweight-charts';
import { useMarketData } from '../contexts/MarketDataContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatVND, formatPercent } from '../utils/formatting';
import {
  calculateScores,
  buildActionPlan,
  getDecisionGuidance,
  getImmediateAction,
  getPositiveScoreColor,
  getConfidenceColor,
} from '../utils/recommendation';
import { TIMEFRAME_OPTIONS, NEWS_BANK_ALIASES } from '../utils/constants';
import { calcEMA, calcBollingerBands, calcMACD, INDICATOR_OPTIONS } from '../utils/indicators';
import { fetchMarketContext } from '../api/market';
import { fetchSignalHistory } from '../api/performance';
import TechnicalDashboardCompact from '../components/TechnicalDecisionPanelV2';
import ActionPlanCard from '../components/ActionGuidePanelV2';
import HistoryTablePanel from '../components/HistoryTablePanel';
import LoadingStatePanel from '../components/LoadingStatePanel';
import AISignalBacktestPanel from '../components/ui/AISignalBacktestPanel';
import QuickStatsBanner from '../components/ui/QuickStatsBanner';
import { exportChartDataCSV, exportPredictionReportCSV } from '../utils/export';

const BANK_NAMES_EN = {
  VCB: 'Joint Stock Commercial Bank for Foreign Trade of Vietnam',
  BID: 'Joint Stock Commercial Bank for Investment and Development of Vietnam',
  CTG: 'Vietnam Joint Stock Commercial Bank for Industry and Trade',
  MBB: 'Military Commercial Joint Stock Bank',
  TCB: 'Vietnam Technological and Commercial Joint Stock Bank',
  VPB: 'Vietnam Prosperity Joint Stock Commercial Bank',
  ACB: 'Asia Commercial Joint Stock Bank',
  HDB: 'Ho Chi Minh City Development Joint Stock Commercial Bank',
  SHB: 'Saigon - Hanoi Commercial Joint Stock Bank',
  VIB: 'Vietnam International Commercial Joint Stock Bank',
};

export default function ChartPage() {
  const {
    ticker, data, loading, error,
    marketContext, setMarketContext,
    setLoadingContext,
    setContextError,
    newsData, profileData,
  } = useMarketData();
  const { isLightTheme, chartTheme, language } = useTheme();

  const [timeframe, setTimeframe] = useState('All');
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [activeIndicators, setActiveIndicators] = useState(new Set());
  const [signalBacktest, setSignalBacktest] = useState(null);
  const [signalBacktestLoading, setSignalBacktestLoading] = useState(false);
  const [activeQuickDiagnosisIndex, setActiveQuickDiagnosisIndex] = useState(0);

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
  const mainTooltipRef = useRef();
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
      forecastKicker: 'D\u1ef1 b\u00e1o xu h\u01b0\u1edbng',
      forecastTitle: 'Tri\u1ec3n v\u1ecdng 1-3 tu\u1ea7n t\u1edbi',
      forecastSource: 'CNN-LSTM-Attention \u2022 T+5/T+10/T+15',
      forecastUp: 'Nghi\u00eang t\u0103ng',
      forecastDown: 'Nghi\u00eang gi\u1ea3m',
      forecastSideways: '\u0110i ngang',
      weekLabels: ['Tu\u1ea7n 1', 'Tu\u1ea7n 2', 'Tu\u1ea7n 3'],
      contextError: 'Ch\u01b0a t\u1ea3i \u0111\u01b0\u1ee3c l\u1edbp b\u1ed1i c\u1ea3nh th\u1ecb tr\u01b0\u1eddng.',
      rsiOverbought: 'Qu\u00e1 mua',
      rsiOversold: 'Qu\u00e1 b\u00e1n',
      neutral: 'Trung t\u00ednh',
      trendUp: 'Nghi\u00eang t\u0103ng',
      trendDown: 'Nghi\u00eang gi\u1ea3m',
      sideways: '\u0110i ngang',
      volumeAboveAverage: 'Cao h\u01a1n trung b\u00ecnh',
      volumeBelowAverage: 'Th\u1ea5p h\u01a1n trung b\u00ecnh',
      volumeBalanced: 'C\u00e2n b\u1eb1ng',
      shortTermTrend: 'Xu h\u01b0\u1edbng ng\u1eafn h\u1ea1n',
      forecastSpread: 'Alpha edge',
      currentRsi: 'RSI hi\u1ec7n t\u1ea1i',
      rsiSub: 'Theo d\u00f5i tr\u1ea1ng th\u00e1i qu\u00e1 mua/qu\u00e1 b\u00e1n',
      volume: 'Kh\u1ed1i l\u01b0\u1ee3ng',
      volumeSub: 'So v\u1edbi trung b\u00ecnh 20 phi\u00ean',
      currentRating: 'X\u1ebfp h\u1ea1ng hi\u1ec7n t\u1ea1i',
      compositeScore: '\u0110i\u1ec3m t\u1ed5ng h\u1ee3p',
      tooltipVolume: 'Kh\u1ed1i l\u01b0\u1ee3ng',
      tooltipSignal: 'T\u00edn hi\u1ec7u ph\u00e2n t\u00edch',
      tooltipDate: 'Ng\u00e0y',
      tooltipOpen: 'M\u1edf',
      tooltipHigh: 'Cao',
      tooltipLow: 'Th\u1ea5p',
      tooltipClose: '\u0110\u00f3ng',
      tooltipChange: 'Bi\u1ebfn \u0111\u1ed9ng',
      updatingKicker: '\u0110ang c\u1eadp nh\u1eadt m\u00f4 h\u00ecnh',
      updatingChip: `${ticker} \u0111ang \u0111\u01b0\u1ee3c l\u00e0m m\u1edbi`,
      retry: 'TH\u1eec L\u1ea0I',
      unknownDate: 'Ch\u01b0a x\u00e1c \u0111\u1ecbnh',
      currency: 'VN\u0110',
      legendVolumeUp: 'Vol t\u0103ng',
      legendVolumeDown: 'Vol gi\u1ea3m',
      legendSignalLine: '\u0110\u01b0\u1eddng t\u00edn hi\u1ec7u',
      quickTrendExplain: 'Cho bi\u1ebft h\u01b0\u1edbng nghi\u00eang ng\u1eafn h\u1ea1n c\u1ee7a m\u00f4 h\u00ecnh. D\u00f9ng \u0111\u1ec3 nh\u1eadn di\u1ec7n h\u1ec7 th\u1ed1ng \u0111ang \u01b0u ti\u00ean k\u1ecbch b\u1ea3n t\u0103ng, gi\u1ea3m hay \u0111i ngang.',
      quickRsiExplain: 'RSI gi\u00fap \u0111\u1ecdc tr\u1ea1ng th\u00e1i n\u00f3ng/l\u1ea1nh c\u1ee7a gi\u00e1. Tr\u00ean 70 th\u01b0\u1eddng d\u1ec5 qu\u00e1 mua, d\u01b0\u1edbi 30 th\u01b0\u1eddng d\u1ec5 qu\u00e1 b\u00e1n; v\u00f9ng gi\u1eefa c\u1ea7n th\u00eam x\u00e1c nh\u1eadn.',
      quickVolumeExplain: 'So s\u00e1nh thanh kho\u1ea3n hi\u1ec7n t\u1ea1i v\u1edbi trung b\u00ecnh 20 phi\u00ean. Thanh kho\u1ea3n cao gi\u00fap t\u00edn hi\u1ec7u \u0111\u00e1ng tin h\u01a1n, thanh kho\u1ea3n th\u1ea5p c\u1ea7n th\u1eadn tr\u1ecdng.',
      quickRatingExplain: '\u0110i\u1ec3m t\u1ed5ng h\u1ee3p gom xu h\u01b0\u1edbng gi\u00e1, x\u00e1c su\u1ea5t m\u00f4 h\u00ecnh, RSI, thanh kho\u1ea3n v\u00e0 b\u1ed1i c\u1ea3nh th\u00e0nh m\u1ed9t nh\u00e3n d\u1ec5 hi\u1ec3u cho ng\u01b0\u1eddi d\u00f9ng.',
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
      forecastKicker: 'Trend forecast',
      forecastTitle: '1-3 week outlook',
      forecastSource: 'CNN-LSTM-Attention \u2022 T+5/T+10/T+15',
      forecastUp: 'Upward bias',
      forecastDown: 'Downward bias',
      forecastSideways: 'Sideways',
      weekLabels: ['Week 1', 'Week 2', 'Week 3'],
      contextError: 'Could not load the market context layer.',
      rsiOverbought: 'Overbought',
      rsiOversold: 'Oversold',
      neutral: 'Neutral',
      trendUp: 'Upward bias',
      trendDown: 'Downward bias',
      sideways: 'Sideways',
      volumeAboveAverage: 'Above average',
      volumeBelowAverage: 'Below average',
      volumeBalanced: 'Balanced',
      shortTermTrend: 'Short-term trend',
      forecastSpread: 'Alpha edge',
      currentRsi: 'Current RSI',
      rsiSub: 'Monitor overbought/oversold status',
      volume: 'Volume',
      volumeSub: 'Versus 20-session average',
      currentRating: 'Current rating',
      compositeScore: 'Composite score',
      tooltipVolume: 'Volume',
      tooltipSignal: 'Analysis signal',
      tooltipDate: 'Date',
      tooltipOpen: 'Open',
      tooltipHigh: 'High',
      tooltipLow: 'Low',
      tooltipClose: 'Close',
      tooltipChange: 'Change',
      updatingKicker: 'Updating model',
      updatingChip: `${ticker} is refreshing`,
      retry: 'TRY AGAIN',
      unknownDate: 'Not available',
      currency: 'VND',
      legendVolumeUp: 'Volume up',
      legendVolumeDown: 'Volume down',
      legendSignalLine: 'Signal line',
      quickTrendExplain: 'Shows the model\'s short-term directional bias. Use it to see whether the setup currently leans up, down, or sideways.',
      quickRsiExplain: 'RSI helps read whether price is stretched. Above 70 often signals overbought pressure, below 30 often signals oversold pressure; the middle zone needs confirmation.',
      quickVolumeExplain: 'Compares current liquidity with the 20-session average. Strong volume makes a signal more credible, while weak volume calls for caution.',
      quickRatingExplain: 'Combines price trend, model probability, RSI, volume, and context into one readable outlook label.',
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
          setContextError(shellCopy.contextError);
          setLoadingContext(false);
        }
      });
    return () => { cancelled = true; };
  }, [ticker, setMarketContext, setLoadingContext, setContextError, shellCopy.contextError]);

  useEffect(() => {
    let cancelled = false;
    setSignalBacktestLoading(true);
    fetchSignalHistory(ticker, 90)
      .then((res) => {
        if (!cancelled) {
          setSignalBacktest(res);
          setSignalBacktestLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignalBacktest(null);
          setSignalBacktestLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [ticker]);

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
          foreign_buy_volume: item.foreign_buy_volume ?? null,
          foreign_sell_volume: item.foreign_sell_volume ?? null,
          foreign_net_volume: item.foreign_net_volume ?? null,
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
  const scores = useMemo(() => calculateScores(data, marketContext, language), [data, marketContext, language]);
  const actionPlan = useMemo(() => buildActionPlan(scores, marketContext, language), [scores, marketContext, language]);
  const decisionGuidance = useMemo(() => getDecisionGuidance(scores.recommendation, language), [scores.recommendation, language]);
  const immediateAction = useMemo(() => getImmediateAction(scores.recommendation, language), [scores.recommendation, language]);
  const weeklyForecastOutlook = useMemo(() => {
    const probabilityForecast = data?.probability_forecast;
    if (data?.prediction_mode === 'alpha_probability' && probabilityForecast) {
      const probs = probabilityForecast.probabilities || {};
      const pOut = Number(probabilityForecast.outperform_probability ?? probs.outperform ?? 0);
      const pUnder = Number(probabilityForecast.underperform_probability ?? probs.underperform ?? 0);
      const pNeutral = Number(probabilityForecast.neutral_probability ?? probs.neutral ?? 0);
      const predictedClass = String(probabilityForecast.predicted_class || 'neutral').toLowerCase();
      const copy = language === 'en'
        ? { label: 'Week 1', up: 'Outperform', down: 'Underperform', sideways: 'Neutral' }
        : { label: 'Tu\u1ea7n 1', up: 'Outperform', down: 'Underperform', sideways: 'Trung l\u1eadp' };
      const directionLabel = predictedClass === 'outperform'
        ? copy.up
        : predictedClass === 'underperform'
          ? copy.down
          : copy.sideways;
      const color = predictedClass === 'outperform'
        ? 'var(--accent-green)'
        : predictedClass === 'underperform'
          ? 'var(--accent-red)'
          : 'var(--accent-yellow)';

      return [{
        key: 'probability-5d',
        label: copy.label,
        horizon: `T+${probabilityForecast.horizon_days || 5}`,
        probability: pOut,
        underperformProbability: pUnder,
        neutralProbability: pNeutral,
        directionLabel,
        color,
      }];
    }

    const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
    const currentPrice = Number(data?.current_price || scores.currentPrice || 0);
    if (!predictions.length || !currentPrice) return [];

    const signalThresholdPct = Number(data?.recommendation_threshold || 0.008) * 100;
    const forecastCopy = language === 'en'
      ? {
          weekLabels: ['Week 1', 'Week 2', 'Week 3'],
          up: 'Upward bias',
          down: 'Downward bias',
          sideways: 'Sideways',
        }
      : {
          weekLabels: ['Tu\u1ea7n 1', 'Tu\u1ea7n 2', 'Tu\u1ea7n 3'],
          up: 'Nghi\u00eang t\u0103ng',
          down: 'Nghi\u00eang gi\u1ea3m',
          sideways: '\u0110i ngang',
        };
    const weekEndIndexes = [4, 9, 14];
    const usedIndexes = new Set();

    return weekEndIndexes
      .map((targetIndex, weekIndex) => {
        const predictionIndex = Math.min(targetIndex, predictions.length - 1);
        if (predictionIndex < 0 || usedIndexes.has(predictionIndex)) return null;
        usedIndexes.add(predictionIndex);

        const prediction = predictions[predictionIndex];
        const forecastPrice = Number(prediction?.predicted_price || 0);
        if (!forecastPrice) return null;

        const changePct = ((forecastPrice - currentPrice) / currentPrice) * 100;
        const direction = changePct >= signalThresholdPct
          ? 'up'
          : changePct <= -signalThresholdPct
            ? 'down'
            : 'sideways';

        return {
          key: `${weekIndex}-${predictionIndex}`,
          label: forecastCopy.weekLabels[weekIndex],
          horizon: prediction?.day || `T+${predictionIndex + 1}`,
          price: forecastPrice,
          changePct,
          directionLabel: direction === 'up'
            ? forecastCopy.up
            : direction === 'down'
              ? forecastCopy.down
              : forecastCopy.sideways,
          color: direction === 'up'
            ? 'var(--accent-green)'
            : direction === 'down'
              ? 'var(--accent-red)'
              : 'var(--accent-yellow)',
        };
      })
      .filter(Boolean);
  }, [data, scores.currentPrice, language]);

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
  const rsiLabel = latestRsi >= 70 ? shellCopy.rsiOverbought : latestRsi <= 30 ? shellCopy.rsiOversold : shellCopy.neutral;
  const neutralMetricColor = isLightTheme ? 'var(--text-primary)' : '#eaecef';
  const tooltipLabelColor = isLightTheme ? '#617488' : '#848e9c';
  const tooltipValueColor = isLightTheme ? '#1b2a38' : '#eaecef';
  const chartValueFormatter = useMemo(() => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'vi-VN', {
    maximumFractionDigits: 0,
  }), [language]);
  const trendLabel = scores.priceDiffPercent >= scores.signalBiasThreshold * 100
    ? shellCopy.trendUp
    : scores.priceDiffPercent <= -(scores.signalBiasThreshold * 100)
      ? shellCopy.trendDown
      : shellCopy.sideways;
  const volumeLabel = volumeRatio >= 1.15 ? shellCopy.volumeAboveAverage : volumeRatio <= 0.85 ? shellCopy.volumeBelowAverage : shellCopy.volumeBalanced;

  const quickDiagnosisCards = [
    {
      label: shellCopy.shortTermTrend,
      value: trendLabel,
      sub: `${shellCopy.forecastSpread} ${scores.priceDiffPercent >= 0 ? '+' : ''}${formatPercent(scores.priceDiffPercent, 2)}`,
      description: shellCopy.quickTrendExplain,
      color: scores.priceDiffPercent >= scores.signalBiasThreshold * 100 ? '#0ecb81' : scores.priceDiffPercent <= -(scores.signalBiasThreshold * 100) ? '#f6465d' : '#fcd535',
    },
    {
      label: shellCopy.currentRsi,
      value: `${latestRsi.toFixed(1)} \u2022 ${rsiLabel}`,
      sub: shellCopy.rsiSub,
      description: shellCopy.quickRsiExplain,
      color: latestRsi >= 70 ? '#f6465d' : latestRsi <= 30 ? '#0ecb81' : neutralMetricColor,
    },
    {
      label: shellCopy.volume,
      value: volumeLabel,
      sub: `${shellCopy.volumeSub}: ${volumeRatio.toFixed(2)}x`,
      description: shellCopy.quickVolumeExplain,
      color: volumeRatio >= 1.15 ? '#0ecb81' : volumeRatio <= 0.85 ? '#fcd535' : neutralMetricColor,
    },
    {
      label: shellCopy.currentRating,
      value: scores.recommendation,
      sub: `${shellCopy.compositeScore} ${Math.round(scores.recommendationScore)}/100`,
      description: shellCopy.quickRatingExplain,
      color: scores.recColor,
    },
  ];
  const activeQuickDiagnosis = quickDiagnosisCards[activeQuickDiagnosisIndex] || quickDiagnosisCards[0];

  // Technical references (news related to ticker)
  const technicalReferences = useMemo(() => {
    const references = [];
    const isEnglish = language === 'en';
    const referenceCompanyName = isEnglish
      ? BANK_NAMES_EN[ticker] || profileData?.company_name || ticker
      : profileData?.company_name || ticker;
    const officialWebsite = profileData?.website;
    if (officialWebsite) {
      references.push({
        kind: 'official',
        label: isEnglish ? 'Official source' : 'Ngu\u1ed3n ch\u00ednh th\u1ee9c',
        title: isEnglish
          ? `${referenceCompanyName}: Corporate website`
          : `${referenceCompanyName}: Website doanh nghi\u1ec7p`,
        note: isEnglish
          ? 'Follow disclosures and company profile updates.'
          : 'Theo d\u00f5i c\u00f4ng b\u1ed1 th\u00f4ng tin v\u00e0 h\u1ed3 s\u01a1 doanh nghi\u1ec7p.',
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
        label: article.isTickerFocused
          ? (isEnglish ? 'Related article' : 'Tin li\u00ean quan')
          : (isEnglish ? 'Sector context' : 'Tin n\u1ec1n ng\u00e0nh'),
        title: article.title,
        note: `${article.source || (isEnglish ? 'News source' : 'Ngu\u1ed3n b\u00e1o')} \u2022 ${article.published || (isEnglish ? 'Updating' : '\u0110ang c\u1eadp nh\u1eadt')}`,
        href: article.link,
        image_url: article.image_url || '',
        summary: article.isTickerFocused
          ? (isEnglish
              ? `Prioritize this because it directly references ${ticker}.`
              : `\u01afu ti\u00ean \u0111\u1ecdc v\u00ec b\u00e0i vi\u1ebft li\u00ean quan tr\u1ef1c ti\u1ebfp \u0111\u1ebfn ${ticker}.`)
          : (isEnglish
              ? 'This article adds broader context for the banking sector or overall market.'
              : 'B\u00e0i vi\u1ebft cung c\u1ea5p th\u00eam b\u1ed1i c\u1ea3nh chung c\u1ee7a nh\u00f3m ng\u00e2n h\u00e0ng ho\u1eb7c th\u1ecb tr\u01b0\u1eddng.'),
      });
    });
    return [...references, ...articleRefs];
  }, [language, newsData, profileData, ticker]);

  const latestDataTime = data?.latest_data_time || shellCopy.unknownDate;
  const dataQuality = data?.data_quality || null;
  const dataQualityWarning = useMemo(() => {
    if (!dataQuality) return null;
    const score = Number(dataQuality.score ?? 0);
    const blocked = Boolean(data?.recommendation_blocked_by_data_quality);
    if (score >= 65 && !blocked) return null;
    const issues = Array.isArray(dataQuality.issues) ? dataQuality.issues.filter(Boolean) : [];
    return {
      score,
      label: dataQuality.label || 'Kh\u00f4ng x\u00e1c \u0111\u1ecbnh',
      source: dataQuality.source || 'unknown',
      blocked,
      issueText: issues.slice(0, 2).join(' | '),
    };
  }, [dataQuality, data?.recommendation_blocked_by_data_quality]);

  // Chart rendering
  useEffect(() => {
    if (!data || !chartContainerRef.current || !attentionContainerRef.current) return;
    let mainChart, attnChart, resizeObserver, syncChartSizes;

    try {
      const normalizeCrosshairTime = (timeValue) => {
        if (!timeValue) return '';
        if (typeof timeValue === 'string') return timeValue;
        if (typeof timeValue === 'object' && timeValue.year && timeValue.month && timeValue.day) {
          return `${timeValue.year}-${String(timeValue.month).padStart(2, '0')}-${String(timeValue.day).padStart(2, '0')}`;
        }
        return '';
      };
      const formatTooltipDate = (timeValue) => {
        const normalized = normalizeCrosshairTime(timeValue);
        if (!normalized) return shellCopy.unknownDate;
        const [year, month, day] = normalized.split('-');
        if (!year || !month || !day) return normalized;
        return `${day}/${month}/${year.slice(-2)}`;
      };
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

      // Prediction zone series for T+1 to T+15.
      const predictionLineSeries = mainChart.addSeries(LineSeries, {
        color: '#fcd535', lineWidth: 2, lineStyle: 1, // dotted
        crosshairMarkerVisible: true, lastValueVisible: false,
        title: language === 'en' ? 'Trend proxy' : 'Xu hướng',
      });
      const predBandSeries = mainChart.addSeries(AreaSeries, {
        lineColor: 'transparent',
        topColor: 'rgba(252, 213, 53, 0.12)',
        bottomColor: 'rgba(252, 213, 53, 0.02)',
        lineWidth: 0,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
      });
      const predLowerBandSeries = mainChart.addSeries(AreaSeries, {
        lineColor: 'transparent',
        topColor: 'rgba(252, 213, 53, 0.0)',
        bottomColor: 'rgba(252, 213, 53, 0.10)',
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
        const recentChartMap = new Map(recentChartData.map((row, index) => ([
          row.time,
          {
            row,
            prevClose: index > 0 ? recentChartData[index - 1].close : row.close,
          },
        ])));
        const renderMainTooltip = (timeValue, candleData) => {
          if (!mainTooltipRef.current) return;
          const normalizedTime = normalizeCrosshairTime(timeValue);
          const lookup = normalizedTime ? recentChartMap.get(normalizedTime) : null;
          const fallbackRow = recentChartData[recentChartData.length - 1];
          const baseRow = lookup?.row || candleData || fallbackRow;
          if (!baseRow) {
            mainTooltipRef.current.style.display = 'none';
            return;
          }

          const open = Number(candleData?.open ?? baseRow.open ?? 0);
          const high = Number(candleData?.high ?? baseRow.high ?? 0);
          const low = Number(candleData?.low ?? baseRow.low ?? 0);
          const close = Number(candleData?.close ?? baseRow.close ?? 0);
          const volume = Number(lookup?.row?.volume ?? baseRow.volume ?? 0);
          const prevClose = Number(lookup?.prevClose ?? close);
          const changePct = prevClose ? ((close - prevClose) / prevClose) * 100 : 0;
          const changeColor = changePct > 0 ? '#0ecb81' : changePct < 0 ? '#f6465d' : tooltipValueColor;
          const openColor = isLightTheme ? '#1d4ed8' : '#7dd3fc';
          const highColor = isLightTheme ? '#047857' : '#34d399';
          const lowColor = isLightTheme ? '#be123c' : '#fb7185';
          const closeColor = close >= open
            ? (isLightTheme ? '#15803d' : '#4ade80')
            : (isLightTheme ? '#b91c1c' : '#f87171');
          const volumeColor = isLightTheme ? '#6d28d9' : '#c084fc';
          const openBg = isLightTheme ? 'rgba(29, 78, 216, 0.14)' : 'transparent';
          const highBg = isLightTheme ? 'rgba(4, 120, 87, 0.14)' : 'transparent';
          const lowBg = isLightTheme ? 'rgba(190, 18, 60, 0.14)' : 'transparent';
          const closeBg = isLightTheme
            ? (close >= open ? 'rgba(21, 128, 61, 0.14)' : 'rgba(185, 28, 28, 0.14)')
            : 'transparent';
          const changeBg = isLightTheme
            ? (changePct > 0 ? 'rgba(14, 203, 129, 0.14)' : changePct < 0 ? 'rgba(246, 70, 93, 0.14)' : 'rgba(100, 116, 139, 0.12)')
            : 'transparent';
          const volumeBg = isLightTheme ? 'rgba(109, 40, 217, 0.14)' : 'transparent';

          mainTooltipRef.current.style.display = 'flex';
          mainTooltipRef.current.innerHTML = `
            <span class="chart-corner-tooltip__date" style="color:${tooltipValueColor}">${formatTooltipDate(normalizedTime || baseRow.time)}</span>
            <span class="chart-corner-tooltip__divider"></span>
            <span class="chart-corner-tooltip__metric"><span class="chart-corner-tooltip__metric-key" style="color:${tooltipLabelColor}">${shellCopy.tooltipOpen}</span><strong class="chart-corner-tooltip__value-pill" style="color:${openColor}; background:${openBg}">${chartValueFormatter.format(open)}</strong></span>
            <span class="chart-corner-tooltip__metric"><span class="chart-corner-tooltip__metric-key" style="color:${tooltipLabelColor}">${shellCopy.tooltipHigh}</span><strong class="chart-corner-tooltip__value-pill" style="color:${highColor}; background:${highBg}">${chartValueFormatter.format(high)}</strong></span>
            <span class="chart-corner-tooltip__metric"><span class="chart-corner-tooltip__metric-key" style="color:${tooltipLabelColor}">${shellCopy.tooltipLow}</span><strong class="chart-corner-tooltip__value-pill" style="color:${lowColor}; background:${lowBg}">${chartValueFormatter.format(low)}</strong></span>
            <span class="chart-corner-tooltip__metric"><span class="chart-corner-tooltip__metric-key" style="color:${tooltipLabelColor}">${shellCopy.tooltipClose}</span><strong class="chart-corner-tooltip__value-pill" style="color:${closeColor}; background:${closeBg}">${chartValueFormatter.format(close)}</strong></span>
            <span class="chart-corner-tooltip__metric"><span class="chart-corner-tooltip__metric-key" style="color:${tooltipLabelColor}">${shellCopy.tooltipChange}</span><strong class="chart-corner-tooltip__value-pill" style="color:${changeColor}; background:${changeBg}">${changePct >= 0 ? '+' : ''}${formatPercent(changePct, 2)}</strong></span>
            <span class="chart-corner-tooltip__metric"><span class="chart-corner-tooltip__metric-key" style="color:${tooltipLabelColor}">${shellCopy.tooltipVolume}</span><strong class="chart-corner-tooltip__value-pill" style="color:${volumeColor}; background:${volumeBg}">${chartValueFormatter.format(volume)}</strong></span>
          `;
        };

        candlestickSeries.setData(recentChartData);
        renderMainTooltip(recentChartData[recentChartData.length - 1].time, recentChartData[recentChartData.length - 1]);
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
        } catch (attnErr) { console.error('XAI render error:', attnErr); }

        // -- Technical Indicators ----------------------------------
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
        } catch (indErr) { console.error('Indicator render error:', indErr); }

        // -- Set prediction zone data -------------------------------
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
            const threshold = Number(data.recommendation_threshold || 0.008);
            const baseBandPct = threshold * 2; // Band expands with sqrt(step).

            // Prediction line starts from the last actual candle and extends to T+15.
            const predLineData = [
              { time: lastDate, value: lastPrice },
              ...data.predictions.map((p, i) => ({
                time: futureDates[i],
                value: Number(p.predicted_price) * 1000,
              })),
            ];

            // Upper confidence band widens by step to reflect accumulated uncertainty.
            const predBandData = [
              { time: lastDate, value: lastPrice },
              ...data.predictions.map((p, i) => ({
                time: futureDates[i],
                value: Number(p.predicted_price) * 1000 * (1 + baseBandPct * Math.sqrt(i + 1)),
              })),
            ];

            // Lower confidence band
            const predLowerBandData = [
              { time: lastDate, value: lastPrice },
              ...data.predictions.map((p, i) => ({
                time: futureDates[i],
                value: Number(p.predicted_price) * 1000 * (1 - baseBandPct * Math.sqrt(i + 1)),
              })),
            ];

            predictionLineSeries.setData(predLineData);
            predBandSeries.setData(predBandData);
            predLowerBandSeries.setData(predLowerBandData);

            // Mark weekly boundaries on the forecast line (W1=T+5, W2=T+10, W3=T+15).
            // Each marker shows % change from last actual close to help users read the trend.
            if (data.predictions.length >= 5) {
              const weekMarkers = [];
              const weekIdx = [4, 9, 14]; // T+5, T+10, T+15
              weekIdx.forEach((idx, wk) => {
                if (idx < data.predictions.length && futureDates[idx]) {
                  const wkPred = data.predictions[idx];
                  const wkPrice = Number(wkPred.predicted_price) * 1000;
                  const wkChgPct = lastPrice > 0 ? ((wkPrice - lastPrice) / lastPrice) * 100 : 0;
                  const sigPct = threshold * 100;
                  const wkColor = wkChgPct >= sigPct ? '#0ecb81' : wkChgPct <= -sigPct ? '#f6465d' : '#fcd535';
                  const wkShape = wkChgPct >= sigPct ? 'arrowUp' : wkChgPct <= -sigPct ? 'arrowDown' : 'circle';
                  const sign = wkChgPct >= 0 ? '+' : '';
                  weekMarkers.push({
                    time: futureDates[idx],
                    position: 'aboveBar',
                    color: wkColor,
                    shape: wkShape,
                    text: `W${wk + 1} ${sign}${wkChgPct.toFixed(1)}%`,
                    size: 1,
                  });
                }
              });
              if (weekMarkers.length > 0) createSeriesMarkers(predictionLineSeries, weekMarkers);
            }

            // Extend time scale to show future dates
            mainChart.timeScale().applyOptions({ rightOffset: data.predictions.length + 2 });
          }
        } catch (predErr) { console.error('Prediction zone render error:', predErr); }

        mainChart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r !== null) attnChart.timeScale().setVisibleLogicalRange(r); });
        attnChart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r !== null) mainChart.timeScale().setVisibleLogicalRange(r); });

        const predictionPointCount = Array.isArray(data.predictions) ? data.predictions.length : 0;
        if (recentChartData.length > 60 || predictionPointCount > 0) {
          mainChart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, recentChartData.length - 60),
            to: recentChartData.length - 1 + predictionPointCount + (predictionPointCount > 0 ? 2 : 0),
          });
        } else { mainChart.timeScale().fitContent(); }

        mainChart.subscribeCrosshairMove((param) => {
          if (!mainTooltipRef.current) return;
          if (
            param.point === undefined ||
            !param.time ||
            param.point.x < 0 ||
            param.point.x > chartContainerRef.current.clientWidth ||
            param.point.y < 0 ||
            param.point.y > chartContainerRef.current.clientHeight
          ) {
            renderMainTooltip(recentChartData[recentChartData.length - 1].time, recentChartData[recentChartData.length - 1]);
            return;
          }
          const candleData = param.seriesData.get(candlestickSeries);
          if (candleData) renderMainTooltip(param.time, candleData);
        });

        attnChart.subscribeCrosshairMove((param) => {
          if (!attnTooltipRef.current) return;
          if (param.point === undefined || !param.time || param.point.x < 0 || param.point.x > attentionContainerRef.current.clientWidth || param.point.y < 0 || param.point.y > attentionContainerRef.current.clientHeight) {
            attnTooltipRef.current.style.display = 'none';
          } else {
            const volData = param.seriesData.get(volumeSeries);
            const attnData = param.seriesData.get(attentionLineSeries);
            let html = '';
            if (volData) html += `<div style="margin-bottom: 5px;"><span style="color: ${tooltipLabelColor}">${shellCopy.tooltipVolume}: </span> <span style="color: ${tooltipValueColor}; font-weight: bold;">${formatVND(volData.value)}</span></div>`;
            if (attnData && attnData.value !== undefined) html += `<div><span style="color: ${tooltipLabelColor}">${shellCopy.tooltipSignal}: </span> <span style="color: #e3fe1a; font-weight: bold;">${attnData.value.toFixed(2)}%</span></div>`;
            if (html) {
              attnTooltipRef.current.style.display = 'flex';
              attnTooltipRef.current.style.flexDirection = 'column';
              attnTooltipRef.current.innerHTML = html;
            } else {
              attnTooltipRef.current.style.display = 'none';
            }
          }
        });

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
      }
    } catch (renderErr) {
      console.error('Chart render error:', renderErr);
    }

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
  }, [data, chartTheme, visibleChartData, activeIndicators, indicatorData, language]);

  if (error) {
    return (
      <div style={{ background: '#0b0e11', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#f6465d' }}>
        <h3>{error}</h3>
        <button className="btn" onClick={() => window.location.reload()}>{shellCopy.retry}</button>
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
                <span className="analysis-banner-kicker">{shellCopy.updatingKicker}</span>
                <span className="analysis-banner-title">{shellCopy.loading}</span>
              </div>
              <span className="analysis-banner-chip">{shellCopy.updatingChip}</span>
            </div>
          )}

          {dataQualityWarning && (
            <div
              style={{
                marginBottom: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #f59e0b',
                background: isLightTheme ? '#fff7ed' : 'rgba(245, 158, 11, 0.12)',
                color: isLightTheme ? '#7c2d12' : '#fbbf24',
                fontSize: '13px',
                lineHeight: 1.45,
              }}
            >
              <strong>
                {dataQualityWarning.blocked
                  ? 'Ch\u1ea5t l\u01b0\u1ee3ng d\u1eef li\u1ec7u th\u1ea5p: h\u1ec7 th\u1ed1ng \u0111\u00e3 kh\u00f3a khuy\u1ebfn ngh\u1ecb h\u00e0nh \u0111\u1ed9ng.'
                  : 'C\u1ea3nh b\u00e1o ch\u1ea5t l\u01b0\u1ee3ng d\u1eef li\u1ec7u: h\u1ec7 th\u1ed1ng \u0111\u00e3 h\u1ea1 \u0111\u1ed9 tin c\u1eady.'}
              </strong>
              <div>
                \u0110i\u1ec3m ch\u1ea5t l\u01b0\u1ee3ng: {dataQualityWarning.score}/100 ({dataQualityWarning.label}) - ngu\u1ed3n: {dataQualityWarning.source}
              </div>
              {dataQualityWarning.issueText && <div>V\u1ea5n \u0111\u1ec1: {dataQualityWarning.issueText}</div>}
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
                  {/* -- Row 1: Ticker identity + Timeframe -- */}
                  <div className="ct-row-1">
                    <div className="ct-identity">
                      <h2 className="ct-ticker">{ticker}</h2>
                      <span className="ct-exchange">{shellCopy.currency}</span>
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
                  {/* -- Row 2: Indicators + Status + Export -- */}
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
                        title={language === 'en' ? 'Export chart data CSV' : 'Xu\u1ea5t d\u1eef li\u1ec7u CSV'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        CSV
                      </button>
                      <button
                        className="export-btn"
                        onClick={() => exportPredictionReportCSV(ticker, data)}
                        title={language === 'en' ? 'Export trend report' : 'Xu\u1ea5t b\u00e1o c\u00e1o xu h\u01b0\u1edbng'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        {language === 'en' ? 'Report' : 'B\u00e1o c\u00e1o'}
                      </button>
                    </div>
                  </div>
                  <div className="chart-frame" ref={chartFrameRef}>
                    <div
                      ref={mainTooltipRef}
                      className="chart-corner-tooltip"
                      style={{
                        position: 'absolute',
                        top: '14px',
                        left: '14px',
                        zIndex: 12,
                        backgroundColor: chartTheme.tooltipBg,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        color: 'var(--text-primary)',
                        pointerEvents: 'none',
                      }}
                    ></div>
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
                      <span className="legend-chip" style={{ color: 'var(--accent-green)' }}>{shellCopy.legendVolumeUp}</span>
                      <span className="legend-chip" style={{ color: 'var(--accent-red)' }}>{shellCopy.legendVolumeDown}</span>
                      <span className="legend-chip" style={{ color: '#e3fe1a' }}>{shellCopy.legendSignalLine}</span>
                    </div>
                  </div>
                  <div className="chart-frame" ref={attentionFrameRef}>
                    <div ref={attnTooltipRef} style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, backgroundColor: chartTheme.tooltipBg, color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${chartTheme.tooltipBorder}`, fontSize: '13px', display: 'none', gap: '10px', pointerEvents: 'none' }}></div>
                    <div ref={attentionContainerRef} style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}></div>
                  </div>

                </div>

                <QuickStatsBanner ticker={ticker} language={language} />

              </div>

              <div className="side-panel-stack">
                {weeklyForecastOutlook.length > 0 && (() => {
                  // ── Overall 3-week trend ──────────────────────────────────────
                  const lastOutlookItem = weeklyForecastOutlook[weeklyForecastOutlook.length - 1];
                  const isProbMode = weeklyForecastOutlook[0]?.probability !== undefined;
                  const sigThresholdPct = Number(data?.recommendation_threshold || 0.008) * 100;

                  let overallDir, overallLabel, overallColor, overallChangePct;
                  if (isProbMode) {
                    overallColor = lastOutlookItem.color;
                    overallLabel = lastOutlookItem.directionLabel;
                    overallDir = overallColor === 'var(--accent-green)' ? 'up'
                      : overallColor === 'var(--accent-red)' ? 'down' : 'sideways';
                    overallChangePct = null;
                  } else {
                    overallChangePct = lastOutlookItem?.changePct ?? 0;
                    overallDir = overallChangePct >= sigThresholdPct ? 'up'
                      : overallChangePct <= -sigThresholdPct ? 'down' : 'sideways';
                    overallColor = overallDir === 'up' ? 'var(--accent-green)'
                      : overallDir === 'down' ? 'var(--accent-red)' : 'var(--accent-yellow)';
                    overallLabel = overallDir === 'up'
                      ? (language === 'en' ? 'Uptrend' : 'Xu hướng tăng')
                      : overallDir === 'down'
                        ? (language === 'en' ? 'Downtrend' : 'Xu hướng giảm')
                        : (language === 'en' ? 'Sideways' : 'Đi ngang');
                  }
                  const trendArrow = overallDir === 'up' ? '↑' : overallDir === 'down' ? '↓' : '→';

                  // ── Mini sparkline: current → W1 → W2 → W3 ──────────────────
                  const currentPx = Number(data?.current_price || scores.currentPrice || 0);
                  const sparkPrices = !isProbMode && currentPx > 0
                    ? [currentPx, ...weeklyForecastOutlook.map(w => w.price).filter(Boolean)]
                    : null;

                  return (
                    <div className="card forecast-panel">
                      <div className="forecast-strip-head">
                        <div>
                          <div className="forecast-kicker">{shellCopy.forecastKicker}</div>
                          <div className="forecast-title">{shellCopy.forecastTitle}</div>
                        </div>
                        <span className="forecast-source">{shellCopy.forecastSource}</span>
                      </div>

                      {/* ── Overall trend banner ── */}
                      <div className="forecast-trend-banner" style={{ borderColor: overallColor }}>
                        <span className="forecast-trend-arrow" style={{ color: overallColor }}>
                          {trendArrow}
                        </span>
                        <div className="forecast-trend-info">
                          <strong style={{ color: overallColor }}>{overallLabel}</strong>
                          {overallChangePct != null && (
                            <span style={{ color: overallColor }}>
                              {overallChangePct >= 0 ? '+' : ''}{formatPercent(overallChangePct, 2)}&nbsp;
                              {language === 'en' ? 'vs today (3w)' : 'so với hôm nay (3 tuần)'}
                            </span>
                          )}
                        </div>
                        {sparkPrices && sparkPrices.length > 1 && (() => {
                          const mn = Math.min(...sparkPrices);
                          const mx = Math.max(...sparkPrices);
                          const rng = mx - mn || 1;
                          const W = 80, H = 28, pad = 3;
                          const pts = sparkPrices.map((p, i) => {
                            const x = pad + (i / (sparkPrices.length - 1)) * (W - 2 * pad);
                            const y = H - pad - ((p - mn) / rng) * (H - 2 * pad);
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          }).join(' ');
                          const spColor = sparkPrices[sparkPrices.length - 1] >= sparkPrices[0]
                            ? '#0ecb81' : '#f6465d';
                          return (
                            <svg className="forecast-sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                              <polyline points={pts} fill="none" stroke={spColor} strokeWidth="2.2"
                                strokeLinejoin="round" strokeLinecap="round" />
                              {sparkPrices.map((p, i) => {
                                const x = pad + (i / (sparkPrices.length - 1)) * (W - 2 * pad);
                                const y = H - pad - ((p - mn) / rng) * (H - 2 * pad);
                                return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)}
                                  r={i === 0 ? 2 : 2.8}
                                  fill={i === 0 ? 'var(--text-muted)' : spColor} />;
                              })}
                            </svg>
                          );
                        })()}
                      </div>

                      {/* ── Per-week cards ── */}
                      <div className="forecast-week-grid">
                        {weeklyForecastOutlook.map((item) => (
                          <div
                            className="forecast-week-card"
                            key={item.key}
                            style={{ '--card-accent-color': item.color }}
                          >
                            <div className="forecast-week-top">
                              <span>{item.label}</span>
                              <strong style={{ color: item.color }}>{item.directionLabel}</strong>
                            </div>
                            <div className="forecast-week-value">
                              {item.probability !== undefined
                                ? `P(outperform) ${formatPercent(item.probability * 100, 1)}`
                                : `${formatVND(item.price * 1000)} ${shellCopy.currency}`}
                            </div>
                            {item.probability !== undefined && (
                              <div className="forecast-prob-track" aria-hidden="true">
                                <span className="forecast-prob-up" style={{ width: `${Math.max(0, item.probability * 100)}%` }} />
                                <span className="forecast-prob-neutral" style={{ width: `${Math.max(0, item.neutralProbability * 100)}%` }} />
                                <span className="forecast-prob-down" style={{ width: `${Math.max(0, item.underperformProbability * 100)}%` }} />
                              </div>
                            )}
                            <div className="forecast-week-meta">
                              <span>{item.horizon}</span>
                              <span style={{ color: item.color }}>
                                {item.probability !== undefined
                                  ? `O ${formatPercent(item.probability * 100, 1)} / N ${formatPercent(item.neutralProbability * 100, 1)} / U ${formatPercent(item.underperformProbability * 100, 1)}`
                                  : `${item.changePct >= 0 ? '+' : ''}${formatPercent(item.changePct, 2)}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="card opening-summary-panel">
                  <div className="opening-summary-head">
                    <div>
                      <div className="opening-summary-kicker">
                        {language === 'en' ? 'Opening view' : 'G\u00f3c nh\u00ecn m\u1edf \u0111\u1ea7u'}
                      </div>
                      <h3>{language === 'en' ? 'Decision snapshot' : 'K\u1ebft lu\u1eadn c\u1ea7n xem ngay'}</h3>
                    </div>
                    <span>{language === 'en' ? 'Latest data' : 'D\u1eef li\u1ec7u'}: {latestDataTime}</span>
                  </div>

                  <div className="opening-summary-rating" style={{ color: scores.recColor }}>
                    {scores.recommendation}
                  </div>
                  <p className="opening-summary-note">{scores.recommendationNote}</p>

                  <div className="opening-summary-metrics">
                    <div title={scores.modelReliability?.note || ''}>
                      <span>{language === 'en' ? 'Model reliability' : '\u0110\u1ed9 tin c\u1eady m\u00f4 h\u00ecnh'}</span>
                      <strong style={{ color: getPositiveScoreColor(scores.modelReliability?.score || 0) }}>
                        {Math.round(scores.modelReliability?.score || 0)}%
                      </strong>
                      <small>{scores.modelReliability?.label || (language === 'en' ? 'Backtest' : 'T\u1eeb backtest')}</small>
                    </div>
                    <div title={language === 'en' ? 'Strength of the live signal for this session' : 'C\u01b0\u1eddng \u0111\u1ed9 t\u00edn hi\u1ec7u s\u1ed1ng cho phi\u00ean hi\u1ec7n t\u1ea1i'}>
                      <span>{language === 'en' ? 'Signal strength' : 'C\u01b0\u1eddng \u0111\u1ed9 t\u00edn hi\u1ec7u'}</span>
                      <strong style={{ color: getConfidenceColor(scores.recommendationConfidenceScore) }}>
                        {Math.round(scores.recommendationConfidenceScore)}%
                      </strong>
                      <small>{scores.recommendationConfidenceLabel}</small>
                    </div>
                    <div>
                      <span>{language === 'en' ? 'Outperform' : 'Outperform'}</span>
                      <strong style={{ color: scores.outperformProbability >= scores.underperformProbability ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {scores.isProbabilityMode ? formatPercent(scores.outperformProbability * 100, 1) : `${scores.priceDiffPercent >= 0 ? '+' : ''}${formatPercent(scores.priceDiffPercent, 2)}`}
                      </strong>
                      <small>
                        {scores.isProbabilityMode
                          ? `N ${formatPercent(scores.neutralProbability * 100, 1)} / U ${formatPercent(scores.underperformProbability * 100, 1)}`
                          : language === 'en' ? 'Legacy trend delta' : 'Bi\u00ean xu h\u01b0\u1edbng legacy'}
                      </small>
                    </div>
                  </div>

                  <div className="opening-summary-action">
                    <span>{language === 'en' ? 'Action now' : 'N\u00ean l\u00e0m g\u00ec ngay'}</span>
                    <p>{immediateAction}</p>
                  </div>
                </div>

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
                  modelReliability={scores.modelReliability}
                  actionPlan={actionPlan}
                  priceSignalScore={scores.priceSignalScore}
                  contextAlignmentScore={scores.contextAlignmentScore}
                  getPositiveScoreColor={getPositiveScoreColor}
                  getConfidenceColor={getConfidenceColor}
                  immediateAction={immediateAction}
                  isProbabilityMode={scores.isProbabilityMode}
                  probabilityForecast={scores.probabilityForecast}
                  outperformProbability={scores.outperformProbability}
                  neutralProbability={scores.neutralProbability}
                  underperformProbability={scores.underperformProbability}
                  language={language}
                />

              </div>
            </div>
          </div>

          <div className="secondary-analysis-grid">
            <AISignalBacktestPanel
              data={signalBacktest}
              loading={signalBacktestLoading}
              language={language}
            />

            <div className="card detail-card quick-read-card" onMouseLeave={() => setActiveQuickDiagnosisIndex(0)}>
              <div className="quick-read-header">
                <div className="quick-read-heading">
                  <div className="quick-read-eyebrow">{shellCopy.helperEyebrow}</div>
                  <h3 className="quick-read-title">{shellCopy.helperTitle}</h3>
                </div>
                <span className="quick-read-note">{shellCopy.helperNote}</span>
              </div>
              <div className="quick-read-grid">
                {quickDiagnosisCards.map((item, index) => (
                  <div
                    key={item.label}
                    className={`quick-diagnosis-card ${index === activeQuickDiagnosisIndex ? 'is-active' : ''}`}
                    tabIndex={0}
                    aria-describedby="quick-diagnosis-explainer"
                    onMouseEnter={() => setActiveQuickDiagnosisIndex(index)}
                    onFocus={() => setActiveQuickDiagnosisIndex(index)}
                  >
                    <div className="quick-diagnosis-label">{item.label}</div>
                    <div className="quick-diagnosis-value" style={{ color: item.color }}>{item.value}</div>
                    <div className="quick-diagnosis-sub">{item.sub}</div>
                  </div>
                ))}
              </div>
              <div className="quick-diagnosis-explainer" id="quick-diagnosis-explainer" aria-live="polite">
                <span>{activeQuickDiagnosis.label}</span>
                <p>{activeQuickDiagnosis.description}</p>
              </div>
            </div>
          </div>

          <div className="detail-stack">
            <ActionPlanCard
              recColor={scores.recColor}
              actionPlan={actionPlan}
              decisionGuidance={decisionGuidance}
              technicalReferences={technicalReferences}
              language={language}
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
            language={language}
          />
        </>
      )}
    </div>
  );
}
