import api from './index';

export const fetchProfileLive = (ticker) =>
  api.get(`/api/profile-live/${ticker}?refresh=true`).then((res) => res.data);

export const fetchProfile = (ticker) =>
  api.get(`/api/profile/${ticker}`).then((res) => res.data);
