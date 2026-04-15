import { useState, useMemo } from 'react';

const COPY = {
  vi: {
    model: 'Mô hình',
    rmse: 'RMSE',
    mae: 'MAE',
    mape: 'MAPE',
    r2: 'R²',
    da: 'DA%',
    default: 'Mặc định',
    best: 'Tốt nhất',
    sortBy: 'Sắp xếp theo',
  },
  en: {
    model: 'Model',
    rmse: 'RMSE',
    mae: 'MAE',
    mape: 'MAPE',
    r2: 'R²',
    da: 'DA%',
    default: 'Default',
    best: 'Best',
    sortBy: 'Sort by',
  },
};

const METRIC_KEYS = ['rmse', 'mae', 'mape', 'r2', 'da'];

export default function ModelComparisonTable({ models, language, isLightTheme }) {
  const copy = COPY[language] || COPY.vi;
  const [sortKey, setSortKey] = useState('da');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    if (!models || models.length === 0) return [];
    const arr = [...models];
    arr.sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [models, sortKey, sortAsc]);

  // Find best values per metric
  const bestValues = useMemo(() => {
    if (!models || models.length === 0) return {};
    const bv = {};
    // Lower is better for: RMSE, MAE, MAPE
    // Higher is better for: R², DA
    for (const key of METRIC_KEYS) {
      const vals = models.map((m) => m[key]).filter((v) => v != null);
      if (['r2', 'da'].includes(key)) {
        bv[key] = Math.max(...vals);
      } else {
        bv[key] = Math.min(...vals);
      }
    }
    return bv;
  }, [models]);

  const handleHeaderClick = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      // Default sort direction: lower-is-better metrics ascending, higher-is-better descending
      setSortAsc(['rmse', 'mae', 'mape'].includes(key));
    }
  };

  if (!models || models.length === 0) return null;

  return (
    <div className={`model-comparison-table-wrap ${isLightTheme ? 'light' : ''}`}>
      <div className="model-comparison-table-scroll">
        <table className="model-comparison-table">
          <thead>
            <tr>
              <th
                className="mct-header mct-model-col"
                onClick={() => handleHeaderClick('model_label')}
              >
                {copy.model}
              </th>
              {METRIC_KEYS.map((key) => (
                <th
                  key={key}
                  className={`mct-header mct-metric-col ${sortKey === key ? 'active' : ''}`}
                  onClick={() => handleHeaderClick(key)}
                >
                  {copy[key]}
                  {sortKey === key && (
                    <span className="mct-sort-arrow">{sortAsc ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((model) => (
              <tr
                key={model.model_name}
                className={`mct-row ${model.is_default ? 'mct-row-default' : ''}`}
              >
                <td className="mct-cell mct-model-col">
                  <span className="mct-model-label">{model.model_label}</span>
                  {model.is_default && (
                    <span className="mct-badge mct-badge-default">{copy.default}</span>
                  )}
                </td>
                {METRIC_KEYS.map((key) => {
                  const val = model[key];
                  const isBest = val != null && Math.abs(val - bestValues[key]) < 0.0001;
                  return (
                    <td
                      key={key}
                      className={`mct-cell mct-metric-col ${isBest ? 'mct-best' : ''}`}
                    >
                      {val != null ? (key === 'da' ? `${val.toFixed(2)}%` : val.toFixed(4)) : '—'}
                      {isBest && <span className="mct-badge mct-badge-best">{copy.best}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
