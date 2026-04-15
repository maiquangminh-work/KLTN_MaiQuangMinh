/**
 * Technical Indicators — tính từ dữ liệu OHLCV.
 * Tất cả input là mảng { time, open, high, low, close, volume }.
 * Các giá trị đã được nhân 1000 (nghìn đồng) trước khi truyền vào.
 */

/** EMA — Exponential Moving Average */
export function calcEMA(data, period) {
  if (!data || data.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;

  for (let i = period - 1; i < data.length; i++) {
    if (i === period - 1) {
      ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
    } else {
      ema = data[i].close * k + ema * (1 - k);
    }
    result.push({ time: data[i].time, value: parseFloat(ema.toFixed(2)) });
  }
  return result;
}

/** SMA — Simple Moving Average (dùng nội bộ cho Bollinger) */
function calcSMA(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((s, d) => s + d.close, 0) / period;
    result.push({ time: data[i].time, value: mean, idx: i });
  }
  return result;
}

/** Bollinger Bands — 20-period SMA ± 2 × stddev */
export function calcBollingerBands(data, period = 20, multiplier = 2) {
  if (!data || data.length < period) return { upper: [], middle: [], lower: [] };
  const upper = [];
  const middle = [];
  const lower = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const closes = slice.map((d) => d.close);
    const mean = closes.reduce((s, v) => s + v, 0) / period;
    const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const stddev = Math.sqrt(variance);

    const time = data[i].time;
    const u = parseFloat((mean + multiplier * stddev).toFixed(2));
    const l = parseFloat((mean - multiplier * stddev).toFixed(2));
    const m = parseFloat(mean.toFixed(2));

    upper.push({ time, value: u });
    middle.push({ time, value: m });
    lower.push({ time, value: l });
  }
  return { upper, middle, lower };
}

/** MACD — 12/26 EMA difference + 9-period signal line */
export function calcMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!data || data.length < slowPeriod + signalPeriod) return { macd: [], signal: [], histogram: [] };

  const kFast = 2 / (fastPeriod + 1);
  const kSlow = 2 / (slowPeriod + 1);
  const kSignal = 2 / (signalPeriod + 1);

  // Seed EMAs with SMA of first period bars
  let emaFast = data.slice(0, fastPeriod).reduce((s, d) => s + d.close, 0) / fastPeriod;
  let emaSlow = data.slice(0, slowPeriod).reduce((s, d) => s + d.close, 0) / slowPeriod;

  const macdValues = [];
  for (let i = 0; i < data.length; i++) {
    if (i < fastPeriod - 1) continue;
    if (i < slowPeriod - 1) {
      emaFast = i === fastPeriod - 1
        ? data.slice(0, fastPeriod).reduce((s, d) => s + d.close, 0) / fastPeriod
        : data[i].close * kFast + emaFast * (1 - kFast);
      continue;
    }
    if (i === slowPeriod - 1) {
      emaFast = data.slice(0, fastPeriod).reduce((s, d) => s + d.close, 0) / fastPeriod;
      // re-calculate emaFast up to this point
      for (let j = fastPeriod; j <= slowPeriod - 1; j++) {
        emaFast = data[j].close * kFast + emaFast * (1 - kFast);
      }
      emaSlow = data.slice(0, slowPeriod).reduce((s, d) => s + d.close, 0) / slowPeriod;
    } else {
      emaFast = data[i].close * kFast + emaFast * (1 - kFast);
      emaSlow = data[i].close * kSlow + emaSlow * (1 - kSlow);
    }
    const macdVal = emaFast - emaSlow;
    macdValues.push({ time: data[i].time, value: parseFloat(macdVal.toFixed(4)) });
  }

  if (macdValues.length < signalPeriod) return { macd: macdValues, signal: [], histogram: [] };

  // Signal = 9-period EMA of MACD values
  let emaSignal = macdValues.slice(0, signalPeriod).reduce((s, d) => s + d.value, 0) / signalPeriod;
  const signal = [];
  const histogram = [];

  for (let i = signalPeriod - 1; i < macdValues.length; i++) {
    if (i === signalPeriod - 1) {
      emaSignal = macdValues.slice(0, signalPeriod).reduce((s, d) => s + d.value, 0) / signalPeriod;
    } else {
      emaSignal = macdValues[i].value * kSignal + emaSignal * (1 - kSignal);
    }
    const signalVal = parseFloat(emaSignal.toFixed(4));
    const hist = parseFloat((macdValues[i].value - signalVal).toFixed(4));

    signal.push({ time: macdValues[i].time, value: signalVal });
    histogram.push({
      time: macdValues[i].time,
      value: hist,
      color: hist >= 0 ? 'rgba(14, 203, 129, 0.7)' : 'rgba(246, 70, 93, 0.7)',
    });
  }

  return { macd: macdValues, signal, histogram };
}

/** RSI — Relative Strength Index (14-period, từ dữ liệu đã có rsi_14 field) */
export const INDICATOR_OPTIONS = [
  { id: 'ema12', label: 'EMA 12', group: 'overlay' },
  { id: 'ema26', label: 'EMA 26', group: 'overlay' },
  { id: 'bollinger', label: 'Bollinger', group: 'overlay' },
  { id: 'macd', label: 'MACD', group: 'panel' },
];
