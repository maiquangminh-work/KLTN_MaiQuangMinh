function MarketContextSection({
  loadingContext,
  contextError,
  marketContext,
  analysisSignalLabel,
  loadingConfidenceHistory,
  confidenceHistory,
  getPositiveScoreColor,
  getRiskScoreColor,
  getConfidenceColor,
  displayTableData,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  availableMonths,
  availableYears,
  formatVND,
}) {
  return (
    <div className="detail-stack">
      <div className="detail-grid">
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>LỚP BỐI CẢNH THỊ TRƯỜNG</h3>
            <span style={{ fontSize: '12px', color: '#848e9c' }}>{analysisSignalLabel}</span>
          </div>
          {loadingContext ? (
            <div style={{ color: '#fcd535' }}>Đang phân tích lớp bối cảnh thị trường...</div>
          ) : contextError ? (
            <div style={{ color: '#f6465d' }}>{contextError}</div>
          ) : marketContext ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ color: '#848e9c', fontSize: '12px' }}>Tâm lý tin tức</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: getPositiveScoreColor(marketContext.news_sentiment_score) }}>{marketContext.news_sentiment_label}</div>
                </div>
                <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ color: '#848e9c', fontSize: '12px' }}>Xung lực ngân hàng</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: getPositiveScoreColor(marketContext.banking_sector_score) }}>{marketContext.banking_sector_label}</div>
                </div>
                <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ color: '#848e9c', fontSize: '12px' }}>Áp lực vĩ mô</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: getRiskScoreColor(marketContext.macro_pressure_score) }}>{marketContext.macro_pressure_label}</div>
                </div>
                <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ color: '#848e9c', fontSize: '12px' }}>Rủi ro chính trị</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: getRiskScoreColor(marketContext.political_risk_score) }}>{marketContext.political_risk_label}</div>
                </div>
              </div>
              <div style={{ marginTop: '12px', background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '4px' }}>Áp lực tổng thể</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: getRiskScoreColor(marketContext.overall_market_pressure) }}>{marketContext.overall_market_label}</div>
              </div>
              {Array.isArray(marketContext.top_signals) && marketContext.top_signals.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '8px' }}>Tín hiệu nổi bật</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {marketContext.top_signals.slice(0, 6).map((signal, index) => (
                      <span key={`${signal}-${index}`} style={{ padding: '6px 10px', borderRadius: '999px', background: '#161a1e', border: '1px solid #2b3139', fontSize: '12px', color: '#eaecef' }}>
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#848e9c' }}>Chưa có dữ liệu bối cảnh thị trường.</div>
          )}
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>LỊCH SỬ ĐỘ TỰ TIN GẦN NHẤT</h3>
            <span style={{ fontSize: '12px', color: '#848e9c' }}>Dùng cho demo và theo dõi nội bộ</span>
          </div>
          {loadingConfidenceHistory ? (
            <div style={{ color: '#fcd535' }}>Đang tải lịch sử độ tự tin...</div>
          ) : confidenceHistory.length === 0 ? (
            <div style={{ color: '#848e9c' }}>Chưa có lịch sử độ tự tin cho mã này.</div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {confidenceHistory.slice(0, 5).map((item, index) => (
                <div key={`${item.captured_at}-${index}`} style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '10px 12px', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#848e9c' }}>{item.captured_at}</div>
                    <div style={{ fontWeight: 700, color: item.recommendation === 'MUA VÀO' ? '#0ecb81' : item.recommendation === 'BÁN RA' ? '#f6465d' : '#fcd535' }}>{item.recommendation}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#848e9c' }}>Độ tự tin</div>
                    <div style={{ fontWeight: 700, color: getConfidenceColor(item.recommendation_confidence_score || 0) }}>
                      {Math.round(item.recommendation_confidence_score || 0)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#848e9c' }}>Bối cảnh</div>
                    <div style={{ fontWeight: 700, color: getRiskScoreColor(item.overall_market_pressure || 50) }}>{item.overall_market_label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card order-book detail-card" style={{ padding: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2b3139', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>LỊCH SỬ THỊ TRƯỜNG</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="filter-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              <option value="All">Tất cả tháng</option>
              {availableMonths.map((month) => <option key={month} value={month}>Tháng {month}</option>)}
            </select>
            <select className="filter-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="All">Tất cả năm</option>
              {availableYears.map((year) => <option key={year} value={year}>Năm {year}</option>)}
            </select>
          </div>
        </div>

        <div className="order-book-scroll" style={{ maxHeight: '350px' }}>
          {displayTableData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#848e9c' }}>Không có dữ liệu giao dịch trong thời gian này.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Ngày</th><th>Mở</th><th>Cao</th><th>Thấp</th><th>Đóng</th><th>Vol (K)</th><th>RSI</th></tr>
              </thead>
              <tbody>
                {displayTableData.slice(0, 100).map((row, index) => {
                  const dateParts = row.time.split('-');
                  const displayDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                  return (
                    <tr key={index}>
                      <td style={{ color: '#848e9c' }}>{displayDate}</td>
                      <td>{formatVND(row.open)}</td>
                      <td>{formatVND(row.high)}</td>
                      <td>{formatVND(row.low)}</td>
                      <td className={row.colorClass} style={{ fontWeight: 'bold' }}>{formatVND(row.close)}</td>
                      <td>{formatVND(row.volume / 1000)}</td>
                      <td style={{ color: row.rsi_14 > 70 ? '#f6465d' : row.rsi_14 < 30 ? '#0ecb81' : '#eaecef' }}>{Number(row.rsi_14).toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketContextSection;
