# Walk-Forward Validation — CNN-LSTM-Attention (5-seed Ensemble)

*Cau hinh*: Train 756d / Val 126d / Test 63d, slide +63d, horizon H=5, ensemble 5 seeds [42, 123, 456, 789, 1024], epochs=50, patience=15. Windows: 5.

## Tong hop mean +- std qua cac window

| Ticker | n | DA_full (mean+-std) | DA@cov30 | DA@cov20 | Sharpe intrinsic |
|--------|---|--------------------|----------|----------|------------------|
| VCB | 5 | 51.5 +- 19.5% | 44.0 +- 23.0% | 54.3 +- 18.6% | 0.33 +- 8.42 |
| BID | 5 | 53.3 +- 21.3% | 56.0 +- 39.1% | 54.3 +- 39.6% | 2.51 +- 6.96 |
| CTG | 5 | 43.0 +- 9.9% | 62.0 +- 21.7% | 71.4 +- 20.2% | -3.10 +- 4.41 |

## Chi tiet tung window

### VCB

| Window | Start | Test end | DA_full | DA@cov30 | DA@cov20 | Sharpe | Temperature |
|--------|-------|----------|---------|----------|----------|--------|-------------|
| 1 | 0 | 945 | 30.3% | 50.0% | 71.4% | -8.46 | 1.33 |
| 2 | 63 | 1008 | 39.4% | 40.0% | 57.1% | -3.50 | 0.54 |
| 3 | 126 | 1071 | 63.6% | 20.0% | 28.6% | 1.86 | 0.78 |
| 4 | 189 | 1134 | 78.8% | 80.0% | 71.4% | 13.87 | 1.23 |
| 5 | 252 | 1197 | 45.5% | 30.0% | 42.9% | -2.11 | 3.88 |

### BID

| Window | Start | Test end | DA_full | DA@cov30 | DA@cov20 | Sharpe | Temperature |
|--------|-------|----------|---------|----------|----------|--------|-------------|
| 1 | 0 | 945 | 30.3% | 70.0% | 71.4% | -2.11 | 2.17 |
| 2 | 63 | 1008 | 51.5% | 20.0% | 28.6% | 1.75 | 0.94 |
| 3 | 126 | 1071 | 36.4% | 10.0% | 0.0% | -5.13 | 0.70 |
| 4 | 189 | 1134 | 81.8% | 100.0% | 100.0% | 12.82 | 0.85 |
| 5 | 252 | 1197 | 66.7% | 80.0% | 71.4% | 5.22 | 2.09 |

### CTG

| Window | Start | Test end | DA_full | DA@cov30 | DA@cov20 | Sharpe | Temperature |
|--------|-------|----------|---------|----------|----------|--------|-------------|
| 1 | 0 | 945 | 45.5% | 40.0% | 57.1% | -1.04 | 5.00 |
| 2 | 63 | 1008 | 45.5% | 70.0% | 57.1% | -2.56 | 4.60 |
| 3 | 126 | 1071 | 27.3% | 70.0% | 85.7% | -9.90 | 4.01 |
| 4 | 189 | 1134 | 42.4% | 40.0% | 57.1% | -4.03 | 2.79 |
| 5 | 252 | 1197 | 54.5% | 90.0% | 100.0% | 2.01 | 2.74 |

## Ket luan

- Mean DA@cov20 (3 ticker x 5 windows): **60.0%** (vs random walk 50%).
- Mean Sharpe intrinsic: **-0.09** (annualized).
- Std cua DA@cov20 phan anh bien dong qua tung thoi ky (robustness check).
- So voi split co dinh 80/10/10 (DA@cov20 57.7%), walk-forward cho ket qua mean+-std tin cay hon, loai nghi van cherry-pick.