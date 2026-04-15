import { useEffect, useRef } from 'react';
import { createChart, HistogramSeries, LineSeries } from 'lightweight-charts';

export default function MetricsOverTimeChart({ weeklyMetrics, isLightTheme }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !weeklyMetrics || weeklyMetrics.length === 0) return;

    const bgColor = isLightTheme ? '#ffffff' : '#161a1e';
    const textColor = isLightTheme ? '#1e293b' : '#aab5c4';
    const gridColor = isLightTheme ? '#e2e8f0' : '#1e2329';

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: { background: { color: bgColor }, textColor, fontFamily: '"Inter", "Segoe UI", sans-serif', fontSize: 12 },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor, timeVisible: false, tickMarkFormatter: () => '' },
    });

    // DA% as bar chart
    const daSeries = chart.addSeries(HistogramSeries, {
      color: '#0ecb81',
      priceFormat: { type: 'custom', formatter: (v) => `${v.toFixed(1)}%` },
      title: 'DA%',
    });

    // MAPE% as line on secondary axis
    const mapeSeries = chart.addSeries(LineSeries, {
      color: '#f6465d',
      lineWidth: 2,
      priceScaleId: 'mape',
      title: 'MAPE%',
    });

    chart.priceScale('mape').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.1 },
    });

    // Convert week labels to pseudo-dates for chart rendering
    const baseDate = new Date('2025-01-06'); // Monday of week 1
    const daData = [];
    const mapeData = [];

    weeklyMetrics.forEach((wm, idx) => {
      // Create evenly spaced dates
      const d = new Date(baseDate);
      d.setDate(d.getDate() + idx * 7);
      const time = d.toISOString().split('T')[0];

      const barColor = wm.da_percent >= 60 ? '#0ecb81' : wm.da_percent >= 45 ? '#fcd535' : '#f6465d';
      daData.push({ time, value: wm.da_percent, color: barColor });
      mapeData.push({ time, value: wm.mape_percent });
    });

    daSeries.setData(daData);
    mapeSeries.setData(mapeData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [weeklyMetrics, isLightTheme]);

  if (!weeklyMetrics || weeklyMetrics.length === 0) return null;

  return (
    <div className="model-perf-chart-wrap">
      <div ref={containerRef} className="model-perf-chart-container" />
      <div className="model-perf-chart-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#0ecb81' }} />
          DA% (Directional Accuracy)
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#f6465d' }} />
          MAPE% (Mean Absolute % Error)
        </span>
      </div>
    </div>
  );
}
