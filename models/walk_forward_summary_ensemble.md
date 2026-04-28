# Walk-Forward Validation — CNN-LSTM-Attention

*Cấu hình*: Train 756d / Val 126d / Test 63d, slide +63d, horizon H=5, ensemble 5 seeds [42, 123, 456, 789, 1024], epochs=50, patience=15. Số windows mục tiêu: 5.

## Tổng hợp mean ± std qua các window

| Ticker | n | DA_full (mean±std) | DA@cov30 | DA@cov20 | Sharpe intrinsic |
|--------|---|--------------------|----------|----------|------------------|
| CTG | 5 | 43.0 ± 9.9% | 62.0 ± 21.7% | 71.4 ± 20.2% | -3.10 ± 4.41 |

## Chi tiết từng window

### CTG

| Window | Start | Test end | DA_full | DA@cov30 | DA@cov20 | Sharpe | T |
|--------|-------|----------|---------|----------|----------|--------|---|
| 1 | 0 | 945 | 45.5% | 40.0% | 57.1% | -1.04 | 5.00 |
| 2 | 63 | 1008 | 45.5% | 70.0% | 57.1% | -2.56 | 4.60 |
| 3 | 126 | 1071 | 27.3% | 70.0% | 85.7% | -9.90 | 4.01 |
| 4 | 189 | 1134 | 42.4% | 40.0% | 57.1% | -4.03 | 2.79 |
| 5 | 252 | 1197 | 54.5% | 90.0% | 100.0% | 2.01 | 2.74 |

## Kết luận

- Mean DA@cov20 across 1 ticker × 5 rolling windows: **71.4%** (vs random walk 50%).
- Mean Sharpe intrinsic: **-3.10** (annualized).
- **Robustness**: std của DA@cov20 cho biết biến động qua thời kỳ. std nhỏ → model stable across regimes; std lớn → model phụ thuộc bối cảnh.
- So với split 80/10/10 cố định trong thesis chính (DA@cov20 57.7%), walk-forward cho cái nhìn **mean±std** đáng tin cậy hơn, loại nghi vấn cherry-pick.