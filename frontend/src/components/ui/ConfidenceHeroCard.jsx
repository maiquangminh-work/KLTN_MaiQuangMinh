import React from 'react';
import { formatPercent, formatVND } from '../../utils/formatting';

/**
 * ConfidenceHeroCard Component
 * Uses standard CSS variables and inline styles for maximum compatibility with the app theme.
 */
export default function ConfidenceHeroCard({
  ticker,
  signal = 'NEUTRAL',
  confidence = 0,
  predictedReturn = 0,
  currentPrice = 0,
  horizonDays = 5,
  isLightTheme = false,
}) {
  const isBuy = signal.toUpperCase().includes('BUY') || signal.toUpperCase().includes('LONG');
  const isSell = signal.toUpperCase().includes('SELL') || signal.toUpperCase().includes('SHORT');

  const badgeColor = isBuy
    ? 'var(--accent-green, #0ecb81)'
    : isSell
    ? 'var(--accent-red, #f6465d)'
    : 'var(--accent-yellow, #fcd535)';

  const badgeBg = isBuy
    ? 'rgba(14, 203, 129, 0.15)'
    : isSell
    ? 'rgba(246, 70, 93, 0.15)'
    : 'rgba(252, 213, 53, 0.15)';

  const badgeText = isBuy
    ? 'TÍN HIỆU TĂNG (LONG)'
    : isSell
    ? 'TÍN HIỆU GIẢM (SHORT)'
    : 'NẰM NGOÀI (NO TRADE)';

  return (
    <div
      style={{
        background: isLightTheme ? '#ffffff' : 'var(--bg-surface, #1e2329)',
        border: '1px solid var(--border-color, #2b3139)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-main, 0 14px 32px rgba(0,0,0,0.18))',
        color: 'var(--text-primary, #eaecef)',
      }}
    >
      {/* Risk Disclaimer Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(252, 213, 53, 0.08)',
          border: '1px solid rgba(252, 213, 53, 0.25)',
          color: 'var(--accent-yellow, #fcd535)',
          fontSize: '12px',
          fontWeight: '500',
          marginBottom: '16px',
          lineHeight: '1.4',
        }}
      >
        <span style={{ fontSize: '15px' }}>⚠️</span>
        <span>
          <strong>Miễn trừ trách nhiệm:</strong> Tín hiệu AI mang tính chất hỗ trợ phân tích định lượng (Quant AI), không phải lời khuyên đầu tư tài chính. Quản trị rủi ro cá nhân là ưu tiên hàng đầu.
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          alignItems: 'center',
        }}
      >
        {/* Metric 1: Signal Badge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary, #848e9c)', fontWeight: '700' }}>
            Tín Hiệu AI ({ticker})
          </span>
          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                background: badgeBg,
                color: badgeColor,
                border: `1px solid ${badgeColor}`,
                boxShadow: `0 0 12px ${badgeBg}`,
              }}
            >
              {badgeText}
            </span>
          </div>
        </div>

        {/* Metric 2: Hero Confidence % */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            borderLeft: '1px solid var(--border-color, #2b3139)',
            borderRight: '1px solid var(--border-color, #2b3139)',
            padding: '0 20px',
          }}
        >
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary, #848e9c)', fontWeight: '700' }}>
            Độ Tin Cậy Mô Hình (Confidence Gate)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '32px',
                fontWeight: '900',
                fontFamily: 'monospace',
                color: 'var(--accent-yellow, #fcd535)',
                lineHeight: '1',
              }}
            >
              {(confidence * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
              (Ngưỡng lọc &gt; 60%)
            </span>
          </div>
        </div>

        {/* Metric 3: Horizon Outlook */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary, #848e9c)', fontWeight: '700' }}>
            Kỳ Vọng T+{horizonDays} (Horizon Outlook)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '28px',
                fontWeight: '900',
                fontFamily: 'monospace',
                color: predictedReturn >= 0 ? 'var(--accent-green, #0ecb81)' : 'var(--accent-red, #f6465d)',
                lineHeight: '1',
              }}
            >
              {predictedReturn >= 0 ? '+' : ''}{(predictedReturn * 100).toFixed(2)}%
            </span>
            {currentPrice > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                Target: {formatVND(currentPrice * (1 + predictedReturn))}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
