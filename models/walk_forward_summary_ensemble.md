# Walk-Forward Validation — CNN-LSTM-Attention

*Cấu hình*: Train 756d / Val 126d / Test 63d, slide +63d, horizon H=5, ensemble 5 seeds [42, 123, 456, 789, 2024], epochs=50, patience=15. Số windows mục tiêu: 5.

## Tổng hợp mean ± std qua các window

| Ticker | n | DA_full (mean±std) | DA@cov30 | DA@cov20 | Sharpe intrinsic |
|--------|---|--------------------|----------|----------|------------------|
| BID | 5 | 53.3 ± 21.3% | 56.0 ± 39.1% | 54.3 ± 39.6% | 2.51 ± 6.96 |

## Chi tiết từng window

### BID

| Window | Start | Test end | DA_full | DA@cov30 | DA@cov20 | Sharpe | T |
|--------|-------|----------|---------|----------|----------|--------|---|
| 1 | 0 | 945 | 30.3% | 70.0% | 71.4% | -2.11 | 2.17 |
| 2 | 63 | 1008 | 51.5% | 20.0% | 28.6% | 1.75 | 0.94 |
| 3 | 126 | 1071 | 36.4% | 10.0% | 0.0% | -5.13 | 0.70 |
| 4 | 189 | 1134 | 81.8% | 100.0% | 100.0% | 12.82 | 0.85 |
| 5 | 252 | 1197 | 66.7% | 80.0% | 71.4% | 5.22 | 2.09 |

## Kết luận

- Mean DA@cov20 across 1 ticker × 5 rolling windows: **54.3%** (vs random walk 50%).
- Mean Sharpe intrinsic: **2.51** (annualized).
- **Robustness**: std của DA@cov20 cho biết biến động qua thời kỳ. std nhỏ → model stable across regimes; std lớn → model phụ thuộc bối cảnh.
- So với split 80/10/10 cố định trong thesis chính (DA@cov20 57.7%), walk-forward cho cái nhìn **mean±std** đáng tin cậy hơn, loại nghi vấn cherry-pick.