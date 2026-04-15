import { useMemo } from 'react';
import { BANK_FINANCIAL_DATA } from '../../utils/constants';

const TICKERS = ['VCB', 'BID', 'CTG'];
const TICKER_COLORS = { VCB: '#fcd535', BID: '#3b82f6', CTG: '#0ecb81' };

const COPY = {
  vi: {
    kicker: 'So s\u00e1nh ng\u00e2n h\u00e0ng',
    title: 'Peer Comparison',
    note: 'So s\u00e1nh c\u00e1c ch\u1ec9 s\u1ed1 t\u00e0i ch\u00ednh gi\u1eefa 3 ng\u00e2n h\u00e0ng qu\u1ed1c doanh l\u1edbn nh\u1ea5t.',
    metric: 'Ch\u1ec9 s\u1ed1',
    radarTitle: 'Bi\u1ec3u \u0111\u1ed3 Radar',
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
    radarLabels: { roe: 'ROE', nim: 'NIM', peInv: '1/PE', car: 'CAR', loanGrowth: 'Loan Gr.' },
  },
  en: {
    kicker: 'Bank Comparison',
    title: 'Peer Comparison',
    note: 'Compare key financial metrics across the top 3 state-owned banks.',
    metric: 'Metric',
    radarTitle: 'Radar Chart',
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
    radarLabels: { roe: 'ROE', nim: 'NIM', peInv: '1/PE', car: 'CAR', loanGrowth: 'Loan Gr.' },
  },
};

/* "Lower is better" metrics — everything else is "higher is better" */
const LOWER_IS_BETTER = new Set(['pe', 'pb', 'nplRatio', 'costToIncome']);

const METRIC_KEYS = [
  'pe', 'pb', 'roe', 'roa', 'nim', 'eps',
  'marketCap', 'totalAssets', 'nplRatio', 'carRatio', 'costToIncome', 'loanGrowth',
];

function formatValue(key, val) {
  if (key === 'marketCap' || key === 'totalAssets') {
    return val >= 1000 ? `${(val / 1000).toFixed(0)}` : val.toLocaleString();
  }
  if (key === 'eps') return val.toLocaleString();
  if (Number.isFinite(val)) return val.toFixed(2);
  return String(val);
}

function bestInRow(key, values) {
  const lower = LOWER_IS_BETTER.has(key);
  let bestIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (lower ? values[i] < values[bestIdx] : values[i] > values[bestIdx]) bestIdx = i;
  }
  return bestIdx;
}

/* ── Pentagon radar helpers ── */
const RADAR_CX = 140;
const RADAR_CY = 140;
const RADAR_R = 105;
const RADAR_AXES = 5;

function polarToXY(angleDeg, radius) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [RADAR_CX + radius * Math.cos(rad), RADAR_CY + radius * Math.sin(rad)];
}

function pentagonPoints(radius) {
  return Array.from({ length: RADAR_AXES }, (_, i) => {
    const angle = (360 / RADAR_AXES) * i;
    return polarToXY(angle, radius);
  });
}

function pointsToStr(pts) {
  return pts.map(([x, y]) => `${x},${y}`).join(' ');
}

function RadarChart({ data, labels, isLightTheme }) {
  const gridColor = isLightTheme ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';
  const textColor = isLightTheme ? '#506273' : '#848e9c';
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const axisKeys = Object.keys(labels);

  const axisAngle = (i) => (360 / RADAR_AXES) * i;

  return (
    <svg
      className="peer-radar-svg"
      viewBox="0 0 280 280"
      width="280"
      height="280"
      style={{ display: 'block', margin: '0 auto' }}
    >
      {/* grid rings */}
      {gridLevels.map((lv) => (
        <polygon
          key={lv}
          points={pointsToStr(pentagonPoints(RADAR_R * lv))}
          fill="none"
          stroke={gridColor}
          strokeWidth="1"
        />
      ))}

      {/* axis lines */}
      {axisKeys.map((_, i) => {
        const [ex, ey] = polarToXY(axisAngle(i), RADAR_R);
        return (
          <line key={i} x1={RADAR_CX} y1={RADAR_CY} x2={ex} y2={ey} stroke={gridColor} strokeWidth="1" />
        );
      })}

      {/* data polygons */}
      {TICKERS.map((tk) => {
        const pts = axisKeys.map((key, i) => {
          const val = (data[tk]?.[key] ?? 0) / 100;
          return polarToXY(axisAngle(i), RADAR_R * Math.min(val, 1));
        });
        return (
          <polygon
            key={tk}
            points={pointsToStr(pts)}
            fill={TICKER_COLORS[tk]}
            fillOpacity="0.12"
            stroke={TICKER_COLORS[tk]}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        );
      })}

      {/* data points */}
      {TICKERS.map((tk) =>
        axisKeys.map((key, i) => {
          const val = (data[tk]?.[key] ?? 0) / 100;
          const [px, py] = polarToXY(axisAngle(i), RADAR_R * Math.min(val, 1));
          return (
            <circle key={`${tk}-${i}`} cx={px} cy={py} r="3" fill={TICKER_COLORS[tk]} />
          );
        }),
      )}

      {/* axis labels */}
      {axisKeys.map((key, i) => {
        const [lx, ly] = polarToXY(axisAngle(i), RADAR_R + 18);
        return (
          <text
            key={key}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fill={textColor}
            fontSize="11"
            fontWeight="600"
          >
            {labels[key]}
          </text>
        );
      })}
    </svg>
  );
}

export default function PeerComparison({ activeTicker, language, isLightTheme }) {
  const copy = COPY[language] || COPY.vi;

  const rows = useMemo(() => {
    return METRIC_KEYS.map((key) => {
      const values = TICKERS.map((tk) => BANK_FINANCIAL_DATA[tk]?.[key] ?? 0);
      const best = bestInRow(key, values);
      return {
        key,
        label: copy.metrics[key] || key,
        values,
        formatted: values.map((v) => formatValue(key, v)),
        bestIdx: best,
      };
    });
  }, [language]);

  const radarData = useMemo(() => {
    /* Normalise each metric to 0-100 across the three banks */
    const raw = {};
    const radarKeys = ['roe', 'nim', 'peInv', 'car', 'loanGrowth'];

    TICKERS.forEach((tk) => {
      const d = BANK_FINANCIAL_DATA[tk];
      raw[tk] = {
        roe: d.roe,
        nim: d.nim,
        peInv: 1 / d.pe, /* invert P/E — lower P/E is better */
        car: d.carRatio,
        loanGrowth: d.loanGrowth,
      };
    });

    /* find per-key min/max across banks */
    const mins = {};
    const maxs = {};
    radarKeys.forEach((k) => {
      const vals = TICKERS.map((tk) => raw[tk][k]);
      mins[k] = Math.min(...vals);
      maxs[k] = Math.max(...vals);
    });

    const normalised = {};
    TICKERS.forEach((tk) => {
      normalised[tk] = {};
      radarKeys.forEach((k) => {
        const range = maxs[k] - mins[k] || 1;
        normalised[tk][k] = ((raw[tk][k] - mins[k]) / range) * 70 + 30; /* scale 30-100 so shapes are visible */
      });
    });

    return normalised;
  }, []);

  return (
    <div className={`peer-comparison ${isLightTheme ? 'light' : ''}`}>
      {/* Header */}
      <div className="peer-header">
        <span className="peer-kicker">{copy.kicker}</span>
        <h3 className="peer-title">{copy.title}</h3>
        <p className="peer-note">{copy.note}</p>
      </div>

      {/* Radar chart + legend */}
      <div className="peer-radar-section">
        <h4 className="peer-radar-heading">{copy.radarTitle}</h4>
        <RadarChart data={radarData} labels={copy.radarLabels} isLightTheme={isLightTheme} />
        <div className="peer-radar-legend">
          {TICKERS.map((tk) => (
            <span key={tk} className="peer-radar-legend-item">
              <span className="peer-radar-legend-dot" style={{ background: TICKER_COLORS[tk] }} />
              {tk}
            </span>
          ))}
        </div>
      </div>

      {/* Comparison table */}
      <div className="peer-table-scroll">
        <table className="peer-table">
          <thead>
            <tr>
              <th className="peer-th-metric">{copy.metric}</th>
              {TICKERS.map((tk) => (
                <th
                  key={tk}
                  className={`peer-th-bank ${tk === activeTicker ? 'peer-th-active' : ''}`}
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
                  const isActive = tk === activeTicker;
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
