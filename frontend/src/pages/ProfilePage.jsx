import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketData } from '../contexts/MarketDataContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatCapitalBillions, formatVND, parseCapitalValueToBillions } from '../utils/formatting';
import { BANK_BRAND_THEMES, BANK_HERO_BACKDROPS, BANK_LOGOS, BANK_STATIC_DATA } from '../utils/constants';
import { fetchForeignOwnership, fetchProfileLive, fetchProfile } from '../api/profile';
import LoadingStatePanel from '../components/LoadingStatePanel';
import BankScreener from '../components/ui/BankScreener';
import FinancialHighlights from '../components/ui/FinancialHighlights';
import PeerComparison from '../components/ui/PeerComparison';

const COPY = {
  vi: {
    profileSource: 'Nguồn hồ sơ',
    updated: 'Cập nhật',
    syncingProfile: 'Hồ sơ doanh nghiệp đang được đồng bộ tự động.',
    liveStatus: 'Dữ liệu trực tuyến',
    referenceStatus: 'Thông tin tham chiếu',
    officialWebsite: 'Website chính thức',
    trackedGroup: 'Nhóm ngân hàng theo dõi',
    bankingIndustry: 'Ngân hàng',
    ticker: 'Mã giao dịch',
    exchange: 'Sàn niêm yết',
    charterCapital: 'Vốn điều lệ',
    charterCapitalSub: 'Quy mô vốn hiện tại',
    firstTradingDate: 'Ngày giao dịch đầu tiên',
    firstTradingDateSub: 'Mốc niêm yết lịch sử',
    updating: 'Đang cập nhật',
    coreListingInfo: 'Thông tin niêm yết cốt lõi',
    stockTicker: 'Mã cổ phiếu',
    tradingExchange: 'Sàn giao dịch',
    listedShares: 'KL CP đang niêm yết',
    industryGroup: 'Nhóm ngành',
    outstandingShares: 'KL CP đang lưu hành',
    firstListedShares: 'KL cổ phiếu niêm yết lần đầu',
    firstClosePrice: 'Giá đóng cửa phiên GD đầu tiên',
    capitalChartTitle: 'Biểu đồ biến đổi vốn điều lệ',
    capitalChartCaption: 'Đơn vị hiển thị: tỷ đồng. Mốc mới nhất đang ở mức khoảng',
    capitalUnit: 'tỷ đồng',
    chartTooltipUnit: 'tỷ VNĐ',
    companyOverview: 'Tổng quan doanh nghiệp',
    companyOverviewUpdating: 'Thông tin mô tả doanh nghiệp đang được cập nhật.',
    listingAdvisor: 'Tổ chức tư vấn niêm yết',
    companyInfo: 'Thông tin doanh nghiệp',
    source: 'Nguồn',
    phone: 'Điện thoại',
    auditor: 'Kiểm toán',
    address: 'Địa chỉ',
    auditFirm: 'Tổ chức kiểm toán',
    leadership: 'Ban lãnh đạo nổi bật',
    leadershipUpdating: 'Thông tin lãnh đạo đang được cập nhật.',
    shareholders: 'Cổ đông lớn',
    shareholdersUpdating: 'Thông tin cổ đông lớn đang được cập nhật.',
    foreignTrading: 'Room & ĐTNN',
    foreignRoomRemain: 'Room ngoại còn lại',
    foreignBuy: 'ĐTNN mua',
    foreignSell: 'ĐTNN bán',
    foreignNet: 'ĐTNN ròng',
    foreignNetValue: 'Giá trị ròng',
    foreignDate: 'Ngày giao dịch',
    foreignSource: 'Nguồn',
    foreignUpdating: 'Đang cập nhật số liệu room và giao dịch khối ngoại.',
    shares: 'cổ phiếu',
  },
  en: {
    profileSource: 'Profile source',
    updated: 'Updated',
    syncingProfile: 'Company profile is being synchronized automatically.',
    liveStatus: 'Live data',
    referenceStatus: 'Reference information',
    officialWebsite: 'Official website',
    trackedGroup: 'Tracked banking group',
    bankingIndustry: 'Banking',
    ticker: 'Ticker',
    exchange: 'Exchange',
    charterCapital: 'Charter capital',
    charterCapitalSub: 'Current capital scale',
    firstTradingDate: 'First trading date',
    firstTradingDateSub: 'Historical listing milestone',
    updating: 'Updating',
    coreListingInfo: 'Core listing information',
    stockTicker: 'Stock ticker',
    tradingExchange: 'Trading exchange',
    listedShares: 'Listed shares',
    industryGroup: 'Industry group',
    outstandingShares: 'Outstanding shares',
    firstListedShares: 'Initial listed shares',
    firstClosePrice: 'First session closing price',
    capitalChartTitle: 'Charter capital history',
    capitalChartCaption: 'Display unit: VND billion. Latest milestone is approximately',
    capitalUnit: 'VND billion',
    chartTooltipUnit: 'VND bn',
    companyOverview: 'Company overview',
    companyOverviewUpdating: 'Company overview is being updated.',
    listingAdvisor: 'Listing advisor',
    companyInfo: 'Company information',
    source: 'Source',
    phone: 'Phone',
    auditor: 'Auditor',
    address: 'Address',
    auditFirm: 'Audit firm',
    leadership: 'Key executives',
    leadershipUpdating: 'Executive information is being updated.',
    shareholders: 'Major shareholders',
    shareholdersUpdating: 'Major shareholder information is being updated.',
    foreignTrading: 'Foreign room & trading',
    foreignRoomRemain: 'Remaining foreign room',
    foreignBuy: 'Foreign buy',
    foreignSell: 'Foreign sell',
    foreignNet: 'Net foreign flow',
    foreignNetValue: 'Net value',
    foreignDate: 'Trading date',
    foreignSource: 'Source',
    foreignUpdating: 'Foreign room and trading data is being updated.',
    shares: 'shares',
  },
};

const HERO_DESCRIPTORS_EN = {
  VCB: 'A leading state-owned commercial bank',
  BID: 'Investment and development banking with a strong infrastructure footprint',
  CTG: 'A highly recognized industrial and commercial banking brand',
  MBB: 'A digital banking pioneer with a broad financial ecosystem',
  TCB: 'A private bank known for operating efficiency',
  VPB: 'A retail bank with a consumer finance ecosystem',
  ACB: 'A stable and resilient retail banking franchise',
  HDB: 'A multi-channel retail banking strategy',
  SHB: 'A banking bridge between Hanoi and Ho Chi Minh City',
  VIB: 'A retail banking player with strength in auto lending',
};

const BANK_NAMES_EN = {
  VCB: 'Joint Stock Commercial Bank for Foreign Trade of Vietnam',
  BID: 'Joint Stock Commercial Bank for Investment and Development of Vietnam',
  CTG: 'Vietnam Joint Stock Commercial Bank for Industry and Trade',
  MBB: 'Military Commercial Joint Stock Bank',
  TCB: 'Vietnam Technological and Commercial Joint Stock Bank',
  VPB: 'Vietnam Prosperity Joint Stock Commercial Bank',
  ACB: 'Asia Commercial Joint Stock Bank',
  HDB: 'Ho Chi Minh City Development Joint Stock Commercial Bank',
  SHB: 'Saigon - Hanoi Commercial Joint Stock Bank',
  VIB: 'Vietnam International Commercial Joint Stock Bank',
};

const MOJIBAKE_TOKENS = [
  '\u00C3',
  '\u00C2',
  '\u00C4',
  '\u00E1\u00BB',
  '\u00E1\u00BA',
  '\u00C6\u00B0',
  '\u00C6\u00A1',
  '\u00E2\u20AC\u00A6',
  '\u00E2\u20AC\u201C',
  '\u00E2\u20AC\u201D',
];

function hasMojibake(value) {
  return MOJIBAKE_TOKENS.some((token) => value.includes(token));
}

function repairDisplayText(value) {
  if (typeof value !== 'string' || !value || !hasMojibake(value)) {
    return value;
  }

  const decodeLatin1AsUtf8 = (input) => {
    try {
      const bytes = Uint8Array.from(Array.from(input, (char) => char.charCodeAt(0) & 0xff));
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return input;
    }
  };

  let repaired = decodeLatin1AsUtf8(value);
  if (repaired && repaired !== value && hasMojibake(repaired)) {
    repaired = decodeLatin1AsUtf8(repaired);
  }

  return repaired || value;
}

function repairNamedEntity(entity) {
  if (!entity) return entity;
  return {
    ...entity,
    name: repairDisplayText(entity.name),
    year: repairDisplayText(entity.year),
  };
}

function BankLogo({ src, fallbackSrc, ticker, className = '', decorative = false }) {
  const [failedSources, setFailedSources] = useState([]);
  const candidates = [src, fallbackSrc].filter(Boolean);
  const activeSrc = candidates.find((candidate) => !failedSources.includes(candidate));

  useEffect(() => {
    setFailedSources([]);
  }, [src, fallbackSrc]);

  if (!activeSrc) {
    return (
      <span className={`cp-logo-fallback ${className}`} aria-hidden={decorative ? 'true' : undefined}>
        {ticker}
      </span>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={decorative ? '' : ticker}
      className={className}
      onError={() => setFailedSources((prev) => (
        prev.includes(activeSrc) ? prev : [...prev, activeSrc]
      ))}
    />
  );
}

export default function ProfilePage() {
  const {
    ticker,
    data,
    profileData,
    setProfileData,
    setTicker,
    watchlistSnapshots,
    watchlistLoading,
  } = useMarketData();
  const { language, isLightTheme } = useTheme();
  const navigate = useNavigate();
  const copy = COPY[language] || COPY.vi;
  const [foreignOwnership, setForeignOwnership] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProfileData(null);
    fetchProfileLive(ticker)
      .then((res) => { if (!cancelled) setProfileData(res); })
      .catch(() => {
        fetchProfile(ticker)
          .then((res) => { if (!cancelled) setProfileData(res); })
          .catch(() => {});
      });
    return () => { cancelled = true; };
  }, [ticker, setProfileData]);

  useEffect(() => {
    let cancelled = false;
    fetchForeignOwnership(ticker)
      .then((res) => { if (!cancelled) setForeignOwnership(res); })
      .catch(() => { if (!cancelled) setForeignOwnership(null); });
    return () => { cancelled = true; };
  }, [ticker]);

  const profileFallback = BANK_STATIC_DATA[ticker];
  const brandTheme = BANK_BRAND_THEMES[ticker] || BANK_BRAND_THEMES.VCB;
  const profileHeroAsset = BANK_HERO_BACKDROPS[ticker] || BANK_HERO_BACKDROPS.VCB;
  const staticLogoUrl = BANK_LOGOS[ticker];
  const profileLogoUrl = profileData?.logo_url || staticLogoUrl;

  const charterCapitalHistory = useMemo(() => {
    const profileCapitalRows = profileData?.charter_capital_history || [];
    const fallbackCapitalRows = profileFallback?.chartData || [];
    const raw = profileCapitalRows.length >= fallbackCapitalRows.length
      ? profileCapitalRows
      : fallbackCapitalRows;
    const normalized = raw
      .map((item, index) => {
        const numericValue = parseCapitalValueToBillions(item.numeric_value ?? item.value);
        return { quarter: item.quarter || `${copy.updated} ${index + 1}`, numericValue };
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
  }, [profileData, profileFallback, copy.updated]);

  const displayCharterCapital = useMemo(() => {
    const normalizedValue = parseCapitalValueToBillions(profileData?.charter_capital);
    if (normalizedValue !== null) return `${formatCapitalBillions(normalizedValue)} ${copy.capitalUnit}`;
    return profileData?.charter_capital || copy.updating;
  }, [profileData, copy.capitalUnit, copy.updating]);

  const listingAdvisor = useMemo(() => repairNamedEntity(
    profileData?.listing_advisor?.name
      ? profileData.listing_advisor
      : profileFallback?.tu_van
  ), [profileData, profileFallback]);

  const auditorTimeline = useMemo(() => {
    const profileAuditors = profileData?.auditor_timeline || [];
    const fallbackAuditors = profileFallback?.auditors || [];
    const source = profileAuditors.length >= fallbackAuditors.length
      ? profileAuditors
      : fallbackAuditors;
    return source.map((auditor) => repairNamedEntity(auditor));
  }, [profileData, profileFallback]);

  const profileStatusClass = profileData?.profile_status === 'live' ? 'live' : 'fallback';
  const profileStatusLabel = profileData?.profile_status === 'live' ? copy.liveStatus : copy.referenceStatus;
  const profileSourceLabel = repairDisplayText(
    profileData?.profile_provider || profileData?.profile_source || 'KBS Security'
  );
  const heroDescriptor = language === 'en'
    ? HERO_DESCRIPTORS_EN[ticker] || HERO_DESCRIPTORS_EN.VCB
    : repairDisplayText(profileHeroAsset.descriptor);
  const displayCompanyName = language === 'en'
    ? BANK_NAMES_EN[ticker] || repairDisplayText(profileData?.company_name)
    : repairDisplayText(profileData?.company_name);
  const displayIndustry = language === 'en'
    ? copy.bankingIndustry
    : repairDisplayText(profileData?.industry) || copy.bankingIndustry;
  const displayCompanyDescription = language === 'en'
    ? heroDescriptor
    : repairDisplayText(profileData?.company_description);

  const profileHeroStyle = {
    '--brand-accent': brandTheme.accent,
    '--brand-accent-soft': brandTheme.accentSoft,
    '--brand-glow': brandTheme.glow,
  };

  const profileHighlights = [
    { label: copy.ticker, value: profileData?.ticker || ticker, sub: copy.trackedGroup },
    { label: copy.exchange, value: profileData?.exchange || 'HOSE', sub: displayIndustry },
    { label: copy.charterCapital, value: displayCharterCapital, sub: copy.charterCapitalSub },
    { label: copy.firstTradingDate, value: profileData?.first_trading_date || copy.updating, sub: copy.firstTradingDateSub },
  ];

  const currentForeignOwnership = foreignOwnership?.ticker === ticker ? foreignOwnership : null;
  const foreignRoom = currentForeignOwnership?.foreign_room || {};
  const foreignTrading = currentForeignOwnership?.foreign_trading_today || {};
  const hasForeignStats = Boolean(
    foreignRoom.remaining_volume !== undefined ||
    foreignTrading.foreign_buy_volume !== undefined ||
    foreignTrading.foreign_sell_volume !== undefined
  );
  const formatShareVolume = (value) => `${formatVND(value)} ${copy.shares}`;
  const formatMoneyValue = (value) => `${formatVND(value)} VN\u0110`;
  const foreignNetVolume = Number(foreignTrading.foreign_net_volume || 0);
  const foreignNetValue = Number(foreignTrading.foreign_net_value || 0);
  const foreignFlowColor = foreignNetVolume > 0
    ? 'var(--accent-green)'
    : foreignNetVolume < 0
      ? 'var(--accent-red)'
      : 'var(--text-primary)';

  const handleScreenerTickerSelect = (bank) => {
    if (!bank || bank === ticker) return;
    setTicker(bank);
    navigate(`/info/${bank}`);
  };

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
          <BankLogo src={profileLogoUrl} fallbackSrc={staticLogoUrl} ticker={ticker} decorative />
        </div>
        <div className="cp-hero-wordmark" aria-hidden="true">{profileHeroAsset.wordmark}</div>
        <div className="cp-header-main">
          <div className="cp-logo-container">
            <BankLogo src={profileLogoUrl} fallbackSrc={staticLogoUrl} ticker={ticker} className="cp-logo" />
          </div>
          <div className="cp-title-group">
            <h2>{displayCompanyName}</h2>
            <p>
              {profileSourceLabel
                ? `${copy.profileSource}: ${profileSourceLabel} • ${copy.updated}: ${profileData.profile_updated_at}`
                : copy.syncingProfile}
            </p>
            <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {heroDescriptor}
            </p>
          </div>
        </div>
        <div className="cp-header-side">
          <div className="cp-badge-row">
            <span className={`cp-badge ${profileStatusClass}`}>{profileStatusLabel}</span>
            {profileSourceLabel && (
              <span className="cp-badge">{profileSourceLabel}</span>
            )}
          </div>
          {profileData.website && (
            <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="cp-link-chip">
              {copy.officialWebsite} ↗
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

      <div className="cp-body">
        <div className="cp-left">
          <div className="cp-primary-card">
            <h4 className="cp-panel-title">{copy.coreListingInfo}</h4>
            <div className="cp-stats-grid">
              <div className="stat-item"><span className="stat-label">{copy.stockTicker}</span><span className="stat-value val-blue">{profileData.ticker}</span></div>
              <div className="stat-item"><span className="stat-label">{copy.charterCapital}</span><span className="stat-value">{displayCharterCapital}</span></div>
              <div className="stat-item"><span className="stat-label">{copy.tradingExchange}</span><span className="stat-value val-blue">{profileData.exchange}</span></div>
              <div className="stat-item"><span className="stat-label">{copy.listedShares}</span><span className="stat-value">{profileData.listed_shares}</span></div>
              <div className="stat-item"><span className="stat-label">{copy.industryGroup}</span><span className="stat-value val-blue">{displayIndustry}</span></div>
              <div className="stat-item" style={{ alignItems: 'center' }}>
                <span className="stat-label">{copy.outstandingShares}</span>
                <div style={{ textAlign: 'right' }}>
                  <span className="stat-value">{profileData.outstanding_shares}</span><br />
                  <span style={{ fontSize: '11px', color: '#848e9c' }}>(100%)</span>
                </div>
              </div>
              <div className="stat-item"><span className="stat-label">{copy.firstTradingDate}</span><span className="stat-value">{profileData.first_trading_date}</span></div>
              <div className="stat-item"><span className="stat-label">{copy.firstListedShares}</span><span className="stat-value">{profileData.first_listed_shares}</span></div>
              <div className="stat-item"><span className="stat-label">{copy.firstClosePrice}</span><span className="stat-value">{profileData.first_price}</span></div>
            </div>
          </div>

          <div className="cp-primary-card">
            <div className="cp-chart-container">
              <div className="cp-chart-title">{copy.capitalChartTitle}</div>
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
                      {item.value} {copy.chartTooltipUnit}
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
                {copy.capitalChartCaption}{' '}
                {charterCapitalHistory.items.length
                  ? `${charterCapitalHistory.items[charterCapitalHistory.items.length - 1].value} ${copy.capitalUnit}`
                  : copy.updating}.
              </div>
            </div>
          </div>

          <div className="profile-section-card">
            <h4>{copy.companyOverview}</h4>
            {displayCompanyDescription ? (
              <p className="profile-section-description">{displayCompanyDescription}</p>
            ) : (
              <p className="profile-empty">{copy.companyOverviewUpdating}</p>
            )}
          </div>

          <div className="cp-primary-card">
            <h4>{copy.listingAdvisor}</h4>
            <div className="audit-item">
              {listingAdvisor?.link ? (
                <a href={listingAdvisor.link} target="_blank" rel="noopener noreferrer" className="audit-name">
                  {listingAdvisor.name} ↗
                </a>
              ) : (
                <span className="audit-name">{listingAdvisor?.name || copy.updating}</span>
              )}
            </div>
          </div>
        </div>

        <div className="cp-right">
          <div className="cp-primary-card">
            <h4>{copy.companyInfo}</h4>
            <div className="audit-list">
              {profileSourceLabel && (
                <div className="audit-item">
                  <span className="audit-year">{copy.source}</span>
                  <span className="audit-name">{profileSourceLabel}</span>
                </div>
              )}
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
                  <span className="audit-year">{copy.phone}</span>
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
                  <span className="audit-year">{copy.auditor}</span>
                  <span className="audit-name">{profileData.auditor}</span>
                </div>
              )}
              {profileData.address && (
                <div className="audit-item" style={{ alignItems: 'flex-start' }}>
                  <span className="audit-year">{copy.address}</span>
                  <span className="audit-name" style={{ textAlign: 'right', lineHeight: 1.5 }}>{profileData.address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="cp-primary-card">
            <h4>{copy.foreignTrading}</h4>
            {hasForeignStats ? (
              <>
                <div className="foreign-flow-grid">
                  <div className="foreign-flow-item wide">
                    <span className="foreign-flow-label">{copy.foreignRoomRemain}</span>
                    <strong className="foreign-flow-value">{formatShareVolume(foreignRoom.remaining_volume)}</strong>
                  </div>
                  <div className="foreign-flow-item">
                    <span className="foreign-flow-label">{copy.foreignBuy}</span>
                    <strong className="foreign-flow-value val-green">{formatShareVolume(foreignTrading.foreign_buy_volume)}</strong>
                  </div>
                  <div className="foreign-flow-item">
                    <span className="foreign-flow-label">{copy.foreignSell}</span>
                    <strong className="foreign-flow-value val-red">{formatShareVolume(foreignTrading.foreign_sell_volume)}</strong>
                  </div>
                  <div className="foreign-flow-item">
                    <span className="foreign-flow-label">{copy.foreignNet}</span>
                    <strong className="foreign-flow-value" style={{ color: foreignFlowColor }}>
                      {foreignNetVolume >= 0 ? '+' : ''}{formatShareVolume(foreignNetVolume)}
                    </strong>
                  </div>
                  <div className="foreign-flow-item">
                    <span className="foreign-flow-label">{copy.foreignNetValue}</span>
                    <strong className="foreign-flow-value" style={{ color: foreignFlowColor }}>
                      {foreignNetValue >= 0 ? '+' : ''}{formatMoneyValue(foreignNetValue)}
                    </strong>
                  </div>
                </div>
                <div className="foreign-flow-meta">
                  <span>{copy.foreignDate}: {currentForeignOwnership?.trading_date || copy.updating}</span>
                  <span>{copy.foreignSource}: {currentForeignOwnership?.source || 'SSI iBoard'}</span>
                </div>
              </>
            ) : (
              <p className="profile-empty">{copy.foreignUpdating}</p>
            )}
          </div>

          <div className="cp-primary-card">
            <h4>{copy.auditFirm}</h4>
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
          <h4>{copy.leadership}</h4>
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
            <p className="profile-empty">{copy.leadershipUpdating}</p>
          )}
        </div>

        <div className="profile-section-card">
          <h4>{copy.shareholders}</h4>
          {profileData.major_shareholders?.length ? (
            <div className="profile-rich-list">
              {profileData.major_shareholders.map((holder, index) => (
                <div key={`${holder.name}-${index}`} className="profile-rich-item">
                  <div className="profile-rich-main">
                    <span className="profile-rich-name">{holder.name}</span>
                    {holder.shares && <span className="profile-rich-subtitle">{holder.shares} {copy.shares}</span>}
                  </div>
                  <div className="profile-rich-meta">
                    {holder.ownership_percent && <span className="profile-chip">{holder.ownership_percent}</span>}
                    {holder.updated_at && <span className="profile-rich-subtitle">{holder.updated_at}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-empty">{copy.shareholdersUpdating}</p>
          )}
        </div>
      </div>

      {/* Financial Highlights */}
      <FinancialHighlights ticker={ticker} language={language} isLightTheme={isLightTheme} />

      {/* Peer Comparison */}
      <PeerComparison activeTicker={ticker} language={language} isLightTheme={isLightTheme} />

      {/* Bank Screener */}
      <BankScreener
        activeTicker={ticker}
        language={language}
        isLightTheme={isLightTheme}
        snapshots={watchlistSnapshots}
        activeSnapshot={data}
        loading={watchlistLoading}
        onSelectTicker={handleScreenerTickerSelect}
      />
    </div>
  );
}


