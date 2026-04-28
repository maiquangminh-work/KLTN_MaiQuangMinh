import argparse
import os
import pickle
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score
from tensorflow.keras.models import load_model

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from src.model.architecture import AttentionLayer
from src.model.evaluate_probability import apply_confidence_gate
from src.model.probability import (
    CLASS_NAMES,
    DEFAULT_ALPHA_THRESHOLD,
    DEFAULT_HORIZON_DAYS,
    DEFAULT_TICKERS,
    DEFAULT_WINDOW_SIZE,
    FEATURE_COLUMNS,
    apply_probability_calibrator,
    build_peer_close_table,
    build_peer_return_table,
    prepare_probability_frame,
)


def classify_regime(benchmark_return):
    if benchmark_return >= 0.01:
        return "bull"
    if benchmark_return <= -0.01:
        return "bear"
    return "sideway"


def naive_baseline_class(previous_class):
    return int(previous_class)


def majority_baseline_class(values):
    values = np.asarray(values).astype(int)
    if values.size == 0:
        return 1
    counts = np.bincount(values, minlength=len(CLASS_NAMES))
    return int(np.argmax(counts))


def add_class_distribution(prefix, target_values, output_dict):
    target_values = np.asarray(target_values).astype(int)
    total = max(1, len(target_values))
    for class_index, class_name in enumerate(CLASS_NAMES):
        count = int(np.sum(target_values == class_index))
        output_dict[f"{prefix}_count_{class_name}"] = count
        output_dict[f"{prefix}_ratio_{class_name}"] = float(count / total)


def plot_walk_forward_summary(summary_df, output_path):
    if summary_df.empty:
        return
    plot_df = summary_df.copy()
    x = np.arange(len(plot_df))
    width = 0.25

    plt.figure(figsize=(13, 7))
    plt.bar(x - width, plot_df["accuracy_model"], width=width, label="Model", color="#0ecb81")
    plt.bar(x, plot_df["accuracy_baseline_persistence"], width=width, label="Baseline Persistence", color="#fcd535")
    plt.bar(x + width, plot_df["accuracy_baseline_majority"], width=width, label="Baseline Majority", color="#94a3b8")
    plt.xticks(x, plot_df["ticker"])
    plt.ylim(0, 1)
    plt.ylabel("Accuracy")
    plt.title("Walk-forward accuracy: model vs baselines")
    plt.grid(axis="y", linestyle=":", alpha=0.5)
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def evaluate_walk_forward(
    ticker,
    peer_return_table,
    peer_close_table,
    tickers,
    horizon_days,
    alpha_threshold,
    window_size,
    test_window_size,
):
    ticker = ticker.upper()
    df = prepare_probability_frame(
        ticker=ticker,
        peer_return_table=peer_return_table,
        peer_close_table=peer_close_table,
        tickers=tickers,
        horizon_days=horizon_days,
        alpha_threshold=alpha_threshold,
    ).reset_index(drop=True)

    model_path = f"models/cnn_lstm_attn_{ticker.lower()}_prob_v1.h5"
    scaler_path = f"models/{ticker.lower()}_prob_feature_scaler.pkl"
    config_path = f"models/{ticker.lower()}_prob_config.pkl"
    calibrator_path = f"models/{ticker.lower()}_prob_calibrator.pkl"

    if not (os.path.exists(model_path) and os.path.exists(scaler_path) and os.path.exists(config_path)):
        raise FileNotFoundError(f"Missing trained probability artifacts for {ticker}.")

    with open(scaler_path, "rb") as file_obj:
        feature_scaler = pickle.load(file_obj)
    with open(config_path, "rb") as file_obj:
        config = pickle.load(file_obj)

    calibrator = None
    if os.path.exists(calibrator_path):
        with open(calibrator_path, "rb") as file_obj:
            calibrator = pickle.load(file_obj)

    model = load_model(model_path, custom_objects={"AttentionLayer": AttentionLayer}, compile=False)

    features = config.get("feature_columns", FEATURE_COLUMNS)
    window_size = int(config.get("window_size", window_size))
    confidence_gate = config.get("confidence_gate", {})
    min_action_probability = float(confidence_gate.get("min_action_probability", 0.45))
    min_probability_edge = float(confidence_gate.get("min_probability_edge", 0.12))

    scaled_data = feature_scaler.transform(df[features].values)
    y_true_all = df["alpha_class"].values.astype(int)
    regime_series = df["benchmark_return_10d"].apply(classify_regime).values

    first_test_idx = max(int(len(df) * 0.7), window_size)
    fold_rows = []
    all_true, all_pred, all_base, all_majority, all_regime, all_signal = [], [], [], [], [], []

    for fold_id, start_idx in enumerate(range(first_test_idx, len(df), test_window_size), start=1):
        end_idx = min(start_idx + test_window_size, len(df))
        if end_idx - start_idx < 5:
            continue

        y_true_fold, y_pred_fold = [], []
        y_base_fold, y_majority_fold, regime_fold = [], [], []
        signal_fold = []
        majority_class = majority_baseline_class(y_true_all[:start_idx])

        for idx in range(start_idx, end_idx):
            seq_start = idx - window_size
            if seq_start < 0:
                continue
            seq = scaled_data[seq_start:idx]
            probs = model.predict(np.array([seq]), verbose=0).flatten()
            probs, _ = apply_probability_calibrator(probs, calibrator)

            pred_class = int(np.argmax(probs))
            previous_idx = max(0, idx - 1)
            base_class = naive_baseline_class(y_true_all[previous_idx])
            has_signal = bool(
                apply_confidence_gate(
                    np.array([probs]),
                    min_action_probability=min_action_probability,
                    min_probability_edge=min_probability_edge,
                )[0]
            )

            y_true_fold.append(y_true_all[idx])
            y_pred_fold.append(pred_class)
            y_base_fold.append(base_class)
            y_majority_fold.append(majority_class)
            regime_fold.append(regime_series[idx])
            signal_fold.append(has_signal)

        if not y_true_fold:
            continue

        fold_metrics = {
            "ticker": ticker,
            "fold_id": fold_id,
            "start_date": str(df["time"].iloc[start_idx]),
            "end_date": str(df["time"].iloc[end_idx - 1]),
            "samples": len(y_true_fold),
            "accuracy_model": float(accuracy_score(y_true_fold, y_pred_fold)),
            "accuracy_baseline_persistence": float(accuracy_score(y_true_fold, y_base_fold)),
            "accuracy_baseline_majority": float(accuracy_score(y_true_fold, y_majority_fold)),
            "macro_f1_model": float(f1_score(y_true_fold, y_pred_fold, average="macro", zero_division=0)),
            "macro_f1_baseline_persistence": float(f1_score(y_true_fold, y_base_fold, average="macro", zero_division=0)),
            "macro_f1_baseline_majority": float(f1_score(y_true_fold, y_majority_fold, average="macro", zero_division=0)),
            "signal_coverage": float(np.mean(signal_fold)),
            "majority_class_label": CLASS_NAMES[majority_class],
        }
        add_class_distribution("fold", y_true_fold, fold_metrics)

        for regime in ("bull", "sideway", "bear"):
            mask = [item == regime for item in regime_fold]
            if any(mask):
                regime_true = [value for value, keep in zip(y_true_fold, mask) if keep]
                regime_pred = [value for value, keep in zip(y_pred_fold, mask) if keep]
                regime_base = [value for value, keep in zip(y_base_fold, mask) if keep]
                regime_majority = [value for value, keep in zip(y_majority_fold, mask) if keep]
                fold_metrics[f"accuracy_model_{regime}"] = float(accuracy_score(regime_true, regime_pred))
                fold_metrics[f"accuracy_baseline_persistence_{regime}"] = float(accuracy_score(regime_true, regime_base))
                fold_metrics[f"accuracy_baseline_majority_{regime}"] = float(accuracy_score(regime_true, regime_majority))
            else:
                fold_metrics[f"accuracy_model_{regime}"] = np.nan
                fold_metrics[f"accuracy_baseline_persistence_{regime}"] = np.nan
                fold_metrics[f"accuracy_baseline_majority_{regime}"] = np.nan

        fold_rows.append(fold_metrics)
        all_true.extend(y_true_fold)
        all_pred.extend(y_pred_fold)
        all_base.extend(y_base_fold)
        all_majority.extend(y_majority_fold)
        all_regime.extend(regime_fold)
        all_signal.extend(signal_fold)

    if not fold_rows:
        raise ValueError(f"Not enough samples for walk-forward evaluation on {ticker}.")

    summary = {
        "ticker": ticker,
        "fold_count": len(fold_rows),
        "samples": len(all_true),
        "accuracy_model": float(accuracy_score(all_true, all_pred)),
        "accuracy_baseline_persistence": float(accuracy_score(all_true, all_base)),
        "accuracy_baseline_majority": float(accuracy_score(all_true, all_majority)),
        "macro_f1_model": float(f1_score(all_true, all_pred, average="macro", zero_division=0)),
        "macro_f1_baseline_persistence": float(f1_score(all_true, all_base, average="macro", zero_division=0)),
        "macro_f1_baseline_majority": float(f1_score(all_true, all_majority, average="macro", zero_division=0)),
        "signal_coverage": float(np.mean(all_signal)),
    }
    add_class_distribution("all", all_true, summary)
    for regime in ("bull", "sideway", "bear"):
        mask = [item == regime for item in all_regime]
        if any(mask):
            regime_true = [value for value, keep in zip(all_true, mask) if keep]
            regime_pred = [value for value, keep in zip(all_pred, mask) if keep]
            regime_base = [value for value, keep in zip(all_base, mask) if keep]
            regime_majority = [value for value, keep in zip(all_majority, mask) if keep]
            summary[f"accuracy_model_{regime}"] = float(accuracy_score(regime_true, regime_pred))
            summary[f"accuracy_baseline_persistence_{regime}"] = float(accuracy_score(regime_true, regime_base))
            summary[f"accuracy_baseline_majority_{regime}"] = float(accuracy_score(regime_true, regime_majority))
        else:
            summary[f"accuracy_model_{regime}"] = np.nan
            summary[f"accuracy_baseline_persistence_{regime}"] = np.nan
            summary[f"accuracy_baseline_majority_{regime}"] = np.nan

    return summary, pd.DataFrame(fold_rows)


def parse_args():
    parser = argparse.ArgumentParser(description="Walk-forward evaluation for alpha-probability models.")
    parser.add_argument("--tickers", nargs="*", default=list(DEFAULT_TICKERS), help="Ticker list to evaluate.")
    parser.add_argument("--horizon-days", type=int, default=DEFAULT_HORIZON_DAYS, help="Forward horizon in sessions.")
    parser.add_argument("--alpha-threshold", type=float, default=DEFAULT_ALPHA_THRESHOLD, help="Alpha threshold.")
    parser.add_argument("--window-size", type=int, default=DEFAULT_WINDOW_SIZE, help="Fallback window size.")
    parser.add_argument("--test-window-size", type=int, default=30, help="Test window size per fold.")
    return parser.parse_args()


def main():
    args = parse_args()
    tickers = tuple(item.upper() for item in args.tickers)
    peer_return_table = build_peer_return_table(tickers=tickers, horizon_days=args.horizon_days)
    peer_close_table = build_peer_close_table(tickers=tickers)

    summary_rows = []
    fold_tables = []
    for ticker in tickers:
        summary, fold_df = evaluate_walk_forward(
            ticker=ticker,
            peer_return_table=peer_return_table,
            peer_close_table=peer_close_table,
            tickers=tickers,
            horizon_days=args.horizon_days,
            alpha_threshold=args.alpha_threshold,
            window_size=args.window_size,
            test_window_size=args.test_window_size,
        )
        summary_rows.append(summary)
        fold_tables.append(fold_df)
        print(
            f"[{ticker}] accuracy(model/persistence/majority): "
            f"{summary['accuracy_model']:.4f}/{summary['accuracy_baseline_persistence']:.4f}/{summary['accuracy_baseline_majority']:.4f} | "
            f"macro_f1(model/persistence/majority): "
            f"{summary['macro_f1_model']:.4f}/{summary['macro_f1_baseline_persistence']:.4f}/{summary['macro_f1_baseline_majority']:.4f}"
        )

    os.makedirs("models", exist_ok=True)
    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_csv("models/walk_forward_metrics.csv", index=False)
    pd.concat(fold_tables, ignore_index=True).to_csv("models/walk_forward_fold_metrics.csv", index=False)
    plot_walk_forward_summary(summary_df, "models/walk_forward_summary.png")
    print("Saved: models/walk_forward_metrics.csv, models/walk_forward_fold_metrics.csv and models/walk_forward_summary.png")


if __name__ == "__main__":
    main()
