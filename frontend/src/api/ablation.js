import api from './index';

export const fetchAblationData = (ticker) =>
  api.get(`/api/ablation/${ticker}`).then((res) => res.data);
