const COPY = {
  vi: {
    loading: 'Đang đồng bộ dữ liệu thị trường...',
    current: 'Giá',
    delta: 'Biến động',
    score: 'Điểm',
    trend: '7 ngày',
    pending: 'Đồng bộ',
    pendingValue: 'Đang cập nhật',
    currency: 'VNĐ',
    recommendations: {
      positive: 'Khả quan',
      neutral: 'Trung lập',
      negative: 'Kém khả quan',
      loading: 'Đang tải',
    },
  },
  en: {
    loading: 'Syncing market data...',
    current: 'Price',
    delta: 'Delta',
    score: 'Score',
    trend: '7D',
    pending: 'Syncing',
    pendingValue: 'Updating',
    currency: 'VND',
    recommendations: {
      positive: 'Outperform',
      neutral: 'Neutral',
      negative: 'Underperform',
      loading: 'Updating',
    },
  },
};

const TAPE_FONT = '"Segoe UI Variable", "Segoe UI", Arial, sans-serif';

function Sparkline({ points = [], color }) {
  const safePoints = points.length >= 2 ? points : [0, 1];
  const width = 64;
  const height = 22;
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
        margin: '0 18px 12px',
        padding: '8px 10px',
        display: 'grid',
        gap: '6px',
        overflow: 'hidden',
        fontFamily: TAPE_FONT,
        letterSpacing: '0',
      }}
    >
      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'right' }}>
          {copy.loading}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: '8px',
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: '2px',
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item) => {
          const recommendationLabel = item.isPending
            ? copy.pending
            : copy.recommendations[item.recommendationTone] || item.recommendation;

          return (
            <button
              key={item.ticker}
              type="button"
              onClick={() => onSelectTicker(item.ticker)}
              style={{
              flex: '0 0 clamp(182px, calc((100vw - 126px) / 10), 214px)',
              minWidth: '182px',
              height: '82px',
              borderRadius: '8px',
              border: `1px solid ${item.ticker === activeTicker ? item.color : 'var(--border-color)'}`,
              background: item.ticker === activeTicker ? `${item.color}14` : 'var(--bg-elevated)',
              padding: '8px 10px 7px',
              display: 'grid',
              gridTemplateRows: '32px 31px',
              gap: '5px',
              textAlign: 'left',
              cursor: 'pointer',
              overflow: 'hidden',
              fontFamily: 'inherit',
              letterSpacing: '0',
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', minWidth: 0 }}>
              <div style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
                <strong style={{ color: 'var(--text-strong)', fontSize: '15px', fontWeight: 800, lineHeight: 1, letterSpacing: '0' }}>{item.ticker}</strong>
                <span
                  style={{
                    color: item.color,
                    fontSize: '11px',
                    fontWeight: 800,
                    lineHeight: 1.35,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '104px',
                    letterSpacing: '0',
                  }}
                  title={recommendationLabel}
                >
                  {recommendationLabel}
                </span>
              </div>
              <div style={{ display: 'grid', gap: '2px', justifyItems: 'end', minWidth: 0 }}>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontWeight: 700,
                    lineHeight: 1.05,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '104px',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0',
                  }}
                  title={item.currentPrice != null ? `${formatVND(item.currentPrice * 1000)} ${copy.currency}` : copy.pendingValue}
                >
                  {item.currentPrice != null ? `${formatVND(item.currentPrice * 1000)} ${copy.currency}` : copy.pendingValue}
                </span>
                <span style={{ color: item.deltaPercent == null ? 'var(--text-muted)' : item.deltaPercent >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '11px', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '0' }}>
                  {item.deltaPercent == null ? '—' : `${item.deltaPercent >= 0 ? '+' : ''}${formatPercent(item.deltaPercent, 2)}`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '8px', minWidth: 0 }}>
              <span
                style={{
                  color: 'var(--text-primary)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '3px 6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0',
                }}
                title={`${copy.score}: ${Math.round(item.score)}/100`}
              >
                {Math.round(item.score)}/100
              </span>
              <div style={{ display: 'grid', justifyItems: 'end', gap: '0', minWidth: '64px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '9px', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0' }}>
                  {copy.trend}
                </span>
                <Sparkline points={item.sparkline} color={item.color} />
              </div>
            </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TickerTapeBar;
