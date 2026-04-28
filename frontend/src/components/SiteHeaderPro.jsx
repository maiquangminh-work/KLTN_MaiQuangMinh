import { useEffect, useMemo, useRef, useState } from 'react';
import { VALID_TICKERS } from '../utils/constants';

const COPY = {
  vi: {
    brandTitle: 'MinSight Banking AI',
    brandSubtitle: 'Theo dõi triển vọng cổ phiếu ngân hàng',
    nav: {
      chart: 'Biểu đồ kỹ thuật',
      info: 'Thông tin cơ bản',
      news: 'Tin tức thị trường',
      about: 'Về chúng tôi',
    },
    searchPlaceholder: 'Nhập mã, tin tức hoặc chủ đề...',
    searchButton: 'Tìm kiếm',
    clearSearch: 'Xóa tìm kiếm',
    searchStocks: 'Mã cổ phiếu',
    searchPages: 'Đi nhanh',
    searchNews: 'Tin tức phù hợp',
    searchActions: 'Hành động',
    modeLabel: 'Giao diện',
    languageLabel: 'Ngôn ngữ',
    light: 'Sáng',
    dark: 'Tối',
    switchTheme: 'Chuyển giao diện',
    switchLanguage: 'Chuyển ngôn ngữ',
  },
  en: {
    brandTitle: 'MinSight Banking AI',
    brandSubtitle: 'Banking stock outlook platform',
    nav: {
      chart: 'Technical View',
      info: 'Company Profile',
      news: 'Market News',
      about: 'About Us',
    },
    searchPlaceholder: 'Search symbols, news, or topics...',
    searchButton: 'Search',
    clearSearch: 'Clear search',
    searchStocks: 'Stocks',
    searchPages: 'Quick links',
    searchNews: 'Matching news',
    searchActions: 'Actions',
    modeLabel: 'Theme',
    languageLabel: 'Language',
    light: 'Light',
    dark: 'Dark',
    switchTheme: 'Toggle theme',
    switchLanguage: 'Toggle language',
  },
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M13.75 13.75L17 17M15.5 8.75A6.75 6.75 0 1 1 2 8.75a6.75 6.75 0 0 1 13.5 0Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M10 2.3V4.1M10 15.9V17.7M17.7 10H15.9M4.1 10H2.3M15.45 4.55L14.15 5.85M5.85 14.15L4.55 15.45M15.45 15.45L14.15 14.15M5.85 5.85L4.55 4.55"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M13.7 2.9A7.2 7.2 0 1 0 17.1 14a6.2 6.2 0 1 1-3.4-11.1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SiteHeaderPro({
  activeTab,
  handleTabChange,
  ticker,
  handleBankChange,
  language,
  setLanguage,
  theme,
  setTheme,
  searchQuery,
  setSearchQuery,
  handleHeaderSearch,
  searchSuggestions,
  handleSearchSuggestionSelect,
}) {
  const copy = COPY[language] || COPY.vi;
  const navItems = ['chart', 'info', 'news', 'about'];
  const showBankSwitch = activeTab === 'chart' || activeTab === 'info' || activeTab === 'news';
  const isLightTheme = theme === 'light';
  const isVietnamese = language === 'vi';
  const searchShellRef = useRef(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [usingKeyboardNav, setUsingKeyboardNav] = useState(false);

  const suggestionGroups = useMemo(
    () => ([
      { key: 'stocks', label: copy.searchStocks, items: searchSuggestions?.stocks || [] },
      { key: 'pages', label: copy.searchPages, items: searchSuggestions?.pages || [] },
      { key: 'news', label: copy.searchNews, items: searchSuggestions?.news || [] },
      { key: 'actions', label: copy.searchActions, items: searchSuggestions?.actions || [] },
    ].filter((group) => group.items.length > 0)),
    [copy.searchActions, copy.searchNews, copy.searchPages, copy.searchStocks, searchSuggestions],
  );

  const flatSuggestions = useMemo(
    () => suggestionGroups.flatMap((group) => group.items),
    [suggestionGroups],
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsSearchOpen(false);
      setUsingKeyboardNav(false);
      setActiveSuggestionIndex(0);
      return;
    }
    if (flatSuggestions.length > 0) {
      setActiveSuggestionIndex(0);
    }
  }, [flatSuggestions.length, searchQuery]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!searchShellRef.current?.contains(event.target)) {
        setIsSearchOpen(false);
        setUsingKeyboardNav(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const commitSuggestion = (item) => {
    handleSearchSuggestionSelect(item);
    setIsSearchOpen(false);
    setUsingKeyboardNav(false);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsSearchOpen(false);
      setUsingKeyboardNav(false);
      return;
    }

    if (!flatSuggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsSearchOpen(true);
      setUsingKeyboardNav(true);
      setActiveSuggestionIndex((prev) => (prev + 1) % flatSuggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsSearchOpen(true);
      setUsingKeyboardNav(true);
      setActiveSuggestionIndex((prev) => (prev - 1 + flatSuggestions.length) % flatSuggestions.length);
      return;
    }

    if (event.key === 'Enter' && isSearchOpen && usingKeyboardNav && flatSuggestions[activeSuggestionIndex]) {
      event.preventDefault();
      commitSuggestion(flatSuggestions[activeSuggestionIndex]);
    }
  };

  return (
    <header className="site-header-pro">
      <div className="site-header-pro__top">
        <button type="button" className="site-header-pro__brand" onClick={() => handleTabChange('chart')}>
          <span className="site-header-pro__logo">
            <span className="site-header-pro__logo-dot" />
          </span>
          <span className="site-header-pro__brand-copy">
            <span className="site-header-pro__brand-title">{copy.brandTitle}</span>
            <span className="site-header-pro__brand-subtitle">{copy.brandSubtitle}</span>
          </span>
        </button>

        <div className="site-header-pro__control-rail">
          <div className="site-header-pro__search-shell" ref={searchShellRef}>
            <form
              className="site-header-pro__search"
              onSubmit={(event) => {
                event.preventDefault();
                handleHeaderSearch(searchQuery);
                setIsSearchOpen(false);
                setUsingKeyboardNav(false);
              }}
            >
              <span className="site-header-pro__search-icon">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setIsSearchOpen(Boolean(event.target.value.trim()));
                  setUsingKeyboardNav(false);
                }}
                onFocus={() => {
                  if (searchQuery.trim() && flatSuggestions.length > 0) {
                    setIsSearchOpen(true);
                  }
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="site-header-pro__search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                    setUsingKeyboardNav(false);
                  }}
                  aria-label={copy.clearSearch}
                >
                  <CloseIcon />
                </button>
              ) : null}
              <button type="submit" className="site-header-pro__search-submit">
                {copy.searchButton}
              </button>
            </form>

            {isSearchOpen && suggestionGroups.length > 0 && (
              <div className="site-header-pro__search-dropdown">
                {suggestionGroups.map((group) => (
                  <div key={group.key} className="site-header-pro__search-group">
                    <div className="site-header-pro__search-group-label">{group.label}</div>
                    <div className="site-header-pro__search-group-list">
                      {group.items.map((item) => {
                        const flatIndex = flatSuggestions.findIndex((candidate) => candidate.id === item.id);
                        const isActive = flatIndex === activeSuggestionIndex;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`site-header-pro__search-item ${isActive ? 'is-active' : ''}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => {
                              setActiveSuggestionIndex(flatIndex);
                              setUsingKeyboardNav(false);
                            }}
                            onClick={() => commitSuggestion(item)}
                          >
                            <span className="site-header-pro__search-item-title">{item.title}</span>
                            {item.subtitle ? (
                              <span className="site-header-pro__search-item-subtitle">{item.subtitle}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="site-header-pro__selector-stack">
            <div className="site-header-pro__selector-card site-header-pro__selector-card--theme">
              <span className="site-header-pro__selector-label">{copy.modeLabel}</span>
              <button
                type="button"
                className={`theme-switch ${isLightTheme ? 'is-light' : 'is-dark'}`}
                onClick={() => setTheme(isLightTheme ? 'dark' : 'light')}
                aria-label={copy.switchTheme}
                title={copy.switchTheme}
              >
                <span className="theme-switch__track">
                  <span className="theme-switch__side theme-switch__side--sun">
                    <SunIcon />
                  </span>
                  <span className="theme-switch__side theme-switch__side--moon">
                    <MoonIcon />
                  </span>
                  <span className="theme-switch__thumb" />
                </span>
                <span className="theme-switch__text">
                  {isLightTheme ? copy.light : copy.dark}
                </span>
              </button>
            </div>

            <div className="site-header-pro__selector-card site-header-pro__selector-card--language">
              <span className="site-header-pro__selector-label">{copy.languageLabel}</span>
              <button
                type="button"
                className={`lang-switch ${isVietnamese ? 'is-vi' : 'is-en'}`}
                onClick={() => setLanguage(isVietnamese ? 'en' : 'vi')}
                aria-label={copy.switchLanguage}
                title={copy.switchLanguage}
              >
                <span className="lang-switch__track">
                  <span className="lang-switch__side lang-switch__side--vi">VI</span>
                  <span className="lang-switch__side lang-switch__side--en">EN</span>
                  <span className="lang-switch__thumb" />
                </span>
                <span className="lang-switch__text">{isVietnamese ? 'VI' : 'EN'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="site-header-pro__subbar">
        <nav className="site-header-pro__nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`site-header-pro__nav-link ${activeTab === item ? 'active' : ''}`}
              onClick={() => handleTabChange(item)}
            >
              {copy.nav[item]}
            </button>
          ))}
        </nav>

        {showBankSwitch && (
          <div className="site-header-pro__subbar-right">
            <div className="bank-switch">
              {VALID_TICKERS.map((bank) => (
                <button
                  key={bank}
                  type="button"
                  className={`bank-switch-chip ${ticker === bank ? 'active' : ''}`}
                  onClick={() => handleBankChange(bank)}
                >
                  {bank}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default SiteHeaderPro;
