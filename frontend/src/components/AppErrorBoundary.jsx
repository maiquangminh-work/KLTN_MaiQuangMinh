import React from 'react';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#0b0e11',
            color: '#eaecef',
            fontFamily: '"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", "Inter", "Noto Sans", Arial, sans-serif',
          }}
        >
          <div
            style={{
              width: 'min(760px, 100%)',
              background: '#161a1e',
              border: '1px solid #2b3139',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22)',
            }}
          >
            <div
              style={{
                color: '#fcd535',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}
            >
              Frontend Error
            </div>
            <h1 style={{ margin: 0, fontSize: '28px', marginBottom: '12px' }}>
              Website gặp lỗi khi render giao diện
            </h1>
            <p style={{ color: '#aab5c4', lineHeight: 1.7, marginBottom: '16px' }}>
              Mình đã chặn lỗi để trang không còn đen hoàn toàn nữa. Phần dưới là thông báo kỹ thuật hiện tại để tiếp tục sửa nhanh.
            </p>
            <div
              style={{
                background: '#0f1318',
                border: '1px solid #2b3139',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#f8fafc',
                fontFamily: 'Consolas, monospace',
                fontSize: '13px',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {String(this.state.error?.message || this.state.error || 'Unknown render error')}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
