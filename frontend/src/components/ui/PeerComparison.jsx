import { useState } from 'react';
import { BANK_FINANCIAL_DATA, VALID_TICKERS } from '../../utils/constants';

const TICKERS = VALID_TICKERS.filter((ticker) => BANK_FINANCIAL_DATA[ticker]);

const COPY = {
  vi: {
    kicker: 'So s\u00e1nh ng\u00e2n h\u00e0ng',
    title: 'Peer Benchmark',
    note: 'B\u1ea3n \u0111\u1ed3 \u0111\u1ecbnh v\u1ecb theo ROE, P/B, v\u1ed1n ho\u00e1 v\u00e0 n\u1ee3 x\u1ea5u; b\u1ea3ng b\u00ean d\u01b0\u1edbi gi\u1eef l\u1ea1i s\u1ed1 li\u1ec7u chi ti\u1ebft.',
    metric: 'Ch\u1ec9 s\u1ed1',
    mapTitle: 'B\u1ea3n \u0111\u1ed3 \u0111\u1ecbnh v\u1ecb peer',
    xAxis: '\u0110\u1ecbnh gi\u00e1: r\u1ebb h\u01a1n \u2190 P/B \u2192 \u0111\u1eaft h\u01a1n',
    yAxis: 'Hi\u1ec7u qu\u1ea3 sinh l\u1eddi: th\u1ea5p \u2192 cao',
    bubble: 'K\u00edch th\u01b0\u1edbc bong b\u00f3ng = v\u1ed1n ho\u00e1',
    median: 'Trung v\u1ecb peer',
    riskLow: 'N\u1ee3 x\u1ea5u th\u1ea5p',
    riskMid: 'N\u1ee3 x\u1ea5u trung b\u00ecnh',
    riskHigh: 'N\u1ee3 x\u1ea5u cao',
    selected: 'M\u00e3 \u0111ang ch\u1ecdn',
    viewing: '\u0110ang xem',
    activeMarker: 'M\u00e3 g\u1ed1c',
    hoverHint: 'Di chu\u1ed9t v\u00e0o t\u1eebng bong b\u00f3ng \u0111\u1ec3 panel c\u1eadp nh\u1eadt chi ti\u1ebft.',
    peerMedian: 'Trung v\u1ecb nh\u00f3m',
    roeRank: 'X\u1ebfp h\u1ea1ng ROE',
    pbRank: 'X\u1ebfp h\u1ea1ng P/B',
    npl: 'N\u1ee3 x\u1ea5u',
    marketCap: 'V\u1ed1n ho\u00e1',
    quickTake: 'K\u1ebft lu\u1eadn nhanh',
    roeSpread: 'ROE so v\u1edbi trung v\u1ecb',
    pbSpread: 'P/B so v\u1edbi trung v\u1ecb',
    nplSpread: 'N\u1ee3 x\u1ea5u so v\u1edbi trung v\u1ecb',
    percentagePoint: ' \u0111i\u1ec3m %',
    quadrantLabels: {
      attractive: 'R\u1ebb h\u01a1n / sinh l\u1eddi t\u1ed1t',
      premium: '\u0110\u1eaft h\u01a1n / ch\u1ea5t l\u01b0\u1ee3ng t\u1ed1t',
      valueTrap: 'R\u1ebb nh\u01b0ng sinh l\u1eddi y\u1ebfu',
      avoid: '\u0110\u1eaft v\u00e0 sinh l\u1eddi y\u1ebfu',
    },
    quickSummaries: {
      attractive: '{ticker} \u0111ang n\u1eb1m \u1edf v\u00f9ng kh\u00e1 h\u1ea5p d\u1eabn: P/B th\u1ea5p h\u01a1n trung v\u1ecb trong khi ROE cao h\u01a1n trung v\u1ecb. \u0110\u00e2y l\u00e0 nh\u00f3m n\u00ean xem k\u1ef9 th\u00eam v\u1ec1 \u0111\u1ed9 b\u1ec1n l\u1ee3i nhu\u1eadn v\u00e0 r\u1ee7i ro n\u1ee3 x\u1ea5u.',
      premium: '{ticker} c\u00f3 ROE cao h\u01a1n trung v\u1ecb nh\u01b0ng P/B c\u0169ng cao h\u01a1n. Th\u1ecb tr\u01b0\u1eddng \u0111ang tr\u1ea3 premium cho ch\u1ea5t l\u01b0\u1ee3ng sinh l\u1eddi, n\u00ean c\u1ea7n ki\u1ec3m tra xem m\u1ee9c \u0111\u1ecbnh gi\u00e1 c\u00f3 h\u1ee3p l\u00fd kh\u00f4ng.',
      valueTrap: '{ticker} c\u00f3 P/B th\u1ea5p h\u01a1n trung v\u1ecb nh\u01b0ng ROE th\u1ea5p h\u01a1n. \u0110\u00e2y l\u00e0 v\u00f9ng r\u1ebb c\u00f3 \u0111i\u1ec1u ki\u1ec7n, c\u1ea7n xem th\u00eam ch\u1ea5t l\u01b0\u1ee3ng t\u00e0i s\u1ea3n v\u00e0 \u0111\u1ed9 ph\u1ee5c h\u1ed3i l\u1ee3i nhu\u1eadn.',
      avoid: '{ticker} \u0111ang k\u00e9m h\u1ea5p d\u1eabn trong nh\u00f3m peer: P/B cao h\u01a1n trung v\u1ecb nh\u01b0ng ROE th\u1ea5p h\u01a1n. N\u00ean th\u1eadn tr\u1ecdng n\u1ebfu kh\u00f4ng c\u00f3 lu\u1eadn \u0111i\u1ec3m t\u0103ng tr\u01b0\u1edfng ri\u00eang.',
    },
    metrics: {
      pe: 'P/E',
      pb: 'P/B',
      roe: 'ROE (%)',
      roa: 'ROA (%)',
      nim: 'NIM (%)',
      eps: 'EPS',
      marketCap: 'V\u1ed1n ho\u00e1 (t\u1ef7)',
      totalAssets: 'T\u1ed5ng t\u00e0i s\u1ea3n (t\u1ef7)',
      nplRatio: 'T\u1ef7 l\u1ec7 n\u1ee3 x\u1ea5u (%)',
      carRatio: 'CAR (%)',
      costToIncome: 'Cost-to-Income (%)',
      loanGrowth: 'T\u0103ng tr\u01b0\u1edfng TD (%)',
    },
  },
  en: {
    kicker: 'Bank Comparison',
    title: 'Peer Benchmark',
    note: 'Position map using ROE, P/B, market cap and NPL ratio; the table below keeps the detailed metrics.',
    metric: 'Metric',
    mapTitle: 'Peer position map',
    xAxis: 'Valuation: cheaper \u2190 P/B \u2192 more expensive',
    yAxis: 'Profitability: lower \u2192 higher',
    bubble: 'Bubble size = market capitalization',
    median: 'Peer median',
    riskLow: 'Low NPL',
    riskMid: 'Medium NPL',
    riskHigh: 'High NPL',
    selected: 'Selected ticker',
    viewing: 'Viewing',
    activeMarker: 'Base ticker',
    hoverHint: 'Hover a bubble to update the detail panel.',
    peerMedian: 'Peer median',
    roeRank: 'ROE rank',
    pbRank: 'P/B rank',
    npl: 'NPL ratio',
    marketCap: 'Market cap',
    quickTake: 'Quick read',
    roeSpread: 'ROE vs median',
    pbSpread: 'P/B vs median',
    nplSpread: 'NPL vs median',
    percentagePoint: ' pp',
    quadrantLabels: {
      attractive: 'Cheaper / strong profitability',
      premium: 'Expensive / strong quality',
      valueTrap: 'Cheap but weak profitability',
      avoid: 'Expensive and weak profitability',
    },
    quickSummaries: {
      attractive: '{ticker} sits in a relatively attractive zone: P/B is below the peer median while ROE is above it. Check earnings durability and asset quality before treating it as a clear opportunity.',
      premium: '{ticker} has above-median ROE but also trades at above-median P/B. The market is paying a premium for profitability, so valuation discipline matters.',
      valueTrap: '{ticker} trades below the peer median P/B but also has below-median ROE. This is a conditional value case, not automatically cheap.',
      avoid: '{ticker} is weaker versus peers: P/B is above median while ROE is below median. Be cautious unless there is a separate growth or turnaround thesis.',
    },
    metrics: {
      pe: 'P/E',
      pb: 'P/B',
      roe: 'ROE (%)',
      roa: 'ROA (%)',
      nim: 'NIM (%)',
      eps: 'EPS',
      marketCap: 'Market Cap (B)',
      totalAssets: 'Total Assets (B)',
      nplRatio: 'NPL Ratio (%)',
      carRatio: 'CAR (%)',
      costToIncome: 'Cost-to-Income (%)',
      loanGrowth: 'Loan Growth (%)',
    },
  },
};

const LOWER_IS_BETTER = new Set(['pe', 'pb', 'nplRatio', 'costToIncome']);
const METRIC_KEYS = [
  'pe', 'pb', 'roe', 'roa', 'nim', 'eps',
  'marketCap', 'totalAssets', 'nplRatio', 'carRatio', 'costToIncome', 'loanGrowth',
];

const MAP = {
  width: 760,
  height: 360,
  left: 68,
  right: 44,
  top: 34,
  bottom: 58,
};

function finiteValues(key) {
  return TICKERS
    .map((ticker) => BANK_FINANCIAL_DATA[ticker]?.[key])
    .filter((value) => Number.isFinite(value));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function extent(values, paddingRatio = 0.08) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return [Math.max(0, min - range * paddingRatio), max + range * paddingRatio];
}

function scale(value, min, max, outMin, outMax) {
  if (!Number.isFinite(value)) return outMin;
  const ratio = (value - min) / (max - min || 1);
  return outMin + ratio * (outMax - outMin);
}

function rankValue(key, ticker) {
  const value = BANK_FINANCIAL_DATA[ticker]?.[key];
  const values = TICKERS
    .map((tk) => BANK_FINANCIAL_DATA[tk]?.[key])
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => (LOWER_IS_BETTER.has(key) ? a - b : b - a));
  return values.findIndex((v) => v === value) + 1;
}

function formatValue(key, val) {
  if (!Number.isFinite(val)) return 'N/A';
  if (key === 'marketCap' || key === 'totalAssets') {
    return val >= 1000 ? `${(val / 1000).toFixed(1)}` : val.toLocaleString();
  }
  if (key === 'eps') return val.toLocaleString();
  return val.toFixed(2);
}

function formatMapValue(key, value) {
  if (!Number.isFinite(value)) return 'N/A';
  if (key === 'marketCap') return `${(value / 1000).toFixed(1)}T VND`;
  if (key === 'roe' || key === 'nplRatio') return `${value.toFixed(2)}%`;
  return value.toFixed(2);
}

function formatSigned(value, suffix = '', decimals = 2) {
  if (!Number.isFinite(value)) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}${suffix}`;
}

function deltaTone(value, higherIsBetter = true) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.01) return 'neutral';
  const favorable = higherIsBetter ? value > 0 : value < 0;
  return favorable ? 'positive' : 'negative';
}

function bestInRow(key, values) {
  const lower = LOWER_IS_BETTER.has(key);
  let bestIdx = values.findIndex((value) => Number.isFinite(value));
  if (bestIdx < 0) return -1;
  for (let i = 1; i < values.length; i++) {
    if (!Number.isFinite(values[i])) continue;
    if (lower ? values[i] < values[bestIdx] : values[i] > values[bestIdx]) bestIdx = i;
  }
  return bestIdx;
}

function riskClass(nplRatio) {
  if (nplRatio <= 1.3) return 'low';
  if (nplRatio <= 2.2) return 'mid';
  return 'high';
}

function quadrantFor(data, pbMedian, roeMedian) {
  const highRoe = data.roe >= roeMedian;
  const cheap = data.pb <= pbMedian;
  if (highRoe && cheap) return 'attractive';
  if (highRoe && !cheap) return 'premium';
  if (!highRoe && cheap) return 'valueTrap';
  return 'avoid';
}

function PeerPositionMap({ activeTicker, copy, isLightTheme }) {
  const [hoveredTicker, setHoveredTicker] = useState(null);
  const viewedTicker = hoveredTicker || activeTicker;
  const pbValues = finiteValues('pb');
  const roeValues = finiteValues('roe');
  const nplValues = finiteValues('nplRatio');
  const marketCapValues = finiteValues('marketCap');
  const [pbMin, pbMax] = extent(pbValues);
  const [roeMin, roeMax] = extent(roeValues);
  const [capMin, capMax] = extent(marketCapValues, 0);
  const pbMedian = median(pbValues);
  const roeMedian = median(roeValues);
  const nplMedian = median(nplValues);
  const chartRight = MAP.width - MAP.right;
  const chartBottom = MAP.height - MAP.bottom;
  const gridColor = isLightTheme ? 'rgba(73, 94, 115, 0.18)' : 'rgba(255,255,255,0.10)';
  const axisColor = isLightTheme ? '#455a70' : '#9aa4b2';

  const selectedData = BANK_FINANCIAL_DATA[viewedTicker] || BANK_FINANCIAL_DATA[TICKERS[0]];
  const selectedQuadrant = quadrantFor(selectedData, pbMedian, roeMedian);
  const medianX = scale(pbMedian, pbMin, pbMax, MAP.left, chartRight);
  const medianY = scale(roeMedian, roeMin, roeMax, chartBottom, MAP.top);
  const pbDeltaPercent = ((selectedData.pb / pbMedian) - 1) * 100;
  const deltaRows = [
    {
      label: copy.roeSpread,
      value: formatSigned(selectedData.roe - roeMedian, copy.percentagePoint),
      tone: deltaTone(selectedData.roe - roeMedian, true),
    },
    {
      label: copy.pbSpread,
      value: formatSigned(pbDeltaPercent, '%'),
      tone: deltaTone(pbDeltaPercent, false),
    },
    {
      label: copy.nplSpread,
      value: formatSigned(selectedData.nplRatio - nplMedian, copy.percentagePoint),
      tone: deltaTone(selectedData.nplRatio - nplMedian, false),
    },
  ];
  const quickSummary = copy.quickSummaries[selectedQuadrant].replace('{ticker}', viewedTicker);

  const points = TICKERS.map((ticker) => {
    const data = BANK_FINANCIAL_DATA[ticker];
    return {
      ticker,
      data,
      x: scale(data.pb, pbMin, pbMax, MAP.left, chartRight),
      y: scale(data.roe, roeMin, roeMax, chartBottom, MAP.top),
      radius: scale(data.marketCap, capMin, capMax, 8, 22),
      risk: riskClass(data.nplRatio),
      active: ticker === activeTicker,
      viewed: ticker === viewedTicker,
    };
  });

  return (
    <div className="peer-map-section">
      <div className="peer-map-topline">
        <h4 className="peer-map-heading">{copy.mapTitle}</h4>
        <div className="peer-map-legend" aria-label={copy.bubble}>
          <span className="peer-risk-dot low" /> {copy.riskLow}
          <span className="peer-risk-dot mid" /> {copy.riskMid}
          <span className="peer-risk-dot high" /> {copy.riskHigh}
        </div>
      </div>
      <div className="peer-map-layout">
        <div className="peer-map-canvas">
          <svg className="peer-map-svg" viewBox={`0 0 ${MAP.width} ${MAP.height}`} role="img" aria-label={copy.mapTitle}>
            <rect x={MAP.left} y={MAP.top} width={chartRight - MAP.left} height={chartBottom - MAP.top} rx="8" className="peer-map-plot" />
            <rect x={MAP.left} y={MAP.top} width={medianX - MAP.left} height={medianY - MAP.top} className="peer-map-zone attractive" />
            <rect x={medianX} y={MAP.top} width={chartRight - medianX} height={medianY - MAP.top} className="peer-map-zone premium" />
            <rect x={MAP.left} y={medianY} width={medianX - MAP.left} height={chartBottom - medianY} className="peer-map-zone value-trap" />
            <rect x={medianX} y={medianY} width={chartRight - medianX} height={chartBottom - medianY} className="peer-map-zone avoid" />

            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
              const x = MAP.left + (chartRight - MAP.left) * tick;
              const y = MAP.top + (chartBottom - MAP.top) * tick;
              const pbLabel = pbMin + (pbMax - pbMin) * tick;
              const roeLabel = roeMax - (roeMax - roeMin) * tick;
              return (
                <g key={tick}>
                  <line x1={x} y1={MAP.top} x2={x} y2={chartBottom} stroke={gridColor} strokeWidth="1" />
                  <line x1={MAP.left} y1={y} x2={chartRight} y2={y} stroke={gridColor} strokeWidth="1" />
                  <text x={x} y={chartBottom + 22} textAnchor="middle" fill={axisColor} fontSize="11" fontWeight="600">
                    {pbLabel.toFixed(1)}
                  </text>
                  <text x={MAP.left - 14} y={y + 4} textAnchor="end" fill={axisColor} fontSize="11" fontWeight="600">
                    {roeLabel.toFixed(1)}%
                  </text>
                </g>
              );
            })}

            <line x1={medianX} y1={MAP.top} x2={medianX} y2={chartBottom} className="peer-map-median" />
            <line x1={MAP.left} y1={medianY} x2={chartRight} y2={medianY} className="peer-map-median" />
            <text x={medianX + 8} y={MAP.top + 18} className="peer-map-median-label">{copy.median}</text>

            <text x={MAP.left + 16} y={MAP.top + 24} className="peer-map-quadrant">{copy.quadrantLabels.attractive}</text>
            <text x={chartRight - 16} y={MAP.top + 24} textAnchor="end" className="peer-map-quadrant">{copy.quadrantLabels.premium}</text>
            <text x={MAP.left + 16} y={chartBottom - 16} className="peer-map-quadrant">{copy.quadrantLabels.valueTrap}</text>
            <text x={chartRight - 16} y={chartBottom - 16} textAnchor="end" className="peer-map-quadrant">{copy.quadrantLabels.avoid}</text>

            {points.map((point) => (
              <g
                key={point.ticker}
                className={`peer-map-point ${point.risk} ${point.active ? 'active' : ''} ${point.viewed ? 'viewed' : ''}`}
                role="button"
                tabIndex="0"
                aria-label={`${point.ticker}: P/B ${point.data.pb.toFixed(2)}, ROE ${point.data.roe.toFixed(2)}%, NPL ${point.data.nplRatio.toFixed(2)}%`}
                onMouseEnter={() => setHoveredTicker(point.ticker)}
                onMouseLeave={() => setHoveredTicker(null)}
                onFocus={() => setHoveredTicker(point.ticker)}
                onBlur={() => setHoveredTicker(null)}
              >
                <circle cx={point.x} cy={point.y} r={point.radius + (point.viewed ? 6 : point.active ? 4 : 0)} className="peer-map-point-halo" />
                <circle cx={point.x} cy={point.y} r={point.radius} className="peer-map-point-core" />
                <text x={point.x} y={point.y + 4} textAnchor="middle" className="peer-map-point-label">
                  {point.ticker}
                </text>
              </g>
            ))}

            <text x={(MAP.left + chartRight) / 2} y={MAP.height - 18} textAnchor="middle" className="peer-map-axis-label">
              {copy.xAxis}
            </text>
            <text x="18" y={(MAP.top + chartBottom) / 2} textAnchor="middle" transform={`rotate(-90 18 ${(MAP.top + chartBottom) / 2})`} className="peer-map-axis-label">
              {copy.yAxis}
            </text>
          </svg>
        </div>

        <aside className="peer-map-insights">
          <span className="peer-insight-label">{hoveredTicker ? copy.viewing : copy.selected}</span>
          <strong className="peer-insight-ticker">{viewedTicker}</strong>
          <p className="peer-insight-stance">{copy.quadrantLabels[selectedQuadrant]}</p>
          {hoveredTicker && hoveredTicker !== activeTicker && (
            <div className="peer-insight-chip">{copy.activeMarker}: {activeTicker}</div>
          )}
          <div className="peer-quick-take">
            <span>{copy.quickTake}</span>
            <p>{quickSummary}</p>
          </div>
          <div className="peer-insight-grid">
            <div>
              <span>{copy.roeRank}</span>
              <strong>#{rankValue('roe', viewedTicker)}/{TICKERS.length}</strong>
            </div>
            <div>
              <span>{copy.pbRank}</span>
              <strong>#{rankValue('pb', viewedTicker)}/{TICKERS.length}</strong>
            </div>
            <div>
              <span>{copy.npl}</span>
              <strong>{formatMapValue('nplRatio', selectedData.nplRatio)}</strong>
            </div>
            <div>
              <span>{copy.marketCap}</span>
              <strong>{formatMapValue('marketCap', selectedData.marketCap)}</strong>
            </div>
          </div>
          <div className="peer-delta-list">
            {deltaRows.map((row) => (
              <div key={row.label} className={`peer-delta-row ${row.tone}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className="peer-median-note">
            {copy.peerMedian}: P/B {pbMedian.toFixed(2)} | ROE {roeMedian.toFixed(2)}% | NPL {nplMedian.toFixed(2)}%
          </div>
          <div className="peer-size-note">{copy.bubble}. {copy.hoverHint}</div>
        </aside>
      </div>
    </div>
  );
}

export default function PeerComparison({ activeTicker, language, isLightTheme }) {
  const copy = COPY[language] || COPY.vi;
  const selectedTicker = TICKERS.includes(activeTicker) ? activeTicker : TICKERS[0];

  const rows = METRIC_KEYS.map((key) => {
    const values = TICKERS.map((tk) => BANK_FINANCIAL_DATA[tk]?.[key] ?? null);
    const best = bestInRow(key, values);
    return {
      key,
      label: copy.metrics[key] || key,
      values,
      formatted: values.map((v) => formatValue(key, v)),
      bestIdx: best,
    };
  });

  return (
    <div className={`peer-comparison ${isLightTheme ? 'light' : ''}`}>
      <div className="peer-header">
        <span className="peer-kicker">{copy.kicker}</span>
        <h3 className="peer-title">{copy.title}</h3>
        <p className="peer-note">{copy.note}</p>
      </div>

      <PeerPositionMap activeTicker={selectedTicker} copy={copy} isLightTheme={isLightTheme} />

      <div className="peer-table-scroll">
        <table className="peer-table">
          <thead>
            <tr>
              <th className="peer-th-metric">{copy.metric}</th>
              {TICKERS.map((tk) => (
                <th
                  key={tk}
                  className={`peer-th-bank ${tk === selectedTicker ? 'peer-th-active' : ''}`}
                >
                  {tk}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="peer-td-label">{row.label}</td>
                {TICKERS.map((tk, ci) => {
                  const isBest = ci === row.bestIdx;
                  const isActive = tk === selectedTicker;
                  return (
                    <td
                      key={tk}
                      className={`peer-td-value ${isActive ? 'peer-td-active' : ''}`}
                      style={isBest ? { color: '#0ecb81', fontWeight: 700 } : undefined}
                    >
                      {row.formatted[ci]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
