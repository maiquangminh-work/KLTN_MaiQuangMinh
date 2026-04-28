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
        title: 'K\u1ebf ho\u1ea1ch theo d\u00f5i ng\u1eafn h\u1ea1n',
        watchRange: 'V\u00f9ng quan s\u00e1t',
        targetLevel: 'K\u1ecbch b\u1ea3n k\u1ef3 v\u1ecdng',
        guardrailLevel: 'K\u1ecbch b\u1ea3n r\u1ee7i ro',
        guidanceTitle: 'N\u1ebfu b\u1ea1n \u0111ang \u1edf t\u00ecnh hu\u1ed1ng n\u00e0y',
        reasonTitle: '3 l\u00fd do n\u1ed5i b\u1eadt',
        referencesTitle: 'Ngu\u1ed3n tham chi\u1ebfu \u0111\u1ec3 \u0111\u1ecdc th\u00eam',
        openSource: 'M\u1edf ngu\u1ed3n',
        noPreview: 'Ch\u01b0a c\u00f3 \u1ea3nh xem tr\u01b0\u1edbc',
        readArticle: '\u0110\u1ecdc b\u00e0i',
        footer: 'H\u00e3y \u01b0u ti\u00ean v\u00f9ng quan s\u00e1t v\u00e0 c\u00e1c k\u1ecbch b\u1ea3n x\u00e1c su\u1ea5t ph\u00eda tr\u00ean. Ch\u1ec9 \u0111\u00e1nh gi\u00e1 l\u1ea1i khi thi\u1ebft l\u1eadp thay \u0111\u1ed5i r\u00f5 ho\u1eb7c k\u1ecbch b\u1ea3n r\u1ee7i ro b\u1ecb k\u00edch ho\u1ea1t.',
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
