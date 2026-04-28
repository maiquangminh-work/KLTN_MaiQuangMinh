function TechnicalDecisionPanelV2({
  latestDataTime,
  currentPrice,
  predictedPrice,
  priceDiff,
  priceDiffPercent,
  recommendationScore,
  formatVND,
  formatPercent,
  recColor,
  recommendation,
  recommendationNote,
  recommendationConfidenceScore,
  recommendationConfidenceLabel,
  recommendationConfidenceNote,
  modelReliability = null,
  priceSignalScore,
  contextAlignmentScore,
  getPositiveScoreColor,
  getConfidenceColor,
  immediateAction,
  isProbabilityMode = false,
  outperformProbability = 0,
  underperformProbability = 0,
  neutralProbability = 0,
  probabilityForecast = null,
  language = 'vi',
}) {
  const copy = language === 'en'
    ? {
        currentPrice: 'Market price',
        latestClose: 'Latest close',
        forecast: 'Legacy T+1 signal',
        probabilityForecast: '5-session trend probability',
        outperform: 'Outperform probability',
        compositeScore: 'Composite score',
        finalRating: 'Final rating',
        quickSummary: 'Quick summary',
        focusSignal: 'Core trend signal',
        latestData: 'Latest data',
        recommendationCore: 'Recommendation core',
        outlookRating: 'Outlook rating',
        confidence: 'Signal strength',
        modelReliability: 'Model reliability',
        modelReliabilityHint: 'From walk-forward backtest \u2014 a fixed score of how trustworthy the model is over time.',
        priceSignalStrength: 'Trend signal strength',
        contextAlignment: 'Context alignment',
        whatNow: 'What to do now',
        currency: 'VND',
      }
    : {
        currentPrice: 'Th\u1ecb gi\u00e1',
        latestClose: 'Gi\u00e1 \u0111\u00f3ng c\u1eeda g\u1ea7n nh\u1ea5t',
        forecast: 'T\u00edn hi\u1ec7u T+1 legacy',
        probabilityForecast: 'X\u00e1c su\u1ea5t xu h\u01b0\u1edbng 5 phi\u00ean',
        outperform: 'X\u00e1c su\u1ea5t outperform',
        compositeScore: '\u0110i\u1ec3m t\u1ed5ng h\u1ee3p',
        finalRating: 'X\u1ebfp h\u1ea1ng cu\u1ed1i c\u00f9ng',
        quickSummary: 'T\u00f3m t\u1eaft nhanh',
        focusSignal: 'T\u00edn hi\u1ec7u xu h\u01b0\u1edbng tr\u1ecdng t\u00e2m',
        latestData: 'D\u1eef li\u1ec7u m\u1edbi nh\u1ea5t',
        recommendationCore: 'L\u00f5i khuy\u1ebfn ngh\u1ecb',
        outlookRating: 'X\u1ebfp h\u1ea1ng tri\u1ec3n v\u1ecdng',
        confidence: 'C\u01b0\u1eddng \u0111\u1ed9 t\u00edn hi\u1ec7u',
        modelReliability: '\u0110\u1ed9 tin c\u1eady m\u00f4 h\u00ecnh',
        modelReliabilityHint: 'L\u1ea5y t\u1eeb walk-forward backtest \u2014 \u0111i\u1ec3m c\u1ed1 \u0111\u1ecbnh \u0111o m\u1ee9c \u0111\u00e1ng tin c\u1ee7a m\u00f4 h\u00ecnh theo th\u1eddi gian d\u00e0i.',
        priceSignalStrength: '\u0110\u1ed9 m\u1ea1nh t\u00edn hi\u1ec7u xu h\u01b0\u1edbng',
        contextAlignment: '\u0110\u1ed3ng thu\u1eadn b\u1ed1i c\u1ea3nh',
        whatNow: 'N\u00ean l\u00e0m g\u00ec ngay',
        currency: 'VN\u0110',
      };

  const compactItems = [
    {
      label: copy.currentPrice,
      value: `${formatVND(currentPrice * 1000)} ${copy.currency}`,
      sub: copy.latestClose,
      color: 'var(--text-primary)',
    },
    {
      label: isProbabilityMode ? copy.probabilityForecast : copy.forecast,
      value: isProbabilityMode
        ? formatPercent(outperformProbability * 100, 1)
        : `${formatVND(predictedPrice * 1000)} ${copy.currency}`,
      sub: isProbabilityMode
        ? `${copy.outperform} | U ${formatPercent(underperformProbability * 100, 1)} / N ${formatPercent(neutralProbability * 100, 1)}`
        : `${priceDiff >= 0 ? '+' : ''}${formatPercent(priceDiffPercent, 2)}`,
      color: isProbabilityMode
        ? outperformProbability >= underperformProbability ? 'var(--accent-green)' : 'var(--accent-red)'
        : priceDiff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
    },
    {
      label: copy.compositeScore,
      value: `${Math.round(recommendationScore)}/100`,
      sub: copy.finalRating,
      color: recColor,
    },
  ];

  return (
    <div className="panel-section">
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{copy.quickSummary}</div>
            <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-primary)' }}>{copy.focusSignal}</h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{copy.latestData}: {latestDataTime}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
          {compactItems.map((item) => (
            <div key={item.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '11px 12px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>{item.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '16px 18px', border: `1px solid ${recColor}`, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{copy.recommendationCore}</div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{copy.outlookRating}</h3>
          </div>
          <span style={{ padding: '6px 10px', borderRadius: '999px', background: `${getConfidenceColor(recommendationConfidenceScore)}22`, color: getConfidenceColor(recommendationConfidenceScore), fontWeight: 700, fontSize: '12px' }}>
            {copy.confidence}: {Math.round(recommendationConfidenceScore)}% - {recommendationConfidenceLabel}
          </span>
        </div>

        <div style={{ fontSize: '28px', fontWeight: 800, color: recColor, letterSpacing: '1px', marginBottom: '6px' }}>
          {recommendation}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.65 }}>
          {recommendationNote}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginTop: '14px' }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>{copy.priceSignalStrength}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: getPositiveScoreColor(priceSignalScore) }}>{Math.round(priceSignalScore)}%</div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>{copy.contextAlignment}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: getPositiveScoreColor(contextAlignmentScore) }}>{Math.round(contextAlignmentScore)}%</div>
          </div>
          <div
            title={copy.modelReliabilityHint}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}
          >
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>{copy.modelReliability}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: getPositiveScoreColor(modelReliability?.score || 0) }}>
              {Math.round(modelReliability?.score || 0)}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{modelReliability?.label || ''}</div>
          </div>
        </div>

        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {recommendationConfidenceNote}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px' }}>{copy.whatNow}</div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px', color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.7 }}>
            {immediateAction}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TechnicalDecisionPanelV2;
