import argparse
import os
import pickle
import sys

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from tensorflow.keras.models import load_model

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from src.model.architecture import AttentionLayer
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
    create_sequences,
    prepare_probability_frame,
)


def brier_score_multiclass(y_true, probabilities, num_classes=3):
    y_true = np.asarray(y_true).astype(int)
    probabilities = np.asarray(probabilities, dtype=float)
    one_hot = np.eye(num_classes)[y_true]
    return float(np.mean(np.sum((probabilities - one_hot) ** 2, axis=1)))


def precision_at_top_k(y_true, probabilities, class_index=2, top_fraction=0.2):
    y_true = np.asarray(y_true).astype(int)
    scores = np.asarray(probabilities)[:, class_index]
    k = max(1, int(len(scores) * top_fraction))
    top_idx = np.argsort(scores)[-k:]
    return float(np.mean(y_true[top_idx] == class_index))


def expected_calibration_error(y_true, probabilities, n_bins=10):
    y_true = np.asarray(y_true).astype(int)
    probabilities = np.asarray(probabilities, dtype=float)
    confidence = probabilities.max(axis=1)
    predictions = probabilities.argmax(axis=1)
    correctness = (predictions == y_true).astype(float)

    ece = 0.0
    for bin_index in range(n_bins):
        lower = bin_index / n_bins
        upper = (bin_index + 1) / n_bins
        mask = (confidence > lower) & (confidence <= upper)
        if not np.any(mask):
            continue
        ece += (np.sum(mask) / len(confidence)) * abs(np.mean(correctness[mask]) - np.mean(confidence[mask]))
    return float(ece)


def apply_confidence_gate(probabilities, min_action_probability=0.45, min_probability_edge=0.12):
    probabilities = np.asarray(probabilities, dtype=float)
    p_under = probabilities[:, 0]
    p_out = probabilities[:, 2]
    edge = p_out - p_under
    predicted = probabilities.argmax(axis=1)
    max_prob = probabilities.max(axis=1)
    strong_direction = (
        ((predicted == 2) & (edge >= min_probability_edge)) |
        ((predicted == 0) & (edge <= -min_probability_edge))
    )
    return strong_direction & (max_prob >= min_action_probability)


def evaluate_model(
    ticker="VCB",
    peer_return_table=None,
    peer_close_table=None,
    tickers=DEFAULT_TICKERS,
    horizon_days=DEFAULT_HORIZON_DAYS,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    window_size=DEFAULT_WINDOW_SIZE,
):
    ticker = ticker.upper()
    print(f"\nEvaluating alpha-probability model for {ticker}")

    df = prepare_probability_frame(
        ticker=ticker,
        peer_return_table=peer_return_table,
        peer_close_table=peer_close_table,
        tickers=tickers,
        horizon_days=horizon_days,
        alpha_threshold=alpha_threshold,
    )

    n_rows = len(df)
    val_end = int(n_rows * 0.9)
    test_df = df.iloc[val_end:].reset_index(drop=True)

    with open(f"models/{ticker.lower()}_prob_feature_scaler.pkl", "rb") as file_obj:
        feature_scaler = pickle.load(file_obj)

    scaled_test_data = feature_scaler.transform(test_df[FEATURE_COLUMNS].values)
    X_test, y_test = create_sequences(scaled_test_data, test_df["alpha_class"].values.astype(int), window_size)

    if len(X_test) == 0:
        raise ValueError(f"Not enough test sequences for {ticker}.")

    model = load_model(
        f"models/cnn_lstm_attn_{ticker.lower()}_prob_v1.h5",
        custom_objects={"AttentionLayer": AttentionLayer},
    )
    probabilities = model.predict(X_test, verbose=0)
    calibrator_path = f"models/{ticker.lower()}_prob_calibrator.pkl"
    calibrated = False
    if os.path.exists(calibrator_path):
        with open(calibrator_path, "rb") as file_obj:
            calibrator_payload = pickle.load(file_obj)
        calibrated_rows = []
        for row in probabilities:
            calibrated_row, row_calibrated = apply_probability_calibrator(row, calibrator_payload)
            calibrated_rows.append(calibrated_row)
            calibrated = calibrated or row_calibrated
        probabilities = np.asarray(calibrated_rows)
    y_pred = np.argmax(probabilities, axis=1)
    signal_mask = apply_confidence_gate(probabilities)
    signal_accuracy = float(accuracy_score(y_test[signal_mask], y_pred[signal_mask])) if np.any(signal_mask) else np.nan

    metrics = {
        "ticker": ticker,
        "calibrated": bool(calibrated),
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, y_pred)),
        "macro_f1": float(f1_score(y_test, y_pred, average="macro", zero_division=0)),
        "macro_precision": float(precision_score(y_test, y_pred, average="macro", zero_division=0)),
        "macro_recall": float(recall_score(y_test, y_pred, average="macro", zero_division=0)),
        "brier_score": brier_score_multiclass(y_test, probabilities, len(CLASS_NAMES)),
        "ece": expected_calibration_error(y_test, probabilities),
        "precision_top_20pct_outperform": precision_at_top_k(y_test, probabilities, class_index=2, top_fraction=0.2),
        "signal_coverage": float(np.mean(signal_mask)),
        "signal_accuracy": signal_accuracy,
    }

    try:
        metrics["roc_auc_ovr"] = float(roc_auc_score(y_test, probabilities, multi_class="ovr", labels=list(range(len(CLASS_NAMES)))))
    except ValueError:
        metrics["roc_auc_ovr"] = np.nan

    print("Metrics:")
    for key, value in metrics.items():
        if key != "ticker":
            print(f"  {key}: {value:.4f}" if isinstance(value, float) and not np.isnan(value) else f"  {key}: {value}")

    print("\nClassification report:")
    print(classification_report(y_test, y_pred, target_names=CLASS_NAMES, zero_division=0))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred, labels=list(range(len(CLASS_NAMES)))))

    os.makedirs("models", exist_ok=True)
    pd.DataFrame([metrics]).to_csv(f"models/{ticker.lower()}_probability_metrics.csv", index=False)

    plot_df = test_df.iloc[window_size:].copy()
    plot_df["p_underperform"] = probabilities[:, 0]
    plot_df["p_neutral"] = probabilities[:, 1]
    plot_df["p_outperform"] = probabilities[:, 2]

    plt.figure(figsize=(14, 7))
    plt.plot(pd.to_datetime(plot_df["time"]), plot_df["p_outperform"], label="P(outperform)", color="#0ecb81")
    plt.plot(pd.to_datetime(plot_df["time"]), plot_df["p_underperform"], label="P(underperform)", color="#f6465d")
    plt.plot(pd.to_datetime(plot_df["time"]), plot_df["p_neutral"], label="P(neutral)", color="#fcd535", alpha=0.75)
    plt.axhline(1 / 3, color="#888888", linestyle=":", linewidth=1)
    plt.title(f"{ticker} - 5-session alpha probability forecast")
    plt.xlabel("Date")
    plt.ylabel("Probability")
    plt.ylim(0, 1)
    plt.grid(True, linestyle=":", alpha=0.5)
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"models/{ticker.lower()}_probability_plot.png")
    plt.close()

    return metrics


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate alpha-probability CNN-LSTM-Attention models.")
    parser.add_argument("--tickers", nargs="*", default=list(DEFAULT_TICKERS), help="Ticker list to evaluate.")
    parser.add_argument("--horizon-days", type=int, default=DEFAULT_HORIZON_DAYS, help="Forward horizon in sessions.")
    parser.add_argument("--alpha-threshold", type=float, default=DEFAULT_ALPHA_THRESHOLD, help="Alpha threshold for non-neutral class.")
    return parser.parse_args()


def main():
    args = parse_args()
    tickers = tuple(ticker.upper() for ticker in args.tickers)
    peer_table = build_peer_return_table(tickers=tickers, horizon_days=args.horizon_days)
    peer_close_table = build_peer_close_table(tickers=tickers)
    all_metrics = []

    for ticker in tickers:
        all_metrics.append(
            evaluate_model(
                ticker=ticker,
                peer_return_table=peer_table,
                peer_close_table=peer_close_table,
                tickers=tickers,
                horizon_days=args.horizon_days,
                alpha_threshold=args.alpha_threshold,
            )
        )

    pd.DataFrame(all_metrics).to_csv("models/probability_model_metrics.csv", index=False)


if __name__ == "__main__":
    main()
