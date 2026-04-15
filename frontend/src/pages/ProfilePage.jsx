import { useEffect, useMemo } from 'react';
import { useMarketData } from '../contexts/MarketDataContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatCapitalBillions, parseCapitalValueToBillions } from '../utils/formatting';
import { BANK_BRAND_THEMES, BANK_HERO_BACKDROPS, BANK_STATIC_DATA } from '../utils/constants';
import { fetchProfileLive, fetchProfile } from '../api/profile';
import LoadingStatePanel from '../components/LoadingStatePanel';
import FinancialHighlights from '../components/ui/FinancialHighlights';
import PeerComparison from '../components/ui/PeerComparison';

export default function ProfilePage() {
  const { ticker, data, profileData, setProfileData } = useMarketData();
  const { language, isLightTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    setProfileData(null);
    fetchProfileLive(ticker)
      .then((res) => { if (!cancelled) setProfileData(res); })
      .catch(() => {
        fetchProfile(ticker)
          .then((res) => { if (!cancelled) setProfileData(res); })
          .catch((err) => console.log('Lỗi API hồ sơ doanh nghiệp:', err));
      });
    return () => { cancelled = true; };
  }, [ticker, setProfileData]);

  const profileFallback = BANK_STATIC_DATA[ticker];
  const brandTheme = BANK_BRAND_THEMES[ticker] || BANK_BRAND_THEMES.VCB;
  const profileHeroAsset = BANK_HERO_BACKDROPS[ticker] || BANK_HERO_BACKDROPS.VCB;

  const sortedFullData = useMemo(() => {
    const safeChartData = Array.isArray(data?.chart_data) ? data.chart_data : [];
    const uniqueDataMap = new Map();
    safeChartData.forEach((item) => {
      const rawTime = item.time || item.Time || '';
      const parsedTime = String(rawTime).split(' ')[0];
      if (parsedTime && parsedTime.length >= 8) {
        uniqueDataMap.set(parsedTime, {
          time: parsedTime,
          open: (Number(item.open) || 0) * 1000,
          high: (Number(item.high) || 0) * 1000,
          low: (Number(item.low) || 0) * 1000,
          close: (Number(item.close_winsorized || item.close) || 0) * 1000,
          volume: Number(item.volume) || 0,
        });
      }
    });
    return Array.from(uniqueDataMap.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [data]);

  const charterCapitalHistory = useMemo(() => {
    const raw = profileData?.charter_capital_history?.length
      ? profileData.charter_capital_history
      : profileFallback?.chartData || [];
    const normalized = raw
      .map((item, index) => {
        const numericValue = parseCapitalValueToBillions(item.numeric_value ?? item.value);
        return { quarter: item.quarter || `Mốc ${index + 1}`, numericValue };
      })
      .filter((item) => Number.isFinite(item.numericValue) && item.numericValue > 0);
    const maxValue = normalized.length ? Math.max(...normalized.map((i) => i.numericValue)) : 1;
    return {
      items: normalized.map((item) => ({
        ...item,
        height: Math.max(18, Math.round((item.numericValue / maxValue) * 90)),
        value: formatCapitalBillions(item.numericValue),
      })),
      axisTicks: [1, 0.75, 0.5, 0.25, 0].map((ratio) => formatCapitalBillions(maxValue * ratio)),
    };
  }, [profileData, profileFallback]);

  const displayCharterCapital = useMemo(() => {
    const normalizedValue = parseCapitalValueToBillions(profileData?.charter_capital);
    if (normalizedValue !== null) return `${formatCapitalBillions(normalizedValue)} tỷ đồng`;
    return profileData?.charter_capital || 'Đang cập nhật';
  }, [profileData]);

  const listingAdvisor = profileData?.listing_advisor?.name
    ? profileData.listing_advisor
    : profileFallback?.tu_van;

  const auditorTimeline = profileData?.auditor_timeline?.length
    ? profileData.auditor_timeline
    : profileFallback?.auditors || [];

  const profileStatusClass = profileData?.profile_status === 'live' ? 'live' : 'fallback';
  const profileStatusLabel = profileData?.profile_status === 'live' ? 'Đồng bộ trực tuyến' : 'Dữ liệu dự phòng';

  const profileHeroStyle = {
    '--brand-accent': brandTheme.accent,
    '--brand-accent-soft': brandTheme.accentSoft,
    '--brand-glow': brandTheme.glow,
  };

  const profileHighlights = [
    { label: 'Mã giao dịch', value: profileData?.ticker || ticker, sub: 'Nhóm ngân hàng theo dõi' },
    { label: 'Sàn niêm yết', value: profileData?.exchange || 'HOSE', sub: profileData?.industry || 'Ngân hàng' },
    { label: 'Vốn điều lệ', value: displayCharterCapital, sub: 'Quy mô vốn hiện tại' },
    { label: 'Ngày giao dịch đầu tiên', value: profileData?.first_trading_date || 'Đang cập nhật', sub: 'Mốc niêm yết lịch sử' },
  ];

  if (!profileData) return <LoadingStatePanel variant="info" />;

  return (
    <div className="company-profile">
      <div className="cp-header" style={profileHeroStyle}>
        <div
          className="cp-hero-scene"
          aria-hidden="true"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.26) 100%), url('${profileHeroAsset.image}')`,
          }}
        />
        <div className="cp-hero-watermark" aria-hidden="true">
          <img src={profileData.logo_url} alt="" />
        </div>
        <div className="cp-hero-wordmark" aria-hidden="true">{profileHeroAsset.wordmark}</div>
        <div className="cp-header-main">
          <div className="cp-logo-container">
            <img src={profileData.logo_url} alt={ticker} className="cp-logo" />
          </div>
          <div className="cp-title-group">
            <h2>{profileData.company_name}</h2>
            <p>
              {profileData.profile_source
                ? `Nguồn hồ sơ: ${profileData.profile_source} • Cập nhật: ${profileData.profile_updated_at}`
                : 'Hồ sơ doanh nghiệp đang được đồng bộ tự động.'}
            </p>
            <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {profileHeroAsset.descriptor}
            </p>
          </div>
        </div>
        <div className="cp-header-side">
          <div className="cp-badge-row">
            <span className={`cp-badge ${profileStatusClass}`}>{profileStatusLabel}</span>
            {profileData.profile_source && (
              <span className="cp-badge">{profileData.profile_source}</span>
            )}
          </div>
          {profileData.website && (
            <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="cp-link-chip">
              Website chính thức ↗
            </a>
          )}
        </div>
      </div>

      <div className="cp-highlight-grid">
        {profileHighlights.map((item) => (
          <div key={item.label} className="cp-highlight-card">
            <span className="cp-highlight-label">{item.label}</span>
            <span className="cp-highlight-value">{item.value}</span>
            <span className="cp-highlight-sub">{item.sub}</span>
          </div>
        ))}
      </div>

      {profileData.crawl_note && (
        <div className="cp-note-banner">{profileData.crawl_note}</div>
      )}

      <div className="cp-body">
        <div className="cp-left">
          <div className="cp-primary-card">
            <h4 className="cp-panel-title">Thông tin niêm yết cốt lõi</h4>
            <div className="cp-stats-grid">
              <div className="stat-item"><span className="stat-label">Mã cổ phiếu</span><span className="stat-value val-blue">{profileData.ticker}</span></div>
              <div className="stat-item"><span className="stat-label">Vốn điều lệ</span><span className="stat-value">{displayCharterCapital}</span></div>
              <div className="stat-item"><span className="stat-label">Sàn giao dịch</span><span className="stat-value val-blue">{profileData.exchange}</span></div>
              <div className="stat-item"><span className="stat-label">KL CP đang niêm yết</span><span className="stat-value">{profileData.listed_shares}</span></div>
              <div className="stat-item"><span className="stat-label">Nhóm ngành</span><span className="stat-value val-blue">{profileData.industry}</span></div>
              <div className="stat-item" style={{ alignItems: 'center' }}>
                <span className="stat-label">KL CP đang lưu hành</span>
                <div style={{ textAlign: 'right' }}>
                  <span className="stat-value">{profileData.outstanding_shares}</span><br />
                  <span style={{ fontSize: '11px', color: '#848e9c' }}>(100%)</span>
                </div>
              </div>
              <div className="stat-item"><span className="stat-label">Ngày giao dịch đầu tiên</span><span className="stat-value">{profileData.first_trading_date}</span></div>
              <div className="stat-item"><span className="stat-label">KL cổ phiếu niêm yết lần đầu</span><span className="stat-value">{profileData.first_listed_shares}</span></div>
              <div className="stat-item"><span className="stat-label">Giá đóng cửa phiên GD đầu tiên</span><span className="stat-value">{profileData.first_price}</span></div>
            </div>
          </div>

          <div className="cp-primary-card">
            <div className="cp-chart-container">
              <div className="cp-chart-title">Biểu đồ biến đổi vốn điều lệ</div>
              <div className="cp-bar-chart">
                <div className="cp-y-axis">
                  {charterCapitalHistory.axisTicks.map((tick, index) => (
                    <span key={`${tick}-${index}`}>{tick}</span>
                  ))}
                </div>
                {charterCapitalHistory.items.map((item, idx) => (
                  <div key={idx} className="cp-bar" style={{ height: `${item.height}%` }}>
                    <div className="bar-tooltip">
                      <strong style={{ color: '#fcd535' }}>{item.quarter}</strong><br />
                      {item.value} tỷ VNĐ
                    </div>
                  </div>
                ))}
              </div>
              <div className="cp-x-axis">
                {charterCapitalHistory.items.map((item, idx) => (
                  <span key={idx}>{item.quarter}</span>
                ))}
              </div>
              <div className="cp-chart-caption">
                Đơn vị hiển thị: tỷ đồng. Mốc mới nhất đang ở mức khoảng{' '}
                {charterCapitalHistory.items.length
                  ? `${charterCapitalHistory.items[charterCapitalHistory.items.length - 1].value} tỷ đồng`
                  : 'đang cập nhật'}.
              </div>
            </div>
          </div>

          <div className="profile-section-card">
            <h4>Tổng quan doanh nghiệp</h4>
            {profileData.company_description ? (
              <p className="profile-section-description">{profileData.company_description}</p>
            ) : (
              <p className="profile-empty">Chưa đồng bộ được phần mô tả doanh nghiệp từ nguồn dữ liệu trực tuyến.</p>
            )}
          </div>

          <div className="cp-primary-card">
            <h4>Tổ chức tư vấn niêm yết</h4>
            <div className="audit-item">
              {listingAdvisor?.link ? (
                <a href={listingAdvisor.link} target="_blank" rel="noopener noreferrer" className="audit-name">
                  {listingAdvisor.name} ↗
                </a>
              ) : (
                <span className="audit-name">{listingAdvisor?.name || 'Chưa có dữ liệu tư vấn niêm yết'}</span>
              )}
            </div>
          </div>
        </div>

        <div className="cp-right">
          <div className="cp-primary-card">
            <h4>Hồ sơ đồng bộ tự động</h4>
            <div className="audit-list">
              {profileData.website && (
                <div className="audit-item">
                  <span className="audit-year">Website</span>
                  <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="audit-name">
                    {profileData.website} ↗
                  </a>
                </div>
              )}
              {profileData.phone && (
                <div className="audit-item">
                  <span className="audit-year">Điện thoại</span>
                  <span className="audit-name">{profileData.phone}</span>
                </div>
              )}
              {profileData.email && (
                <div className="audit-item">
                  <span className="audit-year">Email</span>
                  <span className="audit-name">{profileData.email}</span>
                </div>
              )}
              {profileData.auditor && (
                <div className="audit-item">
                  <span className="audit-year">Kiểm toán</span>
                  <span className="audit-name">{profileData.auditor}</span>
                </div>
              )}
              {profileData.address && (
                <div className="audit-item" style={{ alignItems: 'flex-start' }}>
                  <span className="audit-year">Địa chỉ</span>
                  <span className="audit-name" style={{ textAlign: 'right', lineHeight: 1.5 }}>{profileData.address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="cp-primary-card">
            <h4>Tổ chức kiểm toán</h4>
            <div className="audit-list">
              {auditorTimeline.map((auditor, i) => (
                <div key={i} className="audit-item">
                  <span className="audit-year">{auditor.year}</span>
                  {auditor.link ? (
                    <a href={auditor.link} target="_blank" rel="noopener noreferrer" className="audit-name">
                      {auditor.name} ↗
                    </a>
                  ) : (
                    <span className="audit-name">{auditor.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="cp-secondary-grid">
        <div className="profile-section-card">
          <h4>Ban lãnh đạo nổi bật</h4>
          {profileData.leadership?.length ? (
            <div className="profile-rich-list">
              {profileData.leadership.map((leader, index) => (
                <div key={`${leader.name}-${index}`} className="profile-rich-item">
                  <div className="profile-rich-main">
                    <span className="profile-rich-name">{leader.name}</span>
                    <span className="profile-rich-subtitle">{leader.position}</span>
                  </div>
                  <div className="profile-rich-meta">
                    {leader.ownership_percent && <span className="profile-chip">{leader.ownership_percent}</span>}
                    {leader.updated_at && <span className="profile-rich-subtitle">{leader.updated_at}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-empty">Chưa có dữ liệu lãnh đạo từ nguồn crawl tại thời điểm hiện tại.</p>
          )}
        </div>

        <div className="profile-section-card">
          <h4>Cổ đông lớn</h4>
          {profileData.major_shareholders?.length ? (
            <div className="profile-rich-list">
              {profileData.major_shareholders.map((holder, index) => (
                <div key={`${holder.name}-${index}`} className="profile-rich-item">
                  <div className="profile-rich-main">
                    <span className="profile-rich-name">{holder.name}</span>
                    {holder.shares && <span className="profile-rich-subtitle">{holder.shares} cổ phiếu</span>}
                  </div>
                  <div className="profile-rich-meta">
                    {holder.ownership_percent && <span className="profile-chip">{holder.ownership_percent}</span>}
                    {holder.updated_at && <span className="profile-rich-subtitle">{holder.updated_at}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-empty">Chưa có dữ liệu cổ đông lớn từ nguồn crawl tại thời điểm hiện tại.</p>
          )}
        </div>
      </div>

      {/* Financial Highlights */}
      <FinancialHighlights ticker={ticker} language={language} isLightTheme={isLightTheme} />

      {/* Peer Comparison */}
      <PeerComparison activeTicker={ticker} language={language} isLightTheme={isLightTheme} />
    </div>
  );
}
