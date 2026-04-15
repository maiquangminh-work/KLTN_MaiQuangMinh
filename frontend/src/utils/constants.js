export const NEWS_BANK_ALIASES = {
  ALL: [],
  VCB: ['vcb', 'vietcombank', 'ngoại thương', 'vietcom bank'],
  BID: ['bid', 'bidv', 'đầu tư và phát triển'],
  CTG: ['ctg', 'vietinbank', 'công thương', 'vietin bank'],
};

export const TRACKED_NEWS_SOURCES = ['CafeF', 'Vietstock', 'VNExpress', 'Báo Đầu Tư'];

export const BANK_BRAND_THEMES = {
  VCB: {
    accent: '#1f8f5f',
    accentSoft: 'rgba(31, 143, 95, 0.18)',
    glow: 'rgba(31, 143, 95, 0.30)',
  },
  BID: {
    accent: '#0b4a7b',
    accentSoft: 'rgba(11, 74, 123, 0.20)',
    glow: 'rgba(11, 74, 123, 0.32)',
  },
  CTG: {
    accent: '#1f65b3',
    accentSoft: 'rgba(31, 101, 179, 0.18)',
    glow: 'rgba(31, 101, 179, 0.28)',
  },
};

export const BANK_HERO_BACKDROPS = {
  VCB: {
    image: 'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg?auto=compress&cs=tinysrgb&w=1600',
    wordmark: 'Vietcombank',
    descriptor: 'Ngân hàng dẫn dắt nhóm thương mại quốc doanh',
  },
  BID: {
    image: 'https://images.pexels.com/photos/323705/pexels-photo-323705.jpeg?auto=compress&cs=tinysrgb&w=1600',
    wordmark: 'BIDV',
    descriptor: 'Đầu tư và phát triển với dấu ấn hạ tầng tài chính',
  },
  CTG: {
    image: 'https://images.pexels.com/photos/210607/pexels-photo-210607.jpeg?auto=compress&cs=tinysrgb&w=1600',
    wordmark: 'VietinBank',
    descriptor: 'Thương hiệu ngân hàng công thương giàu nhận diện',
  },
};

export const VALID_TICKERS = ['VCB', 'BID', 'CTG'];

/**
 * Dữ liệu tài chính cơ bản 3 ngân hàng — dùng cho Quick Stats Banner + Financial Highlights.
 * Nguồn: BCTC hợp nhất Q4/2024 và báo cáo thường niên 2024.
 */
export const BANK_FINANCIAL_DATA = {
  VCB: {
    pe: 14.5, pb: 3.02, eps: 6537, roe: 22.3, roa: 1.61, nim: 3.32,
    marketCap: 502300, // tỷ VND
    avgVolume20: 3540000,
    totalAssets: 2190000, // tỷ VND
    loanGrowth: 16.2, // %
    nplRatio: 0.98, // %
    carRatio: 11.8, // %
    costToIncome: 30.5,
    dividendYield: 1.4,
    yearlyMetrics: [
      { year: '2020', roe: 17.4, roa: 1.31, nim: 2.80, npl: 0.62 },
      { year: '2021', roe: 19.6, roa: 1.38, nim: 2.95, npl: 0.64 },
      { year: '2022', roe: 21.2, roa: 1.50, nim: 3.15, npl: 0.68 },
      { year: '2023', roe: 21.8, roa: 1.56, nim: 3.25, npl: 0.85 },
      { year: '2024', roe: 22.3, roa: 1.61, nim: 3.32, npl: 0.98 },
    ],
  },
  BID: {
    pe: 10.8, pb: 1.85, eps: 4310, roe: 18.1, roa: 0.88, nim: 2.82,
    marketCap: 271500,
    avgVolume20: 10200000,
    totalAssets: 2450000,
    loanGrowth: 14.8,
    nplRatio: 1.22,
    carRatio: 10.5,
    costToIncome: 33.2,
    dividendYield: 0,
    yearlyMetrics: [
      { year: '2020', roe: 13.5, roa: 0.65, nim: 2.45, npl: 1.76 },
      { year: '2021', roe: 15.8, roa: 0.72, nim: 2.60, npl: 1.42 },
      { year: '2022', roe: 17.1, roa: 0.80, nim: 2.70, npl: 1.15 },
      { year: '2023', roe: 17.6, roa: 0.84, nim: 2.78, npl: 1.18 },
      { year: '2024', roe: 18.1, roa: 0.88, nim: 2.82, npl: 1.22 },
    ],
  },
  CTG: {
    pe: 9.6, pb: 1.52, eps: 3450, roe: 16.4, roa: 0.82, nim: 2.65,
    marketCap: 198700,
    avgVolume20: 8100000,
    totalAssets: 2080000,
    loanGrowth: 13.5,
    nplRatio: 1.08,
    carRatio: 10.2,
    costToIncome: 35.1,
    dividendYield: 0,
    yearlyMetrics: [
      { year: '2020', roe: 11.2, roa: 0.56, nim: 2.20, npl: 0.93 },
      { year: '2021', roe: 13.0, roa: 0.63, nim: 2.35, npl: 0.90 },
      { year: '2022', roe: 14.8, roa: 0.72, nim: 2.50, npl: 0.82 },
      { year: '2023', roe: 15.7, roa: 0.78, nim: 2.58, npl: 1.01 },
      { year: '2024', roe: 16.4, roa: 0.82, nim: 2.65, npl: 1.08 },
    ],
  },
};

export const TIMEFRAME_OPTIONS = [
  { id: '1W', label: '1W', bars: 5 },
  { id: '1M', label: '1M', bars: 22 },
  { id: '3M', label: '3M', bars: 66 },
  { id: '6M', label: '6M', bars: 132 },
  { id: '1Y', label: '1Y', bars: 264 },
  { id: 'ALL', label: 'All', bars: null },
];

export const BANK_STATIC_DATA = {
  VCB: {
    tu_van: { name: 'Công ty TNHH Chứng khoán Ngân hàng TMCP Ngoại thương Việt Nam', link: 'https://vcbs.com.vn/' },
    auditors: [
      { year: '2024', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2023', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2022', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2020', name: 'Công ty TNHH KPMG Việt Nam', link: 'https://kpmg.com/xx/en.html' },
      { year: '2019', name: 'Công ty TNHH KPMG Việt Nam', link: 'https://kpmg.com/xx/en.html' },
      { year: '2018', name: 'Công ty TNHH KPMG Việt Nam', link: 'https://kpmg.com/xx/en.html' },
    ],
    chartData: [
      { quarter: 'Q4/2023', height: 65, value: '55,890' }, { quarter: 'Q1/2024', height: 65, value: '55,890' },
      { quarter: 'Q3/2024', height: 65, value: '55,890' }, { quarter: 'Q4/2024', height: 65, value: '55,890' },
      { quarter: 'Q1/2025', height: 90, value: '83,557' }, { quarter: 'Q2/2025', height: 90, value: '83,557' },
      { quarter: 'Q3/2025', height: 90, value: '83,557' }, { quarter: 'Q4/2025', height: 90, value: '83,557' },
    ],
  },
  BID: {
    tu_van: { name: 'Công ty CP Chứng khoán Ngân hàng Đầu tư và Phát triển Việt Nam', link: 'https://www.bsc.com.vn/' },
    auditors: [
      { year: '2024', name: 'Công ty TNHH KPMG Việt Nam', link: 'https://kpmg.com/xx/en.html' },
      { year: '2023', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2022', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2021', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2020', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2019', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
    ],
    chartData: [
      { quarter: 'Q4/2023', height: 60, value: '50,585' }, { quarter: 'Q1/2024', height: 60, value: '50,585' },
      { quarter: 'Q3/2024', height: 60, value: '50,585' }, { quarter: 'Q4/2024', height: 75, value: '57,004' },
      { quarter: 'Q1/2025', height: 75, value: '57,004' }, { quarter: 'Q2/2025', height: 90, value: '68,975' },
      { quarter: 'Q3/2025', height: 90, value: '68,975' }, { quarter: 'Q4/2025', height: 90, value: '68,975' },
    ],
  },
  CTG: {
    tu_van: { name: 'Công ty Cổ phần Chứng khoán SSI', link: 'https://www.ssi.com.vn' },
    auditors: [
      { year: '2024', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2023', name: 'Công ty TNHH Deloitte Việt Nam', link: 'https://www.deloitte.com/global/en.html' },
      { year: '2020', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2019', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2018', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
      { year: '2017', name: 'Công ty TNHH Ernst & Young Việt Nam', link: 'https://www.ey.com/en_sg' },
    ],
    chartData: [
      { quarter: 'Q4/2023', height: 60, value: '53,700' }, { quarter: 'Q1/2024', height: 60, value: '53,700' },
      { quarter: 'Q3/2024', height: 60, value: '53,700' }, { quarter: 'Q4/2024', height: 60, value: '53,700' },
      { quarter: 'Q1/2025', height: 60, value: '53,700' }, { quarter: 'Q2/2025', height: 60, value: '53,700' },
      { quarter: 'Q3/2025', height: 60, value: '53,700' }, { quarter: 'Q4/2025', height: 85, value: '77,670' },
    ],
  },
};
