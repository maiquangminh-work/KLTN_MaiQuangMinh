import { useMemo } from 'react';
import { NEWS_BANK_ALIASES, TRACKED_NEWS_SOURCES } from '../utils/constants';

export function useFilteredNews(newsData, searchQuery) {
  return useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const tokenGroups = normalizedQuery
      ? normalizedQuery
          .split(/\s+/)
          .filter(Boolean)
          .map((token) => {
            const expanded = new Set([token]);
            Object.entries(NEWS_BANK_ALIASES).forEach(([bankCode, aliases]) => {
              const keywordPool = [bankCode.toLowerCase(), ...aliases];
              if (keywordPool.some((keyword) => token.includes(keyword) || keyword.includes(token))) {
                keywordPool.forEach((keyword) => expanded.add(keyword));
              }
            });
            return [...expanded];
          })
      : [];

    return newsData.filter((article) => {
      const haystack = `${article.title || ''} ${article.description || ''}`.toLowerCase();
      const matchQuery =
        !tokenGroups.length || tokenGroups.every((group) => group.some((keyword) => haystack.includes(keyword)));
      return matchQuery;
    });
  }, [newsData, searchQuery]);
}

export function useNewsInsights(filteredNews, newsFocusTicker, searchQuery) {
  return useMemo(() => {
    const focusKeywords = newsFocusTicker === 'ALL' ? [] : NEWS_BANK_ALIASES[newsFocusTicker] || [];
    const normalizeText = (value) =>
      String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const scoreToRelevance = (score) => {
      if (score >= 90) return { label: 'Rất cao', tone: 'high' };
      if (score >= 55) return { label: 'Cao', tone: 'medium' };
      if (score >= 30) return { label: 'Theo dõi', tone: 'base' };
      return { label: 'Nền ngành', tone: 'base' };
    };

    const enrichedArticles = filteredNews.map((article) => {
      const cleanDescription = normalizeText(article.description);
      const haystack = `${article.title} ${cleanDescription}`.toLowerCase();
      const tickerMatches = focusKeywords.filter((keyword) => haystack.includes(keyword));
      const isTickerFocused = tickerMatches.length > 0;
      const isBankingRelated = Object.values(NEWS_BANK_ALIASES)
        .flat()
        .some((keyword) => haystack.includes(keyword));
      const titleLower = String(article.title || '').toLowerCase();
      const queryTokens = searchQuery
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const queryMatchCount = queryTokens.filter((token) => haystack.includes(token)).length;
      const titleMatchBoost = isTickerFocused
        ? tickerMatches.filter((keyword) => titleLower.includes(keyword)).length
        : 0;
      const relevanceScore =
        (isTickerFocused ? 72 : 0) +
        tickerMatches.length * 10 +
        queryMatchCount * 8 +
        titleMatchBoost * 6 +
        (isBankingRelated ? 18 : 0);
      const relevance = scoreToRelevance(relevanceScore);
      return {
        ...article,
        cleanDescription,
        isTickerFocused,
        isBankingRelated,
        relevanceScore,
        relevanceLabel: relevance.label,
        relevanceTone: relevance.tone,
        relevanceSummary: isTickerFocused
          ? `Ưu tiên theo ${newsFocusTicker === 'ALL' ? 'Toàn ngành' : newsFocusTicker}`
          : isBankingRelated
            ? 'Tin cùng nhóm ngân hàng'
            : 'Tin nền của thị trường',
      };
    });

    const rankedArticles = [...enrichedArticles].sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    const tickerFocusedArticles =
      newsFocusTicker === 'ALL' ? rankedArticles : rankedArticles.filter((a) => a.isTickerFocused);

    const sourceCounts = rankedArticles.reduce((acc, article) => {
      const src = article.source || 'Khác';
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});

    const sourceChips = TRACKED_NEWS_SOURCES.map((src) => ({
      sourceName: src,
      count: sourceCounts[src] || 0,
    })).filter((item) => item.count > 0);

    const featuredArticle = tickerFocusedArticles[0] || rankedArticles[0] || null;
    const secondaryArticles = rankedArticles.filter((a) => a !== featuredArticle);

    return {
      enrichedArticles: rankedArticles,
      featuredArticle,
      secondaryArticles,
      sourceChips,
      tickerFocusedCount: tickerFocusedArticles.length,
      priorityArticlesCount: rankedArticles.filter((a) => a.relevanceScore >= 55).length,
      uniqueSourcesCount: TRACKED_NEWS_SOURCES.length,
      activeSourcesCount: Object.keys(sourceCounts).length,
      latestPublished: enrichedArticles[0]?.published || 'Đang cập nhật',
    };
  }, [filteredNews, newsFocusTicker, searchQuery]);
}
