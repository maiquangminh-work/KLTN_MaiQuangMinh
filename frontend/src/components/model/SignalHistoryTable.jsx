import { useState, useMemo } from 'react';

const COPY = {
  vi: {
    date: 'Ngày',
    signal: 'Tín hiệu',
    confidence: 'Độ tin cậy',
    predicted: 'Giá dự đoán',
    actual: 'Giá thực tế',
    error: 'Sai số',
    result: 'Kết quả',
    correct: 'Đúng',
    incorrect: 'Sai',
    pending: 'Chờ',
    winRate: 'Tỷ lệ thắng',
    totalSignals: 'Tổng tín hiệu',
    evaluated: 'Đã đánh giá',
    filterAll: 'Tất cả',
    filterBuy: 'Mua',
    filterSell: 'Bán',
    filterHold: 'Giữ',
    showMore: 'Xem thêm',
    showLess: 'Thu gọn',
  },
  en: {
    date: 'Date',
    signal: 'Signal',
    confidence: 'Confidence',
    predicted: 'Predicted',
    actual: 'Actual',
    error: 'Error',
    result: 'Result',
    correct: 'Correct',
    incorrect: 'Wrong',
    pending: 'Pending',
    winRate: 'Win Rate',
    totalSignals: 'Total Signals',
    evaluated: 'Evaluated',
    filterAll: 'All',
    filterBuy: 'Buy',
    filterSell: 'Sell',
    filterHold: 'Hold',
    showMore: 'Show more',
    showLess: 'Show less',
  },
};

const PAGE_SIZE = 20;

export default function SignalHistoryTable({ data, language, isLightTheme }) {
  const copy = COPY[language] || COPY.vi;
  const [filter, setFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    if (!data?.signals) return [];
    if (filter === 'all') return data.signals;
    return data.signals.filter((s) => {
      const rec = s.recommendation?.toLowerCase() || '';
      if (filter === 'buy') return rec.includes('khả quan') || rec.includes('mua');
      if (filter === 'sell') return rec.includes('kém') || rec.includes('bán');
      if (filter === 'hold') return rec.includes('giữ') || rec.includes('trung');
      return true;
    });
  }, [data, filter]);

  const visible = filtered.slice(0, visibleCount);

  const getSignalColor = (rec) => {
    if (!rec) return '#94a3b8';
    const lower = rec.toLowerCase();
    if (lower.includes('khả quan') && !lower.includes('kém')) return '#0ecb81';
    if (lower.includes('kém')) return '#f6465d';
    return '#fcd535';
  };

  const getResultBadge = (result) => {
    if (result === 'correct') return { text: copy.correct, cls: 'signal-badge-correct' };
    if (result === 'incorrect') return { text: copy.incorrect, cls: 'signal-badge-incorrect' };
    return { text: copy.pending, cls: 'signal-badge-pending' };
  };

  const formatPrice = (p) => {
    if (p == null) return '—';
    return `${(p * 1000).toLocaleString('vi-VN')}đ`;
  };

  if (!data) return null;

  return (
    <div className={`signal-history-wrap ${isLightTheme ? 'light' : ''}`}>
      {/* Summary bar */}
      <div className="signal-history-summary">
        <div className="signal-summary-item">
          <span className="signal-summary-label">{copy.totalSignals}</span>
          <span className="signal-summary-value">{data.total_signals}</span>
        </div>
        <div className="signal-summary-item">
          <span className="signal-summary-label">{copy.evaluated}</span>
          <span className="signal-summary-value">{data.evaluated}</span>
        </div>
        <div className="signal-summary-item accent-green">
          <span className="signal-summary-label">{copy.winRate}</span>
          <span className="signal-summary-value">{data.win_rate_percent}%</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="signal-history-filters">
        {['all', 'buy', 'sell', 'hold'].map((f) => (
          <button
            key={f}
            className={`signal-filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => { setFilter(f); setVisibleCount(PAGE_SIZE); }}
          >
            {copy[`filter${f.charAt(0).toUpperCase() + f.slice(1)}`]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="signal-history-table-scroll">
        <table className="signal-history-table">
          <thead>
            <tr>
              <th>{copy.date}</th>
              <th>{copy.signal}</th>
              <th>{copy.confidence}</th>
              <th>{copy.predicted}</th>
              <th>{copy.actual}</th>
              <th>{copy.error}</th>
              <th>{copy.result}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => {
              const badge = getResultBadge(s.result);
              return (
                <tr key={`${s.date}-${i}`} className="signal-row">
                  <td className="signal-cell-date">{s.date}</td>
                  <td>
                    <span
                      className="signal-rec-chip"
                      style={{ color: getSignalColor(s.recommendation), borderColor: getSignalColor(s.recommendation) }}
                    >
                      {s.recommendation}
                    </span>
                  </td>
                  <td>
                    <span className="signal-confidence">{s.confidence_score}</span>
                  </td>
                  <td className="signal-cell-price">{formatPrice(s.predicted_price)}</td>
                  <td className="signal-cell-price">{formatPrice(s.actual_price)}</td>
                  <td className="signal-cell-error">
                    {s.error_percent != null ? `${s.error_percent}%` : '—'}
                  </td>
                  <td>
                    <span className={`signal-badge ${badge.cls}`}>{badge.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > visibleCount && (
        <button
          className="signal-show-more"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
        >
          {copy.showMore} ({filtered.length - visibleCount} remaining)
        </button>
      )}
      {visibleCount > PAGE_SIZE && (
        <button
          className="signal-show-more"
          onClick={() => setVisibleCount(PAGE_SIZE)}
        >
          {copy.showLess}
        </button>
      )}
    </div>
  );
}
