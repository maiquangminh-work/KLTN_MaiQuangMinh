import { useState } from 'react';
import { BANK_FINANCIAL_DATA } from '../../utils/constants';

const COPY = {
  vi: {
    pe: 'P/E',
    pb: 'P/B',
    roe: 'ROE',
    nim: 'NIM',
    marketCap: 'V\u1ed0N HO\u00c1',
    avgVol: 'KL TB 20',
    eps: 'EPS',
    npl: 'N\u1ee2 X\u1ea4U',
    selectHint: 'Ch\u1ecdn m\u1ed9t ch\u1ec9 s\u1ed1 \u0111\u1ec3 xem c\u00e1ch \u0111\u1ecdc.',
    meaning: '\u00dd ngh\u0129a',
    quickRead: 'C\u00e1ch \u0111\u1ecdc nhanh',
    watch: 'C\u1ea7n ch\u00fa \u00fd',
    unit: {
      percent: '%',
      billion: 't\u1ef7',
      trillion: 'ngh\u00ecn t\u1ef7',
      vnd: '\u0111',
    },
  },
  en: {
    pe: 'P/E',
    pb: 'P/B',
    roe: 'ROE',
    nim: 'NIM',
    marketCap: 'MARKET CAP',
    avgVol: 'AVG VOL 20',
    eps: 'EPS',
    npl: 'NPL RATIO',
    selectHint: 'Select a metric to read the interpretation.',
    meaning: 'Meaning',
    quickRead: 'Quick read',
    watch: 'Watch point',
    unit: {
      percent: '%',
      billion: 'B',
      trillion: 'T',
      vnd: 'VND',
    },
  },
};

const EXPLANATIONS = {
  vi: {
    pe: {
      title: 'P/E - Gi\u00e1 tr\u00ean l\u1ee3i nhu\u1eadn',
      body: 'Cho bi\u1ebft nh\u00e0 \u0111\u1ea7u t\u01b0 \u0111ang tr\u1ea3 bao nhi\u00eau \u0111\u1ed3ng cho m\u1ed9t \u0111\u1ed3ng l\u1ee3i nhu\u1eadn h\u00e0ng n\u0103m. P/E th\u1ea5p c\u00f3 th\u1ec3 r\u1ebb h\u01a1n, nh\u01b0ng ph\u1ea3i \u0111\u1ecdc c\u00f9ng t\u0103ng tr\u01b0\u1edfng v\u00e0 ch\u1ea5t l\u01b0\u1ee3ng t\u00e0i s\u1ea3n.',
      read: 'Tham chi\u1ebfu ng\u00e2n h\u00e0ng: d\u01b0\u1edbi 12 th\u01b0\u1eddng h\u1ea5p d\u1eabn h\u01a1n; tr\u00ean 16 c\u1ea7n t\u0103ng tr\u01b0\u1edfng m\u1ea1nh \u0111\u1ec3 h\u1ed7 tr\u1ee3.',
    },
    pb: {
      title: 'P/B - Gi\u00e1 tr\u00ean gi\u00e1 tr\u1ecb s\u1ed5 s\u00e1ch',
      body: 'So s\u00e1nh gi\u00e1 tr\u1ecb th\u1ecb tr\u01b0\u1eddng v\u1edbi v\u1ed1n ch\u1ee7 s\u1edf h\u1eefu. V\u1edbi ng\u00e2n h\u00e0ng, P/B th\u01b0\u1eddng r\u1ea5t quan tr\u1ecdng v\u00ec ROE v\u00e0 ch\u1ea5t l\u01b0\u1ee3ng v\u1ed1n quy\u1ebft \u0111\u1ecbnh \u0111\u1ecbnh gi\u00e1.',
      read: 'D\u01b0\u1edbi 2.0 l\u00e0 t\u01b0\u01a1ng \u0111\u1ed1i r\u1ebb; tr\u00ean 3.0 c\u1ea7n ROE cao v\u00e0 b\u1ec1n v\u1eefng.',
    },
    roe: {
      title: 'ROE - L\u1ee3i nhu\u1eadn tr\u00ean v\u1ed1n ch\u1ee7',
      body: 'Cho bi\u1ebft ng\u00e2n h\u00e0ng t\u1ea1o ra bao nhi\u00eau l\u1ee3i nhu\u1eadn t\u1eeb v\u1ed1n ch\u1ee7 s\u1edf h\u1eefu. ROE cao th\u1ec3 hi\u1ec7n hi\u1ec7u qu\u1ea3 s\u1eed d\u1ee5ng v\u1ed1n t\u1ed1t.',
      read: 'Tr\u00ean 20% l\u00e0 m\u1ea1nh; 15-20% l\u00e0 ch\u1ea5p nh\u1eadn \u0111\u01b0\u1ee3c; d\u01b0\u1edbi 15% c\u1ea7n th\u1eadn tr\u1ecdng.',
    },
    nim: {
      title: 'NIM - Bi\u00ean l\u00e3i r\u00f2ng',
      body: 'Ph\u1ea3n \u00e1nh ch\u00eanh l\u1ec7ch l\u00e3i cho vay sau chi ph\u00ed huy \u0111\u1ed9ng. NIM cho th\u1ea5y s\u1ee9c m\u1ea1nh \u0111\u1ecbnh gi\u00e1, chi ph\u00ed v\u1ed1n v\u00e0 c\u01a1 c\u1ea5u cho vay.',
      read: 'Tr\u00ean 3% th\u01b0\u1eddng l\u00e0 kh\u1ecfe; NIM gi\u1ea3m c\u00f3 th\u1ec3 g\u00e2y \u00e1p l\u1ef1c l\u1ee3i nhu\u1eadn.',
    },
    marketCap: {
      title: 'V\u1ed1n ho\u00e1 th\u1ecb tr\u01b0\u1eddng',
      body: 'Cho bi\u1ebft gi\u00e1 tr\u1ecb th\u1ecb tr\u01b0\u1eddng c\u1ee7a ng\u00e2n h\u00e0ng. Ng\u00e2n h\u00e0ng v\u1ed1n ho\u00e1 l\u1edbn th\u01b0\u1eddng c\u00f3 thanh kho\u1ea3n v\u00e0 m\u1ee9c \u0111\u1ed9 quan t\u00e2m t\u1eeb t\u1ed5 ch\u1ee9c cao h\u01a1n.',
      read: 'D\u00f9ng \u0111\u1ec3 so s\u00e1nh quy m\u00f4 v\u00e0 thanh kho\u1ea3n, kh\u00f4ng d\u00f9ng m\u1ed9t m\u00ecnh \u0111\u1ec3 k\u1ebft lu\u1eadn r\u1ebb hay \u0111\u1eaft.',
    },
    avgVol: {
      title: 'Kh\u1ed1i l\u01b0\u1ee3ng trung b\u00ecnh 20 phi\u00ean',
      body: 'L\u00e0 kh\u1ed1i l\u01b0\u1ee3ng giao d\u1ecbch trung b\u00ecnh trong 20 phi\u00ean g\u1ea7n nh\u1ea5t. Ch\u1ec9 s\u1ed1 n\u00e0y gi\u00fap \u01b0\u1edbc l\u01b0\u1ee3ng thanh kho\u1ea3n v\u00e0 r\u1ee7i ro kh\u1edbp l\u1ec7nh.',
      read: 'Kh\u1ed1i l\u01b0\u1ee3ng cao gi\u00fap mua b\u00e1n d\u1ec5 h\u01a1n; kh\u1ed1i l\u01b0\u1ee3ng th\u1ea5p c\u00f3 th\u1ec3 l\u00e0m tr\u01b0\u1ee3t gi\u00e1.',
    },
    eps: {
      title: 'EPS - L\u00e3i tr\u00ean m\u1ed7i c\u1ed5 phi\u1ebfu',
      body: 'Cho bi\u1ebft l\u1ee3i nhu\u1eadn ph\u00e2n b\u1ed5 cho m\u1ed7i c\u1ed5 phi\u1ebfu. EPS l\u00e0 n\u1ec1n t\u1ea3ng \u0111\u1ec3 \u0111\u1ecdc P/E v\u00e0 s\u1ee9c m\u1ea1nh l\u1ee3i nhu\u1eadn.',
      read: 'EPS t\u0103ng l\u00e0 t\u00edch c\u1ef1c khi \u0111\u1ebfn t\u1eeb ho\u1ea1t \u0111\u1ed9ng c\u1ed1t l\u00f5i, kh\u00f4ng ph\u1ea3i l\u1ee3i nhu\u1eadn b\u1ea5t th\u01b0\u1eddng.',
    },
    npl: {
      title: 'N\u1ee3 x\u1ea5u - NPL ratio',
      body: 'Cho bi\u1ebft t\u1ef7 l\u1ec7 d\u01b0 n\u1ee3 c\u00f3 v\u1ea5n \u0111\u1ec1 tr\u1ea3 n\u1ee3. V\u1edbi ng\u00e2n h\u00e0ng, \u0111\u00e2y l\u00e0 ch\u1ec9 b\u00e1o r\u1ee7i ro c\u1ed1t l\u00f5i.',
      read: 'D\u01b0\u1edbi 1% l\u00e0 t\u1ed1t; tr\u00ean 1.5% c\u1ea7n theo d\u00f5i k\u1ef9 h\u01a1n.',
    },
  },
  en: {
    pe: {
      title: 'P/E - Price to earnings',
      body: 'Shows how many units investors pay for one unit of annual earnings. Lower P/E can imply cheaper valuation, but it must be read with growth and asset quality.',
      read: 'Banking reference: below 12 is usually more attractive; above 16 needs stronger growth support.',
    },
    pb: {
      title: 'P/B - Price to book',
      body: 'Compares market value with book equity. For banks, this is often more important than P/E because equity quality and ROE drive valuation.',
      read: 'Below 2.0 is relatively inexpensive; above 3.0 usually requires high, durable ROE.',
    },
    roe: {
      title: 'ROE - Return on equity',
      body: 'Measures profit generated from shareholder equity. Higher ROE means the bank converts capital into earnings more efficiently.',
      read: 'Above 20% is strong; 15-20% is acceptable; below 15% needs caution.',
    },
    nim: {
      title: 'NIM - Net interest margin',
      body: 'Measures lending spread after funding cost. It reflects pricing power, deposit cost, and loan mix.',
      read: 'Above 3% is healthy for many listed banks; falling NIM can pressure profit.',
    },
    marketCap: {
      title: 'Market cap',
      body: 'Shows the bank equity market value. Larger banks tend to have better liquidity and institutional coverage.',
      read: 'Use it to compare scale, liquidity, and market weight, not to judge cheap or expensive by itself.',
    },
    avgVol: {
      title: 'Average volume 20',
      body: 'Average trading volume over the latest 20 sessions. It helps estimate liquidity and execution risk.',
      read: 'Higher volume makes entries and exits easier; low volume can increase slippage.',
    },
    eps: {
      title: 'EPS - Earnings per share',
      body: 'Profit allocated to each share. EPS supports valuation ratios such as P/E and helps track earnings power.',
      read: 'Rising EPS is positive when it comes from core operations, not one-off gains.',
    },
    npl: {
      title: 'NPL ratio - Non-performing loans',
      body: 'Shows the share of loans with repayment problems. For banks, this is a core risk indicator.',
      read: 'Below 1% is strong; above 1.5% deserves closer monitoring.',
    },
  },
};

const CUSTOMER_NOTES = {
  vi: {
    pe: 'P/E th\u1ea5p kh\u00f4ng t\u1ef1 \u0111\u1ed9ng l\u00e0 r\u1ebb. N\u00ean ki\u1ec3m tra l\u1ee3i nhu\u1eadn c\u00f3 b\u1ec1n v\u1eefng kh\u00f4ng, n\u1ee3 x\u1ea5u c\u00f3 t\u0103ng kh\u00f4ng v\u00e0 c\u1ed5 phi\u1ebfu c\u00f3 \u0111ang b\u1ecb th\u1ecb tr\u01b0\u1eddng chi\u1ebft kh\u1ea5u v\u00ec r\u1ee7i ro n\u00e0o \u0111\u00f3 kh\u00f4ng.',
    pb: 'V\u1edbi ng\u00e2n h\u00e0ng, P/B n\u00ean \u0111\u1ecdc c\u00f9ng ROE. P/B cao c\u00f3 th\u1ec3 h\u1ee3p l\u00fd n\u1ebfu ROE cao v\u00e0 ch\u1ea5t l\u01b0\u1ee3ng t\u00e0i s\u1ea3n t\u1ed1t; P/B th\u1ea5p c\u00f3 th\u1ec3 l\u00e0 t\u00edn hi\u1ec7u r\u1ee7i ro n\u1ebfu n\u1ee3 x\u1ea5u ho\u1eb7c l\u1ee3i nhu\u1eadn suy y\u1ebfu.',
    roe: 'ROE cao cho th\u1ea5y kh\u1ea3 n\u0103ng sinh l\u1eddi t\u1ed1t, nh\u01b0ng c\u1ea7n xem n\u00f3 \u0111\u1ebfn t\u1eeb ho\u1ea1t \u0111\u1ed9ng c\u1ed1t l\u00f5i hay t\u1eeb y\u1ebfu t\u1ed1 b\u1ea5t th\u01b0\u1eddng. ROE duy tr\u00ec qua nhi\u1ec1u k\u1ef3 c\u00f3 gi\u00e1 tr\u1ecb h\u01a1n m\u1ed9t n\u0103m t\u0103ng \u0111\u1ed9t bi\u1ebfn.',
    nim: 'NIM t\u0103ng th\u01b0\u1eddng t\u00edch c\u1ef1c, nh\u01b0ng n\u1ebfu t\u0103ng do cho vay r\u1ee7i ro h\u01a1n th\u00ec c\u1ea7n th\u1eadn tr\u1ecdng. Khi l\u00e3i su\u1ea5t huy \u0111\u1ed9ng t\u0103ng, NIM c\u00f3 th\u1ec3 b\u1ecb co l\u1ea1i v\u00e0 \u1ea3nh h\u01b0\u1edfng l\u1ee3i nhu\u1eadn.',
    marketCap: 'V\u1ed1n ho\u00e1 l\u1edbn gi\u00fap giao d\u1ecbch d\u1ec5 h\u01a1n v\u00e0 th\u01b0\u1eddng \u0111\u01b0\u1ee3c t\u1ed5 ch\u1ee9c theo d\u00f5i nhi\u1ec1u h\u01a1n. Tuy nhi\u00ean, quy m\u00f4 l\u1edbn kh\u00f4ng c\u00f3 ngh\u0129a l\u00e0 bi\u00ean t\u0103ng gi\u00e1 s\u1ebd cao h\u01a1n.',
    avgVol: 'Thanh kho\u1ea3n cao gi\u00fap gi\u1ea3m r\u1ee7i ro kh\u00f3 mua/b\u00e1n. N\u1ebfu kh\u1ed1i l\u01b0\u1ee3ng \u0111\u1ed9t bi\u1ebfn so v\u1edbi trung b\u00ecnh, c\u1ea7n xem \u0111\u00f3 l\u00e0 d\u00f2ng ti\u1ec1n t\u00edch c\u1ef1c hay ch\u1ec9 l\u00e0 giao d\u1ecbch ng\u1eafn h\u1ea1n.',
    eps: 'EPS n\u00ean t\u0103ng \u0111\u1ec1u v\u00e0 \u0111\u1ebfn t\u1eeb l\u00e3i c\u1ed1t l\u00f5i. EPS cao nh\u01b0ng kh\u00f4ng b\u1ec1n v\u1eefng c\u00f3 th\u1ec3 l\u00e0m P/E tr\u00f4ng r\u1ebb h\u01a1n th\u1ef1c t\u1ebf.',
    npl: 'N\u1ee3 x\u1ea5u th\u1ea5p l\u00e0 t\u00edn hi\u1ec7u t\u1ed1t, nh\u01b0ng c\u1ea7n theo d\u00f5i xu h\u01b0\u1edbng. N\u1ee3 x\u1ea5u t\u0103ng nhanh c\u00f3 th\u1ec3 k\u00e9o theo chi ph\u00ed d\u1ef1 ph\u00f2ng cao v\u00e0 l\u00e0m gi\u1ea3m l\u1ee3i nhu\u1eadn.',
  },
  en: {
    pe: 'A low P/E is not automatically cheap. Check whether earnings are sustainable, asset quality is stable, and the market is discounting a specific risk.',
    pb: 'For banks, P/B should be read with ROE. A high P/B can be justified by durable ROE and clean assets; a low P/B can signal risk if asset quality or earnings weaken.',
    roe: 'High ROE is useful only when it comes from core operations. A stable multi-period ROE is more reliable than a one-off spike.',
    nim: 'Higher NIM is positive, but it should not come from taking excessive credit risk. Rising funding costs can compress NIM and pressure profits.',
    marketCap: 'Large market cap usually improves liquidity and institutional coverage, but size alone does not imply stronger upside.',
    avgVol: 'High liquidity reduces execution risk. If volume jumps versus average, check whether it reflects real accumulation or short-term speculative flow.',
    eps: 'EPS should grow from recurring earnings. High but unsustainable EPS can make valuation ratios look cheaper than they really are.',
    npl: 'Low NPL is positive, but the trend matters. Fast-rising NPL can raise provisioning cost and reduce future profit.',
  },
};

export default function QuickStatsBanner({ ticker, language }) {
  const copy = COPY[language] || COPY.vi;
  const explanations = EXPLANATIONS[language] || EXPLANATIONS.vi;
  const fd = BANK_FINANCIAL_DATA[ticker];
  const [selectedMetric, setSelectedMetric] = useState('pe');

  if (!fd) return null;

  const formatMktCap = (val) => {
    if (val >= 1000) return `${(val / 1000).toFixed(0)} ${copy.unit.trillion}`;
    return `${val.toLocaleString()} ${copy.unit.billion}`;
  };

  const formatVol = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
    return val.toLocaleString();
  };

  const stats = [
    { id: 'pe', label: copy.pe, value: fd.pe.toFixed(1), color: fd.pe < 12 ? '#0ecb81' : fd.pe > 16 ? '#f6465d' : '#fcd535' },
    { id: 'pb', label: copy.pb, value: fd.pb.toFixed(2), color: fd.pb < 2 ? '#0ecb81' : fd.pb > 3 ? '#f6465d' : '#fcd535' },
    { id: 'roe', label: copy.roe, value: `${fd.roe}%`, color: fd.roe >= 20 ? '#0ecb81' : fd.roe >= 15 ? '#fcd535' : '#f6465d' },
    { id: 'nim', label: copy.nim, value: `${fd.nim}%`, color: fd.nim >= 3 ? '#0ecb81' : fd.nim >= 2.5 ? '#fcd535' : '#f6465d' },
    { id: 'marketCap', label: copy.marketCap, value: formatMktCap(fd.marketCap), color: '#3b82f6' },
    { id: 'avgVol', label: copy.avgVol, value: formatVol(fd.avgVolume20), color: 'var(--text-primary)' },
    { id: 'eps', label: copy.eps, value: `${fd.eps.toLocaleString()}${copy.unit.vnd}`, color: 'var(--text-primary)' },
    { id: 'npl', label: copy.npl, value: `${fd.nplRatio}%`, color: fd.nplRatio < 1 ? '#0ecb81' : fd.nplRatio > 1.5 ? '#f6465d' : '#fcd535' },
  ];

  const activeMetric = stats.find((item) => item.id === selectedMetric);
  const activeExplanation = activeMetric ? explanations[activeMetric.id] : null;
  const customerNote = (CUSTOMER_NOTES[language] || CUSTOMER_NOTES.vi)[activeMetric?.id] || '';

  return (
    <div className="quick-stats-block">
      <div className="quick-stats-banner">
        {stats.map((stat) => {
          const isActive = selectedMetric === stat.id;
          return (
            <button
              key={stat.id}
              type="button"
              className={`quick-stat-item ${isActive ? 'active' : ''}`}
              onMouseEnter={() => setSelectedMetric(stat.id)}
              onFocus={() => setSelectedMetric(stat.id)}
              onClick={() => setSelectedMetric(stat.id)}
              aria-pressed={isActive}
            >
              <span className="quick-stat-label">{stat.label}</span>
              <span className="quick-stat-value" style={{ color: stat.color }}>{stat.value}</span>
            </button>
          );
        })}
      </div>

      <div className="quick-stat-explainer open">
        <div className="quick-stat-explainer-head">
          <span className="quick-stat-explainer-kicker">{activeMetric.label}</span>
          <strong style={{ color: activeMetric.color }}>{activeMetric.value}</strong>
        </div>
        <h4>{activeExplanation.title}</h4>
        <div className="quick-stat-detail-grid">
          <div className="quick-stat-detail-main">
            <span>{copy.meaning}</span>
            <p>{activeExplanation.body}</p>
          </div>
          <div className="quick-stat-detail-side">
            <div className="quick-stat-read">
              <span>{copy.quickRead}</span>
              <p>{activeExplanation.read}</p>
            </div>
            <div className="quick-stat-watch">
              <span>{copy.watch}</span>
              <p>{customerNote}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
