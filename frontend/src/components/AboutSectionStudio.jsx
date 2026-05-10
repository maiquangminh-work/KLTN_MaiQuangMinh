const ABOUT_IMAGES = {
  hero: 'https://images.pexels.com/photos/7567444/pexels-photo-7567444.jpeg?auto=compress&cs=tinysrgb&w=1600',
  heroAlt1: 'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=1600',
  heroAlt2: 'https://images.pexels.com/photos/7567434/pexels-photo-7567434.jpeg?auto=compress&cs=tinysrgb&w=1600',
  research: 'https://images.pexels.com/photos/7567434/pexels-photo-7567434.jpeg?auto=compress&cs=tinysrgb&w=1400',
};

const BANK_LOGOS = {
  VCB: 'https://cdn.haitrieu.com/wp-content/uploads/2022/02/Logo-Vietcombank.png',
  BID: 'https://news.mbbank.com.vn/file-service/uploads/v1/images/c21788de-1a22-48e0-a4ca-7bda44d5b2b4-logo-bidv-20220426071253.jpg',
  CTG: 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-VietinBank-CTG-Slo.png',
  MBB: 'https://api.vietqr.io/img/MB.png',
  TCB: 'https://api.vietqr.io/img/TCB.png',
  VPB: 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-VPBank.png',
  ACB: 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-ACB.png',
  HDB: 'https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-HDBank.png',
  SHB: 'https://api.vietqr.io/img/SHB.png',
  VIB: 'https://upload.wikimedia.org/wikipedia/commons/5/55/LOGO-VIB-Blue.png',
};

const COPY = {
  vi: {
    eyebrow: 'MinSight Banking AI',
    title: 'Một trung tâm phân tích giúp nhà đầu tư đọc nhanh cơ hội trong nhóm cổ phiếu ngân hàng.',
    subtitle:
      'MinSight gom biểu đồ giá, tín hiệu AI, tin tức và hồ sơ ngân hàng vào một luồng ra quyết định gọn hơn: thấy cơ hội, hiểu rủi ro, rồi mới hành động.',
    primaryAction: 'Xem tín hiệu hiện tại',
    secondaryAction: 'Đọc bối cảnh thị trường',
    trustItems: ['Tín hiệu có xác suất', 'Có vùng giá tham chiếu', 'Có lớp kiểm soát rủi ro'],
    statusLabel: 'Góc nhìn nhà đầu tư',
    statusValue: 'Cơ hội trước, rủi ro ngay bên cạnh',
    heroNote:
      'Dashboard được thiết kế để nhà đầu tư không phải tự ghép nhiều nguồn rời rạc trước khi đánh giá một mã ngân hàng.',
    snapshot: [
      { label: 'Tín hiệu', value: 'Triển vọng + độ tin cậy' },
      { label: 'Bối cảnh', value: 'Tin tức + ngành ngân hàng' },
      { label: 'Hành động', value: 'Quan sát, mua, hoặc tránh' },
    ],
    marketingStats: [
      { value: '10', label: 'mã ngân hàng', note: 'theo dõi trong một dashboard' },
      { value: '2.000+', label: 'phiên giá lịch sử', note: 'làm nền cho phân tích xu hướng' },
      { value: '80%', label: 'rút ngắn thao tác đọc', note: 'ước tính trong luồng demo' },
      { value: '3 lớp', label: 'xác nhận tín hiệu', note: 'giá, AI và bối cảnh thị trường' },
    ],
    capabilityEyebrow: 'Dành cho nhà đầu tư',
    capabilityTitle: 'Tập trung vào những câu hỏi thật sự ảnh hưởng đến quyết định',
    capabilities: [
      {
        label: 'Opportunity',
        title: 'Mã nào đang đáng chú ý?',
        body: 'So sánh nhanh triển vọng giữa các ngân hàng để tìm mã có tín hiệu nổi bật hơn phần còn lại.',
      },
      {
        label: 'Risk',
        title: 'Rủi ro đã đủ rõ chưa?',
        body: 'Kết hợp biến động giá, xác suất mô hình và chất lượng dữ liệu để tránh hành động khi tín hiệu còn yếu.',
      },
      {
        label: 'Timing',
        title: 'Nên theo dõi ở vùng giá nào?',
        body: 'Dashboard đưa ra vùng giá và trạng thái để nhà đầu tư biết nên quan sát, chờ xác nhận hay hành động.',
      },
    ],
    researchEyebrow: 'Cách MinSight tạo luận điểm',
    researchTitle: 'Từ dữ liệu thị trường đến một góc nhìn đầu tư có thể kiểm chứng',
    researchBody:
      'Thay vì chỉ hiển thị nến giá, MinSight chuyển dữ liệu thành một chuỗi đọc dễ theo dõi: xu hướng, xác suất, độ tin cậy, bối cảnh và hành động gợi ý.',
    pipeline: [
      {
        title: 'Đọc diễn biến giá',
        body: 'Chuỗi OHLCV và chỉ báo kỹ thuật cho biết cổ phiếu đang ở trạng thái mạnh, yếu hay nhiễu.',
      },
      {
        title: 'Ước lượng xác suất',
        body: 'Mô hình AI chuyển dữ liệu lịch sử thành xác suất outperform, neutral hoặc underperform.',
      },
      {
        title: 'Kiểm tra bối cảnh',
        body: 'Tin tức và thông tin doanh nghiệp giúp tránh đọc tín hiệu giá một cách tách biệt khỏi thị trường.',
      },
      {
        title: 'Chốt góc nhìn hành động',
        body: 'Kết quả cuối cùng được trình bày bằng khuyến nghị, độ tin cậy và vùng giá cần theo dõi.',
      },
    ],
    principlesEyebrow: 'Trải nghiệm đầu tư',
    principlesTitle: 'Thiết kế để giảm nhiễu, không làm nhà đầu tư bị ngợp',
    principles: [
      {
        title: 'Kết luận rõ trước',
        body: 'Người dùng thấy mã đang nghiêng về tích cực, trung lập hay tiêu cực trước khi đọc chi tiết.',
      },
      {
        title: 'Luôn có lý do đi kèm',
        body: 'Tín hiệu không đứng một mình; nó được đặt cạnh dữ liệu giá, độ tin cậy và bối cảnh liên quan.',
      },
      {
        title: 'Biết khi nào nên đứng ngoài',
        body: 'Nếu xác suất chưa đủ mạnh, hệ thống ưu tiên nhãn quan sát thay vì ép người dùng hành động.',
      },
    ],
    governanceEyebrow: 'Kỷ luật rủi ro',
    governanceTitle: 'MinSight không cố biến mọi biến động thành cơ hội mua bán',
    governance: [
      { title: 'Confidence gate', body: 'Chặn tín hiệu hành động khi xác suất chưa tạo lợi thế đủ rõ.' },
      { title: 'Data quality', body: 'Gắn chất lượng dữ liệu để nhà đầu tư biết mức độ tin cậy của phiên phân tích.' },
      { title: 'Backtest mindset', body: 'Luận điểm được đặt trong tư duy kiểm định, không chỉ dựa trên cảm giác ngắn hạn.' },
      { title: 'Context first', body: 'Tin tức và trạng thái ngành được dùng để kiểm tra lại tín hiệu kỹ thuật.' },
    ],
    scopeEyebrow: 'Phạm vi theo dõi',
    scopeTitle: 'Phạm vi phân tích ngân hàng Việt Nam',
    scopeItems: [
      'Core: VCB, BID, CTG',
      'Demo: MBB, TCB, VPB, ACB, HDB, SHB, VIB',
      'Theo dõi xu hướng ngắn hạn',
      'Tín hiệu tham khảo, không thay thế quản trị rủi ro',
    ],
    footerTitle: 'Ra quyết định gọn hơn',
    footerBody:
      'Một màn hình để xem tín hiệu, bối cảnh và vùng cần theo dõi trước khi hành động.',
    closeEyebrow: 'Quy trình đầu tư',
    closeTitle: 'Theo dõi gọn, đọc nhanh, hành động có kiểm soát.',
    closeItems: [
      { title: 'Theo dõi', body: '10 mã ngân hàng trong một giao diện.' },
      { title: 'Đánh giá', body: 'Tín hiệu AI đặt cạnh tin tức và dữ liệu giá.' },
      { title: 'Hành động', body: 'Ưu tiên quan sát khi xác suất chưa đủ rõ.' },
    ],
    coverageTickers: ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB'],
  },
  en: {
    eyebrow: 'MinSight Banking AI',
    title: 'Một trung tâm phân tích giúp nhà đầu tư đọc nhanh cơ hội trong nhóm cổ phiếu ngân hàng.',
    subtitle:
      'MinSight gom biểu đồ giá, tín hiệu AI, tin tức và hồ sơ ngân hàng vào một luồng ra quyết định gọn hơn: thấy cơ hội, hiểu rủi ro, rồi mới hành động.',
    primaryAction: 'Xem tín hiệu hiện tại',
    secondaryAction: 'Đọc bối cảnh thị trường',
    trustItems: ['Tín hiệu có xác suất', 'Có vùng giá tham chiếu', 'Có lớp kiểm soát rủi ro'],
    statusLabel: 'Góc nhìn nhà đầu tư',
    statusValue: 'Cơ hội trước, rủi ro ngay bên cạnh',
    heroNote:
      'Dashboard được thiết kế để nhà đầu tư không phải tự ghép nhiều nguồn rời rạc trước khi đánh giá một mã ngân hàng.',
    snapshot: [
      { label: 'Tín hiệu', value: 'Triển vọng + độ tin cậy' },
      { label: 'Bối cảnh', value: 'Tin tức + ngành ngân hàng' },
      { label: 'Hành động', value: 'Quan sát, mua, hoặc tránh' },
    ],
    marketingStats: [
      { value: '10', label: 'banking tickers', note: 'tracked in one dashboard' },
      { value: '2,000+', label: 'historical sessions', note: 'used for trend analysis' },
      { value: '80%', label: 'fewer reading steps', note: 'estimated in demo workflow' },
      { value: '3 layers', label: 'signal validation', note: 'price, AI, and market context' },
    ],
    capabilityEyebrow: 'For investors',
    capabilityTitle: 'Focused on the questions that actually affect decisions',
    capabilities: [
      {
        label: 'Opportunity',
        title: 'Which ticker deserves attention?',
        body: 'Compare banking-stock outlooks quickly and surface names with stronger signals than peers.',
      },
      {
        label: 'Risk',
        title: 'Is the risk clear enough?',
        body: 'Combine price behavior, model probability, and data quality to avoid acting on weak signals.',
      },
      {
        label: 'Timing',
        title: 'Which price zone matters?',
        body: 'Use reference zones and signal state to decide whether to observe, wait for confirmation, or act.',
      },
    ],
    researchEyebrow: 'How MinSight builds an investment view',
    researchTitle: 'From market data to a verifiable investing thesis',
    researchBody:
      'Instead of only showing candlesticks, MinSight turns data into a readable flow: trend, probability, confidence, context, and suggested action.',
    pipeline: [
      {
        title: 'Read price behavior',
        body: 'OHLCV series and technical indicators show whether a stock is strong, weak, or noisy.',
      },
      {
        title: 'Estimate probability',
        body: 'The AI model translates historical behavior into outperform, neutral, or underperform probabilities.',
      },
      {
        title: 'Check context',
        body: 'News and company information prevent price signals from being read in isolation.',
      },
      {
        title: 'Form an action view',
        body: 'The final output is presented as recommendation, confidence, and price zones to monitor.',
      },
    ],
    principlesEyebrow: 'Investor experience',
    principlesTitle: 'Designed to reduce noise instead of overwhelming investors',
    principles: [
      {
        title: 'Clear conclusion first',
        body: 'Users see whether the ticker leans positive, neutral, or negative before reading details.',
      },
      {
        title: 'Reason attached',
        body: 'Signals sit beside price data, confidence, and relevant market context.',
      },
      {
        title: 'Know when to stay out',
        body: 'When probability is not strong enough, the system favors observation over forced action.',
      },
    ],
    governanceEyebrow: 'Risk discipline',
    governanceTitle: 'MinSight does not turn every price move into a trade idea',
    governance: [
      { title: 'Confidence gate', body: 'Action signals are blocked when probabilities do not show a clear edge.' },
      { title: 'Data quality', body: 'Data-quality labels show how much trust to place in each analysis session.' },
      { title: 'Backtest mindset', body: 'The thesis is framed with validation discipline, not just short-term intuition.' },
      { title: 'Context first', body: 'News and sector state are used to challenge pure technical signals.' },
    ],
    scopeEyebrow: 'Coverage scope',
    scopeTitle: 'Vietnam banking coverage',
    scopeItems: [
      'Core: VCB, BID, CTG',
      'Demo: MBB, TCB, VPB, ACB, HDB, SHB, VIB',
      'Short-term trend monitoring',
      'Reference signals, not a substitute for risk management',
    ],
    footerTitle: 'Cleaner decisions',
    footerBody:
      'One screen for signal, context, and price zones before action.',
    closeEyebrow: 'Quy trình đầu tư',
    closeTitle: 'Theo dõi gọn, đọc nhanh, hành động có kiểm soát.',
    closeItems: [
      { title: 'Theo dõi', body: '10 mã ngân hàng trong một giao diện.' },
      { title: 'Đánh giá', body: 'Tín hiệu AI đặt cạnh tin tức và dữ liệu giá.' },
      { title: 'Hành động', body: 'Ưu tiên quan sát khi xác suất chưa đủ rõ.' },
    ],
    coverageTickers: ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB'],
  },
};

function AboutSectionStudio({ language, onOpenChart, onOpenTicker, onOpenNews }) {
  const copy = COPY[language] || COPY.vi;

  return (
    <section className="about-cinematic-shell">
      <section
        className="about-cinematic-hero"
        style={{
          '--about-hero-1': `url("${ABOUT_IMAGES.hero}")`,
          '--about-hero-2': `url("${ABOUT_IMAGES.heroAlt1}")`,
          '--about-hero-3': `url("${ABOUT_IMAGES.heroAlt2}")`,
        }}
      >
        <div className="about-cinematic-copy">
          <span className="about-cinematic-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
          <div className="about-cinematic-actions">
            <button type="button" className="about-primary-btn about-cta-shine" onClick={onOpenChart}>
              {copy.primaryAction}
            </button>
            <button type="button" className="about-secondary-btn" onClick={onOpenNews}>
              {copy.secondaryAction}
            </button>
          </div>
          <div className="about-cinematic-trust">
            {copy.trustItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="about-cinematic-signal-board">
          <div className="about-cinematic-board-head">
            <span>{copy.statusLabel}</span>
            <strong>{copy.statusValue}</strong>
          </div>
          <p>{copy.heroNote}</p>
          <div className="about-cinematic-snapshot">
            {copy.snapshot.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="about-cinematic-pulse-line" />
        </div>
      </section>

      <section className="about-impact-rail" aria-label="Investor proof points">
        {copy.marketingStats.map((item) => (
          <article key={item.label} className="about-impact-stat">
            <strong>{item.value}</strong>
            <div>
              <span>{item.label}</span>
              <p>{item.note}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="about-decision-path">
        <div className="about-modern-section-head">
          <span className="about-cinematic-eyebrow">{copy.capabilityEyebrow}</span>
          <h3>{copy.capabilityTitle}</h3>
        </div>
        <div className="about-path-line">
          {copy.capabilities.map((item, index) => (
            <article key={item.title} className="about-path-item">
              <span className="about-path-index">{String(index + 1).padStart(2, '0')}</span>
              <small>{item.label}</small>
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-signal-studio">
        <div
          className="about-signal-image"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(12, 17, 24, 0.10), rgba(12, 17, 24, 0.58)), url("${ABOUT_IMAGES.research}")` }}
        />
        <div className="about-signal-copy">
          <span className="about-cinematic-eyebrow">{copy.researchEyebrow}</span>
          <h3>{copy.researchTitle}</h3>
          <p>{copy.researchBody}</p>
          <div className="about-signal-flow">
            {copy.pipeline.map((item, index) => (
              <article key={item.title} className="about-signal-step">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-investor-close">
        <div className="about-investor-close-head">
          <span className="about-cinematic-eyebrow">{copy.closeEyebrow}</span>
          <h3>{copy.closeTitle}</h3>
          <button type="button" className="about-primary-btn about-cta-shine" onClick={onOpenChart}>
            {copy.primaryAction}
          </button>
        </div>
        <div className="about-coverage-ticker" aria-label="Danh sách mã ngân hàng">
          {copy.coverageTickers.map((ticker) => (
            <button
              key={ticker}
              type="button"
              className="about-coverage-ticker-card"
              onClick={() => (onOpenTicker ? onOpenTicker(ticker) : onOpenChart?.())}
              style={{ '--bank-logo': `url("${BANK_LOGOS[ticker] || ''}")` }}
              title={`Mở dự báo ${ticker}`}
            >
              <span className="about-ticker-logo" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="about-close-steps">
          {copy.closeItems.map((item) => (
            <article key={item.title}>
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default AboutSectionStudio;
