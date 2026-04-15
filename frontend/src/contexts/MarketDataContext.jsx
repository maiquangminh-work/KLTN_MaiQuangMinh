/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useMemo, useCallback } from 'react';

const MarketDataContext = createContext(null);

export function MarketDataProvider({ children }) {
  const [ticker, setTicker] = useState('VCB');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [marketContext, setMarketContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState(null);

  const [watchlistSnapshots, setWatchlistSnapshots] = useState({});
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  const [newsData, setNewsData] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);

  const [profileData, setProfileData] = useState(null);

  const handleBankChange = useCallback(
    (bank) => {
      if (bank === ticker) return;
      setLoading(true);
      setError(null);
      setTicker(bank);
    },
    [ticker]
  );

  const value = useMemo(
    () => ({
      ticker,
      setTicker,
      data,
      setData,
      loading,
      setLoading,
      error,
      setError,
      marketContext,
      setMarketContext,
      loadingContext,
      setLoadingContext,
      contextError,
      setContextError,
      watchlistSnapshots,
      setWatchlistSnapshots,
      watchlistLoading,
      setWatchlistLoading,
      newsData,
      setNewsData,
      loadingNews,
      setLoadingNews,
      profileData,
      setProfileData,
      handleBankChange,
    }),
    [
      ticker,
      data,
      loading,
      error,
      marketContext,
      loadingContext,
      contextError,
      watchlistSnapshots,
      watchlistLoading,
      newsData,
      loadingNews,
      profileData,
      handleBankChange,
    ]
  );

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  const ctx = useContext(MarketDataContext);
  if (!ctx) throw new Error('useMarketData must be used within MarketDataProvider');
  return ctx;
}
