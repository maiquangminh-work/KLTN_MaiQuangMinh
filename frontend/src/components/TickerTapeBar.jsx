const COPY = {
  vi: {
    loading: 'Đang đồng bộ nhanh bảng giá...',
    current: 'Giá',
    delta: 'Biến động',
    score: 'Điểm',
    trend: '7 ngày',
    pending: 'Đang tải',
    pendingValue: 'Đang chờ dữ liệu',
  },
  en: {
    loading: 'Syncing quick market strip...',
    current: 'Price',
    delta: 'Delta',
    score: 'Score',
    trend: '7D',
    pending: 'Loading',
    pendingValue: 'Waiting for data',
  },
};

function Sparkline({ points = [], color }) {
  const safePoints = points.length >= 2 ? points : [0, 1];
  const width = 92;
  const height = 34;
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const range = max - min || 1;

  const path = safePoints
    .map((point, index) => {
      const x = (index / Math.max(safePoints.length - 1, 1)) * (width - 2) + 1;
      const y = height - (((point - min) / range) * (height - 8) + 4);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={path}
      />
    </svg>
  );
}

function TickerTapeBar({
  language,
  items,
  loading,
  activeTicker,
  onSelectTicker,
  formatVND,
  formatPercent,
}) {
  const copy = COPY[language] || COPY.vi;

  return (
    <div
      className="card"
      style={{
        margin: '0 20px 16px',
        padding: '10px 14px',
        display: 'grid',
        gap: '10px',
      }}
    >
      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'right' }}>
          {copy.loading}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '12px',
        }}
      >
        {items.map((item) => (
          <button
            key={item.ticker}
            type="button"
            onClick={() => onSelectTicker(item.ticker)}
            style={{
              width: '100%',
              borderRadius: '12px',
              border: `1px solid ${item.ticker === activeTicker ? item.color : 'var(--border-color)'}`,
              background: item.ticker === activeTicker ? `${item.color}14` : 'var(--bg-elevated)',
              padding: '10px 12px',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '12px',
              alignItems: 'center',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'grid', gap: '4px', minWidth: '70px' }}>
              <strong style={{ color: 'var(--text-strong)', fontSize: '17px', lineHeight: 1.1 }}>{item.ticker}</strong>
              <span style={{ color: item.color, fontSize: '12px', fontWeight: 700 }}>
                {item.isPending ? copy.pending : item.recommendation}
              </span>
            </div>

            <div style={{ display: 'grid', gap: '5px', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>{copy.current}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                  {item.currentPrice != null ? `${formatVND(item.currentPrice * 1000)} VNĐ` : copy.pendingValue}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>{copy.delta}</span>
                <span style={{ color: item.deltaPercent == null ? 'var(--text-muted)' : item.deltaPercent >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                  {item.deltaPercent == null ? '—' : `${item.deltaPercent >= 0 ? '+' : ''}${formatPercent(item.deltaPercent, 2)}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>{copy.score}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{Math.round(item.score)}/100</span>
              </div>
            </div>

            <div style={{ display: 'grid', justifyItems: 'end', gap: '4px', minWidth: '92px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {copy.trend}
              </span>
              <Sparkline points={item.sparkline} color={item.color} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default TickerTapeBar;
