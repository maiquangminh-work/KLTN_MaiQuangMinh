import React, { useState } from 'react';

/**
 * XaiAttentionHeatmap Component
 * Displays Explainable AI (XAI) Attention Weights with synchronized hover tooltips & plain-language explanations.
 * Styled with CSS variables compatible with MinSight Banking AI theme.
 */
export default function XaiAttentionHeatmap({
  attentionWeights = [],
  timestamps = [],
  hoveredDate = null,
  isLightTheme = false,
}) {
  const [activeHoverIndex, setActiveHoverIndex] = useState(null);

  if (!attentionWeights || attentionWeights.length === 0) {
    return (
      <div
        style={{
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #2b3139)',
          background: 'var(--bg-elevated, #161a1e)',
          color: 'var(--text-muted, #94a3b8)',
          fontSize: '12px',
          textAlign: 'center',
        }}
      >
        Chưa có dữ liệu Attention Weights cho phiên này.
      </div>
    );
  }

  const maxWeight = Math.max(...attentionWeights, 0.001);

  const getExplanation = (weight, index) => {
    const norm = weight / maxWeight;
    if (norm > 0.8) {
      return `Mức độ chú ý CỰC CAO (${(weight * 100).toFixed(1)}%): Mô hình phát hiện điểm đảo chiều then chốt kèm khối lượng giao dịch đột biến tại phiên T-${attentionWeights.length - index}.`;
    } else if (norm > 0.5) {
      return `Mức độ chú ý CAO (${(weight * 100).toFixed(1)}%): Tín hiệu vùng hỗ trợ/kháng cự quan trọng tác động mạnh tới xu hướng T+5.`;
    } else if (norm > 0.25) {
      return `Mức độ chú ý TRUNG BÌNH (${(weight * 100).toFixed(1)}%): Biến động giá duy trì trong biên độ tích lũy chuẩn.`;
    }
    return `Mức độ chú ý THẤP (${(weight * 100).toFixed(1)}%): Tín hiệu nhiễu bình thường, ít tác động tới dự báo cuối cùng.`;
  };

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '14px',
        border: '1px solid var(--border-color, #2b3139)',
        background: 'var(--bg-surface, #1e2329)',
        color: 'var(--text-primary, #eaecef)',
        marginTop: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-yellow, #fcd535)' }}>
            🧠 XAI Attention Heatmap
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary, #848e9c)' }}>
            (Trọng số giải thích mô hình)
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
          Cửa sổ 30 phiên gần nhất
        </span>
      </div>

      {/* Heatmap Bar Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '4px',
          height: '60px',
          width: '100%',
          padding: '6px',
          background: 'var(--bg-elevated, #161a1e)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #2b3139)',
        }}
      >
        {attentionWeights.map((w, idx) => {
          const heightPct = Math.max(12, (w / maxWeight) * 100);
          const isHovered = activeHoverIndex === idx || (hoveredDate && timestamps[idx] === hoveredDate);

          let barBg = 'rgba(59, 130, 246, 0.4)';
          if (w / maxWeight > 0.75) barBg = 'var(--accent-yellow, #fcd535)';
          else if (w / maxWeight > 0.4) barBg = 'var(--accent-blue, #3b82f6)';

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setActiveHoverIndex(idx)}
              onMouseLeave={() => setActiveHoverIndex(null)}
            >
              <div
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  borderRadius: '3px 3px 0 0',
                  background: barBg,
                  transition: 'all 0.2s ease',
                  opacity: isHovered ? 1 : 0.8,
                  transform: isHovered ? 'scaleY(1.1)' : 'scaleY(1)',
                  boxShadow: isHovered ? `0 0 10px ${barBg}` : 'none',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Synchronized Explanation Tooltip Area */}
      <div
        style={{
          marginTop: '12px',
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'var(--bg-elevated, #161a1e)',
          border: '1px solid var(--border-color, #2b3139)',
          fontSize: '12px',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {activeHoverIndex !== null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--text-secondary, #848e9c)',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            >
              <span>Phiên: {timestamps[activeHoverIndex] || `T-${attentionWeights.length - activeHoverIndex}`}</span>
              <span style={{ color: 'var(--accent-yellow, #fcd535)', fontWeight: '700' }}>
                Weight: {attentionWeights[activeHoverIndex].toFixed(4)}
              </span>
            </div>
            <p style={{ color: 'var(--text-primary, #eaecef)', fontWeight: '500', margin: 0 }}>
              💡 {getExplanation(attentionWeights[activeHoverIndex], activeHoverIndex)}
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', margin: 0, width: '100%', textAlign: 'center' }}>
            👆 Rê chuột qua các thanh vệt màu trên Heatmap để xem diễn giải lý do mô hình chú ý vào phiên đó.
          </p>
        )}
      </div>
    </div>
  );
}
