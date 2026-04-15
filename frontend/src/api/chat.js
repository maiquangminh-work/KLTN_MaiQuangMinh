import api from './index';

export const sendChatMessage = (message, ticker, currentData) =>
  api
    .post('/api/chat', {
      message,
      ticker,
      current_data: currentData,
    })
    .then((res) => res.data.reply);
