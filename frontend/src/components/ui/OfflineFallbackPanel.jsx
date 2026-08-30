import React from 'react';

/**
 * OfflineFallbackPanel Component
 * Graceful Fallback UI when API calls fail or server connection is interrupted.
 * Styled with standard CSS variables.
 */
export default function OfflineFallbackPanel({
  ticker,
  errorMessage = 'Không thể kết nối tới máy chủ dữ liệu thời gian thực.',
  onRetry,
  lastUpdatedTime = null,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        borderRadius: '16px',
        border: '1px solid rgba(246, 70, 93, 0.3)',
        background: 'var(--bg-surface, #1e2329)',
        boxShadow: 'var(--shadow-main, 0 14px 32px rgba(0,0,0,0.18))',
        margin: '24px auto',
        maxWidth: '560px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(246, 70, 93, 0.1)',
          border: '1px solid rgba(246, 70, 93, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          marginBottom: '16px',
        }}
      >
        📡
      </div>

      <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-strong, #f3f5f7)', marginBottom: '8px' }}>
        Gián Đoạn Kết Nối Dữ Liệu ({ticker})
      </h3>

      <p style={{ fontSize: '13px', color: 'var(--text-secondary, #848e9c)', marginBottom: '16px', maxWidth: '420px', lineHeight: '1.5' }}>
        {errorMessage}
      </p>

      {lastUpdatedTime && (
        <div
          style={{
            marginBottom: '20px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'var(--bg-elevated, #161a1e)',
            fontSize: '12px',
            color: 'var(--text-primary, #eaecef)',
            fontFamily: 'monospace',
          }}
        >
          Dữ liệu lưu gần nhất: {lastUpdatedTime}
        </div>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            background: 'var(--accent-blue, #3b82f6)',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '13px',
            border: '0',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s ease',
          }}
        >
          🔄 Thử kết nối lại
        </button>
      )}
    </div>
  );
}
