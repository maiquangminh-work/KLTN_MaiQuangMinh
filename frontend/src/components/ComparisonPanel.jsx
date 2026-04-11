function ComparisonPanel({
  ticker,
  comparisonData,
  comparisonLoading,
  comparisonError,
  selectedCompareModel,
  setSelectedCompareModel,
  selectedCompareMetric,
  formatMetric,
  modelLabels,
}) {
  return (
    <div style={{ paddingBottom: '50px', display: 'grid', gap: '18px' }}>
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#eaecef' }}>SO SÁNH 7 MÔ HÌNH</h2>
            <div style={{ color: '#848e9c', fontSize: '13px', marginTop: '4px' }}>
              Đối chiếu kết quả trên cùng tập dữ liệu cho mã {ticker}
            </div>
          </div>
          {comparisonData?.overview_chart_url && (
            <a
              href={comparisonData.overview_chart_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fcd535', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}
            >
              Mở biểu đồ tổng hợp ↗
            </a>
          )}
        </div>

        {comparisonLoading ? (
          <div style={{ color: '#fcd535' }}>Đang tải dữ liệu so sánh mô hình...</div>
        ) : comparisonError ? (
          <div style={{ color: '#f6465d' }}>{comparisonError}</div>
        ) : comparisonData ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                <thead>
                  <tr style={{ background: '#161a1e' }}>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #2b3139' }}>Mô hình</th>
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid #2b3139' }}>RMSE</th>
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid #2b3139' }}>MAE</th>
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid #2b3139' }}>MAPE (%)</th>
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid #2b3139' }}>R²</th>
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid #2b3139' }}>DA (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.metrics.map((item) => (
                    <tr
                      key={item.model_name}
                      onClick={() => setSelectedCompareModel(item.model_name)}
                      style={{
                        cursor: 'pointer',
                        background: item.model_name === selectedCompareModel ? 'rgba(252, 213, 53, 0.08)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '12px', borderBottom: '1px solid #2b3139', color: item.model_name === selectedCompareModel ? '#fcd535' : '#eaecef', fontWeight: 700 }}>
                        {item.model_label || modelLabels[item.model_name] || item.model_name}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #2b3139', textAlign: 'right' }}>{formatMetric(item.rmse)}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #2b3139', textAlign: 'right' }}>{formatMetric(item.mae)}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #2b3139', textAlign: 'right' }}>{formatMetric(item.mape)}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #2b3139', textAlign: 'right' }}>{formatMetric(item.r2)}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #2b3139', textAlign: 'right' }}>{formatMetric(item.da)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '18px', marginTop: '18px' }}>
              <div className="card" style={{ padding: '14px', background: '#161a1e' }}>
                <div style={{ fontSize: '12px', color: '#848e9c', marginBottom: '8px' }}>Biểu đồ dự báo của mô hình đang chọn</div>
                {selectedCompareMetric?.forecast_chart_url ? (
                  <img
                    src={selectedCompareMetric.forecast_chart_url}
                    alt={`Biểu đồ dự báo ${selectedCompareMetric.model_label}`}
                    style={{ width: '100%', borderRadius: '10px', border: '1px solid #2b3139' }}
                  />
                ) : (
                  <div style={{ color: '#848e9c' }}>Chưa có biểu đồ dự báo cho mô hình này.</div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '18px' }}>
                <div className="card" style={{ padding: '14px', background: '#161a1e' }}>
                  <div style={{ fontSize: '12px', color: '#848e9c', marginBottom: '8px' }}>Biểu đồ giá gốc của {ticker}</div>
                  {comparisonData.original_price_chart_url ? (
                    <img
                      src={comparisonData.original_price_chart_url}
                      alt={`Biểu đồ giá gốc ${ticker}`}
                      style={{ width: '100%', borderRadius: '10px', border: '1px solid #2b3139' }}
                    />
                  ) : (
                    <div style={{ color: '#848e9c' }}>Chưa có biểu đồ giá gốc.</div>
                  )}
                </div>

                <div className="card" style={{ padding: '16px 18px' }}>
                  <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '8px' }}>Mô hình đang xem</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#fcd535', marginBottom: '10px' }}>
                    {selectedCompareMetric?.model_label || 'Chưa chọn mô hình'}
                  </div>
                  {selectedCompareMetric && (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#848e9c' }}>RMSE</span><strong>{formatMetric(selectedCompareMetric.rmse)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#848e9c' }}>MAE</span><strong>{formatMetric(selectedCompareMetric.mae)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#848e9c' }}>MAPE (%)</span><strong>{formatMetric(selectedCompareMetric.mape)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#848e9c' }}>R²</span><strong>{formatMetric(selectedCompareMetric.r2)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#848e9c' }}>DA (%)</span><strong>{formatMetric(selectedCompareMetric.da)}</strong></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: '#848e9c' }}>Chưa có dữ liệu so sánh mô hình cho mã này.</div>
        )}
      </div>
    </div>
  );
}

export default ComparisonPanel;
