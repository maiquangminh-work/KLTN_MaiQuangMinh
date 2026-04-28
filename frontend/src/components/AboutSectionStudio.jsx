const ABOUT_IMAGES = {
  hero: 'https://images.pexels.com/photos/20232209/pexels-photo-20232209.jpeg?cs=srgb&dl=pexels-jakubzerdzicki-20232209.jpg&fm=jpg',
  story: 'https://images.pexels.com/photos/3183183/pexels-photo-3183183.jpeg?cs=srgb&dl=pexels-fauxels-3183183.jpg&fm=jpg',
  methodology: 'https://images.pexels.com/photos/30309058/pexels-photo-30309058.jpeg?cs=srgb&dl=pexels-jakubzerdzicki-30309058.jpg&fm=jpg',
};

const COPY = {
  vi: {
    kicker: 'Về chúng tôi',
    title: 'Một nền tảng đọc triển vọng ngân hàng theo hướng rõ ràng, có căn cứ và dễ dùng cho người mới.',
    subtitle:
      'MinSight Banking AI gom dữ liệu giá, bối cảnh thị trường, hồ sơ doanh nghiệp và tin tức tham chiếu thành một luồng ra quyết định gọn hơn.',
    primaryAction: 'Mở dashboard kỹ thuật',
    secondaryAction: 'Xem tin tức thị trường',
    mediaChip: 'AI + Finance',
    mediaTitle: 'Kết luận trước, giải thích sau',
    mediaBody:
      'Trang được thiết kế để người dùng đọc ra kết luận chính chỉ trong vài giây đầu, còn các lớp dữ liệu sâu hơn luôn sẵn sàng khi cần kiểm tra thêm.',
    strip: [
      { label: 'Trọng tâm', value: 'Xu hướng 5 phiên' },
      { label: 'Dữ liệu', value: 'Giá + Tin tức + Hồ sơ' },
      { label: 'Đối tượng', value: 'Nhà đầu tư cá nhân' },
    ],
    storyTitle: 'Chúng tôi đang giải quyết bài toán gì?',
    storyBody:
      'Phần lớn người dùng cá nhân phải tự ghép chart, tin tức, hồ sơ doanh nghiệp và bối cảnh vĩ mô trước khi ra quyết định. Điều đó vừa tốn thời gian vừa dễ tạo cảm giác quá tải. MinSight Banking AI được xây dựng để nén các lớp thông tin đó thành một trải nghiệm đọc quyết định rõ hơn.',
    storyPoints: [
      'Một kết luận chính cần nổi bật hơn mọi tín hiệu phụ.',
      'Mỗi khuyến nghị nên đi kèm các mốc giá và nguồn tham chiếu.',
      'Người mới cần biết nên làm gì trước khi họ đọc toàn bộ dữ liệu.',
    ],
    methodologyTitle: 'Phương pháp hệ thống đang dùng',
    methodologyKicker: 'Phương pháp',
    methodologyIntro:
      'Website không chỉ hiển thị mô hình học máy, mà tổ chức toàn bộ quy trình thành ba lớp để người dùng đọc dễ hơn và kiểm tra được căn cứ.',
    methodology: [
      {
        title: 'Lớp 1: Dự báo xu hướng',
        body: 'CNN-LSTM-Attention tạo ra xác suất outperform, neutral hoặc underperform từ dữ liệu kỹ thuật và chuỗi giá đã xử lý.',
      },
      {
        title: 'Lớp 2: Bối cảnh thị trường',
        body: 'Tin tức, nhóm ngân hàng, yếu tố vĩ mô và rủi ro ngoại sinh được lượng hóa để giúp hiểu môi trường hiện tại.',
      },
      {
        title: 'Lớp 3: Hành động gợi ý',
        body: 'Xếp hạng triển vọng, ba mốc giá quan trọng và nguồn tham chiếu được tổng hợp thành cách đọc dễ áp dụng hơn.',
      },
    ],
    roadmapTitle: 'Hai hướng phát triển tiếp theo',
    roadmapKicker: 'Lộ trình',
    roadmap: [
      {
        title: 'Methodology rõ ràng hơn',
        body: 'Giải thích chi tiết cách chấm điểm, cách mô hình tạo tín hiệu và cách hệ thống biến tín hiệu thành khuyến nghị.',
      },
      {
        title: 'Watchlist + Alert',
        body: 'Theo dõi cùng lúc nhiều mã ngân hàng và tạo cảnh báo ngắn khi một mã bắt đầu đáng chú ý hơn phần còn lại.',
      },
    ],
    footerTitle: 'Triết lý sản phẩm',
    footerBody:
      'Mục tiêu của website không phải thay thế hoàn toàn chuyên gia phân tích, mà là giúp người dùng đọc triển vọng nhanh hơn, kiểm tra bối cảnh rõ hơn và ra quyết định kỷ luật hơn.',
  },
  en: {
    kicker: 'About Us',
    title: 'A banking-outlook platform designed to feel clearer, more evidence-based, and easier for first-time investors.',
    subtitle:
      'MinSight Banking AI compresses price data, market context, company intelligence, and reference news into a more readable decision workflow.',
    primaryAction: 'Open technical dashboard',
    secondaryAction: 'Read market news',
    mediaChip: 'AI + Finance',
    mediaTitle: 'Conclusion first, explanation next',
    mediaBody:
      'The interface is designed so users can read the main conclusion within the first few seconds, while deeper layers remain available for verification.',
    strip: [
      { label: 'Focus', value: '5-session trend' },
      { label: 'Data', value: 'Price + News + Profile' },
      { label: 'Audience', value: 'Retail investors' },
    ],
    storyTitle: 'What problem are we solving?',
    storyBody:
      'Most retail investors still need to manually combine charts, news, company data, and macro context before acting. That is time-consuming and cognitively noisy. MinSight Banking AI is built to compress those layers into a clearer workflow.',
    storyPoints: [
      'One main conclusion should dominate the page.',
      'Every recommendation should come with levels and references.',
      'A beginner should know what to do before reading the full dashboard.',
    ],
    methodologyTitle: 'How the system works',
    methodologyKicker: 'Methodology',
    methodologyIntro:
      'The product is not just a machine-learning output. It organizes the full investor flow into three layers so users can read decisions faster and validate the reasoning.',
    methodology: [
      {
        title: 'Layer 1: Trend forecast',
        body: 'CNN-LSTM-Attention estimates outperform, neutral, or underperform probabilities from processed technical data and historical price behavior.',
      },
      {
        title: 'Layer 2: Market context',
        body: 'News, banking-sector signals, macro pressure, and external risks are quantified to reflect the current environment.',
      },
      {
        title: 'Layer 3: Suggested action',
        body: 'Outlook rating, three key price levels, and references are combined into a more usable decision view.',
      },
    ],
    roadmapTitle: 'Two next product directions',
    roadmapKicker: 'Roadmap',
    roadmap: [
      {
        title: 'Clearer methodology',
        body: 'Make the scoring logic, signal creation, and decision pipeline easier to inspect and trust.',
      },
      {
        title: 'Watchlist + Alert',
        body: 'Track multiple banking stocks together and surface short alerts when one becomes more actionable than the rest.',
      },
    ],
    footerTitle: 'Product philosophy',
    footerBody:
      'The goal is not to replace human analysts entirely, but to help users read the outlook faster, verify context better, and act with more discipline.',
  },
};

function AboutSectionStudio({ language, onOpenChart, onOpenNews }) {
  const copy = COPY[language] || COPY.vi;

  return (
    <section className="about-v3-shell">
      <section className="about-v3-hero card">
        <div className="about-v3-copy">
          <span className="about-v3-kicker">{copy.kicker}</span>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
          <div className="about-v3-actions">
            <button type="button" className="about-primary-btn" onClick={onOpenChart}>
              {copy.primaryAction}
            </button>
            <button type="button" className="about-secondary-btn" onClick={onOpenNews}>
              {copy.secondaryAction}
            </button>
          </div>
          <div className="about-v3-strip">
            {copy.strip.map((item) => (
              <div key={item.label} className="about-v3-strip-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="about-v3-media">
          <div
            className="about-v3-main-image"
            style={{ backgroundImage: `linear-gradient(180deg, rgba(12,17,24,0.08), rgba(12,17,24,0.48)), url("${ABOUT_IMAGES.hero}")` }}
          />
          <div className="about-v3-glass">
            <span>{copy.mediaChip}</span>
            <strong>{copy.mediaTitle}</strong>
            <p>{copy.mediaBody}</p>
          </div>
        </div>
      </section>

      <section className="about-v3-story card">
        <div
          className="about-v3-story-media"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(10,14,20,0.12), rgba(10,14,20,0.34)), url("${ABOUT_IMAGES.story}")` }}
        />
        <div className="about-v3-story-copy">
          <h3>{copy.storyTitle}</h3>
          <p>{copy.storyBody}</p>
          <div className="about-v3-list">
            {copy.storyPoints.map((item) => (
              <div key={item} className="about-v3-list-item">
                <span className="about-v3-list-dot" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-v3-feature card">
        <div className="about-v3-feature-copy">
          <span className="about-v3-kicker">{copy.methodologyKicker}</span>
          <h3>{copy.methodologyTitle}</h3>
          <p>{copy.methodologyIntro}</p>
          <div className="about-v3-list">
            {copy.methodology.map((item) => (
              <div key={item.title} className="about-v3-list-item">
                <span className="about-v3-list-dot" />
                <span>
                  <strong style={{ color: 'var(--text-strong)' }}>{item.title}</strong>
                  <span style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>{item.body}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div
          className="about-v3-feature-image"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(12,17,24,0.10), rgba(12,17,24,0.42)), url("${ABOUT_IMAGES.methodology}")` }}
        />
      </section>

      <section className="about-v3-pillars">
        <div className="about-v3-pillars-head">
          <span className="about-v3-kicker">{copy.roadmapKicker}</span>
          <h3>{copy.roadmapTitle}</h3>
        </div>
        <div className="about-v3-pillars-grid">
          {copy.roadmap.map((item, index) => (
            <article key={item.title} className="about-v3-pillar card">
              <span className="about-v3-pillar-index">0{index + 1}</span>
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-v3-footer card">
        <h3>{copy.footerTitle}</h3>
        <p>{copy.footerBody}</p>
      </section>
    </section>
  );
}

export default AboutSectionStudio;
