import argparse
import os
import pickle
import sys

import numpy as np
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from src.model.architecture import build_cnn_lstm_attention_classifier_model
from src.model.probability import (
    CLASS_NAMES,
    DEFAULT_ALPHA_THRESHOLD,
    DEFAULT_HORIZON_DAYS,
    DEFAULT_TICKERS,
    DEFAULT_WINDOW_SIZE,
    FEATURE_COLUMNS,
    build_peer_close_table,
    build_peer_return_table,
    create_sequences,
    fit_temperature_scaler,
    make_probability_config,
    prepare_probability_frame,
)


SEED = 42


def set_global_seed(seed=SEED):
    np.random.seed(seed)
    tf.random.set_seed(seed)


def compute_class_weight_dict(y_train):
    counts = np.bincount(y_train.astype(int), minlength=len(CLASS_NAMES))
    total = counts.sum()
    weights = {}
    for class_index, count in enumerate(counts):
        weights[class_index] = float(total / (len(CLASS_NAMES) * count)) if count else 1.0
    return weights


def train_model(
    ticker="VCB",
    peer_return_table=None,
    peer_close_table=None,
    tickers=DEFAULT_TICKERS,
    horizon_days=DEFAULT_HORIZON_DAYS,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    window_size=DEFAULT_WINDOW_SIZE,
    epochs=80,
    batch_size=32,
):
    ticker = ticker.upper()
    print(f"\nTraining alpha-probability CNN-LSTM-Attention for {ticker}")
    print(f"Target: {horizon_days}-session alpha vs banking peer group; threshold={alpha_threshold:.2%}")

    df = prepare_probability_frame(
        ticker=ticker,
        peer_return_table=peer_return_table,
        peer_close_table=peer_close_table,
        tickers=tickers,
        horizon_days=horizon_days,
        alpha_threshold=alpha_threshold,
    )

    feature_values = df[FEATURE_COLUMNS].values
    target_values = df["alpha_class"].values.astype(int)

    n_rows = len(df)
    train_end = int(n_rows * 0.8)
    val_end = int(n_rows * 0.9)

    train_data = feature_values[:train_end]
    val_data = feature_values[train_end:val_end]
    train_target = target_values[:train_end]
    val_target = target_values[train_end:val_end]

    feature_scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_train_data = feature_scaler.fit_transform(train_data)
    scaled_val_data = feature_scaler.transform(val_data)

    X_train, y_train = create_sequences(scaled_train_data, train_target, window_size)
    X_val, y_val = create_sequences(scaled_val_data, val_target, window_size)

    if len(X_train) == 0 or len(X_val) == 0:
        raise ValueError(f"Not enough sequence data for {ticker} with window_size={window_size}.")

    os.makedirs("models", exist_ok=True)
    config = make_probability_config(
        ticker=ticker,
        tickers=tickers,
        horizon_days=horizon_days,
        alpha_threshold=alpha_threshold,
        window_size=window_size,
        use_dynamic_threshold=True,
    )

    with open(f"models/{ticker.lower()}_prob_feature_scaler.pkl", "wb") as file_obj:
        pickle.dump(feature_scaler, file_obj)
    with open(f"models/{ticker.lower()}_prob_config.pkl", "wb") as file_obj:
        pickle.dump(config, file_obj)

    model = build_cnn_lstm_attention_classifier_model((window_size, len(FEATURE_COLUMNS)), num_classes=len(CLASS_NAMES))
    checkpoint_path = f"models/cnn_lstm_attn_{ticker.lower()}_prob_v1.h5"

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=14, restore_best_weights=True, verbose=1),
        ModelCheckpoint(checkpoint_path, monitor="val_loss", save_best_only=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=7, min_lr=0.00001, verbose=1),
    ]

    class_counts = np.bincount(target_values, minlength=len(CLASS_NAMES)).tolist()
    print("Class distribution:", dict(zip(CLASS_NAMES, class_counts)))

    model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        class_weight=compute_class_weight_dict(y_train),
        verbose=1,
    )

    val_probabilities = model.predict(X_val, verbose=0)
    calibrator_path = f"models/{ticker.lower()}_prob_calibrator.pkl"
    calibrator_payload = fit_temperature_scaler(val_probabilities, y_val)
    with open(calibrator_path, "wb") as file_obj:
        pickle.dump(calibrator_payload, file_obj)
    print(
        f"Saved temperature calibrator: {calibrator_path} "
        f"(T={calibrator_payload['temperature']:.2f}, val_nll={calibrator_payload['validation_nll']:.4f})"
    )

    return checkpoint_path


def parse_args():
    parser = argparse.ArgumentParser(description="Train alpha-probability CNN-LSTM-Attention models.")
    parser.add_argument("--tickers", nargs="*", default=list(DEFAULT_TICKERS), help="Ticker list to train.")
    parser.add_argument("--epochs", type=int, default=80, help="Maximum training epochs.")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size.")
    parser.add_argument("--horizon-days", type=int, default=DEFAULT_HORIZON_DAYS, help="Forward horizon in sessions.")
    parser.add_argument("--alpha-threshold", type=float, default=DEFAULT_ALPHA_THRESHOLD, help="Alpha threshold for non-neutral class.")
    return parser.parse_args()


def main():
    args = parse_args()
    set_global_seed(SEED)
    tickers = tuple(ticker.upper() for ticker in args.tickers)
    peer_table = build_peer_return_table(tickers=tickers, horizon_days=args.horizon_days)
    peer_close_table = build_peer_close_table(tickers=tickers)

    for ticker in tickers:
        train_model(
            ticker=ticker,
            peer_return_table=peer_table,
            peer_close_table=peer_close_table,
            tickers=tickers,
            horizon_days=args.horizon_days,
            alpha_threshold=args.alpha_threshold,
            epochs=args.epochs,
            batch_size=args.batch_size,
        )


if __name__ == "__main__":
    main()
