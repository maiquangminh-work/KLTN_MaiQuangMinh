# Portfolio-Level Backtest — CNN-LSTM-Attention

*Cấu hình*: top-N=3 confidence-ranked, equal-weight long-only, hold H=5d, transaction cost 0.40%/lượt, benchmark = Equal-Weight(10 ticker).

## Tóm tắt hiệu năng

| Metric | Portfolio (top-N) | Benchmark EW(10) | Chênh lệch |
|--------|-------------------|------------------|------------|
| Total return | 36.71% | 22.45% | +14.26pp |
| Annualized return | 39.84% | 24.25% | +15.59pp |
| Annualized vol | 16.20% | 20.50% | — |
| Sharpe ratio | **2.46** | 1.18 | +1.28 |
| Max drawdown | -5.74% | -14.25% | — |
| Information ratio | **0.763** | — | — |
| Hit rate | 51.2% | — | — |
| # bars (có trade) | 41 / 47 | — | — |
| Avg tickers held | 1.47 / 3 | — | — |
| Avg turnover | 19.1% | — | — |

## Diễn giải

- **Information Ratio (IR)**: đo mức sinh lợi vượt benchmark trên mỗi đơn vị risk chủ động. IR > 0.5 được xem là có giá trị cho active management.
- **Sharpe portfolio vs benchmark**: portfolio sử dụng gating nên volatility thường thấp hơn benchmark (ít ngày có position) → Sharpe risk-adjusted cao hơn.
- **Cash-when-unconfident**: các bar có 0 ticker pass filter → portfolio ngồi ngoài, bảo toàn vốn khi market bearish / tín hiệu mỏng.
- **Turnover**: số mã thay đổi mỗi chu kỳ rebalance. Turnover thấp → chi phí thấp; turnover cao → strategy reactive.

## So sánh với backtest per-ticker (thesis_summary)

- Thesis per-ticker báo cáo mean return 6/10 active tickers = +6.82%, mean Sharpe = 1.18 (tính riêng từng mã).
- Portfolio-level tích hợp diversification: rủi ro idiosyncratic triệt tiêu, volatility giảm → Sharpe có thể cao hơn bình quân per-ticker.
- Benchmark EW(10 ticker) là so sánh fair: nếu 1 người mua equal-weight 10 mã banking (B&H) thì được IR đang đạt.