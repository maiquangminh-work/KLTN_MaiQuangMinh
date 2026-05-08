const ABOUT_IMAGES = {
  hero: 'https://images.pexels.com/photos/7567444/pexels-photo-7567444.jpeg?auto=compress&cs=tinysrgb&w=1600',
  research: 'https://images.pexels.com/photos/7567434/pexels-photo-7567434.jpeg?auto=compress&cs=tinysrgb&w=1400',
};

const COPY = {
  vi: {
    eyebrow: 'About MinSight',
    title: 'Nền tảng đọc triển vọng cổ phiếu ngân hàng bằng dữ liệu, mô hình AI và bối cảnh thị trường.',
    subtitle:
      'MinSight Banking AI được xây dựng cho khóa luận và demo sản phẩm: gom dữ liệu giá, đặc trưng kỹ thuật, xác suất dự báo, tin tức và hồ sơ ngân hàng vào một trải nghiệm phân tích có kiểm chứng.',
    primaryAction: 'Mở dashboard',
    secondaryAction: 'Xem tin tức',
    statusLabel: 'Trạng thái hệ thống',
    statusValue: 'Demo học thuật đang vận hành',
    heroNote:
      'Hệ thống ưu tiên diễn giải rõ ràng: người dùng thấy khuyến nghị, độ tin cậy, vùng giá quan trọng và nguồn tham chiếu trước khi đi sâu vào chi tiết mô hình.',
    metrics: [
      { value: '10', label: 'mã ngân hàng hỗ trợ' },
      { value: 'H=5', label: 'chân trời dự báo' },
      { value: '3 lớp', label: 'giá, AI, bối cảnh' },
      { value: '5 seed', label: 'ensemble giảm phương sai' },
    ],
    researchEyebrow: 'Nền tảng nghiên cứu',
    researchTitle: 'Từ dữ liệu thô đến tín hiệu có thể giải thích',
    researchBody:
      'Dự án không chỉ hiển thị chart. Backend đồng bộ dữ liệu, tiền xử lý feature, chạy CNN-LSTM-Attention và đưa kết quả qua lớp xác suất để biến tín hiệu kỹ thuật thành góc nhìn dễ đọc hơn.',
    pipeline: [
      {
        title: 'Thu thập & chuẩn hóa',
        body: 'Dữ liệu OHLCV được lưu vào SQLite, sau đó xuất sang bộ feature đã xử lý cho từng mã.',
      },
      {
        title: 'Mô hình dự báo',
        body: 'CNN trích xuất mẫu ngắn hạn, LSTM học chuỗi thời gian, Attention làm rõ mốc dữ liệu được mô hình chú ý.',
      },
      {
        title: 'Hiệu chỉnh xác suất',
        body: 'Temperature scaling và confidence gate giúp hạn chế tín hiệu quá tự tin khi xác suất chưa đủ chênh lệch.',
      },
      {
        title: 'Giao diện quyết định',
        body: 'Dashboard gom khuyến nghị, độ tin cậy, vùng giá, tin tức và hồ sơ doanh nghiệp vào cùng một luồng đọc.',
      },
    ],
    principlesEyebrow: 'Nguyên tắc sản phẩm',
    principlesTitle: 'Thiết kế cho người cần ra quyết định có kỷ luật',
    principles: [
      {
        title: 'Kết luận trước',
        body: 'Người dùng thấy tín hiệu chính và mức độ tin cậy ngay đầu luồng, không phải tự ghép dữ liệu rời rạc.',
      },
      {
        title: 'Có căn cứ kiểm tra',
        body: 'Mỗi góc nhìn đều đi kèm dữ liệu giá, attention, tin tức hoặc chỉ số hồ sơ để người dùng kiểm chứng.',
      },
      {
        title: 'Không thần thánh hóa AI',
        body: 'Mô hình là công cụ hỗ trợ phân tích, không thay thế quản trị rủi ro hay quyết định đầu tư cá nhân.',
      },
    ],
    scopeEyebrow: 'Phạm vi',
    scopeTitle: 'Phù hợp để demo, trình bày khóa luận và mở rộng sản phẩm',
    scopeItems: [
      'Trọng tâm nghiên cứu: VCB, BID, CTG.',
      'Mở rộng demo: MBB, TCB, VPB, ACB, HDB, SHB, VIB.',
      'Backend FastAPI, frontend React/Vite, dữ liệu vận hành từ CSV processed và SQLite.',
      'Các chỉ báo và khuyến nghị phục vụ tham khảo, không phải lời khuyên đầu tư bắt buộc.',
    ],
    footerTitle: 'Mục tiêu cuối cùng',
    footerBody:
      'Tạo một hệ thống giúp người dùng mới đọc cổ phiếu ngân hàng nhanh hơn, có căn cứ hơn và biết khi nào nên quan sát thêm thay vì hành động vội.',
  },
  en: {
    eyebrow: 'About MinSight',
    title: 'A banking-equity outlook platform built around data, AI forecasts, and market context.',
    subtitle:
      'MinSight Banking AI combines price data, technical features, forecast probabilities, news, and bank profiles into a verifiable analysis workflow for an academic demo and product prototype.',
    primaryAction: 'Open dashboard',
    secondaryAction: 'Read news',
    statusLabel: 'System status',
    statusValue: 'Academic demo running',
    heroNote:
      'The product is designed for explainability: users see the signal, confidence, key price levels, and references before drilling into model details.',
    metrics: [
      { value: '10', label: 'supported banking tickers' },
      { value: 'H=5', label: 'forecast horizon' },
      { value: '3 layers', label: 'price, AI, context' },
      { value: '5 seeds', label: 'variance-aware ensemble' },
    ],
    researchEyebrow: 'Research foundation',
    researchTitle: 'From raw market data to explainable signals',
    researchBody:
      'This is more than a chart interface. The backend syncs data, engineers features, runs CNN-LSTM-Attention, then applies a probability layer to turn technical signals into a readable outlook.',
    pipeline: [
      {
        title: 'Collect & normalize',
        body: 'OHLCV data is stored in SQLite and exported into processed feature sets for each ticker.',
      },
      {
        title: 'Forecast model',
        body: 'CNN extracts short-term patterns, LSTM learns time dependencies, and Attention highlights influential windows.',
      },
      {
        title: 'Probability calibration',
        body: 'Temperature scaling and a confidence gate reduce overconfident actions when probability edges are weak.',
      },
      {
        title: 'Decision interface',
        body: 'The dashboard combines recommendation, confidence, price zones, news, and company context in one flow.',
      },
    ],
    principlesEyebrow: 'Product principles',
    principlesTitle: 'Designed for disciplined decision-making',
    principles: [
      {
        title: 'Conclusion first',
        body: 'Users see the primary signal and confidence level before inspecting secondary evidence.',
      },
      {
        title: 'Evidence attached',
        body: 'Each view is backed by price data, attention, news, or company-profile references.',
      },
      {
        title: 'AI with boundaries',
        body: 'The model supports analysis. It does not replace risk management or personal investment decisions.',
      },
    ],
    scopeEyebrow: 'Scope',
    scopeTitle: 'Ready for thesis presentation, demo usage, and future product expansion',
    scopeItems: [
      'Research focus: VCB, BID, CTG.',
      'Demo expansion: MBB, TCB, VPB, ACB, HDB, SHB, VIB.',
      'FastAPI backend, React/Vite frontend, operational data from processed CSV and SQLite.',
      'Signals are reference material, not mandatory investment advice.',
    ],
    footerTitle: 'End goal',
    footerBody:
      'Help new users read banking stocks faster, verify the reasoning more clearly, and know when observation is better than rushed action.',
  },
};

function AboutSectionStudio({ language, onOpenChart, onOpenNews }) {
  const copy = COPY[language] || COPY.vi;

  return (
    <section className="about-pro-shell">
      <section className="about-pro-hero">
        <div className="about-pro-hero-copy">
          <span className="about-pro-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
          <div className="about-pro-actions">
            <button type="button" className="about-primary-btn" onClick={onOpenChart}>
              {copy.primaryAction}
            </button>
            <button type="button" className="about-secondary-btn" onClick={onOpenNews}>
              {copy.secondaryAction}
            </button>
          </div>
        </div>

        <div className="about-pro-hero-panel">
          <div
            className="about-pro-hero-image"
            style={{ backgroundImage: `linear-gradient(180deg, rgba(12, 17, 24, 0.06), rgba(12, 17, 24, 0.64)), url("${ABOUT_IMAGES.hero}")` }}
          />
          <div className="about-pro-status">
            <span>{copy.statusLabel}</span>
            <strong>{copy.statusValue}</strong>
            <p>{copy.heroNote}</p>
          </div>
        </div>
      </section>

      <section className="about-pro-metrics" aria-label="Project metrics">
        {copy.metrics.map((item) => (
          <div key={item.label} className="about-pro-metric">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <section className="about-pro-research">
        <div
          className="about-pro-research-media"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(12, 17, 24, 0.10), rgba(12, 17, 24, 0.50)), url("${ABOUT_IMAGES.research}")` }}
        />
        <div className="about-pro-research-copy">
          <span className="about-pro-eyebrow">{copy.researchEyebrow}</span>
          <h3>{copy.researchTitle}</h3>
          <p>{copy.researchBody}</p>
          <div className="about-pro-pipeline">
            {copy.pipeline.map((item, index) => (
              <article key={item.title} className="about-pro-pipeline-item">
                <span className="about-pro-step">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-pro-principles">
        <div className="about-pro-section-head">
          <span className="about-pro-eyebrow">{copy.principlesEyebrow}</span>
          <h3>{copy.principlesTitle}</h3>
        </div>
        <div className="about-pro-principle-grid">
          {copy.principles.map((item) => (
            <article key={item.title} className="about-pro-principle">
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-pro-scope">
        <div>
          <span className="about-pro-eyebrow">{copy.scopeEyebrow}</span>
          <h3>{copy.scopeTitle}</h3>
        </div>
        <div className="about-pro-scope-list">
          {copy.scopeItems.map((item) => (
            <div key={item} className="about-pro-scope-item">
              <span />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="about-pro-footer">
        <h3>{copy.footerTitle}</h3>
        <p>{copy.footerBody}</p>
      </section>
    </section>
  );
}

export default AboutSectionStudio;
