const COPY = {
  vi: {
    brandTitle: 'FinSight Banking AI',
    brandSubtitle: 'Nền tảng hỗ trợ theo dõi triển vọng cổ phiếu ngân hàng',
    nav: {
      chart: 'Biểu đồ kỹ thuật',
      info: 'Thông tin cơ bản',
      news: 'Tin tức thị trường',
      model: 'Hiệu suất AI',
      about: 'Về chúng tôi',
    },
    searchPlaceholder: 'Tìm mã, tin tức hoặc chủ đề...',
    searchButton: 'Tìm kiếm',
    modeLabel: 'Giao diện',
    languageLabel: 'Ngôn ngữ',
    light: 'Sáng',
    dark: 'Tối',
    watchKicker: 'Bảng điều khiển',
    watchTitle: 'Trọng tâm nhóm ngân hàng',
    watchNote: 'Theo dõi nhanh VCB, BID và CTG trong cùng một luồng đọc quyết định.',
  },
  en: {
    brandTitle: 'FinSight Banking AI',
    brandSubtitle: 'A banking-stock outlook and investor support platform',
    nav: {
      chart: 'Technical View',
      info: 'Company Profile',
      news: 'Market News',
      model: 'AI Performance',
      about: 'About Us',
    },
    searchPlaceholder: 'Search symbols, news, or topics...',
    searchButton: 'Search',
    modeLabel: 'Theme',
    languageLabel: 'Language',
    light: 'Light',
    dark: 'Dark',
    watchKicker: 'Control center',
    watchTitle: 'Banking stock focus',
    watchNote: 'Track VCB, BID, and CTG inside one investor-friendly workflow.',
  },
};

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
}) {
  const copy = COPY[language] || COPY.vi;
  const navItems = ['chart', 'info', 'news', 'about'];
  const showBankSwitch = activeTab === 'chart' || activeTab === 'info' || activeTab === 'news';

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

        <div className="site-header-pro__controls">
          <form
            className="site-header-pro__search"
            onSubmit={(event) => {
              event.preventDefault();
              handleHeaderSearch();
            }}
          >
            <span className="site-header-pro__search-icon">⌕</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
            />
            <button type="submit">{copy.searchButton}</button>
          </form>

          <div className="site-header-pro__utility-cluster">
            <div className="site-header-pro__utility-group">
              <span className="site-header-pro__utility-label">{copy.modeLabel}</span>
              <div className="toggle-group" role="group" aria-label="Theme">
                <button
                  type="button"
                  className={`toggle-chip ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  {copy.light}
                </button>
                <button
                  type="button"
                  className={`toggle-chip ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  {copy.dark}
                </button>
              </div>
            </div>
            <div className="site-header-pro__utility-group">
              <span className="site-header-pro__utility-label">{copy.languageLabel}</span>
              <div className="toggle-group" role="group" aria-label="Language">
                <button
                  type="button"
                  className={`toggle-chip ${language === 'vi' ? 'active' : ''}`}
                  onClick={() => setLanguage('vi')}
                >
                  VI
                </button>
                <button
                  type="button"
                  className={`toggle-chip ${language === 'en' ? 'active' : ''}`}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
              </div>
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
              {['VCB', 'BID', 'CTG'].map((bank) => (
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
