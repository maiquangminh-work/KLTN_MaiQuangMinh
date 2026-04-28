import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';

const root = createRoot(document.getElementById('root'));

const renderFatalError = (error) => {
  root.render(
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
          Bootstrap Error
        </div>
        <h1 style={{ margin: 0, fontSize: '28px', marginBottom: '12px' }}>
          Frontend không thể khởi động
        </h1>
        <p style={{ color: '#aab5c4', lineHeight: 1.7, marginBottom: '16px' }}>
          Mình đã chặn lỗi ở bước khởi tạo để tránh trang đen hoàn toàn. Hãy gửi lại nội dung lỗi này cho
          mình, mình sẽ sửa tiếp ngay.
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
          {String(error?.message || error || 'Unknown bootstrap error')}
        </div>
      </div>
    </div>,
  );
};

import('./App.jsx')
  .then((appModule) => {
    const AppComponent = appModule.default;
    root.render(
      <BrowserRouter>
        <AppErrorBoundary>
          <AppComponent />
        </AppErrorBoundary>
      </BrowserRouter>,
    );
  })
  .catch((error) => {
    console.error('Failed to bootstrap App:', error);
    renderFatalError(error);
  });
