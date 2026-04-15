import api from './index';

export const fetchMarketContext = (ticker) =>
  api.get(`/api/context/${ticker}`).then((res) => res.data);

export const fetchNews = (limit = 200) =>
  api.get('/api/news', { params: { limit } }).then((res) => res.data.news || []);
