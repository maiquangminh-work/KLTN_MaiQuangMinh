import { useMemo } from 'react';

const COPY = {
  vi: {
    predicted: 'Dự đoán',
    actual: 'Thực tế',
    up: 'Tăng',
    down: 'Giảm',
    tp: 'Đúng Tăng (TP)',
    fp: 'Sai Tăng (FP)',
    fn: 'Sai Giảm (FN)',
    tn: 'Đúng Giảm (TN)',
    precision: 'Precision',
    recall: 'Recall',
    f1: 'F1-Score',
    accuracy: 'Accuracy',
  },
  en: {
    predicted: 'Predicted',
    actual: 'Actual',
    up: 'Up',
    down: 'Down',
    tp: 'True Pos (TP)',
    fp: 'False Pos (FP)',
    fn: 'False Neg (FN)',
    tn: 'True Neg (TN)',
    precision: 'Precision',
    recall: 'Recall',
    f1: 'F1-Score',
    accuracy: 'Accuracy',
  },
};

export default function ConfusionMatrixPanel({ matrix, language, isLightTheme }) {
  const copy = COPY[language] || COPY.vi;
  const { tp, fp, fn, tn } = matrix || { tp: 0, fp: 0, fn: 0, tn: 0 };
  const total = tp + fp + fn + tn;

  const derived = useMemo(() => {
    const accuracy = total > 0 ? ((tp + tn) / total * 100) : 0;
    const precision = (tp + fp) > 0 ? (tp / (tp + fp) * 100) : 0;
    const recall = (tp + fn) > 0 ? (tp / (tp + fn) * 100) : 0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall / (precision + recall)) : 0;
    return {
      accuracy: accuracy.toFixed(1),
      precision: precision.toFixed(1),
      recall: recall.toFixed(1),
      f1: f1.toFixed(1),
    };
  }, [tp, fp, fn, tn, total]);

  const getIntensity = (val) => {
    if (total === 0) return 0;
    return val / total;
  };

  return (
    <div className={`confusion-panel ${isLightTheme ? 'light' : ''}`}>
      {/* Matrix Grid */}
      <div className="confusion-matrix">
        {/* Header */}
        <div className="cm-corner" />
        <div className="cm-header-label">{copy.actual} {copy.up}</div>
        <div className="cm-header-label">{copy.actual} {copy.down}</div>

        {/* Row 1: Predicted Up */}
        <div className="cm-row-label">{copy.predicted} {copy.up}</div>
        <div
          className="cm-cell cm-tp"
          style={{ opacity: 0.4 + getIntensity(tp) * 0.6 }}
          title={copy.tp}
        >
          <span className="cm-cell-value">{tp}</span>
          <span className="cm-cell-label">TP</span>
        </div>
        <div
          className="cm-cell cm-fp"
          style={{ opacity: 0.4 + getIntensity(fp) * 0.6 }}
          title={copy.fp}
        >
          <span className="cm-cell-value">{fp}</span>
          <span className="cm-cell-label">FP</span>
        </div>

        {/* Row 2: Predicted Down */}
        <div className="cm-row-label">{copy.predicted} {copy.down}</div>
        <div
          className="cm-cell cm-fn"
          style={{ opacity: 0.4 + getIntensity(fn) * 0.6 }}
          title={copy.fn}
        >
          <span className="cm-cell-value">{fn}</span>
          <span className="cm-cell-label">FN</span>
        </div>
        <div
          className="cm-cell cm-tn"
          style={{ opacity: 0.4 + getIntensity(tn) * 0.6 }}
          title={copy.tn}
        >
          <span className="cm-cell-value">{tn}</span>
          <span className="cm-cell-label">TN</span>
        </div>
      </div>

      {/* Derived Metrics */}
      <div className="confusion-derived">
        <div className="confusion-metric">
          <span className="confusion-metric-label">{copy.accuracy}</span>
          <span className="confusion-metric-value">{derived.accuracy}%</span>
        </div>
        <div className="confusion-metric">
          <span className="confusion-metric-label">{copy.precision}</span>
          <span className="confusion-metric-value">{derived.precision}%</span>
        </div>
        <div className="confusion-metric">
          <span className="confusion-metric-label">{copy.recall}</span>
          <span className="confusion-metric-value">{derived.recall}%</span>
        </div>
        <div className="confusion-metric">
          <span className="confusion-metric-label">{copy.f1}</span>
          <span className="confusion-metric-value">{derived.f1}%</span>
        </div>
      </div>
    </div>
  );
}
