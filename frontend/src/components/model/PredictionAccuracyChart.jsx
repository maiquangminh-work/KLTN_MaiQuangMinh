import { useEffect, useRef } from 'react';
import { createChart, LineSeries, AreaSeries } from 'lightweight-charts';

export default function PredictionAccuracyChart({ pairs, ticker, isLightTheme }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !pairs || pairs.length === 0) return;

    const bgColor = isLightTheme ? '#ffffff' : '#161a1e';
    const textColor = isLightTheme ? '#1e293b' : '#aab5c4';
    const gridColor = isLightTheme ? '#e2e8f0' : '#1e2329';

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      layout: { background: { color: bgColor }, textColor, fontFamily: '"Inter", "Segoe UI", sans-serif', fontSize: 12 },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor, timeVisible: false },
    });

    // Actual price line (solid green)
    const actualSeries = chart.addSeries(LineSeries, {
      color: '#0ecb81',
      lineWidth: 2,
      title: 'Thực tế',
      crosshairMarkerRadius: 5,
    });

    // Predicted price line (dashed blue)
    const predictedSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: 2, // dashed
      title: 'Dự đoán',
      crosshairMarkerRadius: 5,
    });

    // Error band (area between predicted and actual)
    const errorSeries = chart.addSeries(AreaSeries, {
      lineColor: 'transparent',
      topColor: 'rgba(246, 70, 93, 0.12)',
      bottomColor: 'rgba(246, 70, 93, 0.02)',
      lineWidth: 0,
    });

    const actualData = [];
    const predictedData = [];
    const errorData = [];

    for (const pair of pairs) {
      const time = pair.next_date;
      actualData.push({ time, value: pair.actual_price });
      predictedData.push({ time, value: pair.predicted_price });
      errorData.push({
        time,
        value: Math.max(pair.actual_price, pair.predicted_price),
      });
    }

    actualSeries.setData(actualData);
    predictedSeries.setData(predictedData);
    errorSeries.setData(errorData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [pairs, isLightTheme]);

  if (!pairs || pairs.length === 0) {
    return (
      <div className="model-perf-chart-empty">
        Chưa có dữ liệu prediction pairs
      </div>
    );
  }

  return (
    <div className="model-perf-chart-wrap">
      <div ref={containerRef} className="model-perf-chart-container" />
      <div className="model-perf-chart-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#0ecb81' }} />
          Giá thực tế
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#3b82f6' }} />
          Giá dự đoán T+1
        </span>
      </div>
    </div>
  );
}
