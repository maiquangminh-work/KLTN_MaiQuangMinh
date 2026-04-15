import { useState, useEffect, useRef } from 'react';
import { createChart, HistogramSeries } from 'lightweight-charts';

const METRICS = [
  { key: 'rmse', label: 'RMSE', lowerBetter: true },
  { key: 'mae', label: 'MAE', lowerBetter: true },
  { key: 'mape', label: 'MAPE', lowerBetter: true },
  { key: 'r2', label: 'R²', lowerBetter: false },
  { key: 'da', label: 'DA%', lowerBetter: false },
];

const MODEL_COLORS = {
  lstm_only: '#3b82f6',
  cnn_only: '#8b5cf6',
  attention_only: '#06b6d4',
  cnn_lstm: '#f59e0b',
  lstm_attention: '#10b981',
  cnn_attention: '#f97316',
  cnn_lstm_attention: '#fcd535', // Default model — yellow
};

export default function AblationBarChart({ models, language, isLightTheme }) {
  const [activeMetric, setActiveMetric] = useState('da');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !models || models.length === 0) return;

    const bgColor = isLightTheme ? '#ffffff' : '#161a1e';
    const textColor = isLightTheme ? '#1e293b' : '#aab5c4';
    const gridColor = isLightTheme ? '#e2e8f0' : '#1e2329';

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 280,
      layout: { background: { color: bgColor }, textColor, fontFamily: '"Inter", "Segoe UI", sans-serif', fontSize: 12 },
      grid: { vertLines: { color: 'transparent' }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor, visible: false },
      crosshair: { mode: 0 },
    });

    const barSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'custom',
        formatter: (v) => activeMetric === 'da' ? `${v.toFixed(1)}%` : v.toFixed(4),
      },
    });

    // Use evenly spaced time values
    const baseDate = new Date('2024-01-01');
    const sorted = [...models].sort((a, b) => {
      const m = METRICS.find((x) => x.key === activeMetric);
      return m?.lowerBetter ? a[activeMetric] - b[activeMetric] : b[activeMetric] - a[activeMetric];
    });

    const data = sorted.map((model, idx) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + idx);
      const time = d.toISOString().split('T')[0];
      const color = MODEL_COLORS[model.model_name] || '#94a3b8';
      return { time, value: model[activeMetric] ?? 0, color };
    });

    barSeries.setData(data);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [models, activeMetric, isLightTheme]);

  if (!models || models.length === 0) return null;

  return (
    <div className={`ablation-chart-wrap ${isLightTheme ? 'light' : ''}`}>
      {/* Metric selector */}
      <div className="ablation-metric-tabs">
        {METRICS.map((m) => (
          <button
            key={m.key}
            className={`ablation-metric-tab ${activeMetric === m.key ? 'active' : ''}`}
            onClick={() => setActiveMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="ablation-chart-container" />

      {/* Model legend */}
      <div className="ablation-legend">
        {models.map((model) => (
          <div key={model.model_name} className="ablation-legend-item">
            <span
              className="ablation-legend-dot"
              style={{ background: MODEL_COLORS[model.model_name] || '#94a3b8' }}
            />
            <span className={`ablation-legend-label ${model.is_default ? 'default' : ''}`}>
              {model.model_label}
              {model.is_default && <span className="ablation-default-badge">★</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
