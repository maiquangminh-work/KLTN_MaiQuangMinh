"""
Smart NLP Financial News Filter & Sentiment Preprocessor.

Mục tiêu:
1. Lọc bỏ các bài viết PR/quảng cáo, tin đồn room chat Zalo, bài tài trợ doanh nghiệp.
2. Xác định trọng số nguồn tin (VnEconomy, Nghị quyết HĐQT, Báo cáo tài chính > Tin đồn).
3. Đóng góp Sentiment Score [-1.0, 1.0] sạch hơn cho mô hình dự báo.
"""

import re
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

# Danh sách từ khóa nhận diện bài viết PR / Bơm vá / Quảng cáo
SPONSORED_KEYWORDS = [
    r'tài trợ', r'khuyến mãi', r'tri ân khách hàng', r'nhận quà', r'room zalo',
    r'nhóm phím hàng', r'nhóm vip', r'nhân đôi tài khoản', r'siêu cổ phiếu',
    r'cam kết lợi nhuận', r'ủy thác đầu tư', r'hội thảo'
]

# Nguồn tin uy tín cao (High Credibility Sources)
HIGH_CREDIBILITY_SOURCES = ['vneconomy', 'cafef', 'vietstock', 'ndh', 'tinnhanhchungkhoan', 'sbv.gov.vn']


class FinancialNewsFilter:
    def __init__(self):
        self.pr_patterns = [re.compile(kw, re.IGNORECASE) for kw in SPONSORED_KEYWORDS]

    def is_pr_or_sponsored(self, title: str, content: str = "") -> bool:
        """Kiểm tra bài viết có phải bài PR / Bơm vá hay không."""
        text = f"{title} {content}"
        for pattern in self.pr_patterns:
            if pattern.search(text):
                return True
        return False

    def get_source_weight(self, source_name: str) -> float:
        """Đánh trọng số tin cậy cho nguồn tin [0.2 đến 1.0]."""
        if not source_name:
            return 0.5
        source_clean = source_name.lower()
        for high_src in HIGH_CREDIBILITY_SOURCES:
            if high_src in source_clean:
                return 1.0
        return 0.5

    def filter_and_score_news(self, news_items: list[dict]) -> list[dict]:
        """Lọc danh sách tin tức và tính điểm trọng số tin cậy."""
        clean_news = []
        for item in news_items:
            title = item.get('title', '')
            content = item.get('content', '')
            source = item.get('source', '')

            if self.is_pr_or_sponsored(title, content):
                logging.info(f"[NLP-FILTER-SPAM] Đã loại bỏ bài PR/Bơm vá: {title[:50]}...")
                continue

            weight = self.get_source_weight(source)
            item['credibility_weight'] = weight
            clean_news.append(item)

        logging.info(f"[NLP-FILTER-SUCCESS] Giữ lại {len(clean_news)}/{len(news_items)} bài tin tức chất lượng.")
        return clean_news


if __name__ == '__main__':
    nlp_filter = FinancialNewsFilter()
    sample_news = [
        {'title': 'VCB công bố lợi nhuận quý 2 tăng trưởng 20%', 'source': 'VnEconomy', 'content': 'Doanh thu thuần đạt...'},
        {'title': 'Tham gia room Zalo nhận ngay siêu cổ phiếu X2 tài khoản', 'source': 'NguonTinDoan', 'content': 'Cam kết lợi nhuận 50%...'},
        {'title': 'BIDV mở rộng gói tín dụng xanh 10.000 tỷ', 'source': 'CafeF', 'content': 'Hỗ trợ doanh nghiệp...'}
    ]
    filtered = nlp_filter.filter_and_score_news(sample_news)
    print("\nFiltered News Output:")
    for fn in filtered:
        title_ascii = fn['title'].encode('ascii', errors='ignore').decode('ascii')
        print(f" - [{fn['source']}] Weight: {fn['credibility_weight']} | Title: {title_ascii}")
