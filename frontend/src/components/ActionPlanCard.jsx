function ActionPlanCard({
  recColor,
  actionPlan,
}) {
  return (
    <div className="card" style={{ padding: '16px 18px', border: `1px solid ${recColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>BẢNG HÀNH ĐỘNG ĐẦU TƯ</h3>
        <span style={{ padding: '6px 10px', borderRadius: '999px', background: `${recColor}22`, color: recColor, fontWeight: 700, fontSize: '12px' }}>
          {actionPlan.riskLabel}
        </span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: recColor, letterSpacing: '1px', marginBottom: '6px' }}>
        {actionPlan.actionTitle}
      </div>
      <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.7, marginBottom: '14px' }}>
        {actionPlan.actionSubtitle}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
        <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '4px' }}>Vùng hành động</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#eaecef' }}>{actionPlan.actionRange}</div>
        </div>
        <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '4px' }}>Mục tiêu gần</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0ecb81' }}>{actionPlan.targetLabel}</div>
        </div>
        <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '4px' }}>Ngưỡng quản trị</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f6465d' }}>{actionPlan.guardrailLabel}</div>
        </div>
        <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '4px' }}>Tỷ trọng đề xuất</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#fcd535' }}>{actionPlan.suggestedWeight}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px', marginTop: '14px' }}>
        <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '4px' }}>Khung theo dõi</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#eaecef' }}>{actionPlan.horizonLabel}</div>
        </div>
        <div style={{ background: '#161a1e', border: '1px solid #2b3139', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '8px' }}>3 lý do khuyến nghị</div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {actionPlan.reasons.map((reason, index) => (
              <div key={`${reason}-${index}`} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ minWidth: '24px', height: '24px', borderRadius: '999px', background: `${recColor}22`, color: recColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                  {index + 1}
                </span>
                <span style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6 }}>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
        Các mốc trên là vùng tham khảo tự động, được cập nhật theo dự báo T+1 và lớp bối cảnh thị trường hiện tại.
      </div>
    </div>
  );
}

export default ActionPlanCard;
