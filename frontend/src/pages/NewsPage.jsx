import { useState, useEffect } from 'react';
import { useMarketData } from '../contexts/MarketDataContext';
import { useFilteredNews, useNewsInsights } from '../hooks/useNewsAnalytics';
import { fetchNews } from '../api/market';
import LoadingStatePanel from '../components/LoadingStatePanel';

const NEWS_PAGE_SIZE = 40;
const NEWS_FETCH_LIMIT = 300;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [newsFocusTicker, setNewsFocusTicker] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

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
  const newsInsights = useNewsInsights(filteredNews, newsFocusTicker, searchQuery);
  const totalArticles = newsInsights.enrichedArticles.length;
  const totalPages = Math.max(1, Math.ceil(totalArticles / NEWS_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * NEWS_PAGE_SIZE;
  const endIndex = startIndex + NEWS_PAGE_SIZE;
  const pagedArticles = newsInsights.enrichedArticles.slice(startIndex, endIndex);
  const featuredArticle = pagedArticles[0] || null;
  const secondaryArticles = pagedArticles.slice(1);
  const paginationItems = buildPaginationItems(safeCurrentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, newsFocusTicker]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="news-shell">
      <div className="news-hero">
        <div className="news-hero-main">
          <span className="news-kicker">News Intelligence</span>
          <h2 className="news-hero-title">Trung tâm tin tức vĩ mô và ngân hàng</h2>
          <p className="news-hero-subtitle">
            Hệ thống tổng hợp tin từ nhiều nguồn và cho phép bóc riêng luồng tin của từng ngân hàng hoặc theo dõi toàn thị trường
            trong nhiều tuần gần nhất.
          </p>
          <div className="news-pill-row">
            <span className="news-pill active">Trọng tâm: {newsFocusTicker === 'ALL' ? 'Toàn ngành' : newsFocusTicker}</span>
            <span className="news-pill">Nguồn theo dõi: {newsInsights.uniqueSourcesCount}</span>
            <span className="news-pill">Nguồn đang có bài: {newsInsights.activeSourcesCount}</span>
            <span className="news-pill">Cập nhật gần nhất: {newsInsights.latestPublished}</span>
          </div>
          <div className="news-focus-row">
            {['ALL', 'VCB', 'BID', 'CTG'].map((bankCode) => (
              <button
                key={bankCode}
                type="button"
                className={`news-focus-chip ${newsFocusTicker === bankCode ? 'active' : ''}`}
                onClick={() => setNewsFocusTicker(bankCode)}
              >
                {bankCode === 'ALL' ? 'Toàn ngành' : bankCode}
              </button>
            ))}
          </div>
        </div>

        <div className="news-hero-side">
          <div className="news-header">
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm linh hoạt (VD: VCB, Vietcombank, lãi suất, tỷ giá)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="news-search-note">
            Hỗ trợ alias tự động: gõ <strong>VCB</strong> vẫn hiểu là <strong>Vietcombank</strong>, tương tự với
            <strong> BID/BIDV</strong> và <strong> CTG/VietinBank</strong>.
          </div>

          <div className="news-stats-grid">
            <div className="news-stat-card">
              <span className="news-stat-label">Bài đang hiển thị</span>
              <span className="news-stat-value">{newsInsights.enrichedArticles.length}</span>
              <span className="news-stat-sub">Sau khi áp dụng bộ lọc tìm kiếm</span>
            </div>
            <div className="news-stat-card">
              <span className="news-stat-label">
                Bài liên quan {newsFocusTicker === 'ALL' ? 'trọng tâm đang chọn' : newsFocusTicker}
              </span>
              <span className="news-stat-value">{newsInsights.tickerFocusedCount}</span>
              <span className="news-stat-sub">
                Khi chọn ngân hàng, hệ thống ưu tiên bài liên quan nhưng vẫn giữ cả tin nền của toàn ngành
              </span>
            </div>
            <div className="news-stat-card">
              <span className="news-stat-label">Bài ưu tiên</span>
              <span className="news-stat-value">{newsInsights.priorityArticlesCount}</span>
              <span className="news-stat-sub">Nhóm bài có mức độ liên quan cao để đọc trước</span>
            </div>
          </div>
        </div>
      </div>

      {loadingNews && newsData.length === 0 ? (
        <LoadingStatePanel variant="news" />
      ) : loadingNews ? (
        <div className="news-featured-card" style={{ textAlign: 'center', color: '#fcd535' }}>
          Đang tổng hợp tin tức từ CafeF, Vietstock, VNExpress, Báo Đầu Tư...
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="news-featured-card" style={{ textAlign: 'center', color: '#848e9c' }}>
          Không tìm thấy bài báo nào khớp với từ khóa &quot;{searchQuery}&quot;.
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
                      ? `Trọng tâm ${newsFocusTicker === 'ALL' ? 'ngân hàng' : newsFocusTicker}`
                      : featuredArticle.isBankingRelated
                        ? 'Tin ngân hàng'
                        : 'Tin vĩ mô ngành'}
                  </span>
                  <span className={`news-relevance-badge ${featuredArticle.relevanceTone}`}>
                    Liên quan {featuredArticle.relevanceLabel}
                  </span>
                </div>
                <h3 className="news-featured-title">{featuredArticle.title}</h3>
                <p className="news-featured-desc">
                  {featuredArticle.cleanDescription || 'Bài viết đang được theo dõi để bổ sung tín hiệu cho hệ thống khuyến nghị đầu tư.'}
                </p>
                <div className="news-card-insight">{featuredArticle.relevanceSummary}</div>
                <a href={featuredArticle.link} target="_blank" rel="noopener noreferrer" className="news-cta">
                  Xem bài phân tích đầy đủ ↗
                </a>
              </div>

              <div className="news-featured-right">
                {featuredArticle.image_url ? (
                  <img src={featuredArticle.image_url} alt={featuredArticle.title} className="news-featured-image" />
                ) : (
                  <div className="news-featured-image placeholder">Ảnh xem trước đang được cập nhật</div>
                )}
                <span className="news-stat-label">Nguồn đang chiếm tỷ trọng lớn</span>
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
                    <div className="news-card-image placeholder">Chưa có ảnh xem trước</div>
                  )}
                  <div className="news-meta">
                    <span className="news-source">[{article.source}]</span>
                    <span>{article.published}</span>
                  </div>
                  <h3>{article.title}</h3>
                  <div className="desc">
                    {article.cleanDescription || 'Bài viết đang được theo dõi để bổ sung bối cảnh cho mô hình dự báo.'}
                  </div>
                  <div className="news-card-insight">{article.relevanceSummary}</div>
                  <div className="news-card-footer">
                    <span className={`news-tag ${article.isTickerFocused ? '' : article.isBankingRelated ? 'macro' : 'neutral'}`}>
                      {article.isTickerFocused
                        ? `Liên quan ${newsFocusTicker === 'ALL' ? 'ngân hàng' : newsFocusTicker}`
                        : article.isBankingRelated
                          ? 'Tin ngân hàng'
                          : 'Theo dõi chung'}
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
                Hiển thị {startIndex + 1}-{Math.min(endIndex, totalArticles)} trên {totalArticles} bài viết
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
