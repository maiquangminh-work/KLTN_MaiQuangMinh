import { useEffect, useState, useMemo } from 'react';
import { useMarketData } from '../contexts/MarketDataContext';
import { useTheme } from '../contexts/ThemeContext';
import { fetchPerformanceData, fetchSignalHistory } from '../api/performance';
import { fetchAblationData } from '../api/ablation';
import PredictionAccuracyChart from '../components/model/PredictionAccuracyChart';
import MetricsOverTimeChart from '../components/model/MetricsOverTimeChart';
import ConfusionMatrixPanel from '../components/model/ConfusionMatrixPanel';
import ModelComparisonTable from '../components/model/ModelComparisonTable';
import AblationBarChart from '../components/model/AblationBarChart';
import SignalHistoryTable from '../components/model/SignalHistoryTable';

const COPY = {
  vi: {
    kicker: 'Hiệu suất mô hình AI',
    title: 'Theo dõi độ chính xác dự đoán',
    subtitle: 'So sánh giá dự đoán với thực tế, đánh giá khả năng nhận diện xu hướng và độ tin cậy từng tín hiệu.',
    summaryTitle: 'Tổng quan hiệu suất',
    totalPredictions: 'Tổng dự đoán',
    directionalAccuracy: 'Độ chính xác hướng',
    avgError: 'Sai số trung bình',
    signalHitRate: 'Tỷ lệ tín hiệu đúng',
    accuracyTitle: 'Giá dự đoán vs Thực tế',
    accuracyNote: 'Biểu đồ so sánh giá mô hình dự đoán T+1 với giá đóng cửa thực tế ngày hôm sau.',
    metricsTitle: 'Xu hướng DA% và MAPE% theo tuần',
    metricsNote: 'Theo dõi độ chính xác hướng và sai số trung bình qua từng tuần.',
    confusionTitle: 'Ma trận nhầm lẫn hướng dự đoán',
    confusionNote: 'Đánh giá khả năng nhận diện đúng chiều tăng/giảm của mô hình.',
    comparisonTitle: 'So sánh kiến trúc mô hình',
    comparisonNote: 'Bảng đánh giá 7 kiến trúc khác nhau trên cùng bộ dữ liệu.',
    signalTitle: 'Lịch sử tín hiệu giao dịch',
    signalNote: 'Toàn bộ tín hiệu đã phát và kết quả thực tế tương ứng.',
    loading: 'Đang phân tích hiệu suất mô hình...',
    error: 'Không thể tải dữ liệu hiệu suất.',
    noData: 'Chưa có đủ dữ liệu lịch sử dự đoán để phân tích.',
  },
  en: {
    kicker: 'AI Model Performance',
    title: 'Prediction Accuracy Tracker',
    subtitle: 'Compare predicted vs actual prices, evaluate trend detection and signal reliability.',
    summaryTitle: 'Performance Overview',
    totalPredictions: 'Total Predictions',
    directionalAccuracy: 'Directional Accuracy',
    avgError: 'Average Error',
    signalHitRate: 'Signal Hit Rate',
    accuracyTitle: 'Predicted vs Actual Price',
    accuracyNote: 'Chart comparing T+1 model prediction with actual closing price the next day.',
    metricsTitle: 'Weekly DA% and MAPE% Trends',
    metricsNote: 'Track directional accuracy and average error over each week.',
    confusionTitle: 'Direction Prediction Confusion Matrix',
    confusionNote: 'Evaluate the model\'s ability to correctly identify up/down movements.',
    comparisonTitle: 'Model Architecture Comparison',
    comparisonNote: 'Evaluation of 7 different architectures on the same dataset.',
    signalTitle: 'Trading Signal History',
    signalNote: 'All issued signals and their corresponding actual outcomes.',
    loading: 'Analyzing model performance...',
    error: 'Could not load performance data.',
    noData: 'Not enough prediction history to analyze.',
  },
};

export default function ModelPerformancePage() {
  const { ticker } = useMarketData();
  const { language, isLightTheme } = useTheme();
  const copy = COPY[language] || COPY.vi;

  const [perfData, setPerfData] = useState(null);
  const [signalData, setSignalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      fetchPerformanceData(ticker),
      fetchSignalHistory(ticker, 90),
    ]).then(([perfResult, signalResult]) => {
      if (cancelled) return;
      if (perfResult.status === 'fulfilled') {
        setPerfData(perfResult.value);
      } else {
        setError(copy.error);
      }
      if (signalResult.status === 'fulfilled') {
        setSignalData(signalResult.value);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [ticker]);

  const summary = perfData?.summary;

  if (loading) {
    return (
      <div className="model-perf-page">
        <div className="model-perf-loading">
          <div className="loader-spinner" />
          <p>{copy.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !perfData) {
    return (
      <div className="model-perf-page">
        <div className="model-perf-empty">
          <h2>{error || copy.noData}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={`model-perf-page ${isLightTheme ? 'light' : ''}`}>
      {/* Header */}
      <div className="model-perf-header">
        <span className="model-perf-kicker">{copy.kicker}</span>
        <h1 className="model-perf-title">{copy.title} — {ticker}</h1>
        <p className="model-perf-subtitle">{copy.subtitle}</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="model-perf-summary-grid">
          <div className="model-perf-summary-card">
            <span className="model-perf-summary-label">{copy.totalPredictions}</span>
            <span className="model-perf-summary-value">{summary.total_predictions}</span>
          </div>
          <div className="model-perf-summary-card accent-green">
            <span className="model-perf-summary-label">{copy.directionalAccuracy}</span>
            <span className="model-perf-summary-value">{summary.da_percent}%</span>
          </div>
          <div className="model-perf-summary-card accent-yellow">
            <span className="model-perf-summary-label">{copy.avgError}</span>
            <span className="model-perf-summary-value">{summary.mape_percent}%</span>
          </div>
          <div className="model-perf-summary-card accent-blue">
            <span className="model-perf-summary-label">{copy.signalHitRate}</span>
            <span className="model-perf-summary-value">{summary.hit_rate_percent}%</span>
          </div>
        </div>
      )}

      {/* Prediction Accuracy Chart */}
      <section className="model-perf-section">
        <div className="model-perf-section-header">
          <h2>{copy.accuracyTitle}</h2>
          <p>{copy.accuracyNote}</p>
        </div>
        <PredictionAccuracyChart
          pairs={perfData.prediction_pairs}
          ticker={ticker}
          isLightTheme={isLightTheme}
        />
      </section>

      {/* Weekly Metrics Chart */}
      {perfData.weekly_metrics?.length > 0 && (
        <section className="model-perf-section">
          <div className="model-perf-section-header">
            <h2>{copy.metricsTitle}</h2>
            <p>{copy.metricsNote}</p>
          </div>
          <MetricsOverTimeChart
            weeklyMetrics={perfData.weekly_metrics}
            isLightTheme={isLightTheme}
          />
        </section>
      )}

      {/* Two-column: Confusion Matrix + Model Comparison */}
      <div className="model-perf-two-col">
        <section className="model-perf-section">
          <div className="model-perf-section-header">
            <h2>{copy.confusionTitle}</h2>
            <p>{copy.confusionNote}</p>
          </div>
          <ConfusionMatrixPanel
            matrix={perfData.confusion_matrix}
            language={language}
            isLightTheme={isLightTheme}
          />
        </section>

        {perfData.ablation_comparison?.length > 0 && (
          <section className="model-perf-section">
            <div className="model-perf-section-header">
              <h2>{copy.comparisonTitle}</h2>
              <p>{copy.comparisonNote}</p>
            </div>
            <AblationBarChart
              models={perfData.ablation_comparison}
              language={language}
              isLightTheme={isLightTheme}
            />
            <div style={{ marginTop: '24px' }}>
              <ModelComparisonTable
                models={perfData.ablation_comparison}
                language={language}
                isLightTheme={isLightTheme}
              />
            </div>
          </section>
        )}
      </div>

      {/* Signal History */}
      {signalData && (
        <section className="model-perf-section">
          <div className="model-perf-section-header">
            <h2>{copy.signalTitle}</h2>
            <p>{copy.signalNote}</p>
          </div>
          <SignalHistoryTable
            data={signalData}
            language={language}
            isLightTheme={isLightTheme}
          />
        </section>
      )}
    </div>
  );
}
