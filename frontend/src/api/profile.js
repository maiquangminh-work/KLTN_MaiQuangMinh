import api from './index';

export const fetchProfileLive = (ticker, { refresh = false } = {}) =>
  api.get(`/api/profile-live/${ticker}`, { params: { refresh } }).then((res) => res.data);

export const fetchProfile = (ticker) =>
  api.get(`/api/profile/${ticker}`).then((res) => res.data);

export const fetchForeignOwnership = (ticker) =>
  api.get(`/api/foreign-ownership/${ticker}`).then((res) => res.data);
