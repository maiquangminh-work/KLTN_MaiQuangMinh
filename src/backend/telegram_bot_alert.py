"""
Telegram Real-Time Alert Bot.

Mục tiêu:
1. Tự động phát tin cảnh báo khi AI phát hiện tín hiệu Mua/Bán có Confidence Gate > 80%.
2. Cảnh báo biến động khối lượng bất thường (Volume Spike >= 1.5x 20-day MA).
3. Hỗ trợ gửi định dạng Markdown kèm link truy cập trực tiếp Dashboard.
"""

import os
import sys
import logging
import urllib.parse
import urllib.request
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

# Default Bot Token & Chat ID (có thể đọc từ môi trường ENV)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "DEMO_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "@minsight_signals_demo")


class TelegramAlertBot:
    def __init__(self, token: str = TELEGRAM_BOT_TOKEN, chat_id: str = TELEGRAM_CHAT_ID):
        self.token = token
        self.chat_id = chat_id
        self.api_url = f"https://api.telegram.org/bot{self.token}/sendMessage"

    def send_message(self, message_md: str) -> bool:
        """Gửi thông báo Markdown tới Telegram Chat / Channel."""
        if self.token == "DEMO_BOT_TOKEN":
            logging.info("[TELEGRAM-SIMULATION] Telegram alert test:")
            print("=" * 60)
            clean_msg = message_md.encode('ascii', errors='ignore').decode('ascii')
            print(clean_msg)
            print("=" * 60)
            return True

        try:
            payload = {
                "chat_id": self.chat_id,
                "text": message_md,
                "parse_mode": "Markdown",
                "disable_web_page_preview": False
            }
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(self.api_url, data=data, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    logging.info("[TELEGRAM-SUCCESS] Đã gửi thông báo Telegram thành công.")
                    return True
        except Exception as e:
            logging.error(f"[TELEGRAM-ERROR] Không thể gửi tin nhắn Telegram: {e}")
        return False

    def notify_high_confidence_signal(
        self,
        ticker: str,
        signal_type: str,
        confidence_pct: float,
        current_price: float,
        predicted_target: float,
        horizon_days: int = 5
    ) -> bool:
        """Gửi cảnh báo tín hiệu có độ tin cậy cao."""
        emoji = "🚀" if "BUY" in signal_type.upper() or "LONG" in signal_type.upper() else "📉"
        change_pct = ((predicted_target - current_price) / current_price) * 100

        msg = (
            f"{emoji} *CẢNH BÁO TÍN HIỆU QUANT AI: {ticker}*\n\n"
            f"• *Tín hiệu:* `{signal_type}`\n"
            f"• *Độ tin cậy (Confidence):* `{confidence_pct:.1f}%` (Vượt ngưỡng 80%)\n"
            f"• *Giá hiện tại:* `{current_price:,.0f} VNĐ`\n"
            f"• *Mục tiêu T+{horizon_days}:* `{predicted_target:,.0f} VNĐ` (`{change_pct:+.2f}%`)\n\n"
            f"🔗 [Xem biểu đồ kỹ thuật chi tiết](http://localhost:5173/chart/{ticker})\n\n"
            f"⚠️ _Lưu ý: Tín hiệu tham khảo hỗ trợ giao dịch, tuân thủ kỷ luật quản trị rủi ro._"
        )
        return self.send_message(msg)


if __name__ == '__main__':
    bot = TelegramAlertBot()
    bot.notify_high_confidence_signal(
        ticker="VCB",
        signal_type="LONG (MUA TÍCH LŨY)",
        confidence_pct=85.4,
        current_price=59300,
        predicted_target=61500,
        horizon_days=5
    )
