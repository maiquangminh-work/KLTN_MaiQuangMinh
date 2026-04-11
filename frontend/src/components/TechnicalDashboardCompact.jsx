function TechnicalDashboardCompact({
  latestDataTime,
  currentPrice,
  predictedPrice,
  priceDiff,
  priceDiffPercent,
  thresholdValue,
  formatVND,
  formatPercent,
  recColor,
  recommendation,
  recommendationNote,
  recommendationConfidenceScore,
  recommendationConfidenceLabel,
  recommendationConfidenceNote,
  priceSignalScore,
  contextAlignmentScore,
  getPositiveScoreColor,
  getConfidenceColor,
}) {
  return (
    <div className="panel-section">
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>TỔNG QUAN DỰ BÁO T+1</h3>
          <span style={{ fontSize: '12px', color: '#848e9c' }}>Dữ liệu mới nhất: {latestDataTime}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '6px' }}>Thị giá hiện tại</div>
            <div className="price">{formatVND(currentPrice * 1000)}</div>
          </div>
          <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '6px' }}>Giá dự báo T+1</div>
            <div className="price" style={{ color: '#eaecef' }}>{formatVND(predictedPrice * 1000)}</div>
          </div>
          <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '6px' }}>Mức chênh lệch</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: priceDiff >= 0 ? '#0ecb81' : '#f6465d' }}>
              {priceDiff >= 0 ? '+' : ''}{formatVND(priceDiff * 1000)}
            </div>
            <div style={{ fontSize: '12px', color: '#848e9c', marginTop: '4px' }}>
              {priceDiffPercent >= 0 ? '+' : ''}{formatPercent(priceDiffPercent, 2)}
            </div>
          </div>
          <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '6px' }}>Ngưỡng ra quyết định</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#fcd535' }}>{formatPercent(thresholdValue * 100, 2)}</div>
            <div style={{ fontSize: '12px', color: '#848e9c', marginTop: '4px' }}>Dùng để phân loại Mua / Giữ / Bán</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 18px', border: `1px solid ${recColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>HỆ THỐNG KHUYẾN NGHỊ</h3>
          <span style={{ padding: '6px 10px', borderRadius: '999px', background: `${getConfidenceColor(recommendationConfidenceScore)}22`, color: getConfidenceColor(recommendationConfidenceScore), fontWeight: 700, fontSize: '12px' }}>
            Độ tự tin: {Math.round(recommendationConfidenceScore)}% • {recommendationConfidenceLabel}
          </span>
        </div>
        <div style={{ fontSize: '26px', fontWeight: 'bold', color: recColor, letterSpacing: '1.5px', marginBottom: '8px' }}>{recommendation}</div>
        <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.7 }}>{recommendationNote}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
          <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
            <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '4px' }}>Tín hiệu giá</div>
            <div style={{ fontSize: '21px', fontWeight: 700, color: getPositiveScoreColor(priceSignalScore) }}>{Math.round(priceSignalScore)}%</div>
          </div>
          <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
            <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '4px' }}>Đồng thuận bối cảnh</div>
            <div style={{ fontSize: '21px', fontWeight: 700, color: getPositiveScoreColor(contextAlignmentScore) }}>{Math.round(contextAlignmentScore)}%</div>
          </div>
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>{recommendationConfidenceNote}</div>
      </div>
    </div>
  );
}

export default TechnicalDashboardCompact;
