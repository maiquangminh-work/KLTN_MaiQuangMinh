import api from './index';

export const fetchPrediction = (ticker) =>
  api.get(`/api/predict/${ticker}`).then((res) => res.data);

export const fetchPredictionBatch = async (tickers) => {
  const results = await Promise.allSettled(tickers.map((ticker) => fetchPrediction(ticker)));

  return results.reduce((acc, result, index) => {
    const ticker = tickers[index];
    if (result.status === 'fulfilled') {
      acc.snapshots[ticker] = result.value;
    } else {
      acc.failedTickers.push(ticker);
    }
    return acc;
  }, { snapshots: {}, failedTickers: [] });
};

export const fetchConfidenceHistory = (ticker) =>
  api.get(`/api/confidence-history/${ticker}`).then((res) => res.data);
