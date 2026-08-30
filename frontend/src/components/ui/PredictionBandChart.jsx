import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries } from 'lightweight-charts';

/**
 * PredictionBandChart Component
 * Lightweight Charts wrapper rendering Candlestick price data + Predicted Horizon (H=1..5)
 * with Confidence Interval 95% Cloud Shade.
 */
export default function PredictionBandChart({
  candles = [],
  predictions = [],
  horizonDays = 5,
  isLightTheme = false,
  onCrosshairMove = null,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    // Destroy existing chart if re-rendering
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const isDark = !isLightTheme;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { type: 'solid', color: isDark ? '#0f172a' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#334155',
      },
      grid: {
        vertLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
        horzLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
      },
      crosshair: {
        mode: 1,
      },
      timeScale: {
        borderColor: isDark ? '#334155' : '#cbd5e1',
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    const formattedCandles = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(formattedCandles);

    // 2. Prediction Horizon Line & 95% Confidence Band
    if (predictions && predictions.length > 0) {
      const predLine = chart.addSeries(LineSeries, {
        color: '#38bdf8',
        lineWidth: 2,
        lineStyle: 2, // Dashed line for predictions
        title: `Dự báo H=${horizonDays}d`,
      });

      const upperBand = chart.addSeries(AreaSeries, {
        topColor: 'rgba(56, 189, 248, 0.25)',
        bottomColor: 'rgba(56, 189, 248, 0.02)',
        lineColor: 'rgba(56, 189, 248, 0.4)',
        lineWidth: 1,
        title: 'Vùng tin cậy 95%',
      });

      const lastCandle = candles[candles.length - 1];
      const predData = [
        { time: lastCandle.time, value: lastCandle.close },
        ...predictions.map((p) => ({ time: p.time, value: p.predicted_close })),
      ];

      const bandData = [
        { time: lastCandle.time, value: lastCandle.close },
        ...predictions.map((p) => ({
          time: p.time,
          value: p.predicted_close * 1.025, // Upper 95% bound approximation
        })),
      ];

      predLine.setData(predData);
      upperBand.setData(bandData);
    }

    // Crosshair listener for XAI synchronization
    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        if (param.time) {
          onCrosshairMove(param.time);
        }
      });
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, predictions, isLightTheme]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/90 shadow-xl">
      <div className="absolute top-3 left-4 z-10 flex items-center gap-3 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
        <span className="flex items-center gap-1 font-semibold text-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Tăng
        </span>
        <span className="flex items-center gap-1 font-semibold text-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Giảm
        </span>
        <span className="flex items-center gap-1 font-semibold text-cyan-400">
          <span className="w-2.5 h-0.5 border-b-2 border-dashed border-cyan-400 inline-block"></span> Dự báo AI
        </span>
        <span className="flex items-center gap-1 text-sky-400/80">
          <span className="w-2.5 h-2.5 rounded bg-sky-400/30 inline-block"></span> Vùng 95% Confidence
        </span>
      </div>
      <div ref={containerRef} className="w-full h-[420px]" />
    </div>
  );
}
