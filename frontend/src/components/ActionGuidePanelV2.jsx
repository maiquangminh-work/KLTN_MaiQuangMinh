function ActionGuidePanelV2({ recColor, actionPlan, decisionGuidance, technicalReferences }) {
  const officialReferences = (technicalReferences || []).filter((item) => item.kind === 'official');
  const articleReferences = (technicalReferences || []).filter((item) => item.kind === 'article');

  return (
    <div className="card" style={{ padding: '16px 18px', border: `1px solid ${recColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Kế hoạch theo dõi ngắn hạn</h3>
        <span style={{ padding: '6px 10px', borderRadius: '999px', background: `${recColor}22`, color: recColor, fontWeight: 700, fontSize: '12px' }}>
          {actionPlan.riskLabel}
        </span>
      </div>

      <div style={{ fontSize: '24px', fontWeight: 800, color: recColor, letterSpacing: '1px', marginBottom: '6px' }}>
        {actionPlan.actionTitle}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '14px' }}>
        {actionPlan.actionSubtitle}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Vùng quan sát</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{actionPlan.actionRange}</div>
        </div>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Mốc kỳ vọng</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-green)' }}>{actionPlan.targetLabel}</div>
        </div>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Mốc phòng thủ</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-red)' }}>{actionPlan.guardrailLabel}</div>
        </div>
      </div>

      {!!decisionGuidance?.length && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>Nếu bạn đang ở tình huống này</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {decisionGuidance.map((item) => (
              <div key={item.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>{item.label}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.65 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>3 lý do nổi bật</div>
        <div style={{ display: 'grid', gap: '8px' }}>
          {actionPlan.reasons.map((reason, index) => (
            <div key={`${reason}-${index}`} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ minWidth: '24px', height: '24px', borderRadius: '999px', background: `${recColor}22`, color: recColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                {index + 1}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>{reason}</span>
            </div>
          ))}
        </div>
      </div>

      {(officialReferences.length > 0 || articleReferences.length > 0) && (
        <div style={{ marginTop: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px' }}>Nguồn tham chiếu để đọc thêm</div>

          {!!officialReferences.length && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: articleReferences.length ? '12px' : 0 }}>
              {officialReferences.map((reference) => (
                <a
                  key={`${reference.label}-${reference.href}`}
                  href={reference.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textDecoration: 'none',
                    background: 'var(--bg-soft)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'grid',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--accent-yellow)', fontSize: '12px', fontWeight: 700 }}>{reference.label}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Mở nguồn ↗</span>
                  </div>
                  <div style={{ color: 'var(--text-strong)', fontWeight: 700, lineHeight: 1.55 }}>{reference.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.55 }}>{reference.note}</div>
                </a>
              ))}
            </div>
          )}

          {!!articleReferences.length && (
            <div className="reference-article-grid">
              {articleReferences.map((reference) => (
                <a
                  key={`${reference.label}-${reference.href}`}
                  href={reference.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reference-article-card"
                >
                  {reference.image_url ? (
                    <img src={reference.image_url} alt={reference.title} className="reference-article-image" />
                  ) : (
                    <div className="reference-article-image placeholder">
                      Chưa có ảnh xem trước
                    </div>
                  )}

                  <div className="reference-article-meta">
                    <span>{reference.label}</span>
                    <span>Đọc bài ↗</span>
                  </div>
                  <div className="reference-article-title">{reference.title}</div>
                  <div className="reference-article-note">{reference.note}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Hãy ưu tiên 3 mốc trên trước. Chỉ khi giá tiến sát mốc kỳ vọng hoặc xuyên xuống mốc phòng thủ thì mới cần đánh giá lại quyết định.
      </div>
    </div>
  );
}

export default ActionGuidePanelV2;
