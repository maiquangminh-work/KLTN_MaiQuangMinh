const COPY = {
  vi: {
    brand: 'FinSight Banking AI',
    summary: 'Nền tảng theo dõi triển vọng cổ phiếu ngân hàng.',
    quickLinks: 'Điều hướng nhanh',
    platform: 'Nền tảng',
    disclaimerTitle: 'Lưu ý sử dụng',
    chart: 'Biểu đồ kỹ thuật',
    info: 'Thông tin cơ bản',
    news: 'Tin tức thị trường',
    model: 'Hiệu suất AI',
    about: 'Về chúng tôi',
    methodology: 'Phương pháp đánh giá',
    dataSources: 'Nguồn dữ liệu',
    support: 'Hỗ trợ người mới',
    disclaimer:
      'Website cung cấp công cụ hỗ trợ phân tích và diễn giải dữ liệu. Đây không phải khuyến nghị đầu tư bắt buộc hay cam kết lợi nhuận.',
    rights: 'Hỗ trợ đọc triển vọng, tin tức và hồ sơ doanh nghiệp.',
  },
  en: {
    brand: 'FinSight Banking AI',
    summary: 'A platform for reading banking-stock outlook faster.',
    quickLinks: 'Quick links',
    platform: 'Platform',
    disclaimerTitle: 'Usage note',
    chart: 'Technical view',
    info: 'Company profile',
    news: 'Market news',
    model: 'AI Performance',
    about: 'About us',
    methodology: 'Methodology',
    dataSources: 'Data sources',
    support: 'Beginner support',
    disclaimer:
      'The website is designed to support analysis and interpretation. It is not a mandatory investment recommendation or a profit guarantee.',
    rights: 'Built to support outlook reading, news context, and company profiles.',
  },
};

function FooterSectionV2({ language, onOpenChart, onOpenInfo, onOpenNews, onOpenAbout, onOpenModel }) {
  const copy = COPY[language] || COPY.vi;

  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <div className="site-footer__logo">
            <span className="site-footer__logo-dot" />
          </div>
          <div className="site-footer__copy">
            <h3>{copy.brand}</h3>
            <p>{copy.summary}</p>
          </div>
        </div>

        <div className="site-footer__column">
          <span className="site-footer__title">{copy.quickLinks}</span>
          <button type="button" className="site-footer__link" onClick={onOpenChart}>{copy.chart}</button>
          <button type="button" className="site-footer__link" onClick={onOpenInfo}>{copy.info}</button>
          <button type="button" className="site-footer__link" onClick={onOpenNews}>{copy.news}</button>
          <button type="button" className="site-footer__link" onClick={onOpenAbout}>{copy.about}</button>
        </div>

        <div className="site-footer__column">
          <span className="site-footer__title">{copy.platform}</span>
          <span className="site-footer__text">{copy.methodology}</span>
          <span className="site-footer__text">{copy.dataSources}</span>
          <span className="site-footer__text">{copy.support}</span>
        </div>

        <div className="site-footer__column">
          <span className="site-footer__title">{copy.disclaimerTitle}</span>
          <p className="site-footer__disclaimer">{copy.disclaimer}</p>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>© 2026 FinSight Banking AI</span>
        <span>{copy.rights}</span>
      </div>
    </footer>
  );
}

export default FooterSectionV2;
