function SkeletonBox({ height = 18, width = '100%', radius = 12 }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: radius,
        background: 'linear-gradient(90deg, rgba(148,163,184,0.12) 0%, rgba(148,163,184,0.24) 50%, rgba(148,163,184,0.12) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

function LoadingStatePanel({ variant = 'chart' }) {
  if (variant === 'news') {
    return (
      <div style={{ display: 'grid', gap: '16px', margin: '0 20px 24px' }}>
        <div className="card" style={{ padding: '22px', display: 'grid', gap: '16px' }}>
          <SkeletonBox width="140px" height={12} radius={999} />
          <SkeletonBox width="52%" height={36} />
          <SkeletonBox width="84%" height={18} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <SkeletonBox height={92} />
            <SkeletonBox height={92} />
            <SkeletonBox height={92} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '16px' }}>
          <div className="card" style={{ padding: '18px', display: 'grid', gap: '14px' }}>
            <SkeletonBox height={240} radius={18} />
            <SkeletonBox width="78%" height={26} />
            <SkeletonBox width="100%" height={16} />
            <SkeletonBox width="88%" height={16} />
          </div>
          <div className="card" style={{ padding: '18px', display: 'grid', gap: '14px' }}>
            <SkeletonBox height={160} radius={18} />
            <SkeletonBox width="84%" height={22} />
            <SkeletonBox width="100%" height={16} />
            <SkeletonBox width="86%" height={16} />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'info') {
    return (
      <div className="company-profile" style={{ display: 'grid', gap: '18px' }}>
        <div className="cp-header" style={{ minHeight: 210, display: 'grid', gap: '16px', alignItems: 'center' }}>
          <SkeletonBox width="240px" height={28} />
          <SkeletonBox width="420px" height={20} />
          <SkeletonBox width="320px" height={18} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px' }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="cp-highlight-card" style={{ display: 'grid', gap: '8px' }}>
              <SkeletonBox width="90px" height={12} />
              <SkeletonBox width="70%" height={24} />
              <SkeletonBox width="100%" height={14} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.92fr)', gap: '16px' }}>
          <div className="cp-primary-card" style={{ display: 'grid', gap: '12px' }}>
            <SkeletonBox width="180px" height={20} />
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBox key={index} height={16} />
            ))}
          </div>
          <div className="cp-primary-card" style={{ display: 'grid', gap: '12px' }}>
            <SkeletonBox width="150px" height={20} />
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBox key={index} height={18} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div className="main-grid" style={{ opacity: 1, pointerEvents: 'none' }}>
        <div className="chart-section">
          <div className="card chart-card" style={{ display: 'grid', gap: '16px' }}>
            <SkeletonBox width="160px" height={12} radius={999} />
            <SkeletonBox width="220px" height={34} />
            <SkeletonBox width="58%" height={16} />
            <SkeletonBox height={420} radius={18} />
          </div>
          <div className="card signal-card" style={{ display: 'grid', gap: '16px' }}>
            <SkeletonBox width="180px" height={12} radius={999} />
            <SkeletonBox width="240px" height={28} />
            <SkeletonBox height={180} radius={18} />
          </div>
        </div>
        <div className="side-panel-stack">
          <div className="card detail-card" style={{ padding: '18px', display: 'grid', gap: '14px' }}>
            <SkeletonBox width="120px" height={12} radius={999} />
            <SkeletonBox width="220px" height={28} />
            <SkeletonBox height={74} />
            <SkeletonBox height={74} />
            <SkeletonBox height={74} />
          </div>
          <div className="card detail-card" style={{ padding: '18px', display: 'grid', gap: '12px' }}>
            <SkeletonBox width="150px" height={12} radius={999} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              <SkeletonBox height={108} />
              <SkeletonBox height={108} />
              <SkeletonBox height={108} />
              <SkeletonBox height={108} />
            </div>
          </div>
        </div>
      </div>
      <div className="detail-stack">
        <div className="card" style={{ padding: '18px', display: 'grid', gap: '14px' }}>
          <SkeletonBox width="180px" height={12} radius={999} />
          <SkeletonBox width="260px" height={28} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
            <SkeletonBox height={76} />
            <SkeletonBox height={76} />
            <SkeletonBox height={76} />
            <SkeletonBox height={76} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoadingStatePanel;
