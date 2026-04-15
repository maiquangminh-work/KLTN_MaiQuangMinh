import { useMemo } from 'react';
import { BANK_FINANCIAL_DATA } from '../../utils/constants';

const COPY = {
  vi: {
    pe: 'P/E',
    pb: 'P/B',
    roe: 'ROE',
    nim: 'NIM',
    marketCap: 'Vốn hoá',
    avgVol: 'KL TB 20',
    eps: 'EPS',
    npl: 'Nợ xấu',
    unit: {
      percent: '%',
      billion: 'tỷ',
      trillion: 'nghìn tỷ',
      vnd: 'đ',
    },
  },
  en: {
    pe: 'P/E',
    pb: 'P/B',
    roe: 'ROE',
    nim: 'NIM',
    marketCap: 'Market Cap',
    avgVol: 'Avg Vol 20',
    eps: 'EPS',
    npl: 'NPL Ratio',
    unit: {
      percent: '%',
      billion: 'B',
      trillion: 'T',
      vnd: 'VND',
    },
  },
};

export default function QuickStatsBanner({ ticker, language }) {
  const copy = COPY[language] || COPY.vi;
  const fd = BANK_FINANCIAL_DATA[ticker];

  const stats = useMemo(() => {
    if (!fd) return [];

    const formatMktCap = (val) => {
      if (val >= 1000) return `${(val / 1000).toFixed(0)} ${copy.unit.trillion}`;
      return `${val.toLocaleString()} ${copy.unit.billion}`;
    };

    const formatVol = (val) => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return val.toLocaleString();
    };

    return [
      { label: copy.pe, value: fd.pe.toFixed(1), color: fd.pe < 12 ? '#0ecb81' : fd.pe > 16 ? '#f6465d' : '#fcd535' },
      { label: copy.pb, value: fd.pb.toFixed(2), color: fd.pb < 2 ? '#0ecb81' : fd.pb > 3 ? '#f6465d' : '#fcd535' },
      { label: copy.roe, value: `${fd.roe}%`, color: fd.roe >= 20 ? '#0ecb81' : fd.roe >= 15 ? '#fcd535' : '#f6465d' },
      { label: copy.nim, value: `${fd.nim}%`, color: fd.nim >= 3 ? '#0ecb81' : fd.nim >= 2.5 ? '#fcd535' : '#f6465d' },
      { label: copy.marketCap, value: formatMktCap(fd.marketCap), color: '#3b82f6' },
      { label: copy.avgVol, value: formatVol(fd.avgVolume20), color: 'var(--text-primary)' },
      { label: copy.eps, value: `${fd.eps.toLocaleString()}${copy.unit.vnd}`, color: 'var(--text-primary)' },
      { label: copy.npl, value: `${fd.nplRatio}%`, color: fd.nplRatio < 1 ? '#0ecb81' : fd.nplRatio > 1.5 ? '#f6465d' : '#fcd535' },
    ];
  }, [fd, language]);

  if (!fd) return null;

  return (
    <div className="quick-stats-banner">
      {stats.map((s) => (
        <div key={s.label} className="quick-stat-item">
          <span className="quick-stat-label">{s.label}</span>
          <span className="quick-stat-value" style={{ color: s.color }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}
