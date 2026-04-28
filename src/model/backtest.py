"""
Backtest realistic cho mô hình CNN-LSTM-Attention (Bước 6).

Mục tiêu: chuyển từ "DA% lý thuyết" sang các metric mà nhà đầu tư thực sự quan tâm:
  • Equity curve (đường vốn theo thời gian)
  • Total Return (%)
  • Sharpe Ratio (annualized)
  • Max Drawdown (MDD)
  • Win rate / Profit factor
  • So sánh vs Buy & Hold

Giả lập giao dịch:
  - Long-only (khớp quy định thị trường VN dành cho retail)
  - Position sizing binary: vào lệnh hoặc không (không leverage)
  - Confidence gate: chỉ vào lệnh khi |pred_log_return| * T >= threshold
  - Holding period = horizon_days của model
  - Transaction cost = 0.15% / lượt (0.3% round-trip) — phí trung bình VN
  - Không stop-loss (để tách bạch signal strength vs risk management)

Cách chạy:
    cd D:\\.vscode\\KLTN\\Demo
    python -m src.model.backtest

Hoặc dùng programmatic:
    from src.model.backtest import run_backtest
    report = run_backtest('VCB', coverage=0.2)
"""
from __future__ import annotations

import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

import numpy as np
import pandas as pd
import pickle
from typing import Optional

import matplotlib
matplotlib.use('Agg')  # headless — tránh cần GUI backend khi chạy batch
import matplotlib.pyplot as plt

from src.model.architecture import AttentionLayer
from src.model.train import (
    REGRESSION_FEATURE_COLUMNS as DEFAULT_FEATURES,
    _augment_regression_features,
    _augment_cross_sectional_features,
    load_ensemble_models,
    predict_ensemble,
)
from src.model.confidence import (
    fit_temperature,
    compute_confidence_scores,
)
from tensorflow.keras.models import load_model

WINDOW_SIZE = 30
TRANSACTION_COST = 0.0015  # 0.15% mỗi lượt (buy + sell → 0.3% round-trip)
TRADING_DAYS_YEAR = 252


def _resolve_cfg(ticker: str) -> dict:
    cfg_path = f'models/{ticker.lower()}_reg_config.pkl'
    if not os.path.exists(cfg_path):
        return {}
    with open(cfg_path, 'rb') as f:
        return pickle.load(f)


def _create_sequences(data, target, window_size=WINDOW_SIZE):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i:(i + window_size)])
        y.append(target[i + window_size])
    return np.array(X), np.array(y)


def _compute_metrics(returns: np.ndarray,
                     equity: np.ndarray,
                     trades: list,
                     horizon_days: int = 1) -> dict:
    """Tính các chỉ số performance chuẩn tài chính."""
    if len(equity) < 2:
        return {
            'total_return_pct': 0.0,
            'annual_return_pct': 0.0,
            'sharpe': 0.0,
            'max_drawdown_pct': 0.0,
            'win_rate_pct': 0.0,
            'profit_factor': 0.0,
            'num_trades': 0,
            'avg_trade_return_pct': 0.0,
        }

    total_return = equity[-1] / equity[0] - 1.0
    # Annualize: scale theo tổng số ngày trong backtest
    n_days = len(equity)
    years = n_days / TRADING_DAYS_YEAR
    annual_return = (equity[-1] / equity[0]) ** (1 / max(years, 1e-9)) - 1.0 if years > 0 else 0.0

    # Sharpe: std của DAILY returns (returns đã ở scale daily vì equity cập nhật hàng ngày)
    daily_returns = np.diff(equity) / equity[:-1]
    if daily_returns.std() > 1e-9:
        sharpe = (daily_returns.mean() / daily_returns.std()) * np.sqrt(TRADING_DAYS_YEAR)
    else:
        sharpe = 0.0

    # Max Drawdown
    peaks = np.maximum.accumulate(equity)
    drawdowns = (equity - peaks) / peaks
    max_dd = float(drawdowns.min()) if len(drawdowns) > 0 else 0.0

    # Trade stats
    trade_returns = [t['return_pct'] for t in trades]
    wins = [r for r in trade_returns if r > 0]
    losses = [r for r in trade_returns if r < 0]
    win_rate = (len(wins) / len(trade_returns) * 100) if trade_returns else 0.0
    total_gain = sum(wins) if wins else 0.0
    total_loss = abs(sum(losses)) if losses else 0.0
    profit_factor = (total_gain / total_loss) if total_loss > 1e-9 else (float('inf') if total_gain > 0 else 0.0)
    avg_trade_return = float(np.mean(trade_returns)) if trade_returns else 0.0

    return {
        'total_return_pct': float(total_return * 100),
        'annual_return_pct': float(annual_return * 100),
        'sharpe': float(sharpe),
        'max_drawdown_pct': float(max_dd * 100),
        'win_rate_pct': float(win_rate),
        'profit_factor': float(profit_factor) if np.isfinite(profit_factor) else 999.0,
        'num_trades': int(len(trade_returns)),
        'avg_trade_return_pct': float(avg_trade_return * 100),
    }


def run_backtest(ticker: str = 'VCB',
                 coverage: float = 0.2,
                 initial_capital: float = 100.0,
                 transaction_cost: float = TRANSACTION_COST,
                 output_dir: str = 'models/backtest',
                 threshold_mode: str = 'hybrid',
                 universal_sigma: float = 0.30,
                 min_test_coverage: float = 0.20,
                 allow_short: bool = False) -> dict:
    """Chạy backtest cho 1 ticker trên test split (10% cuối).

    Args:
        ticker: mã cổ phiếu
        coverage: % top samples tự tin nhất sẽ trade (0.2 = trade 20% mạnh nhất)
        initial_capital: vốn khởi tạo (đơn vị tương đối, dùng 100 để đọc %)
        transaction_cost: chi phí mỗi lượt (buy hoặc sell)
        output_dir: thư mục lưu equity curve PNG + metrics JSON
        threshold_mode: cách tính threshold:
            - 'val_quantile': quantile(1-coverage) trên VAL confidence (chuẩn, có thể OOD)
            - 'universal':    fixed universal_sigma * ref_std — giá trị tuyệt đối
            - 'hybrid':       min(val_quantile, universal) — an toàn cho OOD shift
        universal_sigma: ngưỡng confidence tuyệt đối khi mode ∈ {universal, hybrid}
        min_test_coverage: coverage tối thiểu bắt buộc trên TEST (floor).
            Khi val_quantile cho 0 trade, hạ threshold xuống quantile TEST tại mức này
            để ngăn OOD làm rỗng signal. KHÔNG leak label — chỉ dùng confidence (|pred|).

    Returns:
        dict metrics + paths.
    """
    cfg = _resolve_cfg(ticker)
    features = list(cfg.get('feature_columns') or DEFAULT_FEATURES)
    horizon_days = int(cfg.get('horizon_days', 1))

    df = pd.read_csv(f'data/processed/{ticker}_features.csv')
    df = _augment_regression_features(df)
    if any(col in features for col in ('benchmark_return_1d', 'rank_return_1d', 'alpha_1d_vs_peer')):
        df = _augment_cross_sectional_features(df, ticker)
    if horizon_days == 1:
        df['log_return'] = np.log(df['close_winsorized'] / df['close_winsorized'].shift(1))
    else:
        df['log_return'] = np.log(df['close_winsorized'].shift(-horizon_days) / df['close_winsorized'])
    df.dropna(subset=features + ['log_return', 'close_winsorized'], inplace=True)
    df.reset_index(drop=True, inplace=True)

    with open(f'models/{ticker.lower()}_feature_scaler.pkl', 'rb') as f:
        feature_scaler = pickle.load(f)
    with open(f'models/{ticker.lower()}_target_scaler.pkl', 'rb') as f:
        target_scaler = pickle.load(f)

    data_values = df[features].values
    target_values = df[['log_return']].values
    prices = df['close_winsorized'].values
    dates = pd.to_datetime(df['time']) if 'time' in df.columns else pd.RangeIndex(len(df))

    n = len(df)
    train_end = int(n * 0.8)
    val_end = int(n * 0.9)

    # Step 1: Fit temperature trên VAL set
    val_data = data_values[train_end:val_end]
    val_target = target_values[train_end:val_end]
    val_prices = prices[train_end:val_end]
    scaled_val = feature_scaler.transform(val_data)
    scaled_val_tgt = target_scaler.transform(val_target)
    X_val, _ = _create_sequences(scaled_val, scaled_val_tgt)

    ensemble_models, _ = load_ensemble_models(ticker)
    if ensemble_models:
        pred_source = 'ensemble'
        val_pred_scaled = predict_ensemble(ensemble_models, X_val)
    else:
        model = load_model(f'models/cnn_lstm_attn_{ticker.lower()}_v1.h5',
                           custom_objects={'AttentionLayer': AttentionLayer},
                           compile=False)
        pred_source = 'single'
        val_pred_scaled = model.predict(X_val, verbose=0)
    val_pred_log = target_scaler.inverse_transform(val_pred_scaled).flatten()

    # Ground truth log-return trên val
    Nv = len(val_pred_log)
    if horizon_days == 1:
        val_prev = val_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + Nv]
        val_act = val_prices[WINDOW_SIZE: WINDOW_SIZE + Nv]
    else:
        avail = len(val_prices) - (WINDOW_SIZE - 1 + horizon_days)
        Nv = min(Nv, max(0, avail))
        val_prev = val_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + Nv]
        val_act = val_prices[WINDOW_SIZE - 1 + horizon_days:
                             WINDOW_SIZE - 1 + horizon_days + Nv]
        val_pred_log = val_pred_log[:Nv]
    val_true_log = np.log(val_act / val_prev) if len(val_prev) > 0 else np.array([])
    T = fit_temperature(val_pred_log, val_true_log) if val_true_log.size > 0 else 1.0

    # Reference std từ train log-return để gate
    train_log_return = target_values[:train_end].flatten()
    train_log_return = train_log_return[~np.isnan(train_log_return)]
    ref_std = float(np.std(train_log_return)) if train_log_return.size > 0 else 0.01

    # Threshold tương ứng coverage target trên VAL (tránh peek test label)
    val_confidence = compute_confidence_scores(val_pred_log * T, ref_std)
    if val_confidence.size > 0:
        quantile = 1.0 - float(coverage)
        val_threshold = float(np.quantile(val_confidence, quantile))
    else:
        val_threshold = 0.0

    # Universal threshold: dùng giá trị cố định (không phụ thuộc VAL distribution)
    universal_threshold = float(universal_sigma)

    if threshold_mode == 'universal':
        threshold = universal_threshold
    elif threshold_mode == 'hybrid':
        threshold = min(val_threshold, universal_threshold) if val_threshold > 0 else universal_threshold
    else:  # 'val_quantile' — behavior cũ
        threshold = val_threshold

    print(f"\n[BACKTEST] {ticker}: source={pred_source} horizon={horizon_days} "
          f"T={T:.3f} ref_std={ref_std:.5f} mode={threshold_mode} "
          f"val_thr={val_threshold:.4f} univ_thr={universal_threshold:.4f} "
          f"→ threshold={threshold:.4f} (coverage target {coverage*100:.0f}%)")

    # Step 2: Predict trên TEST set
    test_data = data_values[val_end:]
    test_target = target_values[val_end:]
    test_prices = prices[val_end:]
    test_dates = dates.iloc[val_end:].reset_index(drop=True) if hasattr(dates, 'iloc') else None

    scaled_test = feature_scaler.transform(test_data)
    scaled_test_tgt = target_scaler.transform(test_target)
    X_test, _ = _create_sequences(scaled_test, scaled_test_tgt)

    if ensemble_models:
        test_pred_scaled = predict_ensemble(ensemble_models, X_test)
    else:
        test_pred_scaled = model.predict(X_test, verbose=0)
    test_pred_log = target_scaler.inverse_transform(test_pred_scaled).flatten() * T

    N = len(test_pred_log)
    if horizon_days == 1:
        entry_prices = test_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + N]
        exit_prices = test_prices[WINDOW_SIZE: WINDOW_SIZE + N]
    else:
        avail = len(test_prices) - (WINDOW_SIZE - 1 + horizon_days)
        N = min(N, max(0, avail))
        entry_prices = test_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + N]
        exit_prices = test_prices[WINDOW_SIZE - 1 + horizon_days:
                                  WINDOW_SIZE - 1 + horizon_days + N]
        test_pred_log = test_pred_log[:N]

    test_confidence = compute_confidence_scores(test_pred_log, ref_std)

    # OOD safety floor: nếu threshold lọc sạch signal → giảm xuống mức đảm bảo
    # ít nhất min_test_coverage % test-set có cơ hội trade. Chỉ dùng confidence
    # (|pred|, không có nhãn true_return) nên KHÔNG leak information.
    signals_pass = int(np.sum(test_confidence >= threshold)) if test_confidence.size else 0
    floor_threshold = threshold
    floor_triggered = False
    if test_confidence.size > 0:
        min_n = max(1, int(np.ceil(min_test_coverage * test_confidence.size)))
        if signals_pass < min_n:
            # Hạ threshold xuống mức chấp nhận đủ min_n sample tự tin nhất trên TEST
            q_floor = 1.0 - (min_n / test_confidence.size)
            floor_threshold = float(np.quantile(test_confidence, max(0.0, q_floor)))
            floor_threshold = min(floor_threshold, threshold)  # an toàn
            threshold = floor_threshold
            floor_triggered = True
            print(f"[BACKTEST] {ticker}: OOD floor triggered — "
                  f"val/hybrid threshold filtered {signals_pass}/{test_confidence.size} test points; "
                  f"giảm xuống {floor_threshold:.4f} (min_test_coverage={min_test_coverage*100:.0f}%)")

    # Step 3: Simulate trades
    # Strategy: long khi pred > 0 AND confidence >= threshold; exit sau horizon_days.
    # Non-overlapping: sau mỗi trade, bỏ qua horizon_days tiếp theo để tránh
    # ghi đè position (ở daily H=1 thì không bỏ qua gì).
    equity = [initial_capital]
    trades = []
    i = 0
    daily_equity_curve = [initial_capital]  # theo từng ngày để tính Sharpe chuẩn

    while i < N:
        pred = test_pred_log[i]
        conf_ok = test_confidence[i] >= threshold
        signal_long = (pred > 0) and conf_ok
        signal_short = allow_short and (pred < 0) and conf_ok
        if signal_long or signal_short:
            p_in = entry_prices[i]
            p_out = exit_prices[i]
            gross_ret = p_out / p_in - 1.0
            if signal_short:
                # Short: lợi nhuận ngược dấu với price change
                gross_ret = -gross_ret
            net_ret = gross_ret - 2 * transaction_cost  # buy + sell
            new_cap = equity[-1] * (1 + net_ret)
            # Rải equity qua các ngày trong holding period (nội suy tuyến tính theo log-price)
            for step in range(1, horizon_days + 1):
                alpha = step / horizon_days
                interp_cap = equity[-1] * (1 + (gross_ret - 2 * transaction_cost) * alpha)
                daily_equity_curve.append(interp_cap)
            equity.append(new_cap)
            trades.append({
                'entry_idx': int(i),
                'entry_price': float(p_in),
                'exit_price': float(p_out),
                'direction': 'short' if signal_short else 'long',
                'gross_return_pct': float(gross_ret * 100),
                'return_pct': float(net_ret),
                'predicted_log_return': float(pred),
                'confidence': float(test_confidence[i]),
            })
            i += horizon_days  # non-overlapping positions
        else:
            # Không trade — equity giữ nguyên, ngày trôi qua
            daily_equity_curve.append(equity[-1])
            i += 1

    equity = np.array(equity)
    daily_equity_curve = np.array(daily_equity_curve)

    # Buy & Hold benchmark (toàn bộ period)
    if horizon_days == 1:
        bh_prices = test_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + N + 1]
    else:
        bh_prices = test_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + N + horizon_days]
    if len(bh_prices) >= 2:
        bh_equity = initial_capital * bh_prices / bh_prices[0]
        # Trừ phí 1 lần mua + 1 lần bán cho fair comparison
        bh_equity = bh_equity * (1 - 2 * transaction_cost)
    else:
        bh_equity = np.array([initial_capital])

    metrics = _compute_metrics(None, daily_equity_curve, trades, horizon_days)
    bh_metrics = _compute_metrics(None, bh_equity, [
        {'return_pct': (bh_equity[-1] / bh_equity[0] - 1)} if len(bh_equity) >= 2 else {'return_pct': 0.0}
    ], horizon_days)

    # Step 4: Save plot + report
    os.makedirs(output_dir, exist_ok=True)
    plot_path = os.path.join(output_dir, f'{ticker.lower()}_equity_curve.png')

    plt.figure(figsize=(12, 6))
    plt.plot(daily_equity_curve, label=f'Strategy (coverage {coverage*100:.0f}%)',
             linewidth=1.8, color='#1f77b4')
    # Align buy-hold length với daily_equity_curve
    min_len = min(len(daily_equity_curve), len(bh_equity))
    plt.plot(bh_equity[:min_len], label='Buy & Hold', linewidth=1.2,
             color='#888888', linestyle='--')
    plt.title(f'{ticker} — Equity Curve Backtest (horizon={horizon_days})')
    plt.xlabel('Trading days (test set)')
    plt.ylabel('Equity (initial = 100)')
    plt.legend()
    plt.grid(True, alpha=0.3, linestyle=':')
    plt.tight_layout()
    plt.savefig(plot_path, dpi=100)
    plt.close()

    report = {
        'ticker': ticker,
        'horizon_days': horizon_days,
        'coverage_target': float(coverage),
        'threshold_mode': threshold_mode,
        'val_threshold': float(val_threshold),
        'universal_threshold': float(universal_threshold),
        'threshold': float(threshold),
        'floor_triggered': bool(floor_triggered),
        'temperature': float(T),
        'strategy': metrics,
        'buy_and_hold': bh_metrics,
        'num_test_samples': int(N),
        'num_trades': int(len(trades)),
        'equity_curve_path': plot_path,
        'pred_source': pred_source,
    }

    # In báo cáo
    print("\n" + "=" * 72)
    print(f"  BACKTEST REPORT — {ticker}")
    print("=" * 72)
    print(f"  {'Metric':<25}{'Strategy':>20}{'Buy & Hold':>20}")
    print("-" * 72)
    for k, label in (
        ('total_return_pct', 'Total Return (%)'),
        ('annual_return_pct', 'Annualized Return (%)'),
        ('sharpe', 'Sharpe Ratio'),
        ('max_drawdown_pct', 'Max Drawdown (%)'),
        ('win_rate_pct', 'Win Rate (%)'),
        ('profit_factor', 'Profit Factor'),
        ('num_trades', '# Trades'),
        ('avg_trade_return_pct', 'Avg Trade Return (%)'),
    ):
        s = metrics.get(k, 0.0)
        b = bh_metrics.get(k, 0.0)
        fmt = ',.0f' if k == 'num_trades' else ',.3f'
        print(f"  {label:<25}{s:>20{fmt}}{b:>20{fmt}}")
    print("-" * 72)
    print(f"  Equity curve PNG:  {plot_path}")
    print("=" * 72)
    return report


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--coverage', type=float, default=0.30,
                    help='% top-confidence samples trading target (default 0.30)')
    ap.add_argument('--mode', choices=['val_quantile', 'universal', 'hybrid'],
                    default='hybrid', help='Cách chọn threshold (default: hybrid)')
    ap.add_argument('--universal_sigma', type=float, default=0.30,
                    help='Threshold tuyệt đối cho mode universal/hybrid (default 0.30)')
    ap.add_argument('--min_test_coverage', type=float, default=0.20,
                    help='OOD floor — đảm bảo >= mức này của TEST sample pass gate')
    ap.add_argument('--allow_short', action='store_true',
                    help='Cho phép short khi pred<0 (default: long-only)')
    ap.add_argument('--tickers', nargs='*', default=None,
                    help='Danh sách ticker (mặc định: 10 mã NH)')
    args = ap.parse_args()

    tickers = args.tickers or ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB']
    reports = []
    for tk in tickers:
        try:
            r = run_backtest(tk,
                             coverage=args.coverage,
                             threshold_mode=args.mode,
                             universal_sigma=args.universal_sigma,
                             min_test_coverage=args.min_test_coverage,
                             allow_short=args.allow_short)
            reports.append(r)
        except Exception as e:
            import traceback
            print(f"[BACKTEST-ERROR] {tk}: {e}")
            traceback.print_exc()

    if reports:
        print("\n\n" + "#" * 102)
        print(f"  TỔNG HỢP BACKTEST — mode={args.mode} "
              f"coverage={args.coverage*100:.0f}% "
              f"universal_sigma={args.universal_sigma} "
              f"min_test_cov={args.min_test_coverage*100:.0f}%")
        print("#" * 102)
        header = (f"{'Ticker':<8}{'Return':>10}{'BH Ret':>10}{'Sharpe':>9}"
                  f"{'MDD':>9}{'Win%':>8}{'PF':>8}{'Trades':>8}{'Floor':>7}")
        print(header)
        print("-" * 102)
        for r in reports:
            s, b = r['strategy'], r['buy_and_hold']
            floor_mark = 'Y' if r.get('floor_triggered') else '-'
            print(f"{r['ticker']:<8}"
                  f"{s['total_return_pct']:>9.1f}%"
                  f"{b['total_return_pct']:>9.1f}%"
                  f"{s['sharpe']:>9.2f}"
                  f"{s['max_drawdown_pct']:>8.1f}%"
                  f"{s['win_rate_pct']:>7.1f}%"
                  f"{s['profit_factor']:>8.2f}"
                  f"{s['num_trades']:>8d}"
                  f"{floor_mark:>7}")
        print("-" * 102)

        # Thêm trung bình và Sharpe-weighted aggregates
        import numpy as _np
        rets = _np.array([r['strategy']['total_return_pct'] for r in reports])
        bh_rets = _np.array([r['buy_and_hold']['total_return_pct'] for r in reports])
        sharpes = _np.array([r['strategy']['sharpe'] for r in reports])
        trades = _np.array([r['strategy']['num_trades'] for r in reports])
        active = trades > 0
        print(f"  Portfolio metrics:")
        print(f"    Mean return (all):        {rets.mean():>7.2f}%  (BH: {bh_rets.mean():>6.2f}%)")
        if active.any():
            print(f"    Mean return (active):     {rets[active].mean():>7.2f}%  on {int(active.sum())}/{len(reports)} tickers")
            print(f"    Mean Sharpe (active):     {sharpes[active].mean():>7.2f}")
            print(f"    Total trades:             {int(trades.sum())}")
        print("-" * 102)
