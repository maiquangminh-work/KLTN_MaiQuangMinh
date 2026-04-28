import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from '../api/chat';
import { formatVND } from '../utils/formatting';

export function useChatWidget(ticker, data, newsData, marketContext) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'Chào bạn! Tôi đã nắm được dữ liệu 10 mã ngân hàng hôm nay (VCB, BID, CTG, MBB, TCB, VPB, ACB, HDB, SHB, VIB). Bạn cần phân tích gì không?' },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [chatSize, setChatSize] = useState({ width: 360, height: 550 });
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const startResize = useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();

    const handleMouseMove = (e) => {
      const newWidth = window.innerWidth - e.clientX - 25;
      const newHeight = window.innerHeight - e.clientY - 105;
      setChatSize({
        width: Math.max(320, Math.min(newWidth, 800)),
        height: Math.max(400, Math.min(newHeight, window.innerHeight - 100)),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSendMessage = useCallback(async (overrideText) => {
    const userMsg = (typeof overrideText === 'string' ? overrideText : chatInput).trim();
    if (!userMsg) return;
    setChatInput('');
    setChatHistory((prev) => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const currentPrice = data?.current_price || 0;
      const probabilityForecast = data?.probability_forecast || {};
      const probabilities = probabilityForecast.probabilities || {};
      const pOut = Number(probabilityForecast.outperform_probability ?? probabilities.outperform);
      const pNeutral = Number(probabilityForecast.neutral_probability ?? probabilities.neutral);
      const pUnder = Number(probabilityForecast.underperform_probability ?? probabilities.underperform);
      const probabilityLabel = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '--';
      const trendSignal = [pOut, pNeutral, pUnder].some(Number.isFinite)
        ? `P(outperform): ${probabilityLabel(pOut)}, P(neutral): ${probabilityLabel(pNeutral)}, P(underperform): ${probabilityLabel(pUnder)}`
        : data?.recommendation || 'Đang cập nhật tín hiệu xu hướng';
      const newsSummary = newsData
        .slice(0, 3)
        .map((n) => n.title)
        .join('. ');
      const marketContextSummary = marketContext
        ? `Tâm lý tin tức: ${marketContext.news_sentiment_label}; Xung lực ngân hàng: ${marketContext.banking_sector_label}; Áp lực vĩ mô: ${marketContext.macro_pressure_label}; Rủi ro chính trị: ${marketContext.political_risk_label}; Áp lực tổng thể: ${marketContext.overall_market_label}`
        : 'Chưa có dữ liệu bối cảnh thị trường.';

      const reply = await sendChatMessage(userMsg, ticker, {
        price: formatVND(currentPrice * 1000),
        predict: trendSignal,
        news_summary: newsSummary,
        market_context: marketContextSummary,
      });
      setChatHistory((prev) => [...prev, { role: 'ai', text: reply }]);
    } catch {
      setChatHistory((prev) => [...prev, { role: 'ai', text: 'Mất kết nối với trợ lý AI...' }]);
    } finally {
      setIsTyping(false);
    }
  }, [chatInput, data, newsData, marketContext, ticker]);

  return {
    isChatOpen,
    setIsChatOpen,
    chatInput,
    setChatInput,
    chatHistory,
    isTyping,
    chatSize,
    chatEndRef,
    startResize,
    handleSendMessage,
  };
}
