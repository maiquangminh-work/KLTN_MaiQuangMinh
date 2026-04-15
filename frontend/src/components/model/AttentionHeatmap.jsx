import { useMemo } from 'react';

/**
 * AttentionHeatmap — Hiển thị 30 trọng số attention dưới dạng heatmap màu sắc.
 * data.attention_weights: [{time, weight}, ...]
 */
export default function AttentionHeatmap({ attentionWeights, isLightTheme, language }) {
  const copy = language === 'en'
    ? { title: 'Attention Signal Map', note: 'Each cell represents the model\'s focus on that trading day. Darker = higher weight.', low: 'Low', high: 'High', dayLabel: 'Day' }
    : { title: 'Bản đồ tín hiệu Attention', note: 'Mỗi ô là mức độ tập trung của mô hình vào ngày giao dịch tương ứng. Màu đậm hơn = trọng số cao hơn.', low: 'Thấp', high: 'Cao', dayLabel: 'Ngày' };

  const cells = useMemo(() => {
    if (!attentionWeights || attentionWeights.length === 0) return [];
    const weights = attentionWeights.map((item) => Number(item.weight || 0));
    const max = Math.max(...weights);
    const min = Math.min(...weights);
    const range = max - min || 1;

    return attentionWeights.map((item, idx) => {
      const normalised = (Number(item.weight || 0) - min) / range; // 0–1
      return {
        idx,
        time: item.time,
        weight: Number(item.weight || 0),
        normalised,
      };
    });
  }, [attentionWeights]);

  if (!cells.length) return null;

  const getColor = (n, light) => {
    // Low → High: cool blue → warm yellow → hot red
    if (n < 0.33) {
      const t = n / 0.33;
      return light
        ? `rgba(59, 130, 246, ${0.2 + t * 0.5})`  // blue
        : `rgba(59, 130, 246, ${0.25 + t * 0.55})`;
    } else if (n < 0.66) {
      const t = (n - 0.33) / 0.33;
      return light
        ? `rgba(252, 213, 53, ${0.3 + t * 0.5})`  // yellow
        : `rgba(252, 213, 53, ${0.35 + t * 0.55})`;
    } else {
      const t = (n - 0.66) / 0.34;
      return light
        ? `rgba(246, 70, 93, ${0.4 + t * 0.55})`  // red
        : `rgba(246, 70, 93, ${0.45 + t * 0.5})`;
    }
  };

  return (
    <div className={`attention-heatmap-wrap ${isLightTheme ? 'light' : ''}`}>
      <div className="attention-heatmap-header">
        <span className="attention-heatmap-title">{copy.title}</span>
        <span className="attention-heatmap-note">{copy.note}</span>
      </div>

      <div className="attention-heatmap-grid">
        {cells.map((cell) => (
          <div
            key={cell.idx}
            className="attention-heatmap-cell"
            style={{ background: getColor(cell.normalised, isLightTheme) }}
            title={`${copy.dayLabel}: ${cell.time} | ${(cell.weight * 100).toFixed(2)}%`}
          >
            <span className="attention-heatmap-cell-label">
              {cell.time ? cell.time.slice(5) : cell.idx + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="attention-heatmap-legend">
        <span className="attention-legend-label">{copy.low}</span>
        <div className="attention-legend-bar">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              style={{ flex: 1, background: getColor(i / 19, isLightTheme) }}
            />
          ))}
        </div>
        <span className="attention-legend-label">{copy.high}</span>
      </div>
    </div>
  );
}
