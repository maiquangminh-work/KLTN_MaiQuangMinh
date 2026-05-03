"""
Portfolio-level Backtest.

Mục tiêu: Chuyển từ đánh giá **per-ticker** (10 chuỗi tách biệt) sang đánh giá
**portfolio** — mỗi ngày re-balance chọn top-N mã mô hình tự tin nhất, hold H ngày,
equal-weight. Đánh giá tổng hợp Sharpe / Information Ratio / MaxDD so với benchmark.

Tại sao quan trọng?
  • Thực tế hành vi đầu tư: chọn mã, không phải trade 1 chuỗi đơn lẻ.
  • Trung hoà rủi ro idiosyncratic: nếu 1 mã lỗi, các mã khác bù.
  • Thước đo chuẩn công nghiệp: Information Ratio với chuẩn EW(10 ticker).

Pipeline:
  1. Load test predictions từ `load_test_predictions()` (statistical_tests.py)
     cho tất cả 10 ticker, gắn với `time` từ features CSV.
  2. Merge về pivot DataFrame theo calendar date, cột = ticker,
     có 3 layer: pred_log, true_log (H-ngày forward return), confidence (|pred|).
  3. Mỗi ngày t:
       • Sắp xếp ticker theo confidence
       • Chọn top-N (default 3) có pred_log > 0 (long-only)
       • Nếu < N có pred > 0 → giữ tiền mặt phần còn lại (weight=0)
       • Nếu all pred_log ≤ 0 → cash 100%
     Entry tại close(t), exit tại close(t+H).
  4. Benchmark: EW(10 tickers) giữ nguyên H=5 rolling
  5. Metrics: Annualized Return, Vol, Sharpe, MDD, HitRate, IR vs benchmark

Cách chạy:
    cd D:/.vscode/KLTN/Demo
    python -m src.model.portfolio_backtest
    python -m src.model.portfolio_backtest --top_n 3 --hold_days 5
    python -m src.model.portfolio_backtest --top_n 5 --min_signal 0.0
"""
from __future__ import annotations

import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

import argparse
import numpy as np
import pandas as pd
import pickle
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from src.model.statistical_tests import load_test_predictions
from src.model.train import (
    REGRESSION_FEATURE_COLUMNS as DEFAULT_FEATURES,
    _augment_regression_features,
    _augment_cross_sectional_features,
)

WINDOW_SIZE = 30
TICKERS_ALL = ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB']
TRADING_DAYS = 252


# ──────────────────────────────────────────────────────────────────────
#  Data loading with date alignment
# ──────────────────────────────────────────────────────────────────────

def _resolve_cfg(ticker: str) -> dict:
    cfg_path = f'models/{ticker.lower()}_reg_config.pkl'
    if not os.path.exists(cfg_path):
        return {}
    with open(cfg_path, 'rb') as f:
        return pickle.load(f)


def load_test_with_dates(ticker: str) -> pd.DataFrame | None:
    """Mở rộng load_test_predictions để kèm calendar date cho phần TEST.

    Returns DataFrame với cột:
        date, ticker, pred_log, true_log, confidence (= |pred_log|),
        price_entry (close tại entry), price_exit (close tại t+H)
    """
    try:
        pred = load_test_predictions(ticker)
    except Exception as e:
        print(f"[LOAD-ERROR] {ticker}: {e}")
        return None

    cfg = _resolve_cfg(ticker)
    features = list(cfg.get('feature_columns') or DEFAULT_FEATURES)
    H = int(pred['horizon_days'])

    df = pd.read_csv(f'data/processed/{ticker}_features.csv')
    df = _augment_regression_features(df)
    if any(col in features for col in ('benchmark_return_1d', 'rank_return_1d', 'alpha_1d_vs_peer')):
        df = _augment_cross_sectional_features(df, ticker)
    # Cần align chính xác với cách load_test_predictions drop NaN:
    df.dropna(subset=features + ['close_winsorized'], inplace=True)
    df.reset_index(drop=True, inplace=True)

    # Fill forward log_return H=5 (như trong statistical_tests)
    if H == 1:
        df['log_return'] = np.log(df['close_winsorized'] / df['close_winsorized'].shift(1))
    else:
        df['log_return'] = np.log(df['close_winsorized'].shift(-H) / df['close_winsorized'])
    df.dropna(subset=['log_return'], inplace=True)
    df.reset_index(drop=True, inplace=True)

    n = len(df)
    val_end = int(n * 0.9)
    # TEST segment tương ứng
    test_df = df.iloc[val_end:].reset_index(drop=True)
    prices = test_df['close_winsorized'].values
    dates = pd.to_datetime(test_df['time']).values

    y_pred = np.asarray(pred['y_pred'])
    y_true = np.asarray(pred['y_true'])
    N = len(y_pred)

    # Index alignment: entry tại index (WINDOW_SIZE-1), exit tại (WINDOW_SIZE-1 + H)
    if H == 1:
        entry_idx = np.arange(WINDOW_SIZE - 1, WINDOW_SIZE - 1 + N)
        exit_idx = entry_idx + 1
    else:
        avail = len(prices) - (WINDOW_SIZE - 1 + H)
        N = min(N, max(0, avail))
        entry_idx = np.arange(WINDOW_SIZE - 1, WINDOW_SIZE - 1 + N)
        exit_idx = entry_idx + H

    out = pd.DataFrame({
        'date': dates[entry_idx[:N]],
        'ticker': ticker,
        'pred_log': y_pred[:N],
        'true_log': y_true[:N],
        'price_entry': prices[entry_idx[:N]],
        'price_exit': prices[exit_idx[:N]],
    })
    out['confidence'] = out['pred_log'].abs()
    out['true_simple'] = np.exp(out['true_log']) - 1.0  # simple return H-days
    return out


def build_panel(tickers: list[str]) -> dict:
    """Load và concat thành long-form panel + pivot để xếp hạng."""
    frames = []
    for tk in tickers:
        df_tk = load_test_with_dates(tk)
        if df_tk is not None and len(df_tk) > 0:
            frames.append(df_tk)
            print(f"  [{tk}] {len(df_tk)} test days "
                  f"{pd.to_datetime(df_tk['date'].min()).date()} → "
                  f"{pd.to_datetime(df_tk['date'].max()).date()}")
    if not frames:
        raise RuntimeError("No valid tickers loaded.")
    long_df = pd.concat(frames, ignore_index=True)
    long_df['date'] = pd.to_datetime(long_df['date'])
    return {
        'long': long_df,
        'tickers': sorted(long_df['ticker'].unique().tolist()),
    }


# ──────────────────────────────────────────────────────────────────────
#  Portfolio construction & returns
# ──────────────────────────────────────────────────────────────────────

def portfolio_returns(panel_long: pd.DataFrame, top_n: int = 3,
                      min_signal: float = 0.0, tcost: float = 0.0015,
                      horizon_days: int = 5,
                      non_overlap: bool = True) -> pd.DataFrame:
    """Tạo chuỗi equity-curve cho portfolio strategy.

    Chiến lược: mỗi bar có dự đoán → rank tickers theo confidence desc,
    lọc pred_log > min_signal, lấy top-N. Equal-weight, hold H=horizon_days.

    • non_overlap=True (mặc định): rebalance mỗi H ngày → returns không overlap
      → cumprod là equity curve thực, Sharpe/IR valid.
    • non_overlap=False: rebalance hàng ngày — nhiều obs hơn nhưng overlap H-1
      ngày giữa các bar → return của 1 calendar ngày bị double-count.
      Chỉ dùng để tham khảo, không phải equity thực.

    Returns DataFrame với cột:
        date, n_selected, tickers_list, gross_return, turnover, net_return
    """
    panel_long = panel_long.sort_values(['date', 'ticker']).reset_index(drop=True)

    if non_overlap and horizon_days > 1:
        # Lấy mỗi H ngày 1 bar để tránh overlap
        all_dates = sorted(panel_long['date'].unique())
        keep_dates = set(all_dates[::horizon_days])
        panel_long = panel_long[panel_long['date'].isin(keep_dates)].copy()

    rows = []
    last_selected = set()

    for date, grp in panel_long.groupby('date'):
        cands = grp[grp['pred_log'] > min_signal].copy()
        cands = cands.sort_values('confidence', ascending=False).head(top_n)
        selected = cands['ticker'].tolist()
        if len(selected) == 0:
            rows.append({
                'date': date,
                'n_selected': 0,
                'tickers_list': '',
                'gross_return': 0.0,
                'turnover': 0.0,
                'net_return': 0.0,
            })
            last_selected = set()
            continue
        weights = 1.0 / len(selected)  # equal-weight, part in cash if <N
        avg_ret = float(cands['true_simple'].mean())
        # Scale by fraction-invested: len(selected) / top_n (còn lại cash=0)
        gross = avg_ret * (len(selected) / top_n)
        cur_set = set(selected)
        turnover = len(cur_set.symmetric_difference(last_selected)) / max(top_n, 1)
        # Transaction cost: cả mua và bán (mỗi lần đổi ticker → 2 × tcost)
        cost = turnover * tcost
        net = gross - cost
        rows.append({
            'date': date,
            'n_selected': len(selected),
            'tickers_list': ','.join(selected),
            'gross_return': gross,
            'turnover': turnover,
            'net_return': net,
        })
        last_selected = cur_set

    out = pd.DataFrame(rows).sort_values('date').reset_index(drop=True)
    out['cum_gross'] = (1.0 + out['gross_return']).cumprod()
    out['cum_net'] = (1.0 + out['net_return']).cumprod()
    return out


def benchmark_equal_weight(panel_long: pd.DataFrame, tcost: float = 0.0015,
                           horizon_days: int = 5, non_overlap: bool = True) -> pd.DataFrame:
    """Benchmark: giữ equal-weight toàn bộ ticker.

    Giống portfolio_returns, phải dùng non-overlap để cumprod làm equity thực."""
    if non_overlap and horizon_days > 1:
        all_dates = sorted(panel_long['date'].unique())
        keep_dates = set(all_dates[::horizon_days])
        panel_long = panel_long[panel_long['date'].isin(keep_dates)].copy()
    rows = []
    for date, grp in panel_long.groupby('date'):
        if len(grp) == 0:
            rows.append({'date': date, 'bench_return': 0.0})
            continue
        avg_ret = float(grp['true_simple'].mean())
        # bench turnover ≈ 0 (chỉ rebalance weight nhỏ) → cost ~ 0 cho EW
        rows.append({'date': date, 'bench_return': avg_ret})
    out = pd.DataFrame(rows).sort_values('date').reset_index(drop=True)
    out['cum_bench'] = (1.0 + out['bench_return']).cumprod()
    return out


# ──────────────────────────────────────────────────────────────────────
#  Metrics
# ──────────────────────────────────────────────────────────────────────

def annualize_ret(ret_seq: np.ndarray, bar_days: int = 5) -> float:
    """Ước lượng annualized return khi mỗi obs cover `bar_days` calendar days.
    (non-overlap: bar_days = H; overlap daily: bar_days = 1)."""
    if len(ret_seq) == 0:
        return 0.0
    cum = np.prod(1.0 + ret_seq) - 1.0
    total_days = len(ret_seq) * bar_days
    if total_days <= 0:
        return 0.0
    return float((1.0 + cum) ** (TRADING_DAYS / total_days) - 1.0)


def annualize_vol(ret_seq: np.ndarray, bar_days: int = 5) -> float:
    if len(ret_seq) < 2:
        return 0.0
    # Mỗi obs cover bar_days → vol annualize = std * sqrt(252/bar_days)
    return float(np.std(ret_seq, ddof=1) * np.sqrt(TRADING_DAYS / bar_days))


def sharpe_ratio(ret_seq: np.ndarray, bar_days: int = 5) -> float:
    vol = annualize_vol(ret_seq, bar_days)
    ret = annualize_ret(ret_seq, bar_days)
    return float(ret / vol) if vol > 1e-9 else 0.0


def max_drawdown(equity: np.ndarray) -> float:
    if len(equity) == 0:
        return 0.0
    running_max = np.maximum.accumulate(equity)
    dd = (equity - running_max) / running_max
    return float(dd.min())


def information_ratio(port_ret: np.ndarray, bench_ret: np.ndarray,
                      bar_days: int = 5) -> float:
    """IR = mean(excess) / std(excess), annualized theo bar_days."""
    n = min(len(port_ret), len(bench_ret))
    if n < 2:
        return 0.0
    excess = port_ret[:n] - bench_ret[:n]
    if excess.std() < 1e-12:
        return 0.0
    return float(excess.mean() / excess.std(ddof=1) * np.sqrt(TRADING_DAYS / bar_days))


def summarize(port: pd.DataFrame, bench: pd.DataFrame, bar_days: int = 5) -> dict:
    port_ret = port['net_return'].values
    bench_ret = bench['bench_return'].values
    n = min(len(port_ret), len(bench_ret))
    port_ret = port_ret[:n]
    bench_ret = bench_ret[:n]

    port_eq = np.cumprod(1.0 + port_ret)
    bench_eq = np.cumprod(1.0 + bench_ret)

    # Hit rate (portfolio return > 0)
    trades = port[port['n_selected'] > 0]
    hit = float((trades['net_return'] > 0).mean()) if len(trades) > 0 else 0.0

    return {
        'n_bars': int(n),
        'port_total_return': float(port_eq[-1] - 1.0) if n > 0 else 0.0,
        'bench_total_return': float(bench_eq[-1] - 1.0) if n > 0 else 0.0,
        'port_ann_return': annualize_ret(port_ret, bar_days),
        'bench_ann_return': annualize_ret(bench_ret, bar_days),
        'port_ann_vol': annualize_vol(port_ret, bar_days),
        'bench_ann_vol': annualize_vol(bench_ret, bar_days),
        'port_sharpe': sharpe_ratio(port_ret, bar_days),
        'bench_sharpe': sharpe_ratio(bench_ret, bar_days),
        'port_mdd': max_drawdown(port_eq),
        'bench_mdd': max_drawdown(bench_eq),
        'info_ratio': information_ratio(port_ret, bench_ret, bar_days),
        'hit_rate': hit,
        'n_trades': int(len(trades)),
        'avg_n_selected': float(port['n_selected'].mean()) if len(port) > 0 else 0.0,
        'avg_turnover': float(port['turnover'].mean()) if len(port) > 0 else 0.0,
    }


# ──────────────────────────────────────────────────────────────────────
#  Main
# ──────────────────────────────────────────────────────────────────────

def plot_equity(port: pd.DataFrame, bench: pd.DataFrame, path: str,
                top_n: int):
    fig, ax = plt.subplots(figsize=(11, 5))
    n = min(len(port), len(bench))
    dates = pd.to_datetime(port['date'].values[:n])
    ax.plot(dates, port['cum_net'].values[:n], label=f'Portfolio top-{top_n}', color='#1f77b4', lw=1.8)
    ax.plot(dates, bench['cum_bench'].values[:n], label='EW(10 ticker) benchmark', color='#ff7f0e', lw=1.4, ls='--')
    ax.axhline(1.0, color='gray', ls=':', alpha=0.7)
    ax.set_title(f'Portfolio Equity Curve — top-{top_n} confidence, equal-weight, H=5d hold')
    ax.set_ylabel('Equity (=1 ban đầu)')
    ax.legend()
    ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(path, dpi=120)
    plt.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tickers', nargs='*', default=TICKERS_ALL)
    ap.add_argument('--top_n', type=int, default=3)
    ap.add_argument('--min_signal', type=float, default=0.0,
                    help='Lọc pred_log > min_signal trước khi rank (default 0 = long only)')
    ap.add_argument('--tcost', type=float, default=0.0015,
                    help='Transaction cost 1 lượt (default 0.15%)')
    ap.add_argument('--horizon_days', type=int, default=5)
    ap.add_argument('--overlap', action='store_true',
                    help='Rebalance daily (overlapping). Default non-overlap mỗi H ngày.')
    ap.add_argument('--output_dir', default='models')
    args = ap.parse_args()

    print("█" * 80)
    print(f"  PORTFOLIO BACKTEST — top-{args.top_n}, min_signal={args.min_signal}, "
          f"tcost={args.tcost*100:.2f}%")
    print("█" * 80)

    panel = build_panel(args.tickers)
    long_df = panel['long']
    print(f"\nTotal obs: {len(long_df)} (avg {len(long_df)/len(panel['tickers']):.0f} / ticker)")

    non_overlap = not args.overlap
    port = portfolio_returns(long_df, top_n=args.top_n, min_signal=args.min_signal,
                             tcost=args.tcost, horizon_days=args.horizon_days,
                             non_overlap=non_overlap)
    bench = benchmark_equal_weight(long_df, tcost=args.tcost,
                                   horizon_days=args.horizon_days,
                                   non_overlap=non_overlap)
    print(f"\nRebalance mode: {'non-overlap (mỗi H ngày)' if non_overlap else 'daily (OVERLAPPING - tham khảo)'}")

    # Cân số ngày
    common = sorted(set(port['date']).intersection(set(bench['date'])))
    port = port[port['date'].isin(common)].sort_values('date').reset_index(drop=True)
    bench = bench[bench['date'].isin(common)].sort_values('date').reset_index(drop=True)
    port['cum_net'] = (1.0 + port['net_return']).cumprod()
    bench['cum_bench'] = (1.0 + bench['bench_return']).cumprod()

    # bar_days: mỗi bar cover mấy ngày calendar.
    # non_overlap → H ngày; overlap daily → 1 ngày (obs giao với nhau)
    bar_days = args.horizon_days if non_overlap else 1
    stats = summarize(port, bench, bar_days=bar_days)
    print("\n═══ KẾT QUẢ PORTFOLIO ═══")
    for k, v in stats.items():
        if 'return' in k or 'vol' in k or 'mdd' in k or k == 'hit_rate' or 'turnover' in k:
            print(f"  {k:25s} = {v*100:.2f}%")
        elif 'sharpe' in k or 'info_ratio' in k:
            print(f"  {k:25s} = {v:.3f}")
        else:
            print(f"  {k:25s} = {v}")

    # Save
    os.makedirs(args.output_dir, exist_ok=True)
    port.to_csv(f'{args.output_dir}/portfolio_backtest_daily.csv', index=False)
    bench.to_csv(f'{args.output_dir}/portfolio_benchmark_daily.csv', index=False)

    # Plot equity
    plot_path = f'{args.output_dir}/portfolio_equity.png'
    plot_equity(port, bench, plot_path, args.top_n)
    print(f"\n[WRITE] {plot_path}")

    # Markdown
    md = [
        "# Portfolio-Level Backtest — CNN-LSTM-Attention",
        "",
        f"*Cấu hình*: top-N={args.top_n} confidence-ranked, equal-weight long-only, "
        f"hold H={args.horizon_days}d, transaction cost {args.tcost*100:.2f}%/lượt, "
        f"benchmark = Equal-Weight({len(panel['tickers'])} ticker).",
        "",
        "## Tóm tắt hiệu năng",
        "",
        "| Metric | Portfolio (top-N) | Benchmark EW(10) | Chênh lệch |",
        "|--------|-------------------|------------------|------------|",
        f"| Total return | {stats['port_total_return']*100:.2f}% | {stats['bench_total_return']*100:.2f}% | "
        f"{(stats['port_total_return']-stats['bench_total_return'])*100:+.2f}pp |",
        f"| Annualized return | {stats['port_ann_return']*100:.2f}% | {stats['bench_ann_return']*100:.2f}% | "
        f"{(stats['port_ann_return']-stats['bench_ann_return'])*100:+.2f}pp |",
        f"| Annualized vol | {stats['port_ann_vol']*100:.2f}% | {stats['bench_ann_vol']*100:.2f}% | — |",
        f"| Sharpe ratio | **{stats['port_sharpe']:.2f}** | {stats['bench_sharpe']:.2f} | "
        f"{stats['port_sharpe']-stats['bench_sharpe']:+.2f} |",
        f"| Max drawdown | {stats['port_mdd']*100:.2f}% | {stats['bench_mdd']*100:.2f}% | — |",
        f"| Information ratio | **{stats['info_ratio']:.3f}** | — | — |",
        f"| Hit rate | {stats['hit_rate']*100:.1f}% | — | — |",
        f"| # bars (có trade) | {stats['n_trades']} / {stats['n_bars']} | — | — |",
        f"| Avg tickers held | {stats['avg_n_selected']:.2f} / {args.top_n} | — | — |",
        f"| Avg turnover | {stats['avg_turnover']*100:.1f}% | — | — |",
        "",
        "## Diễn giải",
        "",
        "- **Information Ratio (IR)**: đo mức sinh lợi vượt benchmark trên mỗi đơn vị "
        "risk chủ động. IR > 0.5 được xem là có giá trị cho active management.",
        "- **Sharpe portfolio vs benchmark**: portfolio sử dụng gating nên volatility "
        "thường thấp hơn benchmark (ít ngày có position) → Sharpe risk-adjusted cao hơn.",
        "- **Cash-when-unconfident**: các bar có 0 ticker pass filter → portfolio "
        "ngồi ngoài, bảo toàn vốn khi market bearish / tín hiệu mỏng.",
        "- **Turnover**: số mã thay đổi mỗi chu kỳ rebalance. Turnover thấp "
        "→ chi phí thấp; turnover cao → strategy reactive.",
        "",
        "## So sánh với backtest per-ticker (thesis_summary)",
        "",
        "- Thesis per-ticker báo cáo mean return 6/10 active tickers = +6.82%, "
        "mean Sharpe = 1.18 (tính riêng từng mã).",
        "- Portfolio-level tích hợp diversification: rủi ro idiosyncratic triệt "
        "tiêu, volatility giảm → Sharpe có thể cao hơn bình quân per-ticker.",
        "- Benchmark EW(10 ticker) là so sánh fair: nếu 1 người mua equal-weight "
        "10 mã banking (B&H) thì được IR đang đạt.",
    ]
    md_path = f'{args.output_dir}/portfolio_backtest.md'
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(md))
    print(f"[WRITE] {md_path}")

    print("\n✓ Xong portfolio backtest")


if __name__ == "__main__":
    main()
