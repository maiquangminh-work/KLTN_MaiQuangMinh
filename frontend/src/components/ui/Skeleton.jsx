/**
 * Skeleton — Loading placeholder component.
 * Usage: <Skeleton width="100%" height={20} />
 *        <Skeleton variant="circle" size={40} />
 *        <Skeleton variant="card" />
 */
export default function Skeleton({ width, height, variant = 'rect', size, className = '' }) {
  if (variant === 'circle') {
    return (
      <div
        className={`skeleton skeleton-circle ${className}`}
        style={{ width: size ?? 40, height: size ?? 40 }}
      />
    );
  }
  if (variant === 'card') {
    return (
      <div className={`skeleton-card ${className}`}>
        <div className="skeleton skeleton-line" style={{ width: '60%', height: 14, marginBottom: 10 }} />
        <div className="skeleton skeleton-line" style={{ width: '100%', height: 10, marginBottom: 6 }} />
        <div className="skeleton skeleton-line" style={{ width: '80%', height: 10, marginBottom: 6 }} />
        <div className="skeleton skeleton-line" style={{ width: '90%', height: 10 }} />
      </div>
    );
  }
  return (
    <div
      className={`skeleton skeleton-rect ${className}`}
      style={{ width: width ?? '100%', height: height ?? 16 }}
    />
  );
}

/** SkeletonChart — placeholder for chart area */
export function SkeletonChart({ height = 400 }) {
  return (
    <div className="skeleton-chart-wrap" style={{ height }}>
      <div className="skeleton skeleton-rect" style={{ width: '100%', height: '100%', borderRadius: 8 }} />
      <div className="skeleton-chart-lines">
        {[70, 45, 60, 50, 80, 40, 65].map((h, i) => (
          <div key={i} className="skeleton-chart-bar" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/** SkeletonNewsCard — placeholder for news cards */
export function SkeletonNewsCard() {
  return (
    <div className="skeleton-news-card">
      <div className="skeleton skeleton-rect" style={{ width: '100%', height: 140, borderRadius: 8, marginBottom: 12 }} />
      <div className="skeleton skeleton-line" style={{ width: '30%', height: 10, marginBottom: 8 }} />
      <div className="skeleton skeleton-line" style={{ width: '100%', height: 14, marginBottom: 6 }} />
      <div className="skeleton skeleton-line" style={{ width: '85%', height: 14, marginBottom: 12 }} />
      <div className="skeleton skeleton-line" style={{ width: '60%', height: 10 }} />
    </div>
  );
}

/** SkeletonTable — placeholder for data tables */
export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="skeleton-table-wrap">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-table-row">
          <div className="skeleton skeleton-line" style={{ width: '12%', height: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: '22%', height: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: '15%', height: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: '15%', height: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: '15%', height: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: '10%', height: 12 }} />
        </div>
      ))}
    </div>
  );
}
