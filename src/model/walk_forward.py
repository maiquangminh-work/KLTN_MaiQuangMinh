"""
Walk-Forward Validation (Bước B1).

Mục tiêu: Loại bỏ nghi vấn cherry-pick split. Thay vì báo cáo DA trên 1 split
80/10/10 cố định, ta trượt cửa sổ qua nhiều thời kỳ và báo cáo **mean ± std**
của DA, Sharpe trên 8 rolling windows.

Thiết kế window:
    ┌─────── train 756 days (3 năm) ───────┐┌ val 126 ┐┌ test 63 ┐
    ... window 1
                 ... window 2 (trượt +63 test)
                            ... window 3
                                       ...

Để tăng tốc (8 windows × 3 ticker):
  - Single seed (42) thay vì ensemble 5 seeds
  - Epochs 50 (patience 15) thay vì 150 (patience 20)
  - Horizon=5 giữ nguyên thesis
  - Giữ cùng architecture & loss VarianceMatchingMSE

Cách chạy:
    cd D:\\.vscode\\KLTN\\Demo
    python -m src.model.walk_forward                    # 3 ticker default
    python -m src.model.walk_forward --tickers VCB      # 1 ticker
    python -m src.model.walk_forward --n_windows 5      # ít windows hơn

Output:
    models/walkforward/{ticker}_windows.csv   — chi tiết từng window
    models/walkforward/{ticker}_summary.md    — mean ± std
    models/walk_forward_summary.md            — tổng hợp 3 ticker
"""
from __future__ import annotations

import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

import argparse
import numpy as np
import pandas as pd
import pickle
import random
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler, MaxAbsScaler
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from src.model.architecture import build_cnn_lstm_attention_model, AttentionLayer
from src.model.losses import VarianceMatchingMSE
from src.model.train import (
    REGRESSION_FEATURE_COLUMNS,
    _augment_regression_features,
    _augment_cross_sectional_features,
    create_sequences,
)
from src.model.confidence import fit_temperature, compute_confidence_scores

WINDOW_SIZE = 30          # lookback sequence (giống thesis)
TRAIN_DAYS = 756          # 3 năm train
VAL_DAYS = 126            # 6 tháng val
TEST_DAYS = 63            # 3 tháng test
HORIZON = 5               # T+5 log-return target


def set_global_seed(seed: int):
    os.environ['PYTHONHASHSEED'] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)


def prepare_ticker_data(ticker: str) -> dict:
    """Load + augment features. Trả về DataFrame và feature list."""
    features = list(REGRESSION_FEATURE_COLUMNS)
    df = pd.read_csv(f'data/processed/{ticker}_features.csv')
    df = _augment_regression_features(df)
    if any(col in features for col in ('benchmark_return_1d', 'rank_return_1d', 'alpha_1d_vs_peer')):
        df = _augment_cross_sectional_features(df, ticker)
    # Forward log-return H=5
    df['log_return'] = np.log(df['close_winsorized'].shift(-HORIZON) / df['close_winsorized'])
    df.dropna(subset=features + ['log_return', 'close_winsorized'], inplace=True)
    df.reset_index(drop=True, inplace=True)
    return {'df': df, 'features': features}


def train_one_window(X_train, y_train, X_val, y_val, n_features, seed=42,
                     epochs=50, patience=15, batch_size=16, verbose=0):
    """Train 1 model nhanh cho 1 window. Không save checkpoint (giữ trong memory)."""
    set_global_seed(seed)
    model = build_cnn_lstm_attention_model((WINDOW_SIZE, n_features))
    custom_loss = VarianceMatchingMSE(
        variance_weight=0.5, direction_weight=0.15, direction_temp=20.0,
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss=custom_loss,
        metrics=['mae'],
    )
    cbs = [
        EarlyStopping(monitor='val_loss', patience=patience,
                      restore_best_weights=True, verbose=0),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=8,
                          min_lr=1e-5, verbose=0),
    ]
    history = model.fit(
        X_train, y_train, validation_data=(X_val, y_val),
        epochs=epochs, batch_size=batch_size, callbacks=cbs, verbose=verbose,
    )
    best_val_loss = float(min(history.history.get('val_loss', [float('inf')])))
    return model, best_val_loss


def train_ensemble_window(X_train, y_train, X_val, y_val, n_features,
                          seeds=(42, 123, 456), epochs=50, patience=15,
                          batch_size=16):
    """Train ensemble K models (cùng window, nhiều seed) → predict trung bình.
    Trả về list(models), mean_val_loss."""
    models = []
    val_losses = []
    for i, s in enumerate(seeds):
        print(f"    seed {s} ({i+1}/{len(seeds)})...", end=' ', flush=True)
        m, vl = train_one_window(
            X_train, y_train, X_val, y_val, n_features,
            seed=s, epochs=epochs, patience=patience, batch_size=batch_size,
        )
        models.append(m)
        val_losses.append(vl)
        print(f"val_loss={vl:.5f}")
    return models, float(np.mean(val_losses))


def ensemble_predict(models, X):
    """Trung bình dự đoán từ ensemble (scaled space)."""
    preds = np.stack([m.predict(X, verbose=0) for m in models], axis=0)
    return preds.mean(axis=0)


def evaluate_window(model_or_models, target_scaler, X_val, y_val, X_test, y_test,
                    val_prices, test_prices, feature_count: int,
                    val_prev_prices, val_act_prices,
                    test_prev_prices, test_act_prices,
                    train_target_std: float) -> dict:
    """Đánh giá trên 1 test window: DA, DA gated, Sharpe nội tại.
    Hỗ trợ cả single model và ensemble (list of models)."""
    is_ensemble = isinstance(model_or_models, list)

    def _predict(X):
        return (ensemble_predict(model_or_models, X) if is_ensemble
                else model_or_models.predict(X, verbose=0))

    # Val predictions → fit temperature
    val_pred_scaled = _predict(X_val)
    val_pred_log = target_scaler.inverse_transform(val_pred_scaled).flatten()
    Nv = min(len(val_pred_log), len(val_prev_prices))
    val_pred_log = val_pred_log[:Nv]
    val_true_log = np.log(val_act_prices[:Nv] / val_prev_prices[:Nv])
    T = fit_temperature(val_pred_log, val_true_log) if val_true_log.size > 0 else 1.0

    # Test predictions với temperature scaling
    test_pred_scaled = _predict(X_test)
    test_pred_log = target_scaler.inverse_transform(test_pred_scaled).flatten() * T
    N = min(len(test_pred_log), len(test_prev_prices))
    test_pred_log = test_pred_log[:N]
    test_true_log = np.log(test_act_prices[:N] / test_prev_prices[:N])

    # DA full
    da_full = float((np.sign(test_pred_log) == np.sign(test_true_log)).mean())

    # DA gated cov30 + cov20
    ref_std = train_target_std if train_target_std > 1e-9 else 0.01
    conf = compute_confidence_scores(test_pred_log, ref_std)
    gated = {}
    for cov, label in ((0.3, 'cov30'), (0.2, 'cov20')):
        if conf.size >= 10:
            thr = np.quantile(conf, 1 - cov)
            mask = conf >= thr
            if mask.sum() >= 5:
                da = float((np.sign(test_pred_log[mask]) == np.sign(test_true_log[mask])).mean())
            else:
                da = np.nan
        else:
            da = np.nan
        gated[label] = da

    # Sharpe nội tại trên sign(pred) × true
    signal_ret = np.sign(test_pred_log) * test_true_log
    if len(signal_ret) >= 2 and signal_ret.std() > 1e-9:
        sharpe = float(signal_ret.mean() / signal_ret.std() * np.sqrt(252))
    else:
        sharpe = 0.0

    return {
        'n_test': int(N),
        'temperature': float(T),
        'ref_std': float(ref_std),
        'da_full': da_full,
        'da_cov30': gated['cov30'],
        'da_cov20': gated['cov20'],
        'sharpe_intrinsic': sharpe,
        'mean_pred': float(np.mean(test_pred_log)),
        'mean_true': float(np.mean(test_true_log)),
    }


def walk_forward_ticker(ticker: str, n_windows: int = 8,
                        train_days: int = TRAIN_DAYS,
                        val_days: int = VAL_DAYS,
                        test_days: int = TEST_DAYS,
                        epochs: int = 50,
                        seeds: tuple = (42,),
                        patience: int = 15) -> pd.DataFrame:
    """Chạy walk-forward cho 1 ticker trên n_windows rolling windows."""
    data = prepare_ticker_data(ticker)
    df = data['df']
    features = data['features']

    total = len(df)
    window_total = train_days + val_days + test_days
    if total < window_total + (n_windows - 1) * test_days:
        # Scale lại nếu data không đủ
        max_windows = max(1, (total - window_total) // test_days + 1)
        print(f"[WF] {ticker}: data {total} days < cần {window_total + (n_windows - 1) * test_days}. "
              f"Giảm n_windows {n_windows} → {max_windows}.")
        n_windows = max_windows

    data_values = df[features].values
    target_values = df[['log_return']].values
    prices = df['close_winsorized'].values
    rows = []

    for w in range(n_windows):
        start = w * test_days
        train_end = start + train_days
        val_end = train_end + val_days
        test_end = val_end + test_days
        if test_end > total:
            break

        print(f"\n═══ {ticker} Window {w+1}/{n_windows} "
              f"[{start}:{train_end}] train | [{train_end}:{val_end}] val | "
              f"[{val_end}:{test_end}] test ═══")

        train_data = data_values[start:train_end]
        train_target = target_values[start:train_end]
        val_data = data_values[train_end:val_end]
        val_target = target_values[train_end:val_end]
        test_data = data_values[val_end:test_end]
        test_target = target_values[val_end:test_end]

        train_prices = prices[start:train_end]
        val_prices = prices[train_end:val_end]
        test_prices = prices[val_end:test_end]

        # Scalers fit trên train (tránh leakage)
        feat_scaler = MinMaxScaler(feature_range=(0, 1)).fit(train_data)
        tgt_scaler = MaxAbsScaler().fit(train_target)
        sc_train = feat_scaler.transform(train_data)
        sc_train_tgt = tgt_scaler.transform(train_target)
        sc_val = feat_scaler.transform(val_data)
        sc_val_tgt = tgt_scaler.transform(val_target)
        sc_test = feat_scaler.transform(test_data)
        sc_test_tgt = tgt_scaler.transform(test_target)

        X_train, y_train = create_sequences(sc_train, sc_train_tgt, WINDOW_SIZE)
        X_val, y_val = create_sequences(sc_val, sc_val_tgt, WINDOW_SIZE)
        X_test, y_test = create_sequences(sc_test, sc_test_tgt, WINDOW_SIZE)

        if len(X_train) < 50 or len(X_val) < 5 or len(X_test) < 5:
            print(f"  Skip — insufficient sequences (train={len(X_train)}, "
                  f"val={len(X_val)}, test={len(X_test)})")
            continue

        # Price alignment cho DA evaluation
        Nv = len(X_val)
        val_prev = val_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + Nv]
        val_act = val_prices[WINDOW_SIZE - 1 + HORIZON: WINDOW_SIZE - 1 + HORIZON + Nv] \
            if len(val_prices) > WINDOW_SIZE - 1 + HORIZON else np.array([])
        # Val prices đôi khi không đủ cho HORIZON — fallback:
        if len(val_act) < Nv:
            # Dùng thay thế từ test_prices (mô phỏng "future" price)
            needed = Nv - len(val_act)
            if len(test_prices) >= needed:
                val_act = np.concatenate([val_act, test_prices[:needed]])
            else:
                Nv = len(val_act)
        Nv = min(Nv, len(val_prev), len(val_act))
        val_prev = val_prev[:Nv]
        val_act = val_act[:Nv]

        Nt = len(X_test)
        test_prev = test_prices[WINDOW_SIZE - 1: WINDOW_SIZE - 1 + Nt]
        if len(test_prices) > WINDOW_SIZE - 1 + HORIZON:
            test_act = test_prices[WINDOW_SIZE - 1 + HORIZON:
                                   WINDOW_SIZE - 1 + HORIZON + Nt]
        else:
            test_act = np.array([])
        if len(test_act) < Nt:
            needed = Nt - len(test_act)
            # Dùng data vượt biên từ df.prices
            tail_start = val_end + WINDOW_SIZE - 1 + HORIZON
            overflow = prices[val_end + len(test_prices):]
            if len(overflow) >= needed:
                test_act = np.concatenate([test_act, overflow[:needed]])
            else:
                Nt = len(test_act)
        Nt = min(Nt, len(test_prev), len(test_act))
        test_prev = test_prev[:Nt]
        test_act = test_act[:Nt]

        # Train (single seed vs ensemble)
        if len(seeds) == 1:
            model, best_val_loss = train_one_window(
                X_train, y_train, X_val, y_val,
                n_features=len(features), seed=seeds[0], epochs=epochs,
                patience=patience,
            )
            model_for_eval = model
        else:
            print(f"  Ensemble {len(seeds)} seeds:")
            models, best_val_loss = train_ensemble_window(
                X_train, y_train, X_val, y_val,
                n_features=len(features), seeds=seeds,
                epochs=epochs, patience=patience,
            )
            model_for_eval = models

        # Train target std for ref_std
        train_target_std = float(np.std(train_target.flatten()))

        # Evaluate
        metrics = evaluate_window(
            model_for_eval, tgt_scaler, X_val[:Nv], y_val[:Nv], X_test[:Nt], y_test[:Nt],
            val_prices, test_prices, len(features),
            val_prev, val_act, test_prev, test_act, train_target_std,
        )

        row = {
            'ticker': ticker,
            'window': w + 1,
            'start_idx': int(start),
            'train_end': int(train_end),
            'val_end': int(val_end),
            'test_end': int(test_end),
            'best_val_loss': float(best_val_loss),
            **metrics,
        }
        rows.append(row)
        print(f"  → DA_full={row['da_full']*100:.1f}%  "
              f"DA@cov30={row['da_cov30']*100:.1f}%  "
              f"DA@cov20={row['da_cov20']*100:.1f}%  "
              f"Sharpe={row['sharpe_intrinsic']:.2f}  T={row['temperature']:.3f}")

        # Partial save: flush sau mỗi window để không mất kết quả nếu crash
        try:
            _partial_dir = os.path.join('models', 'walkforward_partial')
            os.makedirs(_partial_dir, exist_ok=True)
            pd.DataFrame(rows).to_csv(
                os.path.join(_partial_dir, f'{ticker}_windows_partial.csv'),
                index=False,
            )
        except Exception as _exc:
            print(f"  [WARN] partial save failed: {_exc}")

        # Free memory
        if len(seeds) == 1:
            del model
        else:
            del models
        tf.keras.backend.clear_session()

    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame, ticker: str) -> dict:
    """Tính mean ± std trên các window."""
    if len(df) == 0:
        return {'ticker': ticker, 'n_windows': 0}
    cols = ['da_full', 'da_cov30', 'da_cov20', 'sharpe_intrinsic', 'temperature']
    summary = {'ticker': ticker, 'n_windows': len(df)}
    for c in cols:
        if c in df.columns:
            vals = df[c].dropna().values
            if len(vals) > 0:
                summary[f'{c}_mean'] = float(vals.mean())
                summary[f'{c}_std'] = float(vals.std(ddof=1) if len(vals) > 1 else 0.0)
                summary[f'{c}_min'] = float(vals.min())
                summary[f'{c}_max'] = float(vals.max())
    return summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tickers', nargs='*', default=['VCB', 'MBB', 'BID'])
    ap.add_argument('--n_windows', type=int, default=8)
    ap.add_argument('--epochs', type=int, default=50)
    ap.add_argument('--patience', type=int, default=15)
    ap.add_argument('--seeds', nargs='*', type=int, default=[42],
                    help='Multi-seed ensemble. VD: --seeds 42 123 456')
    ap.add_argument('--output_dir', default='models/walkforward')
    ap.add_argument('--tag', default='',
                    help='Suffix đặt tên output, vd "ensemble" → walkforward_ensemble/')
    args = ap.parse_args()
    if args.tag:
        args.output_dir = f'{args.output_dir}_{args.tag}'
    seeds = tuple(args.seeds)

    os.makedirs(args.output_dir, exist_ok=True)
    all_summaries = []
    all_windows = []

    for tk in args.tickers:
        print("\n" + "█" * 90)
        print(f"  WALK-FORWARD {tk}")
        print("█" * 90)
        try:
            df_windows = walk_forward_ticker(
                tk, n_windows=args.n_windows, epochs=args.epochs,
                seeds=seeds, patience=args.patience,
            )
            df_windows.to_csv(f'{args.output_dir}/{tk}_windows.csv', index=False)
            summary = summarize(df_windows, tk)
            all_summaries.append(summary)
            all_windows.append(df_windows)
            print(f"\n[WF SUMMARY] {tk}: n={summary['n_windows']}")
            if 'da_full_mean' in summary:
                print(f"  DA_full      mean={summary['da_full_mean']*100:.2f}% "
                      f"std={summary['da_full_std']*100:.2f}%")
                print(f"  DA@cov30     mean={summary['da_cov30_mean']*100:.2f}% "
                      f"std={summary['da_cov30_std']*100:.2f}%")
                print(f"  DA@cov20     mean={summary['da_cov20_mean']*100:.2f}% "
                      f"std={summary['da_cov20_std']*100:.2f}%")
                print(f"  Sharpe       mean={summary['sharpe_intrinsic_mean']:.2f} "
                      f"std={summary['sharpe_intrinsic_std']:.2f}")
        except Exception as e:
            import traceback
            print(f"[WF-ERROR] {tk}: {e}")
            traceback.print_exc()

    # Markdown tổng hợp
    md = ["# Walk-Forward Validation — CNN-LSTM-Attention\n"]
    seed_desc = f"ensemble {len(seeds)} seeds {list(seeds)}" if len(seeds) > 1 else f"single seed={seeds[0]}"
    md.append(f"*Cấu hình*: Train {TRAIN_DAYS}d / Val {VAL_DAYS}d / Test {TEST_DAYS}d, "
              f"slide +{TEST_DAYS}d, horizon H={HORIZON}, {seed_desc}, "
              f"epochs={args.epochs}, patience={args.patience}. "
              f"Số windows mục tiêu: {args.n_windows}.\n")

    md.append("## Tổng hợp mean ± std qua các window\n")
    md.append("| Ticker | n | DA_full (mean±std) | DA@cov30 | DA@cov20 | Sharpe intrinsic |")
    md.append("|--------|---|--------------------|----------|----------|------------------|")
    for s in all_summaries:
        if s['n_windows'] == 0:
            md.append(f"| {s['ticker']} | 0 | — | — | — | — |")
            continue
        md.append(
            f"| {s['ticker']} | {s['n_windows']} | "
            f"{s['da_full_mean']*100:.1f} ± {s['da_full_std']*100:.1f}% | "
            f"{s['da_cov30_mean']*100:.1f} ± {s['da_cov30_std']*100:.1f}% | "
            f"{s['da_cov20_mean']*100:.1f} ± {s['da_cov20_std']*100:.1f}% | "
            f"{s['sharpe_intrinsic_mean']:.2f} ± {s['sharpe_intrinsic_std']:.2f} |"
        )

    md.append("\n## Chi tiết từng window\n")
    for df_w, s in zip(all_windows, all_summaries):
        md.append(f"### {s['ticker']}\n")
        md.append("| Window | Start | Test end | DA_full | DA@cov30 | DA@cov20 | Sharpe | T |")
        md.append("|--------|-------|----------|---------|----------|----------|--------|---|")
        for _, row in df_w.iterrows():
            md.append(
                f"| {int(row['window'])} | {int(row['start_idx'])} | "
                f"{int(row['test_end'])} | "
                f"{row['da_full']*100:.1f}% | "
                f"{row['da_cov30']*100:.1f}% | "
                f"{row['da_cov20']*100:.1f}% | "
                f"{row['sharpe_intrinsic']:.2f} | "
                f"{row['temperature']:.2f} |"
            )
        md.append("")

    md.append("## Kết luận\n")
    valid = [s for s in all_summaries if s.get('n_windows', 0) > 0]
    if valid:
        mean_da20 = np.mean([s['da_cov20_mean'] for s in valid]) * 100
        mean_sharpe = np.mean([s['sharpe_intrinsic_mean'] for s in valid])
        md.append(f"- Mean DA@cov20 across {len(valid)} ticker × {sum(s['n_windows'] for s in valid)} "
                  f"rolling windows: **{mean_da20:.1f}%** (vs random walk 50%).")
        md.append(f"- Mean Sharpe intrinsic: **{mean_sharpe:.2f}** (annualized).")
        md.append("- **Robustness**: std của DA@cov20 cho biết biến động qua thời kỳ. "
                  "std nhỏ → model stable across regimes; std lớn → model phụ thuộc bối cảnh.")
        md.append("- So với split 80/10/10 cố định trong thesis chính (DA@cov20 57.7%), "
                  "walk-forward cho cái nhìn **mean±std** đáng tin cậy hơn, loại nghi vấn cherry-pick.")

    tag_suffix = f'_{args.tag}' if args.tag else ''
    out_md = f'models/walk_forward_summary{tag_suffix}.md'
    with open(out_md, 'w', encoding='utf-8') as f:
        f.write("\n".join(md))
    print(f"\n[WRITE] {out_md}")

    # Bar plot DA@cov20 mean với error bars
    if valid:
        fig, ax = plt.subplots(figsize=(10, 5))
        tks = [s['ticker'] for s in valid]
        means = [s['da_cov20_mean'] * 100 for s in valid]
        stds = [s['da_cov20_std'] * 100 for s in valid]
        x = np.arange(len(tks))
        ax.bar(x, means, yerr=stds, capsize=8, color='#1f77b4', alpha=0.8,
               edgecolor='#003366')
        ax.axhline(50, color='gray', linestyle=':', label='Random 50%')
        ax.set_xticks(x)
        ax.set_xticklabels(tks)
        ax.set_ylabel('DA @ cov20 (%)')
        ax.set_title(f'Walk-Forward DA@cov20 — mean ± std qua {args.n_windows} rolling windows')
        ax.legend()
        ax.grid(axis='y', alpha=0.3)
        for i, (m, s) in enumerate(zip(means, stds)):
            ax.text(i, m + s + 1, f'{m:.1f}%', ha='center', fontsize=9)
        plt.tight_layout()
        plot_path = f'models/walk_forward_plot{tag_suffix}.png'
        plt.savefig(plot_path, dpi=120)
        plt.close()
        print(f"[WRITE] {plot_path}")


if __name__ == "__main__":
    main()
