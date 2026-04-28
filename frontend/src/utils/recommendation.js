import { formatVND, formatPercent } from './formatting';

const formatMoneyLabel = (value) => `${formatVND(value * 1000)} VND`;
const formatMoneyLabelVi = (value) => `${formatVND(value * 1000)} VN\u0110`;

const RECOMMENDATION_LABELS = {
  positive: { vi: 'KH\u1ea2 QUAN', en: 'OUTPERFORM' },
  negative: { vi: 'K\u00c9M KH\u1ea2 QUAN', en: 'UNDERPERFORM' },
  neutral: { vi: 'TRUNG L\u1eacP', en: 'NEUTRAL' },
};

const stripAccents = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

const getLocalizedRecommendation = (tone, language = 'vi') => (
  RECOMMENDATION_LABELS[tone]?.[language]
  || RECOMMENDATION_LABELS.neutral[language]
  || RECOMMENDATION_LABELS.neutral.vi
);

const getConfidenceLabel = (score, language = 'vi') => {
  if (language === 'en') {
    if (score >= 75) return 'High';
    if (score >= 55) return 'Medium';
    return 'Watch';
  }
  if (score >= 75) return 'Cao';
  if (score >= 55) return 'Trung b\u00ecnh';
  return 'Quan s\u00e1t';
};

const getRiskLabel = (score, language = 'vi') => {
  if (language === 'en') {
    if (score >= 70) return 'High risk';
    if (score >= 55) return 'Medium risk';
    return 'Low risk';
  }
  if (score >= 70) return 'R\u1ee7i ro cao';
  if (score >= 55) return 'R\u1ee7i ro trung b\u00ecnh';
  return 'R\u1ee7i ro th\u1ea5p';
};

const getRecommendationTone = (recommendation, scores = {}) => {
  if (scores.directionalBias === 'positive' && (scores.recommendationScore ?? 0) >= 68) return 'positive';
  if (scores.directionalBias === 'negative' && (scores.recommendationScore ?? 0) >= 68) return 'negative';

  const normalized = stripAccents(recommendation);

  if (
    normalized.includes('KEM KHA QUAN')
    || normalized.includes('UNDERPERFORM')
    || normalized.includes('NEGATIVE')
    || normalized.includes('BEARISH')
    || normalized.includes('SELL')
    || normalized.includes('BAN')
  ) {
    return 'negative';
  }

  if (
    normalized.includes('KHA QUAN')
    || normalized.includes('OUTPERFORM')
    || normalized.includes('POSITIVE')
    || normalized.includes('BULLISH')
    || normalized.includes('BUY')
    || normalized.includes('ACCUMULATE')
    || normalized.includes('MUA')
  ) {
    return 'positive';
  }

  return 'neutral';
};

const lowerLabel = (value, fallback) => {
  const clean = String(value || fallback || '').trim();
  return clean ? clean.toLowerCase() : String(fallback || '').toLowerCase();
};

export const getRecommendationColor = (label, scores = {}) => {
  const tone = getRecommendationTone(label, scores);
  if (tone === 'positive') return '#0ecb81';
  if (tone === 'negative') return '#f6465d';
  return '#fcd535';
};

export const getPositiveScoreColor = (score) => {
  if (score >= 65) return '#0ecb81';
  if (score <= 35) return '#f6465d';
  return '#fcd535';
};

export const getRiskScoreColor = (score) => {
  if (score >= 65) return '#f6465d';
  if (score <= 35) return '#0ecb81';
  return '#fcd535';
};

export const getConfidenceColor = (score) => {
  if (score >= 75) return '#0ecb81';
  if (score >= 55) return '#fcd535';
  return '#f6465d';
};

export function calculateScores(data, marketContext, language = 'vi') {
  const currentPrice = Number(data?.current_price || 0);
  const probabilityForecast = data?.probability_forecast || null;
  const isProbabilityMode = data?.prediction_mode === 'alpha_probability' && !!probabilityForecast;
  const probabilities = probabilityForecast?.probabilities || {};
  const outperformProbability = Number(probabilityForecast?.outperform_probability ?? probabilities.outperform ?? 0);
  const neutralProbability = Number(probabilityForecast?.neutral_probability ?? probabilities.neutral ?? 0);
  const underperformProbability = Number(probabilityForecast?.underperform_probability ?? probabilities.underperform ?? 0);
  const probabilityEdge = Number(probabilityForecast?.probability_edge ?? (outperformProbability - underperformProbability));
  const predictedPrice = isProbabilityMode ? currentPrice : Number(data?.predictions?.[0]?.predicted_price || 0);
  const priceDiff = isProbabilityMode ? probabilityEdge * currentPrice * 0.01 : predictedPrice - currentPrice;
  const priceDiffPercent = isProbabilityMode ? probabilityEdge * 100 : currentPrice ? (priceDiff / currentPrice) * 100 : 0;
  const signalReferenceThreshold = Number(data?.recommendation_threshold ?? 0.008);
  const signalBiasThreshold = signalReferenceThreshold * 0.6;
  const moveRatio = isProbabilityMode
    ? Math.abs(probabilityEdge) / 0.2
    : currentPrice
      ? Math.abs(priceDiff) / (currentPrice * Math.max(signalReferenceThreshold, 0.0001))
      : 0;

  const marketPressureScore = Number(marketContext?.overall_market_pressure ?? 50);
  const bankingSupportScore = Number(marketContext?.banking_sector_score ?? 50);
  const probabilityClass = String(probabilityForecast?.predicted_class || '').toLowerCase();

  const directionalBias = data?.directional_bias || (
    isProbabilityMode
      ? probabilityClass === 'outperform' && probabilityEdge > 0.08
        ? 'positive'
        : probabilityClass === 'underperform' && probabilityEdge < -0.08
          ? 'negative'
          : 'neutral'
      : priceDiff > currentPrice * signalBiasThreshold
        ? 'positive'
        : priceDiff < -currentPrice * signalBiasThreshold
          ? 'negative'
          : 'neutral'
  );

  const priceSignalScore = Number(
    data?.price_signal_score
    ?? (() => {
      if (directionalBias === 'positive' || directionalBias === 'negative') {
        return Math.max(40, Math.min(95, 52 + moveRatio * 22));
      }
      return Math.max(40, Math.min(80, 58 - Math.min(moveRatio, 1.4) * 12));
    })(),
  );

  const contextAlignmentScore = Number(
    data?.context_alignment_score
    ?? (() => {
      if (directionalBias === 'positive') {
        return Math.max(20, Math.min(95, (100 - marketPressureScore) * 0.55 + bankingSupportScore * 0.45));
      }
      if (directionalBias === 'negative') {
        return Math.max(20, Math.min(95, marketPressureScore * 0.7 + (100 - bankingSupportScore) * 0.3));
      }
      return Math.max(
        20,
        Math.min(95, 100 - Math.abs(marketPressureScore - 50) * 1.15 - Math.abs(bankingSupportScore - 50) * 0.85),
      );
    })(),
  );

  const recommendationScore = Number(
    data?.recommendation_score
    ?? Math.max(20, Math.min(95, priceSignalScore * 0.6 + contextAlignmentScore * 0.4)),
  );

  const fallbackTone =
    directionalBias === 'positive' && recommendationScore >= 68
      ? 'positive'
      : directionalBias === 'negative' && recommendationScore >= 68
        ? 'negative'
        : 'neutral';

  const rawRecommendation = data?.recommendation || getLocalizedRecommendation(fallbackTone, 'vi');
  const recommendationTone = getRecommendationTone(rawRecommendation, { directionalBias, recommendationScore });
  const recommendation = getLocalizedRecommendation(recommendationTone, language);
  const recColor = getRecommendationColor(recommendation, { directionalBias, recommendationScore });

  const recommendationNote = language === 'en'
    ? data?.recommendation_note_en || 'The current rating combines trend-signal strength with the market-context layer.'
    : data?.recommendation_note || 'X\u1ebfp h\u1ea1ng hi\u1ec7n t\u1ea1i \u0111\u01b0\u1ee3c t\u1ed5ng h\u1ee3p t\u1eeb \u0111\u1ed9 m\u1ea1nh t\u00edn hi\u1ec7u xu h\u01b0\u1edbng v\u00e0 l\u1edbp b\u1ed1i c\u1ea3nh th\u1ecb tr\u01b0\u1eddng.';

  const recommendationConfidenceScore = Number(data?.recommendation_confidence_score ?? recommendationScore);
  const recommendationConfidenceLabel = language === 'en'
    ? data?.recommendation_confidence_label_en || getConfidenceLabel(recommendationConfidenceScore, 'en')
    : data?.recommendation_confidence_label || getConfidenceLabel(recommendationConfidenceScore, 'vi');

  const recommendationConfidenceNote = language === 'en'
    ? data?.recommendation_confidence_note_en || (
      recommendationTone === 'positive'
        ? 'Trend signals lean positive and the current backdrop is relatively supportive.'
        : recommendationTone === 'negative'
          ? 'Trend signals are weakening or the backdrop is putting meaningful pressure on the short-term outlook.'
          : 'Trend signals and context remain neutral, so observation is preferable before upgrading the outlook.'
    )
    : data?.recommendation_confidence_note || (
      recommendationTone === 'positive'
        ? 'T\u00edn hi\u1ec7u xu h\u01b0\u1edbng \u0111ang nghi\u00eang t\u00edch c\u1ef1c v\u00e0 b\u1ed1i c\u1ea3nh hi\u1ec7n \u1ee7ng h\u1ed9 \u1edf m\u1ee9c t\u01b0\u01a1ng \u0111\u1ed1i.'
        : recommendationTone === 'negative'
          ? 'T\u00edn hi\u1ec7u xu h\u01b0\u1edbng \u0111ang suy y\u1ebfu ho\u1eb7c b\u1ed1i c\u1ea3nh \u0111ang g\u00e2y \u00e1p l\u1ef1c \u0111\u00e1ng k\u1ec3 l\u00ean tri\u1ec3n v\u1ecdng ng\u1eafn h\u1ea1n.'
          : 'T\u00edn hi\u1ec7u xu h\u01b0\u1edbng v\u00e0 b\u1ed1i c\u1ea3nh hi\u1ec7n v\u1eabn \u1edf v\u00f9ng trung t\u00ednh, ph\u00f9 h\u1ee3p quan s\u00e1t th\u00eam tr\u01b0\u1edbc khi n\u00e2ng h\u1ea1ng tri\u1ec3n v\u1ecdng.'
    );

  const modelReliabilityRaw = data?.model_reliability || {};
  const modelReliabilityScore = Number(modelReliabilityRaw.score ?? 0);
  const modelReliabilityLabelVi = modelReliabilityRaw.label || (
    modelReliabilityScore >= 80 ? 'Cao' : modelReliabilityScore >= 65 ? 'Kh\u00e1' : modelReliabilityScore > 0 ? 'Trung b\u00ecnh' : 'Ch\u01b0a \u0111\u00e1nh gi\u00e1'
  );
  const modelReliabilityLabelEn = (
    modelReliabilityScore >= 80 ? 'High' : modelReliabilityScore >= 65 ? 'Solid' : modelReliabilityScore > 0 ? 'Moderate' : 'Not rated'
  );
  const modelReliability = {
    score: modelReliabilityScore,
    label: language === 'en' ? modelReliabilityLabelEn : modelReliabilityLabelVi,
    calibrationScore: Number(modelReliabilityRaw.calibration_score ?? 0),
    discriminationScore: Number(modelReliabilityRaw.discrimination_score ?? 0),
    macroF1Score: Number(modelReliabilityRaw.macro_f1_score ?? 0),
    note: modelReliabilityRaw.note || '',
  };

  return {
    currentPrice,
    predictedPrice,
    priceDiff,
    priceDiffPercent,
    signalReferenceThreshold,
    signalBiasThreshold,
    moveRatio,
    marketPressureScore,
    bankingSupportScore,
    directionalBias,
    priceSignalScore,
    contextAlignmentScore,
    recommendationScore,
    recommendation,
    recColor,
    recommendationNote,
    recommendationConfidenceScore,
    recommendationConfidenceLabel,
    recommendationConfidenceNote,
    modelReliability,
    riskLevelLabel: getRiskLabel(marketPressureScore, language),
    isProbabilityMode,
    probabilityForecast,
    outperformProbability,
    neutralProbability,
    underperformProbability,
    probabilityEdge,
  };
}

export function buildActionPlan(scores, marketContext, language = 'vi') {
  const {
    currentPrice,
    predictedPrice,
    priceDiff,
    priceDiffPercent,
    signalReferenceThreshold,
    recommendation,
    recommendationScore,
    recommendationConfidenceScore,
    riskLevelLabel,
    marketPressureScore,
    isProbabilityMode,
    probabilityForecast,
    outperformProbability,
    neutralProbability,
    underperformProbability,
    probabilityEdge,
  } = scores;

  const bandSize = Math.max(signalReferenceThreshold / 2, 0.004);
  const moveMagnitude = Math.abs(priceDiffPercent);
  const recommendationTone = getRecommendationTone(recommendation, scores);
  const defaultReason = language === 'en'
    ? 'Market context is neutral, so the plan should wait for fresher confirmation.'
    : 'L\u1edbp b\u1ed1i c\u1ea3nh \u0111ang \u1edf tr\u1ea1ng th\u00e1i trung t\u00ednh, c\u1ea7n theo d\u00f5i th\u00eam d\u1eef li\u1ec7u m\u1edbi nh\u1ea5t.';
  const probabilityEdgeLabel = formatPercent(probabilityEdge * 100, 1);
  const probabilityReasonEn = isProbabilityMode
    ? `The model estimates P(outperform) at ${formatPercent(outperformProbability * 100, 1)} versus P(underperform) at ${formatPercent(underperformProbability * 100, 1)}, giving an alpha edge of ${probabilityEdgeLabel}.`
    : `The legacy T+1 trend proxy is ${formatPercent(moveMagnitude, 2)} away from the latest market price.`;
  const probabilityReasonVi = isProbabilityMode
    ? `M\u00f4 h\u00ecnh \u01b0\u1edbc t\u00ednh P(outperform) ${formatPercent(outperformProbability * 100, 1)} so v\u1edbi P(underperform) ${formatPercent(underperformProbability * 100, 1)}, t\u1ea1o alpha edge ${probabilityEdgeLabel}.`
    : `T\u00edn hi\u1ec7u xu h\u01b0\u1edbng T+1 legacy l\u1ec7ch ${formatPercent(moveMagnitude, 2)} so v\u1edbi th\u1ecb gi\u00e1 g\u1ea7n nh\u1ea5t.`;

  const marketReason = (() => {
    if (!marketContext) return defaultReason;

    if (language === 'en') {
      if (recommendationTone === 'positive') {
        if ((marketContext.banking_sector_score ?? 50) >= 60) {
          return 'Banking-sector momentum is supportive, which keeps the short-term upside case in play.';
        }
        if ((marketContext.news_sentiment_score ?? 50) >= 60) {
          return 'News sentiment is constructive, so capital flow can react more positively.';
        }
        return 'Overall market pressure is controlled enough to keep a measured positive view.';
      }
      if (recommendationTone === 'negative') {
        if ((marketContext.overall_market_pressure ?? 50) >= 65) {
          return 'Overall market pressure is elevated, so a more defensive short-term stance is appropriate.';
        }
        if ((marketContext.political_risk_score ?? 50) >= 60) {
          return 'Political-risk pressure is notable, which can make recovery signals less durable.';
        }
        return 'Macro pressure is not favorable enough to support adding risk right now.';
      }
      if (moveMagnitude < signalReferenceThreshold * 100) {
        return 'The forecast spread is still close to neutral, so observation is preferable before changing exposure.';
      }
      return 'The current backdrop supports a neutral view until stronger confirmation appears.';
    }

    if (recommendationTone === 'positive') {
      if ((marketContext.banking_sector_score ?? 50) >= 60) {
        return `Xung l\u1ef1c ng\u00e0nh ng\u00e2n h\u00e0ng \u0111ang ${lowerLabel(marketContext.banking_sector_label, 't\u00edch c\u1ef1c')}, h\u1ed7 tr\u1ee3 cho k\u1ecbch b\u1ea3n t\u0103ng ng\u1eafn h\u1ea1n.`;
      }
      if ((marketContext.news_sentiment_score ?? 50) >= 60) {
        return `T\u00e2m l\u00fd tin t\u1ee9c \u0111ang ${lowerLabel(marketContext.news_sentiment_label, 't\u00edch c\u1ef1c')}, gi\u00fap d\u00f2ng ti\u1ec1n d\u1ec5 ph\u1ea3n \u1ee9ng t\u1ed1t h\u01a1n.`;
      }
      return `\u00c1p l\u1ef1c t\u1ed5ng th\u1ec3 hi\u1ec7n \u1edf m\u1ee9c ${lowerLabel(marketContext.overall_market_label, 'ki\u1ec3m so\u00e1t \u0111\u01b0\u1ee3c')}, ph\u00f9 h\u1ee3p \u0111\u1ecdc tri\u1ec3n v\u1ecdng theo h\u01b0\u1edbng t\u00edch c\u1ef1c c\u00f3 ki\u1ec3m so\u00e1t.`;
    }

    if (recommendationTone === 'negative') {
      if ((marketContext.overall_market_pressure ?? 50) >= 65) {
        return `\u00c1p l\u1ef1c t\u1ed5ng th\u1ec3 \u0111ang ${lowerLabel(marketContext.overall_market_label, 'cao')}, ph\u00f9 h\u1ee3p v\u1edbi g\u00f3c nh\u00ecn ph\u00f2ng th\u1ee7 h\u01a1n trong ng\u1eafn h\u1ea1n.`;
      }
      if ((marketContext.political_risk_score ?? 50) >= 60) {
        return `R\u1ee7i ro ch\u00ednh tr\u1ecb \u0111ang ${lowerLabel(marketContext.political_risk_label, '\u0111\u00e1ng l\u01b0u \u00fd')}, c\u00f3 th\u1ec3 l\u00e0m t\u00edn hi\u1ec7u h\u1ed3i ph\u1ee5c k\u00e9m b\u1ec1n h\u01a1n.`;
      }
      return `\u00c1p l\u1ef1c v\u0129 m\u00f4 \u0111ang ${lowerLabel(marketContext.macro_pressure_label, 'b\u1ea5t l\u1ee3i')}, khi\u1ebfn tri\u1ec3n v\u1ecdng ng\u1eafn h\u1ea1n k\u00e9m thu\u1eadn l\u1ee3i h\u01a1n.`;
    }

    if (moveMagnitude < signalReferenceThreshold * 100) {
      return 'Bi\u00ean d\u1ef1 b\u00e1o hi\u1ec7n v\u1eabn n\u1eb1m g\u1ea7n v\u00f9ng trung t\u00ednh, n\u00ean ti\u1ebfp t\u1ee5c quan s\u00e1t thay v\u00ec thay \u0111\u1ed5i v\u1ecb th\u1ebf qu\u00e1 s\u1edbm.';
    }
    return `B\u1ed1i c\u1ea3nh hi\u1ec7n \u1edf m\u1ee9c ${lowerLabel(marketContext.overall_market_label, 'trung t\u00ednh')}, ph\u00f9 h\u1ee3p duy tr\u00ec g\u00f3c nh\u00ecn trung l\u1eadp v\u00e0 ch\u1edd th\u00eam x\u00e1c nh\u1eadn.`;
  })();

  const confidenceReason = language === 'en'
    ? `Composite score is ${Math.round(recommendationScore)}/100 with confidence at ${Math.round(recommendationConfidenceScore)}%.`
    : `\u0110i\u1ec3m t\u1ed5ng h\u1ee3p hi\u1ec7n \u0111\u1ea1t ${Math.round(recommendationScore)}/100, v\u1edbi \u0111\u1ed9 t\u1ef1 tin \u1edf m\u1ee9c ${Math.round(recommendationConfidenceScore)}%.`;

  if (isProbabilityMode) {
    const horizon = probabilityForecast?.horizon_days || 5;
    const pOutLabel = formatPercent(outperformProbability * 100, 1);
    const pUnderLabel = formatPercent(underperformProbability * 100, 1);
    const pNeutralLabel = formatPercent(neutralProbability * 100, 1);
    const watchLow = currentPrice * (1 - bandSize);
    const watchHigh = currentPrice * (1 + bandSize);
    const actionRange = language === 'en'
      ? `${formatMoneyLabel(watchLow)} - ${formatMoneyLabel(watchHigh)}`
      : `${formatMoneyLabelVi(watchLow)} - ${formatMoneyLabelVi(watchHigh)}`;
    const edgeLabel = `${probabilityEdge >= 0 ? '+' : ''}${formatPercent(probabilityEdge * 100, 1)}`;

    if (language === 'en') {
      const riskLabel = getRiskLabel(marketPressureScore, 'en');
      const reasons = [
        `The ${horizon}-session model assigns ${pOutLabel} to outperforming the banking peer group.`,
        `Probability edge is ${edgeLabel} versus the underperform scenario.`,
        `Neutral probability is ${pNeutralLabel}, so position size should still reflect uncertainty.`,
      ];

      if (recommendationTone === 'positive') {
        return {
          actionTitle: 'OVERWEIGHT WATCH',
          actionSubtitle: 'The model favors relative outperformance over the next trading week. Prefer controlled sizing over chasing price.',
          suggestedWeight: recommendationConfidenceScore >= 75 ? '40% - 50% of planned capital' : '25% - 35% of planned capital',
          actionRange,
          targetLabel: `P(outperform): ${pOutLabel}`,
          guardrailLabel: `P(underperform): ${pUnderLabel}`,
          horizonLabel: `${horizon} sessions`,
          riskLabel,
          reasons,
        };
      }

      if (recommendationTone === 'negative') {
        return {
          actionTitle: 'UNDERWEIGHT WATCH',
          actionSubtitle: 'The model favors relative underperformance over the next trading week. Prioritize risk control.',
          suggestedWeight: recommendationConfidenceScore >= 75 ? 'Reduce 40% - 60% of the position' : 'Reduce 20% - 35% of the position',
          actionRange,
          targetLabel: `P(outperform): ${pOutLabel}`,
          guardrailLabel: `P(underperform): ${pUnderLabel}`,
          horizonLabel: `${horizon} sessions`,
          riskLabel,
          reasons,
        };
      }

      return {
        actionTitle: 'NEUTRAL WATCH',
        actionSubtitle: 'The probability distribution is not decisive enough to change exposure aggressively.',
        suggestedWeight: 'Keep current exposure and wait for a cleaner probability edge',
        actionRange,
        targetLabel: `P(outperform): ${pOutLabel}`,
        guardrailLabel: `P(underperform): ${pUnderLabel}`,
        horizonLabel: `${horizon} sessions`,
        riskLabel,
        reasons,
      };
    }

    const reasons = [
      `M\u00f4 h\u00ecnh ${horizon} phi\u00ean g\u00e1n ${pOutLabel} cho k\u1ecbch b\u1ea3n outperform nh\u00f3m ng\u00e2n h\u00e0ng.`,
      `Ch\u00eanh x\u00e1c su\u1ea5t outperform - underperform l\u00e0 ${edgeLabel}.`,
      `X\u00e1c su\u1ea5t trung l\u1eadp l\u00e0 ${pNeutralLabel}, n\u00ean v\u1eabn c\u1ea7n ki\u1ec3m so\u00e1t t\u1ef7 tr\u1ecdng theo m\u1ee9c b\u1ea5t \u0111\u1ecbnh.`,
    ];

    if (recommendationTone === 'positive') {
      return {
        actionTitle: 'THEO D\u00d5I OVERWEIGHT',
        actionSubtitle: `M\u00f4 h\u00ecnh nghi\u00eang v\u1ec1 kh\u1ea3 n\u0103ng t\u1ea1o alpha d\u01b0\u01a1ng trong ${horizon} phi\u00ean t\u1edbi. \u01afu ti\u00ean gi\u1ea3i ng\u00e2n c\u00f3 ki\u1ec3m so\u00e1t thay v\u00ec mua \u0111u\u1ed5i.`,
        suggestedWeight: recommendationConfidenceScore >= 75 ? '40% - 50% v\u1ed1n k\u1ebf ho\u1ea1ch' : '25% - 35% v\u1ed1n k\u1ebf ho\u1ea1ch',
        actionRange,
        targetLabel: `P(outperform): ${pOutLabel}`,
        guardrailLabel: `P(underperform): ${pUnderLabel}`,
        horizonLabel: `${horizon} phi\u00ean`,
        riskLabel: riskLevelLabel,
        reasons,
      };
    }

    if (recommendationTone === 'negative') {
      return {
        actionTitle: 'THEO D\u00d5I UNDERWEIGHT',
        actionSubtitle: `M\u00f4 h\u00ecnh nghi\u00eang v\u1ec1 kh\u1ea3 n\u0103ng k\u00e9m h\u01a1n peer group trong ${horizon} phi\u00ean t\u1edbi. \u01afu ti\u00ean b\u1ea3o to\u00e0n v\u1ecb th\u1ebf v\u00e0 h\u1ea1n ch\u1ebf m\u1edf m\u1edbi.`,
        suggestedWeight: recommendationConfidenceScore >= 75 ? 'Gi\u1ea3m 40% - 60% v\u1ecb th\u1ebf' : 'Gi\u1ea3m 20% - 35% v\u1ecb th\u1ebf',
        actionRange,
        targetLabel: `P(outperform): ${pOutLabel}`,
        guardrailLabel: `P(underperform): ${pUnderLabel}`,
        horizonLabel: `${horizon} phi\u00ean`,
        riskLabel: riskLevelLabel,
        reasons,
      };
    }

    return {
      actionTitle: 'GI\u1eee G\u00d3C NH\u00ccN TRUNG L\u1eacP',
      actionSubtitle: `Ph\u00e2n ph\u1ed1i x\u00e1c su\u1ea5t ${horizon} phi\u00ean ch\u01b0a \u0111\u1ee7 l\u1ec7ch \u0111\u1ec3 thay \u0111\u1ed5i t\u1ef7 tr\u1ecdng m\u1ea1nh.`,
      suggestedWeight: 'Gi\u1eef t\u1ef7 tr\u1ecdng hi\u1ec7n t\u1ea1i v\u00e0 ch\u1edd t\u00edn hi\u1ec7u x\u00e1c su\u1ea5t r\u00f5 h\u01a1n',
      actionRange,
      targetLabel: `P(outperform): ${pOutLabel}`,
      guardrailLabel: `P(underperform): ${pUnderLabel}`,
      horizonLabel: `${horizon} phi\u00ean`,
      riskLabel: riskLevelLabel,
      reasons,
    };
  }

  if (language === 'en') {
    const riskLabel = getRiskLabel(marketPressureScore, 'en');

    if (recommendationTone === 'positive') {
      const entryLow = currentPrice * (1 - bandSize);
      const entryHigh = currentPrice * (1 + bandSize * 0.6);
      const targetPrice = Math.max(predictedPrice, currentPrice * (1 + Math.max(signalReferenceThreshold, 0.01)));
      const stopLoss = currentPrice * (1 - Math.max(signalReferenceThreshold * 0.75, 0.006));

      return {
        actionTitle: recommendationConfidenceScore >= 75 ? 'PRIORITIZE ACCUMULATION' : 'WATCH FOR AN ENTRY',
        actionSubtitle: 'The short-term outlook leans positive. Prefer partial accumulation on controlled pullbacks instead of chasing strength.',
        suggestedWeight:
          recommendationConfidenceScore >= 75
            ? '40% - 50% of planned capital'
            : recommendationConfidenceScore >= 55
              ? '25% - 35% of planned capital'
              : '10% - 20% of planned capital',
        actionRange: `${formatMoneyLabel(entryLow)} - ${formatMoneyLabel(entryHigh)}`,
        targetLabel: formatMoneyLabel(targetPrice),
        guardrailLabel: formatMoneyLabel(stopLoss),
        horizonLabel: recommendationConfidenceScore >= 75 ? '1 - 3 sessions' : '1 - 2 sessions',
        riskLabel,
        reasons: [probabilityReasonEn, marketReason, confidenceReason],
      };
    }

    if (recommendationTone === 'negative') {
      const actionLow = currentPrice * (1 - bandSize * 0.5);
      const actionHigh = currentPrice * (1 + bandSize * 0.5);
      const targetPrice = Math.min(predictedPrice, currentPrice * (1 - Math.max(signalReferenceThreshold, 0.01)));
      const invalidationPrice = currentPrice * (1 + Math.max(signalReferenceThreshold * 0.65, 0.006));

      return {
        actionTitle: recommendationConfidenceScore >= 75 ? 'PRIORITIZE DEFENSE' : 'WATCH FOR DE-RISKING',
        actionSubtitle: 'The short-term outlook is less favorable. Prioritize protecting the position rather than expanding risk.',
        suggestedWeight: recommendationConfidenceScore >= 75 ? 'Reduce 40% - 60% of the position' : 'Reduce 20% - 35% of the position',
        actionRange: `${formatMoneyLabel(actionLow)} - ${formatMoneyLabel(actionHigh)}`,
        targetLabel: formatMoneyLabel(targetPrice),
        guardrailLabel: formatMoneyLabel(invalidationPrice),
        horizonLabel: recommendationConfidenceScore >= 75 ? 'Next session' : '1 - 2 sessions',
        riskLabel,
        reasons: [probabilityReasonEn, marketReason, confidenceReason],
      };
    }

    const actionLow = currentPrice * (1 - bandSize);
    const actionHigh = currentPrice * (1 + bandSize);
    const reviewLevel = currentPrice * (1 + Math.sign(priceDiff || 1) * Math.max(signalReferenceThreshold * 0.5, 0.004));

    return {
      actionTitle: marketPressureScore >= 60 ? 'STAY CAUTIOUS' : 'KEEP A NEUTRAL VIEW',
      actionSubtitle: 'The short-term outlook is not clear enough to upgrade or downgrade. Keep observing before changing exposure.',
      suggestedWeight: 'Keep current exposure and avoid large new positions',
      actionRange: `${formatMoneyLabel(actionLow)} - ${formatMoneyLabel(actionHigh)}`,
      targetLabel: formatMoneyLabel(predictedPrice),
      guardrailLabel: formatMoneyLabel(reviewLevel),
      horizonLabel: 'Watch for another 1 - 3 sessions',
      riskLabel,
      reasons: [
        isProbabilityMode ? probabilityReasonEn : `The legacy trend spread is ${formatPercent(moveMagnitude, 2)}, not strong enough to change the rating.`,
        marketReason,
        confidenceReason,
      ],
    };
  }

  if (recommendationTone === 'positive') {
    const entryLow = currentPrice * (1 - bandSize);
    const entryHigh = currentPrice * (1 + bandSize * 0.6);
    const targetPrice = Math.max(predictedPrice, currentPrice * (1 + Math.max(signalReferenceThreshold, 0.01)));
    const stopLoss = currentPrice * (1 - Math.max(signalReferenceThreshold * 0.75, 0.006));

    return {
      actionTitle: recommendationConfidenceScore >= 75 ? '\u01afU TI\u00caN T\u00cdCH L\u0168Y' : 'THEO D\u00d5I \u0110I\u1ec2M MUA',
      actionSubtitle: 'Tri\u1ec3n v\u1ecdng ng\u1eafn h\u1ea1n nghi\u00eang t\u00edch c\u1ef1c, ph\u00f9 h\u1ee3p quan s\u00e1t c\u00e1c nh\u1ecbp \u0111i\u1ec1u ch\u1ec9nh \u0111\u1ec3 t\u00edch l\u0169y t\u1eebng ph\u1ea7n.',
      suggestedWeight:
        recommendationConfidenceScore >= 75
          ? '40% - 50% v\u1ed1n k\u1ebf ho\u1ea1ch'
          : recommendationConfidenceScore >= 55
            ? '25% - 35% v\u1ed1n k\u1ebf ho\u1ea1ch'
            : '10% - 20% v\u1ed1n k\u1ebf ho\u1ea1ch',
      actionRange: `${formatMoneyLabelVi(entryLow)} - ${formatMoneyLabelVi(entryHigh)}`,
      targetLabel: formatMoneyLabelVi(targetPrice),
      guardrailLabel: formatMoneyLabelVi(stopLoss),
      horizonLabel: recommendationConfidenceScore >= 75 ? '1 - 3 phi\u00ean' : '1 - 2 phi\u00ean',
      riskLabel: riskLevelLabel,
      reasons: [probabilityReasonVi, marketReason, confidenceReason],
    };
  }

  if (recommendationTone === 'negative') {
    const actionLow = currentPrice * (1 - bandSize * 0.5);
    const actionHigh = currentPrice * (1 + bandSize * 0.5);
    const targetPrice = Math.min(predictedPrice, currentPrice * (1 - Math.max(signalReferenceThreshold, 0.01)));
    const invalidationPrice = currentPrice * (1 + Math.max(signalReferenceThreshold * 0.65, 0.006));

    return {
      actionTitle: recommendationConfidenceScore >= 75 ? '\u01afU TI\u00caN PH\u00d2NG TH\u1ee6' : 'THEO D\u00d5I GI\u1ea2M T\u1ef6 TR\u1eccNG',
      actionSubtitle: 'Tri\u1ec3n v\u1ecdng ng\u1eafn h\u1ea1n \u0111ang k\u00e9m thu\u1eadn l\u1ee3i h\u01a1n, ph\u00f9 h\u1ee3p \u01b0u ti\u00ean b\u1ea3o to\u00e0n v\u1ecb th\u1ebf thay v\u00ec m\u1edf r\u1ed9ng r\u1ee7i ro.',
      suggestedWeight: recommendationConfidenceScore >= 75 ? 'Gi\u1ea3m 40% - 60% v\u1ecb th\u1ebf' : 'Gi\u1ea3m 20% - 35% v\u1ecb th\u1ebf',
      actionRange: `${formatMoneyLabelVi(actionLow)} - ${formatMoneyLabelVi(actionHigh)}`,
      targetLabel: formatMoneyLabelVi(targetPrice),
      guardrailLabel: formatMoneyLabelVi(invalidationPrice),
      horizonLabel: recommendationConfidenceScore >= 75 ? 'Trong phi\u00ean k\u1ebf ti\u1ebfp' : '1 - 2 phi\u00ean',
      riskLabel: riskLevelLabel,
      reasons: [probabilityReasonVi, marketReason, confidenceReason],
    };
  }

  const actionLow = currentPrice * (1 - bandSize);
  const actionHigh = currentPrice * (1 + bandSize);
  const reviewLevel = currentPrice * (1 + Math.sign(priceDiff || 1) * Math.max(signalReferenceThreshold * 0.5, 0.004));

  return {
    actionTitle: marketPressureScore >= 60 ? 'DUY TR\u00cc TH\u1eacN TR\u1eccNG' : 'GI\u1eee G\u00d3C NH\u00ccN TRUNG L\u1eacP',
    actionSubtitle: 'Tri\u1ec3n v\u1ecdng ng\u1eafn h\u1ea1n ch\u01b0a \u0111\u1ee7 r\u00f5 \u0111\u1ec3 n\u00e2ng h\u1ea1ng ho\u1eb7c h\u1ea1 h\u1ea1ng, ph\u00f9 h\u1ee3p quan s\u00e1t th\u00eam tr\u01b0\u1edbc khi thay \u0111\u1ed5i v\u1ecb th\u1ebf.',
    suggestedWeight: 'Gi\u1eef t\u1ef7 tr\u1ecdng hi\u1ec7n t\u1ea1i, h\u1ea1n ch\u1ebf m\u1edf v\u1ecb th\u1ebf l\u1edbn',
    actionRange: `${formatMoneyLabelVi(actionLow)} - ${formatMoneyLabelVi(actionHigh)}`,
    targetLabel: formatMoneyLabelVi(predictedPrice),
    guardrailLabel: formatMoneyLabelVi(reviewLevel),
    horizonLabel: 'Theo d\u00f5i th\u00eam 1 - 3 phi\u00ean',
    riskLabel: riskLevelLabel,
    reasons: [
      isProbabilityMode ? probabilityReasonVi : `Bi\u00ean t\u00edn hi\u1ec7u xu h\u01b0\u1edbng legacy \u1edf m\u1ee9c ${formatPercent(moveMagnitude, 2)}, ch\u01b0a t\u1ea1o kh\u00e1c bi\u1ec7t \u0111\u1ee7 m\u1ea1nh \u0111\u1ec3 thay \u0111\u1ed5i x\u1ebfp h\u1ea1ng.`,
      marketReason,
      confidenceReason,
    ],
  };
}

export function getDecisionGuidance(recommendation, language = 'vi') {
  const recommendationTone = getRecommendationTone(recommendation);

  if (language === 'en') {
    if (recommendationTone === 'positive') {
      return [
        { label: 'Already holding', value: 'You can continue holding and add gradually only while price remains inside the watch range.' },
        { label: 'No position yet', value: 'Consider a small exploratory entry, but avoid chasing if price moves too far from the watch range.' },
        { label: 'Want to buy more', value: 'Scale in gradually and recheck the market backdrop before increasing exposure.' },
      ];
    }
    if (recommendationTone === 'negative') {
      return [
        { label: 'Already holding', value: 'Tighten risk management, especially if price weakens below the defensive level.' },
        { label: 'No position yet', value: 'Avoid opening a new position until price signals and market context stabilize again.' },
        { label: 'Want to buy more', value: 'Do not average down too early. Reconsider only when clearer confirmation appears.' },
      ];
    }
    return [
      { label: 'Already holding', value: 'Keep current exposure and observe for another 1 - 3 sessions before changing the position.' },
      { label: 'No position yet', value: 'Avoid opening a large new position while the outlook remains neutral.' },
      { label: 'Want to buy more', value: 'Only consider a small exploratory buy if price signals improve and the broader context remains supportive.' },
    ];
  }

  if (recommendationTone === 'positive') {
    return [
      { label: 'N\u1ebfu \u0111ang n\u1eafm gi\u1eef', value: 'C\u00f3 th\u1ec3 ti\u1ebfp t\u1ee5c n\u1eafm gi\u1eef v\u00e0 \u01b0u ti\u00ean gia t\u0103ng t\u1eebng ph\u1ea7n khi gi\u00e1 gi\u1eef tr\u00ean v\u00f9ng quan s\u00e1t.' },
      { label: 'N\u1ebfu ch\u01b0a c\u00f3 v\u1ecb th\u1ebf', value: 'C\u00f3 th\u1ec3 c\u00e2n nh\u1eafc m\u1edf v\u1ecb th\u1ebf th\u0103m d\u00f2, tr\u00e1nh mua \u0111u\u1ed5i khi gi\u00e1 \u0111i qu\u00e1 xa v\u00f9ng quan s\u00e1t.' },
      { label: 'N\u1ebfu mu\u1ed1n mua th\u00eam', value: '\u01afu ti\u00ean gi\u1ea3i ng\u00e2n t\u1eebng ph\u1ea7n v\u00e0 ki\u1ec3m tra l\u1ea1i b\u1ed1i c\u1ea3nh th\u1ecb tr\u01b0\u1eddng tr\u01b0\u1edbc khi t\u0103ng t\u1ef7 tr\u1ecdng.' },
    ];
  }
  if (recommendationTone === 'negative') {
    return [
      { label: 'N\u1ebfu \u0111ang n\u1eafm gi\u1eef', value: '\u01afu ti\u00ean si\u1ebft qu\u1ea3n tr\u1ecb r\u1ee7i ro, \u0111\u1eb7c bi\u1ec7t n\u1ebfu gi\u00e1 suy y\u1ebfu d\u01b0\u1edbi v\u00f9ng ph\u00f2ng th\u1ee7.' },
      { label: 'N\u1ebfu ch\u01b0a c\u00f3 v\u1ecb th\u1ebf', value: 'Ch\u01b0a n\u00ean m\u1edf m\u1edbi cho \u0111\u1ebfn khi t\u00edn hi\u1ec7u gi\u00e1 v\u00e0 b\u1ed1i c\u1ea3nh \u1ed5n \u0111\u1ecbnh tr\u1edf l\u1ea1i.' },
      { label: 'N\u1ebfu mu\u1ed1n mua th\u00eam', value: 'Kh\u00f4ng n\u00ean b\u00ecnh qu\u00e2n v\u1ed9i; ch\u1ec9 c\u00e2n nh\u1eafc l\u1ea1i khi xu\u1ea5t hi\u1ec7n t\u00edn hi\u1ec7u x\u00e1c nh\u1eadn r\u00f5 r\u00e0ng h\u01a1n.' },
    ];
  }
  return [
    { label: 'N\u1ebfu \u0111ang n\u1eafm gi\u1eef', value: 'Gi\u1eef t\u1ef7 tr\u1ecdng hi\u1ec7n t\u1ea1i v\u00e0 theo d\u00f5i th\u00eam 1 - 3 phi\u00ean tr\u01b0\u1edbc khi thay \u0111\u1ed5i v\u1ecb th\u1ebf.' },
    { label: 'N\u1ebfu ch\u01b0a c\u00f3 v\u1ecb th\u1ebf', value: 'Ch\u01b0a n\u00ean m\u1edf m\u1edbi quy m\u00f4 l\u1edbn khi tri\u1ec3n v\u1ecdng v\u1eabn \u0111ang \u1edf v\u00f9ng trung l\u1eadp.' },
    { label: 'N\u1ebfu mu\u1ed1n mua th\u00eam', value: 'Ch\u1ec9 n\u00ean gi\u1ea3i ng\u00e2n th\u0103m d\u00f2 khi t\u00edn hi\u1ec7u gi\u00e1 c\u1ea3i thi\u1ec7n v\u00e0 b\u1ed1i c\u1ea3nh ti\u1ebfp t\u1ee5c \u0111\u1ed3ng thu\u1eadn.' },
  ];
}

export function getImmediateAction(recommendation, language = 'vi') {
  const recommendationTone = getRecommendationTone(recommendation);

  if (language === 'en') {
    if (recommendationTone === 'positive') {
      return 'Prioritize holding the current position or add gradually while price remains inside the watch range.';
    }
    if (recommendationTone === 'negative') {
      return 'Prioritize defense and avoid new entries. Reassess only when both price signals and market context improve.';
    }
    return 'Keep the current position or continue observing. Avoid large new entries while the outlook remains neutral.';
  }

  if (recommendationTone === 'positive') {
    return '\u01afu ti\u00ean gi\u1eef v\u1ecb th\u1ebf hi\u1ec7n c\u00f3 ho\u1eb7c gi\u1ea3i ng\u00e2n th\u0103m d\u00f2 t\u1eebng ph\u1ea7n khi gi\u00e1 c\u00f2n n\u1eb1m trong v\u00f9ng quan s\u00e1t.';
  }
  if (recommendationTone === 'negative') {
    return '\u01afu ti\u00ean ph\u00f2ng th\u1ee7 v\u00e0 tr\u00e1nh m\u1edf m\u1edbi; ch\u1ec9 \u0111\u00e1nh gi\u00e1 l\u1ea1i khi t\u00edn hi\u1ec7u gi\u00e1 l\u1eabn b\u1ed1i c\u1ea3nh c\u00f9ng c\u1ea3i thi\u1ec7n tr\u1edf l\u1ea1i.';
  }
  return 'Gi\u1eef v\u1ecb th\u1ebf hi\u1ec7n t\u1ea1i ho\u1eb7c quan s\u00e1t th\u00eam; ch\u01b0a n\u00ean m\u1edf m\u1edbi quy m\u00f4 l\u1edbn khi tri\u1ec3n v\u1ecdng v\u1eabn \u1edf v\u00f9ng trung l\u1eadp.';
}
