/**
 * Export utilities for MinSight Banking AI.
 *
 * Provides functions to export chart data and AI trend reports as CSV files
 * with UTF-8 BOM encoding for Excel compatibility.
 */

/**
 * Create an in-memory Blob from a CSV string and trigger a browser download.
 *
 * @param {string} csvContent - The full CSV text (should already include BOM if needed).
 * @param {string} filename   - Suggested filename for the download.
 */
export function triggerDownload(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Return today's date formatted as YYYY-MM-DD.
 *
 * @returns {string}
 */
function todayStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Escape a value for safe inclusion in a CSV cell.
 * Wraps the value in double-quotes when it contains a comma, quote, or newline.
 *
 * @param {*} value
 * @returns {string}
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export chart data (OHLCV + RSI) to a CSV file.
 *
 * The prices inside `chartData` are already expressed in VND (multiplied by
 * 1 000 on the server side), so no further conversion is applied here.
 *
 * @param {string} ticker    - Stock ticker symbol (e.g. "VCB").
 * @param {Array<{
 *   time:   string,
 *   open:   number,
 *   high:   number,
 *   low:    number,
 *   close:  number,
 *   volume: number,
 *   rsi_14: number
 * }>} chartData - Array of OHLCV + RSI objects with prices already in VND.
 */
export function exportChartDataCSV(ticker, chartData) {
  if (!chartData || chartData.length === 0) return;

  const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'RSI_14'];
  const rows = chartData.map((d) =>
    [
      d.time,
      d.open,
      d.high,
      d.low,
      d.close,
      d.volume,
      d.rsi_14 != null ? Number(d.rsi_14).toFixed(2) : '',
    ]
      .map(csvEscape)
      .join(','),
  );

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const filename = `${ticker}_chart_data_${todayStamp()}.csv`;
  triggerDownload(csv, filename);
}

/**
 * Export a full AI trend report as a CSV file.
 *
 * The report contains two sections separated by a blank row:
 *   1. **Trend Signal Summary** -- ticker, date, current price, trend
 *      probabilities, recommendation text, and confidence scores.
 *   2. **Recent Price History** -- the last 30 days of OHLCV + RSI data taken
 *      from `data.chart_data`.
 *
 * Prices coming from the API (`current_price`, legacy `predicted_price`) are
 * in *thousands* of VND and are multiplied by 1 000 before writing.
 * Prices in `chart_data` are already in VND.
 *
 * @param {string} ticker - Stock ticker symbol.
 * @param {{
 *   current_price:                   number,
 *   predictions:                     Array<{ predicted_price: number, date: string }>,
 *   recommendation:                  string,
 *   recommendation_score:            number,
 *   recommendation_confidence_score: number,
 *   chart_data: Array<{
 *     time:   string,
 *     open:   number,
 *     high:   number,
 *     low:    number,
 *     close:  number,
 *     volume: number,
 *     rsi_14: number
 *   }>
 * }} data - The full API response object.
 */
export function exportPredictionReportCSV(ticker, data) {
  if (!data) return;

  const lines = [];

  // Section 1: Trend Signal Summary
  lines.push('TREND SIGNAL SUMMARY');
  lines.push(`Ticker,${csvEscape(ticker)}`);
  lines.push(`Report Date,${csvEscape(todayStamp())}`);
  lines.push(
    `Current Price (VND),${csvEscape(Math.round(data.current_price * 1000))}`,
  );

  const probabilityForecast = data.probability_forecast || {};
  const probabilitySource = probabilityForecast.probabilities || {};
  const pOutperform = probabilityForecast.outperform_probability ?? probabilitySource.outperform;
  const pNeutral = probabilityForecast.neutral_probability ?? probabilitySource.neutral;
  const pUnderperform = probabilityForecast.underperform_probability ?? probabilitySource.underperform;
  const alphaEdge = probabilityForecast.alpha_edge;
  const isProbabilityMode = data.prediction_mode === 'alpha_probability'
    || [pOutperform, pNeutral, pUnderperform].some((value) => Number.isFinite(Number(value)));

  if (isProbabilityMode) {
    lines.push('');
    lines.push('Trend Probabilities');
    lines.push('Horizon,Outperform,Neutral,Underperform,Alpha Edge');
    lines.push([
      probabilityForecast.horizon_label || `T+${probabilityForecast.horizon_days || 5}`,
      pOutperform != null ? `${(Number(pOutperform) * 100).toFixed(2)}%` : '',
      pNeutral != null ? `${(Number(pNeutral) * 100).toFixed(2)}%` : '',
      pUnderperform != null ? `${(Number(pUnderperform) * 100).toFixed(2)}%` : '',
      alphaEdge != null ? `${(Number(alphaEdge) * 100).toFixed(2)}%` : '',
    ].map(csvEscape).join(','));
  } else if (data.predictions && data.predictions.length > 0) {
    lines.push('');
    lines.push('Legacy Trend Proxy');
    lines.push('Date,Legacy Price Path (VND)');
    data.predictions.forEach((p) => {
      lines.push(
        `${csvEscape(p.date)},${csvEscape(Math.round(p.predicted_price * 1000))}`,
      );
    });
  }

  lines.push('');
  lines.push(
    `Recommendation,${csvEscape(data.recommendation || '')}`,
  );
  lines.push(
    `Recommendation Score,${csvEscape(
      data.recommendation_score != null
        ? Number(data.recommendation_score).toFixed(2)
        : '',
    )}`,
  );
  lines.push(
    `Confidence Score,${csvEscape(
      data.recommendation_confidence_score != null
        ? Number(data.recommendation_confidence_score).toFixed(2)
        : '',
    )}`,
  );

  // Section 2: Recent Price History (last 30 days)
  if (data.chart_data && data.chart_data.length > 0) {
    const recent = data.chart_data.slice(-30);

    lines.push('');
    lines.push('RECENT PRICE HISTORY (Last 30 days)');
    lines.push('Date,Open,High,Low,Close,Volume,RSI_14');

    recent.forEach((d) => {
      lines.push(
        [
          d.time,
          d.open,
          d.high,
          d.low,
          d.close,
          d.volume,
          d.rsi_14 != null ? Number(d.rsi_14).toFixed(2) : '',
        ]
          .map(csvEscape)
          .join(','),
      );
    });
  }

  const csv = '\uFEFF' + lines.join('\r\n');
  const filename = `${ticker}_trend_report_${todayStamp()}.csv`;
  triggerDownload(csv, filename);
}
