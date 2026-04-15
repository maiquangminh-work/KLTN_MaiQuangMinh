function MarketContextPanel({
  loadingContext,
  contextError,
  marketContext,
  analysisSignalLabel,
  getPositiveScoreColor,
  getRiskScoreColor,
}) {
  const contextCards = marketContext
    ? [
        {
          label: 'Tâm lý tin tức',
          value: marketContext.news_sentiment_label,
          color: getPositiveScoreColor(marketContext.news_sentiment_score),
        },
        {
          label: 'Xung lực ngân hàng',
          value: marketContext.banking_sector_label,
          color: getPositiveScoreColor(marketContext.banking_sector_score),
        },
        {
          label: 'Áp lực vĩ mô',
          value: marketContext.macro_pressure_label,
          color: getRiskScoreColor(marketContext.macro_pressure_score),
        },
        {
          label: 'Rủi ro chính trị',
          value: marketContext.political_risk_label,
          color: getRiskScoreColor(marketContext.political_risk_score),
        },
      ]
    : [];

  const alertItems = [
    {
      label: 'Áp lực tổng thể',
      value: marketContext?.overall_market_label || 'Đang cập nhật',
      color: marketContext ? getRiskScoreColor(marketContext.overall_market_pressure) : 'var(--text-primary)',
      note: 'Dùng để đọc mức thuận lợi chung của thị trường.',
    },
    {
      label: 'Tâm lý tin tức',
      value: marketContext?.news_sentiment_label || 'Đang cập nhật',
      color: marketContext ? getPositiveScoreColor(marketContext.news_sentiment_score) : 'var(--text-primary)',
      note: 'Cho biết luồng tin gần đây đang hỗ trợ hay gây nhiễu.',
    },
    {
      label: 'Xung lực ngân hàng',
      value: marketContext?.banking_sector_label || 'Đang cập nhật',
      color: marketContext ? getPositiveScoreColor(marketContext.banking_sector_score) : 'var(--text-primary)',
      note: 'Cho biết riêng nhóm ngân hàng có đang đồng thuận hay không.',
    },
    {
      label: 'Rủi ro chính trị',
      value: marketContext?.political_risk_label || 'Đang cập nhật',
      color: marketContext ? getRiskScoreColor(marketContext.political_risk_score) : 'var(--text-primary)',
      note: 'Chỉ báo ngoại sinh, chỉ nên xem như bối cảnh tham khảo.',
    },
  ];

  return (
    <div className="detail-stack">
      <div className="detail-grid">
        <div className="card" style={{ padding: '16px 18px', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Bối cảnh thị trường để tham khảo thêm</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{analysisSignalLabel}</span>
          </div>
          {loadingContext ? (
            <div style={{ color: 'var(--accent-yellow)' }}>Đang phân tích bối cảnh thị trường...</div>
          ) : contextError ? (
            <div style={{ color: 'var(--accent-red)' }}>{contextError}</div>
          ) : marketContext ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {contextCards.map((item) => (
                  <div
                    key={item.label}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}
                  >
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{item.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Kết luận bối cảnh chung</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: getRiskScoreColor(marketContext.overall_market_pressure) }}>
                  {marketContext.overall_market_label}
                </div>
              </div>
              {Array.isArray(marketContext.top_signals) && marketContext.top_signals.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>Tín hiệu nổi bật</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {marketContext.top_signals.slice(0, 6).map((signal, index) => (
                      <span
                        key={`${signal}-${index}`}
                        style={{ padding: '6px 10px', borderRadius: '999px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-primary)' }}
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>Chưa có dữ liệu bối cảnh thị trường.</div>
          )}
        </div>

        <div className="card" style={{ padding: '16px 18px', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Tóm tắt cảnh báo nhanh</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Chỉ mở khi bạn muốn hiểu sâu hơn</span>
          </div>
          {loadingContext ? (
            <div style={{ color: 'var(--accent-yellow)' }}>Đang tổng hợp cảnh báo ngắn hạn...</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {alertItems.map((item) => (
                <div
                  key={item.label}
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.55 }}>{item.note}</div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: item.color, textAlign: 'right', lineHeight: 1.35 }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketContextPanel;
