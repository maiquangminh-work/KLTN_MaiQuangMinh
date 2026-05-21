function ActionGuidePanelV2({ recColor, actionPlan, decisionGuidance, technicalReferences, language = 'vi' }) {
  const copy = language === 'en'
    ? {
        title: 'Short-term watch plan',
        watchRange: 'Watch range',
        targetLevel: 'Expected scenario',
        guardrailLevel: 'Risk scenario',
        guidanceTitle: 'If this is your current position',
        reasonTitle: '3 key reasons',
        referencesTitle: 'References to read next',
        openSource: 'Open source',
        noPreview: 'No preview image',
        readArticle: 'Read article',
        footer: 'Start with the watch range and probability scenarios above. Reassess when the setup changes clearly or the defensive scenario is triggered.',
      }
    : {
        title: 'Kế hoạch theo dõi ngắn hạn',
        watchRange: 'Vùng quan sát',
        targetLevel: 'Kịch bản kỳ vọng',
        guardrailLevel: 'Kịch bản rủi ro',
        guidanceTitle: 'Nếu bạn đang ở tình huống này',
        reasonTitle: '3 lý do nổi bật',
        referencesTitle: 'Nguồn tham khảo để đọc thêm',
        openSource: 'Mở nguồn',
        noPreview: 'Chưa có ảnh xem trước',
        readArticle: 'Đọc bài',
        footer: 'Hãy ưu tiên vùng quan sát và các kịch bản xác suất ở trên. Đánh giá lại khi thiết lập thay đổi rõ ràng hoặc kịch bản phòng ngừa được kích hoạt.',
      };

  const officialReferences = (technicalReferences || []).filter((item) => item.kind === 'official');
  const articleReferences = (technicalReferences || []).filter((item) => item.kind === 'article');

  return (
    <div className="card action-plan-card" style={{ '--plan-color': recColor, borderColor: recColor }}>
      <div className="action-plan-hero">
        <div className="action-plan-topline">
          <div>
            <span className="action-plan-kicker">{copy.title}</span>
            <h3>{actionPlan.actionTitle}</h3>
          </div>
          <span className="action-plan-risk-pill">
            {language === 'en' ? 'Risk' : 'R\u1ee7i ro'}: {actionPlan.riskLabel}
          </span>
        </div>

        <p className="action-plan-subtitle">{actionPlan.actionSubtitle}</p>

        <div className="action-plan-scenario-grid">
          <div className="action-plan-scenario-card watch">
            <span>{copy.watchRange}</span>
            <strong>{actionPlan.actionRange}</strong>
          </div>
          <div className="action-plan-scenario-card target">
            <span>{copy.targetLevel}</span>
            <strong>{actionPlan.targetLabel}</strong>
          </div>
          <div className="action-plan-scenario-card guardrail">
            <span>{copy.guardrailLevel}</span>
            <strong>{actionPlan.guardrailLabel}</strong>
          </div>
        </div>
      </div>

      <div className="action-plan-body">
        {!!decisionGuidance?.length && (
          <div className="action-plan-section action-plan-guidance">
            <div className="action-plan-section-title">{copy.guidanceTitle}</div>
            <div className="action-plan-guidance-grid">
              {decisionGuidance.map((item) => (
                <div key={item.label} className="action-plan-guidance-card">
                  <span>{item.label}</span>
                  <p>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="action-plan-section action-plan-reasons">
          <div className="action-plan-section-title">{copy.reasonTitle}</div>
          <div className="action-plan-reason-list">
            {actionPlan.reasons.map((reason, index) => (
              <div key={`${reason}-${index}`} className="action-plan-reason-item">
                <span>{index + 1}</span>
                <p>{reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(officialReferences.length > 0 || articleReferences.length > 0) && (
        <div className="action-plan-references">
          <div className="action-plan-section-title">{copy.referencesTitle}</div>

          {!!officialReferences.length && (
            <div className="action-plan-official-grid">
              {officialReferences.map((reference) => (
                <a
                  key={`${reference.label}-${reference.href}`}
                  href={reference.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-plan-reference-link"
                >
                  <div>
                    <span>{reference.label}</span>
                    <strong>{reference.title}</strong>
                  </div>
                  <small>{copy.openSource}</small>
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
                      {copy.noPreview}
                    </div>
                  )}

                  <div className="reference-article-meta">
                    <span>{reference.label}</span>
                    <span>{copy.readArticle}</span>
                  </div>
                  <div className="reference-article-title">{reference.title}</div>
                  <div className="reference-article-note">{reference.note}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="action-plan-footer">
        {copy.footer}
      </div>
    </div>
  );
}

export default ActionGuidePanelV2;
