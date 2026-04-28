import { useState, useEffect } from 'react';
import { useMarketData } from '../contexts/MarketDataContext';
import { useLocation, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useFilteredNews, useNewsInsights } from '../hooks/useNewsAnalytics';
import { fetchNews } from '../api/market';
import { VALID_TICKERS } from '../utils/constants';
import LoadingStatePanel from '../components/LoadingStatePanel';

const NEWS_PAGE_SIZE = 40;
const NEWS_FETCH_LIMIT = 300;

const COPY = {
  vi: {
    kicker: 'News Intelligence',
    title: 'Trung tâm tin tức vĩ mô và ngân hàng',
    subtitle:
      'Hệ thống tổng hợp tin từ nhiều nguồn và cho phép bóc riêng luồng tin của từng ngân hàng hoặc theo dõi toàn thị trường trong nhiều tuần gần nhất.',
    focus: 'Trọng tâm',
    allSector: 'Toàn ngành',
    sourceCount: 'Nguồn có bài',
    latestUpdate: 'Cập nhật gần nhất',
    searchPlaceholder: 'Tìm kiếm linh hoạt (VD: VCB, Vietcombank, lãi suất, tỷ giá)...',
    searchNotePrefix: 'Hỗ trợ alias tự động: gõ',
    searchNoteSuffix: 'vẫn hiểu là Vietcombank, tương tự với BID/BIDV và CTG/VietinBank.',
    visibleArticles: 'Bài đang hiển thị',
    visibleArticlesSub: 'Sau khi áp dụng bộ lọc tìm kiếm',
    relatedArticles: 'Bài liên quan',
    selectedFocus: 'trọng tâm đang chọn',
    relatedArticlesSub:
      'Khi chọn ngân hàng, hệ thống ưu tiên bài liên quan nhưng vẫn giữ cả tin nền của toàn ngành',
    priorityArticles: 'Bài ưu tiên',
    priorityArticlesSub: 'Nhóm bài có mức độ liên quan cao để đọc trước',
    loadingInline: 'Đang tổng hợp tin tức từ các nguồn đang có bài phù hợp...',
    noResults: (query) => `Không tìm thấy bài báo nào khớp với từ khóa "${query}".`,
    focusBanking: 'ngân hàng',
    bankingNews: 'Tin ngân hàng',
    macroNews: 'Tin vĩ mô ngành',
    relevancePrefix: 'Liên quan',
    featuredFallback: 'Bài viết đang được theo dõi để bổ sung tín hiệu cho hệ thống khuyến nghị đầu tư.',
    cardFallback: 'Bài viết đang được theo dõi để bổ sung bối cảnh cho mô hình dự báo.',
    readFull: 'Xem bài phân tích đầy đủ',
    featuredImagePlaceholder: 'Ảnh xem trước đang được cập nhật',
    cardImagePlaceholder: 'Chưa có ảnh xem trước',
    sourcesWithArticles: 'Nguồn đang có bài',
    relatedTo: 'Liên quan',
    generalWatch: 'Theo dõi chung',
    showing: 'Hiển thị',
    of: 'trên',
    articles: 'bài viết',
  },
  en: {
    kicker: 'News Intelligence',
    title: 'Macro and banking news center',
    subtitle:
      'The system aggregates articles from multiple sources and lets you isolate each bank news flow or follow broader market context across recent weeks.',
    focus: 'Focus',
    allSector: 'Sector-wide',
    sourceCount: 'Active sources',
    latestUpdate: 'Latest update',
    searchPlaceholder: 'Flexible search (e.g. VCB, Vietcombank, interest rates, FX)...',
    searchNotePrefix: 'Automatic aliases are supported: typing',
    searchNoteSuffix: 'still matches Vietcombank, and similarly BID/BIDV or CTG/VietinBank.',
    visibleArticles: 'Visible articles',
    visibleArticlesSub: 'After applying the search filter',
    relatedArticles: 'Related articles',
    selectedFocus: 'selected focus',
    relatedArticlesSub:
      'When a bank is selected, related articles are prioritized while broader sector context is still retained',
    priorityArticles: 'Priority articles',
    priorityArticlesSub: 'Articles with stronger relevance signals to read first',
    loadingInline: 'Collecting relevant articles from available sources...',
    noResults: (query) => `No articles matched "${query}".`,
    focusBanking: 'banking',
    bankingNews: 'Banking news',
    macroNews: 'Macro/sector news',
    relevancePrefix: 'Relevance',
    featuredFallback: 'This article is tracked as an additional signal for the investment recommendation layer.',
    cardFallback: 'This article is tracked as extra context for the forecasting model.',
    readFull: 'Read full article',
    featuredImagePlaceholder: 'Preview image is being updated',
    cardImagePlaceholder: 'No preview image yet',
    sourcesWithArticles: 'Sources with articles',
    relatedTo: 'Related to',
    generalWatch: 'General watch',
    showing: 'Showing',
    of: 'of',
    articles: 'articles',
  },
};

function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items = [];
  for (let index = 0; index < sortedPages.length; index += 1) {
    const page = sortedPages[index];
    const previous = sortedPages[index - 1];
    if (previous && page - previous > 1) {
      items.push(`ellipsis-${previous}-${page}`);
    }
    items.push(page);
  }

  return items;
}

export default function NewsPage() {
  const { newsData, setNewsData, loadingNews, setLoadingNews } = useMarketData();
  const { language } = useTheme();
  const location = useLocation();
  const { ticker: routeTicker } = useParams();
  const copy = COPY[language] || COPY.vi;
  const [searchQuery, setSearchQuery] = useState('');
  const [newsFocusTicker, setNewsFocusTicker] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchQuery(params.get('q') || '');
    setCurrentPage(1);
  }, [location.search]);

  useEffect(() => {
    const normalizedTicker = String(routeTicker || '').toUpperCase();
    setNewsFocusTicker(VALID_TICKERS.includes(normalizedTicker) ? normalizedTicker : 'ALL');
    setCurrentPage(1);
  }, [routeTicker]);

  useEffect(() => {
    if (newsData.length > 0) return;
    let cancelled = false;
    setLoadingNews(true);
    fetchNews(NEWS_FETCH_LIMIT)
      .then((news) => {
        if (!cancelled) {
          setNewsData(news);
          setLoadingNews(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingNews(false);
      });
    return () => {
      cancelled = true;
    };
  }, [newsData.length, setNewsData, setLoadingNews]);

  const filteredNews = useFilteredNews(newsData, searchQuery);
  const newsInsights = useNewsInsights(filteredNews, newsFocusTicker, searchQuery, language);
  const totalArticles = newsInsights.enrichedArticles.length;
  const totalPages = Math.max(1, Math.ceil(totalArticles / NEWS_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * NEWS_PAGE_SIZE;
  const endIndex = startIndex + NEWS_PAGE_SIZE;
  const pagedArticles = newsInsights.enrichedArticles.slice(startIndex, endIndex);
  const featuredArticle = pagedArticles[0] || null;
  const secondaryArticles = pagedArticles.slice(1);
  const paginationItems = buildPaginationItems(safeCurrentPage, totalPages);
  const focusDisplay = newsFocusTicker === 'ALL' ? copy.allSector : newsFocusTicker;

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1);
  };

  const handleFocusTickerChange = (bankCode) => {
    setNewsFocusTicker(bankCode);
    setCurrentPage(1);
  };

  return (
    <div className="news-shell">
      <div className="news-hero">
        <div className="news-hero-main">
          <span className="news-kicker">{copy.kicker}</span>
          <h2 className="news-hero-title">{copy.title}</h2>
          <p className="news-hero-subtitle">{copy.subtitle}</p>
          <div className="news-pill-row">
            <span className="news-pill active">{copy.focus}: {focusDisplay}</span>
            <span className="news-pill">{copy.sourceCount}: {newsInsights.activeSourcesCount}</span>
            <span className="news-pill">{copy.latestUpdate}: {newsInsights.latestPublished}</span>
          </div>
          <div className="news-focus-row">
            {['ALL', ...VALID_TICKERS].map((bankCode) => (
              <button
                key={bankCode}
                type="button"
                className={`news-focus-chip ${newsFocusTicker === bankCode ? 'active' : ''}`}
                onClick={() => handleFocusTickerChange(bankCode)}
              >
                {bankCode === 'ALL' ? copy.allSector : bankCode}
              </button>
            ))}
          </div>
        </div>

        <div className="news-hero-side">
          <div className="news-header">
            <input
              type="text"
              className="search-input"
              placeholder={copy.searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          <div className="news-search-note">
            {copy.searchNotePrefix} <strong>VCB</strong> {copy.searchNoteSuffix}
          </div>

          <div className="news-stats-grid">
            <div className="news-stat-card">
              <span className="news-stat-label">{copy.visibleArticles}</span>
              <span className="news-stat-value">{newsInsights.enrichedArticles.length}</span>
              <span className="news-stat-sub">{copy.visibleArticlesSub}</span>
            </div>
            <div className="news-stat-card">
              <span className="news-stat-label">
                {copy.relatedArticles} {newsFocusTicker === 'ALL' ? copy.selectedFocus : newsFocusTicker}
              </span>
              <span className="news-stat-value">{newsInsights.tickerFocusedCount}</span>
              <span className="news-stat-sub">{copy.relatedArticlesSub}</span>
            </div>
            <div className="news-stat-card">
              <span className="news-stat-label">{copy.priorityArticles}</span>
              <span className="news-stat-value">{newsInsights.priorityArticlesCount}</span>
              <span className="news-stat-sub">{copy.priorityArticlesSub}</span>
            </div>
          </div>
        </div>
      </div>

      {loadingNews && newsData.length === 0 ? (
        <LoadingStatePanel variant="news" />
      ) : loadingNews ? (
        <div className="news-featured-card" style={{ textAlign: 'center', color: '#fcd535' }}>
          {copy.loadingInline}
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="news-featured-card" style={{ textAlign: 'center', color: '#848e9c' }}>
          {copy.noResults(searchQuery)}
        </div>
      ) : (
        <>
          {featuredArticle && (
            <div className="news-featured-card">
              <div className="news-featured-left">
                <div className="news-source-row">
                  <span className="news-source-badge">{featuredArticle.source}</span>
                  <span className="news-time-badge">{featuredArticle.published}</span>
                  <span className={`news-tag ${featuredArticle.isTickerFocused ? '' : 'macro'}`}>
                    {featuredArticle.isTickerFocused
                      ? `${copy.focus} ${newsFocusTicker === 'ALL' ? copy.focusBanking : newsFocusTicker}`
                      : featuredArticle.isBankingRelated
                        ? copy.bankingNews
                        : copy.macroNews}
                  </span>
                  <span className={`news-relevance-badge ${featuredArticle.relevanceTone}`}>
                    {copy.relevancePrefix} {featuredArticle.relevanceLabel}
                  </span>
                </div>
                <h3 className="news-featured-title">{featuredArticle.title}</h3>
                <p className="news-featured-desc">
                  {featuredArticle.cleanDescription || copy.featuredFallback}
                </p>
                <div className="news-card-insight">{featuredArticle.relevanceSummary}</div>
                <a href={featuredArticle.link} target="_blank" rel="noopener noreferrer" className="news-cta">
                  {copy.readFull} ↗
                </a>
              </div>

              <div className="news-featured-right">
                {featuredArticle.image_url ? (
                  <img src={featuredArticle.image_url} alt={featuredArticle.title} className="news-featured-image" />
                ) : (
                  <div className="news-featured-image placeholder">{copy.featuredImagePlaceholder}</div>
                )}
                <span className="news-stat-label">{copy.sourcesWithArticles}</span>
                <div className="news-chip-grid">
                  {newsInsights.sourceChips.map((item) => (
                    <div key={item.sourceName} className="news-source-chip">
                      <span>{item.sourceName}</span>
                      <span className="news-source-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="news-grid">
            {secondaryArticles.map((article, index) => (
              <div key={`${article.link}-${index}`} className="news-card">
                <a href={article.link} target="_blank" rel="noopener noreferrer">
                  {article.image_url ? (
                    <img src={article.image_url} alt={article.title} className="news-card-image" />
                  ) : (
                    <div className="news-card-image placeholder">{copy.cardImagePlaceholder}</div>
                  )}
                  <div className="news-meta">
                    <span className="news-source">[{article.source}]</span>
                    <span>{article.published}</span>
                  </div>
                  <h3>{article.title}</h3>
                  <div className="desc">
                    {article.cleanDescription || copy.cardFallback}
                  </div>
                  <div className="news-card-insight">{article.relevanceSummary}</div>
                  <div className="news-card-footer">
                    <span className={`news-tag ${article.isTickerFocused ? '' : article.isBankingRelated ? 'macro' : 'neutral'}`}>
                      {article.isTickerFocused
                        ? `${copy.relatedTo} ${newsFocusTicker === 'ALL' ? copy.focusBanking : newsFocusTicker}`
                        : article.isBankingRelated
                          ? copy.bankingNews
                          : copy.generalWatch}
                    </span>
                    <span className={`news-relevance-badge ${article.relevanceTone}`}>
                      {article.relevanceLabel}
                    </span>
                  </div>
                </a>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="news-pagination-shell">
              <div className="news-pagination-summary">
                {copy.showing} {startIndex + 1}-{Math.min(endIndex, totalArticles)} {copy.of} {totalArticles} {copy.articles}
              </div>
              <div className="news-pagination">
                <button
                  type="button"
                  className="news-page-btn nav"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                >
                  ‹
                </button>
                {paginationItems.map((item) => (
                  typeof item === 'number' ? (
                    <button
                      key={item}
                      type="button"
                      className={`news-page-btn ${safeCurrentPage === item ? 'active' : ''}`}
                      onClick={() => setCurrentPage(item)}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} className="news-page-ellipsis">…</span>
                  )
                ))}
                <button
                  type="button"
                  className="news-page-btn nav"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
