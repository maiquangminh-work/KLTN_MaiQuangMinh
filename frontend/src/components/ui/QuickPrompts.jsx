import { useMemo } from 'react';

const PROMPTS = {
  vi: (ticker) => [
    { text: `Phân tích ${ticker} hôm nay`, display: `Phân tích ${ticker} hôm nay` },
    { text: 'So sánh 3 ngân hàng VCB, BID, CTG', display: 'So sánh VCB, BID, CTG' },
    { text: 'Giải thích tín hiệu attention', display: 'Giải thích attention' },
    { text: 'Dự đoán xu hướng tuần tới', display: 'Xu hướng tuần tới' },
    { text: `Rủi ro khi mua ${ticker}?`, display: `Rủi ro ${ticker}?` },
  ],
  en: (ticker) => [
    { text: `Analyze ${ticker} today`, display: `Analyze ${ticker} today` },
    { text: 'Compare VCB, BID, CTG', display: 'Compare VCB, BID, CTG' },
    { text: 'Explain attention signals', display: 'Explain attention' },
    { text: 'Predict next week trend', display: 'Next week trend' },
    { text: `Risks of buying ${ticker}?`, display: `Risks of ${ticker}?` },
  ],
};

const LABEL = { vi: 'Gợi ý', en: 'Suggestions' };

export default function QuickPrompts({ onSelect, ticker = 'VCB', language = 'vi' }) {
  const prompts = useMemo(
    () => (PROMPTS[language] || PROMPTS.vi)(ticker),
    [ticker, language],
  );

  const label = LABEL[language] || LABEL.vi;

  return (
    <div className="quick-prompt-wrapper">
      <span className="quick-prompt-label">{label}</span>
      <div className="quick-prompt-row">
        {prompts.map((p, i) => (
          <button
            key={i}
            className="quick-prompt-pill"
            style={{ animationDelay: `${i * 60}ms` }}
            onClick={() => onSelect(p.text)}
            title={p.text}
          >
            {p.display}
          </button>
        ))}
      </div>
    </div>
  );
}
