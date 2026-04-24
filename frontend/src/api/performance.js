import api from './index';

export const fetchSignalHistory = (ticker, days = 90) =>
  api.get(`/api/signal-history/${ticker}?days=${days}`).then((res) => res.data);
