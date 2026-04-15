import { formatVND, formatPercent } from './formatting';

export const getRecommendationColor = (label) => {
  if (label === 'KHẢ QUAN') return '#0ecb81';
  if (label === 'KÉM KHẢ QUAN') return '#f6465d';
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

export function calculateScores(data, marketContext) {
  const currentPrice = data?.current_price || 0;
  const predictedPrice = data?.predictions?.[0]?.predicted_price || 0;
  const priceDiff = predictedPrice - currentPrice;
  const priceDiffPercent = currentPrice ? (priceDiff / currentPrice) * 100 : 0;
  const signalReferenceThreshold = data?.recommendation_threshold ?? 0.0004;
  const signalBiasThreshold = signalReferenceThreshold * 0.6;
  const moveRatio = currentPrice
    ? Math.abs(priceDiff) / (currentPrice * Math.max(signalReferenceThreshold, 0.0001))
    : 0;

  const marketPressureScore = marketContext?.overall_market_pressure ?? 50;
  const bankingSupportScore = marketContext?.banking_sector_score ?? 50;

  const directionalBias =
    data?.directional_bias ||
    (priceDiff > currentPrice * signalBiasThreshold
      ? 'positive'
      : priceDiff < -currentPrice * signalBiasThreshold
        ? 'negative'
        : 'neutral');

  const priceSignalScore = Number(
    data?.price_signal_score ??
      (() => {
        if (directionalBias === 'positive' || directionalBias === 'negative') {
          return Math.max(40, Math.min(95, 52 + moveRatio * 22));
        }
        return Math.max(40, Math.min(80, 58 - Math.min(moveRatio, 1.4) * 12));
      })()
  );

  const contextAlignmentScore = Number(
    data?.context_alignment_score ??
      (() => {
        if (directionalBias === 'positive') {
          return Math.max(20, Math.min(95, (100 - marketPressureScore) * 0.55 + bankingSupportScore * 0.45));
        }
        if (directionalBias === 'negative') {
          return Math.max(20, Math.min(95, marketPressureScore * 0.7 + (100 - bankingSupportScore) * 0.3));
        }
        return Math.max(
          20,
          Math.min(95, 100 - Math.abs(marketPressureScore - 50) * 1.15 - Math.abs(bankingSupportScore - 50) * 0.85)
        );
      })()
  );

  const recommendationScore = Number(
    data?.recommendation_score ?? Math.max(20, Math.min(95, priceSignalScore * 0.6 + contextAlignmentScore * 0.4))
  );

  const fallbackRecommendation =
    directionalBias === 'positive' && recommendationScore >= 68
      ? 'KHẢ QUAN'
      : directionalBias === 'negative' && recommendationScore >= 68
        ? 'KÉM KHẢ QUAN'
        : 'TRUNG LẬP';

  const recommendation = data?.recommendation || fallbackRecommendation;
  const recColor = getRecommendationColor(recommendation);

  const recommendationNote =
    data?.recommendation_note || 'Xếp hạng hiện tại được tổng hợp từ độ mạnh tín hiệu giá và lớp bối cảnh thị trường.';

  const recommendationConfidenceScore = Number(data?.recommendation_confidence_score ?? recommendationScore);

  const recommendationConfidenceLabel =
    data?.recommendation_confidence_label ||
    (recommendationConfidenceScore >= 75 ? 'Cao' : recommendationConfidenceScore >= 55 ? 'Trung bình' : 'Thận trọng');

  const recommendationConfidenceNote =
    data?.recommendation_confidence_note ||
    (recommendation === 'KHẢ QUAN'
      ? 'Tín hiệu giá đang nghiêng tích cực và bối cảnh hiện ủng hộ ở mức tương đối.'
      : recommendation === 'KÉM KHẢ QUAN'
        ? 'Tín hiệu giá đang suy yếu hoặc bối cảnh đang gây áp lực đáng kể lên triển vọng ngắn hạn.'
        : 'Tín hiệu giá và bối cảnh hiện vẫn ở vùng trung tính, phù hợp quan sát thêm trước khi nâng hạng triển vọng.');

  const riskLevelLabel =
    marketPressureScore >= 70 ? 'Rủi ro cao' : marketPressureScore >= 55 ? 'Rủi ro trung bình' : 'Rủi ro thấp';

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
    riskLevelLabel,
  };
}

export function buildActionPlan(scores, marketContext) {
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
  } = scores;

  const bandSize = Math.max(signalReferenceThreshold / 2, 0.004);
  const moveMagnitude = Math.abs(priceDiffPercent);
  const defaultReason = 'Lớp bối cảnh đang ở trạng thái trung tính, cần theo dõi thêm dữ liệu mới nhất.';

  const marketReason = (() => {
    if (!marketContext) return defaultReason;

    if (recommendation === 'KHẢ QUAN') {
      if ((marketContext.banking_sector_score ?? 50) >= 60) {
        return `Xung lực ngành ngân hàng đang ${String(marketContext.banking_sector_label || '').toLowerCase()}, hỗ trợ cho kịch bản tăng ngắn hạn.`;
      }
      if ((marketContext.news_sentiment_score ?? 50) >= 60) {
        return `Tâm lý tin tức đang ${String(marketContext.news_sentiment_label || '').toLowerCase()}, giúp dòng tiền dễ phản ứng tích cực hơn.`;
      }
      return `Áp lực tổng thể hiện ở mức ${String(marketContext.overall_market_label || '').toLowerCase()}, phù hợp đọc triển vọng theo hướng tích cực có kiểm soát.`;
    }

    if (recommendation === 'KÉM KHẢ QUAN') {
      if ((marketContext.overall_market_pressure ?? 50) >= 65) {
        return `Áp lực tổng thể đang ${String(marketContext.overall_market_label || '').toLowerCase()}, phù hợp với góc nhìn phòng thủ hơn trong ngắn hạn.`;
      }
      if ((marketContext.political_risk_score ?? 50) >= 60) {
        return `Rủi ro chính trị đang ${String(marketContext.political_risk_label || '').toLowerCase()}, có thể làm tín hiệu hồi phục kém bền.`;
      }
      return `Áp lực vĩ mô đang ${String(marketContext.macro_pressure_label || '').toLowerCase()}, khiến triển vọng ngắn hạn kém thuận lợi hơn.`;
    }

    if (moveMagnitude < signalReferenceThreshold * 100) {
      return 'Biên dự báo hiện vẫn nằm gần vùng trung tính, nên tiếp tục quan sát thay vì thay đổi vị thế quá sớm.';
    }
    return `Bối cảnh hiện ở mức ${String(marketContext.overall_market_label || '').toLowerCase()}, phù hợp duy trì góc nhìn trung lập và chờ thêm xác nhận.`;
  })();

  const confidenceReason = `Điểm tổng hợp hiện đạt ${Math.round(recommendationScore)}/100, với độ tự tin ở mức ${Math.round(recommendationConfidenceScore)}%.`;

  if (recommendation === 'KHẢ QUAN') {
    const entryLow = currentPrice * (1 - bandSize);
    const entryHigh = currentPrice * (1 + bandSize * 0.6);
    const targetPrice = Math.max(predictedPrice, currentPrice * (1 + Math.max(signalReferenceThreshold, 0.01)));
    const stopLoss = currentPrice * (1 - Math.max(signalReferenceThreshold * 0.75, 0.006));

    return {
      actionTitle: recommendationConfidenceScore >= 75 ? 'ƯU TIÊN TÍCH LŨY' : 'THEO DÕI ĐIỂM MUA',
      actionSubtitle:
        'Triển vọng ngắn hạn nghiêng tích cực, phù hợp quan sát các nhịp điều chỉnh để tích lũy từng phần.',
      suggestedWeight:
        recommendationConfidenceScore >= 75
          ? '40% - 50% vốn kế hoạch'
          : recommendationConfidenceScore >= 55
            ? '25% - 35% vốn kế hoạch'
            : '10% - 20% vốn kế hoạch',
      actionRange: `${formatVND(entryLow * 1000)} - ${formatVND(entryHigh * 1000)} VNĐ`,
      targetLabel: `${formatVND(targetPrice * 1000)} VNĐ`,
      guardrailLabel: `${formatVND(stopLoss * 1000)} VNĐ`,
      horizonLabel: recommendationConfidenceScore >= 75 ? '1 - 3 phiên' : '1 - 2 phiên',
      riskLabel: riskLevelLabel,
      reasons: [
        `Giá dự báo T+1 đang cao hơn thị giá ${formatPercent(moveMagnitude, 2)}.`,
        marketReason,
        confidenceReason,
      ],
    };
  }

  if (recommendation === 'KÉM KHẢ QUAN') {
    const actionLow = currentPrice * (1 - bandSize * 0.5);
    const actionHigh = currentPrice * (1 + bandSize * 0.5);
    const targetPrice = Math.min(predictedPrice, currentPrice * (1 - Math.max(signalReferenceThreshold, 0.01)));
    const invalidationPrice = currentPrice * (1 + Math.max(signalReferenceThreshold * 0.65, 0.006));

    return {
      actionTitle: recommendationConfidenceScore >= 75 ? 'ƯU TIÊN PHÒNG THỦ' : 'THEO DÕI GIẢM TỶ TRỌNG',
      actionSubtitle:
        'Triển vọng ngắn hạn đang kém thuận lợi hơn, phù hợp ưu tiên bảo toàn vị thế thay vì mở rộng rủi ro.',
      suggestedWeight:
        recommendationConfidenceScore >= 75 ? 'Giảm 40% - 60% vị thế' : 'Giảm 20% - 35% vị thế',
      actionRange: `${formatVND(actionLow * 1000)} - ${formatVND(actionHigh * 1000)} VNĐ`,
      targetLabel: `${formatVND(targetPrice * 1000)} VNĐ`,
      guardrailLabel: `${formatVND(invalidationPrice * 1000)} VNĐ`,
      horizonLabel: recommendationConfidenceScore >= 75 ? 'Trong phiên kế tiếp' : '1 - 2 phiên',
      riskLabel: riskLevelLabel,
      reasons: [
        `Giá dự báo T+1 đang thấp hơn thị giá ${formatPercent(moveMagnitude, 2)}.`,
        marketReason,
        confidenceReason,
      ],
    };
  }

  const actionLow = currentPrice * (1 - bandSize);
  const actionHigh = currentPrice * (1 + bandSize);
  const reviewLevel =
    currentPrice * (1 + Math.sign(priceDiff || 1) * Math.max(signalReferenceThreshold * 0.5, 0.004));

  return {
    actionTitle: marketPressureScore >= 60 ? 'DUY TRÌ THẬN TRỌNG' : 'GIỮ GÓC NHÌN TRUNG LẬP',
    actionSubtitle:
      'Triển vọng ngắn hạn chưa đủ rõ để nâng hạng hoặc hạ hạng, phù hợp quan sát thêm trước khi thay đổi vị thế.',
    suggestedWeight: 'Giữ tỷ trọng hiện tại, hạn chế mở vị thế lớn',
    actionRange: `${formatVND(actionLow * 1000)} - ${formatVND(actionHigh * 1000)} VNĐ`,
    targetLabel: `${formatVND(predictedPrice * 1000)} VNĐ`,
    guardrailLabel: `${formatVND(reviewLevel * 1000)} VNĐ`,
    horizonLabel: 'Theo dõi thêm 1 - 3 phiên',
    riskLabel: riskLevelLabel,
    reasons: [
      `Biên dự báo hiện ở mức ${formatPercent(moveMagnitude, 2)}, chưa tạo khác biệt đủ mạnh để thay đổi xếp hạng.`,
      marketReason,
      confidenceReason,
    ],
  };
}

export function getDecisionGuidance(recommendation) {
  if (recommendation === 'KHẢ QUAN') {
    return [
      { label: 'Nếu đang nắm giữ', value: 'Có thể tiếp tục nắm giữ và ưu tiên gia tăng từng phần khi giá giữ trên vùng quan sát.' },
      { label: 'Nếu chưa có vị thế', value: 'Có thể cân nhắc mở vị thế thăm dò, tránh mua đuổi khi giá đi quá xa vùng quan sát.' },
      { label: 'Nếu muốn mua thêm', value: 'Ưu tiên giải ngân từng phần và kiểm tra lại bối cảnh thị trường trước khi tăng tỷ trọng.' },
    ];
  }
  if (recommendation === 'KÉM KHẢ QUAN') {
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

export function getImmediateAction(recommendation) {
  if (recommendation === 'KHẢ QUAN') {
    return 'Ưu tiên giữ vị thế hiện có hoặc giải ngân thăm dò từng phần khi giá còn nằm trong vùng quan sát.';
  }
  if (recommendation === 'KÉM KHẢ QUAN') {
    return 'Ưu tiên phòng thủ và tránh mở mới; chỉ đánh giá lại khi tín hiệu giá lẫn bối cảnh cùng cải thiện trở lại.';
  }
  return 'Giữ vị thế hiện tại hoặc quan sát thêm; chưa nên mở mới quy mô lớn khi triển vọng vẫn ở vùng trung lập.';
}
