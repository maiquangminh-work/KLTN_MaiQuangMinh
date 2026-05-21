import { formatVND, formatPercent } from './formatting';

const formatMoneyLabel = (value) => `${formatVND(value * 1000)} VND`;
const formatMoneyLabelVi = (value) => `${formatVND(value * 1000)} VNĐ`;

const RECOMMENDATION_LABELS = {
  positive: { vi: 'KHẢ QUAN', en: 'OUTPERFORM' },
  negative: { vi: 'KÉM KHẢ QUAN', en: 'UNDERPERFORM' },
  neutral: { vi: 'TRUNG LẬP', en: 'NEUTRAL' },
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
  if (score >= 55) return 'Trung bình';
  return 'Quan sát';
};

const getRiskLabel = (score, language = 'vi') => {
  if (language === 'en') {
    if (score >= 70) return 'High risk';
    if (score >= 55) return 'Medium risk';
    return 'Low risk';
  }
  if (score >= 70) return 'Rủi ro cao';
  if (score >= 55) return 'Rủi ro trung bình';
  return 'Rủi ro thấp';
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
    : data?.recommendation_note || 'Xếp hạng hiện tại được tổng hợp từ độ mạnh tín hiệu xu hướng và lớp bối cảnh thị trường.';

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
        ? 'Tín hiệu xu hướng đang nghiêng tích cực và bối cảnh hiện ủng hộ ở mức tương đối.'
        : recommendationTone === 'negative'
          ? 'Tín hiệu xu hướng đang suy yếu hoặc bối cảnh đang gây áp lực đáng kể lên triển vọng ngắn hạn.'
          : 'Tín hiệu xu hướng và bối cảnh hiện vẫn ở vùng trung tính, phù hợp quan sát thêm trước khi nâng hạng triển vọng.'
    );

  const modelReliabilityRaw = data?.model_reliability || {};
  const modelReliabilityScore = Number(modelReliabilityRaw.score ?? 0);
  const modelReliabilityLabelVi = modelReliabilityRaw.label || (
    modelReliabilityScore >= 80 ? 'Cao' : modelReliabilityScore >= 65 ? 'Khá' : modelReliabilityScore > 0 ? 'Trung bình' : 'Chưa đánh giá'
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
    : 'Lớp bối cảnh đang ở trạng thái trung tính, cần theo dõi thêm dữ liệu mới nhất.';
  const probabilityEdgeLabel = formatPercent(probabilityEdge * 100, 1);
  const probabilityReasonEn = isProbabilityMode
    ? `The model estimates P(outperform) at ${formatPercent(outperformProbability * 100, 1)} versus P(underperform) at ${formatPercent(underperformProbability * 100, 1)}, giving an alpha edge of ${probabilityEdgeLabel}.`
    : `The legacy T+1 trend proxy is ${formatPercent(moveMagnitude, 2)} away from the latest market price.`;
  const probabilityReasonVi = isProbabilityMode
    ? `Mô hình ước tính P(outperform) ${formatPercent(outperformProbability * 100, 1)} so với P(underperform) ${formatPercent(underperformProbability * 100, 1)}, tạo alpha edge ${probabilityEdgeLabel}.`
    : `Tín hiệu xu hướng T+1 legacy lệch ${formatPercent(moveMagnitude, 2)} so với thị giá gần nhất.`;

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
        return `Xung lực ngành ngân hàng đang ${lowerLabel(marketContext.banking_sector_label, 'tích cực')}, hỗ trợ cho kịch bản tăng ngắn hạn.`;
      }
      if ((marketContext.news_sentiment_score ?? 50) >= 60) {
        return `Tâm lý tin tức đang ${lowerLabel(marketContext.news_sentiment_label, 'tích cực')}, giúp dòng tiền dễ phản ứng tốt hơn.`;
      }
      return `Áp lực tổng thể hiện ở mức ${lowerLabel(marketContext.overall_market_label, 'kiểm soát được')}, phù hợp đọc triển vọng theo hướng tích cực có kiểm soát.`;
    }

    if (recommendationTone === 'negative') {
      if ((marketContext.overall_market_pressure ?? 50) >= 65) {
        return `Áp lực tổng thể đang ${lowerLabel(marketContext.overall_market_label, 'cao')}, phù hợp với góc nhìn phòng thủ hơn trong ngắn hạn.`;
      }
      if ((marketContext.political_risk_score ?? 50) >= 60) {
        return `Rủi ro chính trị đang ${lowerLabel(marketContext.political_risk_label, 'đáng lưu ý')}, có thể làm tín hiệu hồi phục kém bền hơn.`;
      }
      return `Áp lực vĩ mô đang ${lowerLabel(marketContext.macro_pressure_label, 'bất lợi')}, khiến triển vọng ngắn hạn kém thuận lợi hơn.`;
    }

    if (moveMagnitude < signalReferenceThreshold * 100) {
      return 'Biên dự báo hiện vẫn nằm gần vùng trung tính, nên tiếp tục quan sát thay vì thay đổi vị thế quá sớm.';
    }
    return `Bối cảnh hiện ở mức ${lowerLabel(marketContext.overall_market_label, 'trung tính')}, phù hợp duy trì góc nhìn trung lập và chờ thêm xác nhận.`;
  })();

  const confidenceReason = language === 'en'
    ? `Composite score is ${Math.round(recommendationScore)}/100 with confidence at ${Math.round(recommendationConfidenceScore)}%.`
    : `Điểm tổng hợp hiện đạt ${Math.round(recommendationScore)}/100, với độ tự tin ở mức ${Math.round(recommendationConfidenceScore)}%.`;

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
      `Mô hình ${horizon} phiên gán ${pOutLabel} cho kịch bản outperform nhóm ngân hàng.`,
      `Chênh xác suất outperform - underperform là ${edgeLabel}.`,
      `Xác suất trung lập là ${pNeutralLabel}, nên vẫn cần kiểm soát tỷ trọng theo mức bất định.`,
    ];

    if (recommendationTone === 'positive') {
      return {
        actionTitle: 'THEO DÕI OVERWEIGHT',
        actionSubtitle: `Mô hình nghiêng về khả năng tạo alpha dương trong ${horizon} phiên tới. Ưu tiên giải ngân có kiểm soát thay vì mua đuổi.`,
        suggestedWeight: recommendationConfidenceScore >= 75 ? '40% - 50% vốn kế hoạch' : '25% - 35% vốn kế hoạch',
        actionRange,
        targetLabel: `P(outperform): ${pOutLabel}`,
        guardrailLabel: `P(underperform): ${pUnderLabel}`,
        horizonLabel: `${horizon} phiên`,
        riskLabel: riskLevelLabel,
        reasons,
      };
    }

    if (recommendationTone === 'negative') {
      return {
        actionTitle: 'THEO DÕI UNDERWEIGHT',
        actionSubtitle: `Mô hình nghiêng về khả năng kém hơn peer group trong ${horizon} phiên tới. Ưu tiên bảo toàn vị thế và hạn chế mở mới.`,
        suggestedWeight: recommendationConfidenceScore >= 75 ? 'Giảm 40% - 60% vị thế' : 'Giảm 20% - 35% vị thế',
        actionRange,
        targetLabel: `P(outperform): ${pOutLabel}`,
        guardrailLabel: `P(underperform): ${pUnderLabel}`,
        horizonLabel: `${horizon} phiên`,
        riskLabel: riskLevelLabel,
        reasons,
      };
    }

    return {
      actionTitle: 'GIỮ GÓC NHÌN TRUNG LẬP',
      actionSubtitle: `Phân phối xác suất ${horizon} phiên chưa đủ lệch để thay đổi tỷ trọng mạnh.`,
      suggestedWeight: 'Giữ tỷ trọng hiện tại và chờ tín hiệu xác suất rõ hơn',
      actionRange,
      targetLabel: `P(outperform): ${pOutLabel}`,
      guardrailLabel: `P(underperform): ${pUnderLabel}`,
      horizonLabel: `${horizon} phiên`,
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
      actionTitle: recommendationConfidenceScore >= 75 ? 'ƯU TIÊN TÍCH LŨY' : 'THEO DÕI ĐIỂM MUA',
      actionSubtitle: 'Triển vọng ngắn hạn nghiêng tích cực, phù hợp quan sát các nhịp điều chỉnh để tích lũy từng phần.',
      suggestedWeight:
        recommendationConfidenceScore >= 75
          ? '40% - 50% vốn kế hoạch'
          : recommendationConfidenceScore >= 55
            ? '25% - 35% vốn kế hoạch'
            : '10% - 20% vốn kế hoạch',
      actionRange: `${formatMoneyLabelVi(entryLow)} - ${formatMoneyLabelVi(entryHigh)}`,
      targetLabel: formatMoneyLabelVi(targetPrice),
      guardrailLabel: formatMoneyLabelVi(stopLoss),
      horizonLabel: recommendationConfidenceScore >= 75 ? '1 - 3 phiên' : '1 - 2 phiên',
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
      actionTitle: recommendationConfidenceScore >= 75 ? 'ƯU TIÊN PHÒNG THỦ' : 'THEO DÕI GIẢM TỶ TRỌNG',
      actionSubtitle: 'Triển vọng ngắn hạn đang kém thuận lợi hơn, phù hợp ưu tiên bảo toàn vị thế thay vì mở rộng rủi ro.',
      suggestedWeight: recommendationConfidenceScore >= 75 ? 'Giảm 40% - 60% vị thế' : 'Giảm 20% - 35% vị thế',
      actionRange: `${formatMoneyLabelVi(actionLow)} - ${formatMoneyLabelVi(actionHigh)}`,
      targetLabel: formatMoneyLabelVi(targetPrice),
      guardrailLabel: formatMoneyLabelVi(invalidationPrice),
      horizonLabel: recommendationConfidenceScore >= 75 ? 'Trong phiên kế tiếp' : '1 - 2 phiên',
      riskLabel: riskLevelLabel,
      reasons: [probabilityReasonVi, marketReason, confidenceReason],
    };
  }

  const actionLow = currentPrice * (1 - bandSize);
  const actionHigh = currentPrice * (1 + bandSize);
  const reviewLevel = currentPrice * (1 + Math.sign(priceDiff || 1) * Math.max(signalReferenceThreshold * 0.5, 0.004));

  return {
    actionTitle: marketPressureScore >= 60 ? 'DUY TRÌ THẬN TRỌNG' : 'GIỮ GÓC NHÌN TRUNG LẬP',
    actionSubtitle: 'Triển vọng ngắn hạn chưa đủ rõ để nâng hạng hoặc hạ hạng, phù hợp quan sát thêm trước khi thay đổi vị thế.',
    suggestedWeight: 'Giữ tỷ trọng hiện tại, hạn chế mở vị thế lớn',
    actionRange: `${formatMoneyLabelVi(actionLow)} - ${formatMoneyLabelVi(actionHigh)}`,
    targetLabel: formatMoneyLabelVi(predictedPrice),
    guardrailLabel: formatMoneyLabelVi(reviewLevel),
    horizonLabel: 'Theo dõi thêm 1 - 3 phiên',
    riskLabel: riskLevelLabel,
    reasons: [
      isProbabilityMode ? probabilityReasonVi : `Biên tín hiệu xu hướng legacy ở mức ${formatPercent(moveMagnitude, 2)}, chưa tạo khác biệt đủ mạnh để thay đổi xếp hạng.`,
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
      { label: 'Nếu đang nắm giữ', value: 'Có thể tiếp tục nắm giữ và ưu tiên gia tăng từng phần khi giá giữ trên vùng quan sát.' },
      { label: 'Nếu chưa có vị thế', value: 'Có thể cân nhắc mở vị thế thăm dò, tránh mua đuổi khi giá đi quá xa vùng quan sát.' },
      { label: 'Nếu muốn mua thêm', value: 'Ưu tiên giải ngân từng phần và kiểm tra lại bối cảnh thị trường trước khi tăng tỷ trọng.' },
    ];
  }
  if (recommendationTone === 'negative') {
    return [
      { label: 'Nếu đang nắm giữ', value: 'Ưu tiên siết quản trị rủi ro, đặc biệt nếu giá suy yếu dưới vùng phòng thủ.' },
      { label: 'Nếu chưa có vị thế', value: 'Chưa nên mở mới cho đến khi tín hiệu giá và bối cảnh ổn định trở lại.' },
      { label: 'Nếu muốn mua thêm', value: 'Không nên bình quân vội; chỉ cân nhắc lại khi xuất hiện tín hiệu xác nhận rõ ràng hơn.' },
    ];
  }
  return [
    { label: 'Nếu đang nắm giữ', value: 'Giữ tỷ trọng hiện tại và theo dõi thêm 1 - 3 phiên trước khi thay đổi vị thế.' },
    { label: 'Nếu chưa có vị thế', value: 'Chưa nên mở mới quy mô lớn khi triển vọng vẫn đang ở vùng trung lập.' },
    { label: 'Nếu muốn mua thêm', value: 'Chỉ nên giải ngân thăm dò khi tín hiệu giá cải thiện và bối cảnh tiếp tục đồng thuận.' },
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
    return 'Ưu tiên giữ vị thế hiện có hoặc giải ngân thăm dò từng phần khi giá còn nằm trong vùng quan sát.';
  }
  if (recommendationTone === 'negative') {
    return 'Ưu tiên phòng thủ và tránh mở mới; chỉ đánh giá lại khi tín hiệu giá lẫn bối cảnh cùng cải thiện trở lại.';
  }
  return 'Giữ vị thế hiện tại hoặc quan sát thêm; chưa nên mở mới quy mô lớn khi triển vọng vẫn ở vùng trung lập.';
}
