import { BANK_FINANCIAL_DATA } from '../../utils/constants';

const COPY = {
  vi: {
    kicker: 'Chỉ số tài chính nổi bật',
    title: 'Financial Highlights',
    note: 'Số liệu từ báo cáo tài chính hợp nhất — chỉ mang tính tham khảo.',
    pe: 'P/E',
    pb: 'P/B',
    roe: 'ROE',
    roa: 'ROA',
    nim: 'NIM',
    eps: 'EPS',
    marketCap: 'Vốn hoá',
    npl: 'Tỷ lệ nợ xấu',
    car: 'Tỷ lệ an toàn vốn',
    costToIncome: 'Cost-to-Income',
    loanGrowth: 'Tăng trưởng TD',
    dividendYield: 'Cổ tức',
    totalAssets: 'Tổng tài sản',
    trendTitle: 'Xu hướng qua các năm',
    year: 'Năm',
    unit: { billion: 'tỷ', trillion: 'nghìn tỷ', vnd: 'đ' },
  },
  en: {
    kicker: 'Key Financial Metrics',
    title: 'Financial Highlights',
    note: 'Data from audited consolidated financial statements — for reference only.',
    pe: 'P/E',
    pb: 'P/B',
    roe: 'ROE',
    roa: 'ROA',
    nim: 'NIM',
    eps: 'EPS',
    marketCap: 'Market Cap',
    npl: 'NPL Ratio',
    car: 'CAR (Capital)',
    costToIncome: 'Cost-to-Income',
    loanGrowth: 'Loan Growth',
    dividendYield: 'Dividend Yield',
    totalAssets: 'Total Assets',
    trendTitle: 'Yearly Trend',
    year: 'Year',
    unit: { billion: 'B', trillion: 'T', vnd: 'VND' },
  },
};

function MiniSparkline({ values, color = '#0ecb81', width = 80, height = 28 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function FinancialHighlights({ ticker, language, isLightTheme }) {
  const copy = COPY[language] || COPY.vi;
  const fd = BANK_FINANCIAL_DATA[ticker];

  const accentColors = {
    green: '#0ecb81',
    red: '#f6465d',
    yellow: '#fcd535',
    blue: '#3b82f6',
  };

  if (!fd) return null;

  const fmt = (v, suffix) => `${v.toLocaleString()}${suffix}`;
  const fmtCap = (v) => v >= 1000 ? `${(v / 1000).toFixed(0)} ${copy.unit.trillion}` : `${v} ${copy.unit.billion}`;
  const metrics = [
    { label: copy.pe, value: fd.pe.toFixed(1), spark: null, accent: fd.pe < 12 ? 'green' : fd.pe > 16 ? 'red' : 'yellow' },
    { label: copy.pb, value: fd.pb.toFixed(2), spark: null, accent: fd.pb < 2 ? 'green' : fd.pb > 3 ? 'red' : 'yellow' },
    { label: copy.roe, value: fmt(fd.roe, '%'), spark: fd.yearlyMetrics?.map((m) => m.roe), accent: 'green' },
    { label: copy.roa, value: fmt(fd.roa, '%'), spark: fd.yearlyMetrics?.map((m) => m.roa), accent: 'green' },
    { label: copy.nim, value: fmt(fd.nim, '%'), spark: fd.yearlyMetrics?.map((m) => m.nim), accent: 'green' },
    { label: copy.eps, value: `${fd.eps.toLocaleString()}${copy.unit.vnd}`, spark: null, accent: 'blue' },
    { label: copy.marketCap, value: fmtCap(fd.marketCap), spark: null, accent: 'blue' },
    { label: copy.totalAssets, value: fmtCap(fd.totalAssets), spark: null, accent: 'blue' },
    { label: copy.npl, value: fmt(fd.nplRatio, '%'), spark: fd.yearlyMetrics?.map((m) => m.npl), accent: fd.nplRatio < 1 ? 'green' : 'red' },
    { label: copy.car, value: fmt(fd.carRatio, '%'), spark: null, accent: fd.carRatio >= 10 ? 'green' : 'red' },
    { label: copy.loanGrowth, value: fmt(fd.loanGrowth, '%'), spark: null, accent: 'green' },
    { label: copy.costToIncome, value: fmt(fd.costToIncome, '%'), spark: null, accent: fd.costToIncome < 35 ? 'green' : 'yellow' },
  ];

  return (
    <div className={`fin-highlights ${isLightTheme ? 'light' : ''}`}>
      <div className="fin-highlights-header">
        <span className="fin-highlights-kicker">{copy.kicker}</span>
        <h3 className="fin-highlights-title">{copy.title}</h3>
        <p className="fin-highlights-note">{copy.note}</p>
      </div>

      <div className="fin-highlights-grid">
        {metrics.map((m) => (
          <div key={m.label} className="fin-metric-card">
            <span className="fin-metric-label">{m.label}</span>
            <span className="fin-metric-value" style={{ color: accentColors[m.accent] }}>
              {m.value}
            </span>
            {m.spark && (
              <div className="fin-metric-spark">
                <MiniSparkline values={m.spark} color={accentColors[m.accent]} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Yearly trend table */}
      {fd.yearlyMetrics?.length > 0 && (
        <div className="fin-trend-section">
          <h4 className="fin-trend-title">{copy.trendTitle}</h4>
          <div className="fin-trend-table-scroll">
            <table className="fin-trend-table">
              <thead>
                <tr>
                  <th>{copy.year}</th>
                  <th>{copy.roe}</th>
                  <th>{copy.roa}</th>
                  <th>{copy.nim}</th>
                  <th>{copy.npl}</th>
                </tr>
              </thead>
              <tbody>
                {fd.yearlyMetrics.map((m) => (
                  <tr key={m.year}>
                    <td className="fin-trend-year">{m.year}</td>
                    <td style={{ color: '#0ecb81' }}>{m.roe}%</td>
                    <td>{m.roa}%</td>
                    <td>{m.nim}%</td>
                    <td style={{ color: m.npl > 1.2 ? '#f6465d' : '#0ecb81' }}>{m.npl}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
