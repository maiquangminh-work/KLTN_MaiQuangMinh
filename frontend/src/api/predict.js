import api from './index';

export const fetchPrediction = (ticker) =>
  api.get(`/api/predict/${ticker}`).then((res) => res.data);

export const fetchConfidenceHistory = (ticker) =>
  api.get(`/api/confidence-history/${ticker}`).then((res) => res.data);
