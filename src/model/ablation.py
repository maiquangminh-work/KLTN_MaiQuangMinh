import argparse
import gc
import os
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

try:
    from src.model.architecture import MODEL_BUILDERS
except ImportError:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
    from src.model.architecture import MODEL_BUILDERS


SEED = 42
DEFAULT_TICKERS = ("VCB", "BID", "CTG")
DEFAULT_WINDOW_SIZE = 30
DEFAULT_OUTPUT_DIR = "models/ablation"
TEN_HIEN_THI_MO_HINH = {
    "lstm_only": "LSTM đơn",
    "cnn_only": "CNN đơn",
    "attention_only": "Attention đơn", 
    "cnn_lstm": "CNN-LSTM",
    "lstm_attention": "LSTM-Attention",
    "cnn_attention": "CNN-Attention",
    "cnn_lstm_attention": "CNN-LSTM-Attention",
}
FEATURE_COLUMNS = [
    "open",
    "high",
    "low",
    "close_winsorized",
    "volume",
    "sma_10",
    "sma_20",
    "rsi_14",
]


@dataclass
class ExperimentData:
    ticker: str
    window_size: int
    feature_columns: list[str]
    scaler_X: MinMaxScaler
    scaler_y: MinMaxScaler
    X_train: np.ndarray
    y_train: np.ndarray
    X_val: np.ndarray
    y_val: np.ndarray
    X_test: np.ndarray
    y_test_diff: np.ndarray
    previous_price: np.ndarray
    actual_price: np.ndarray
    plot_dates: np.ndarray
    full_dates: np.ndarray
    full_price: np.ndarray


def set_global_seed(seed=SEED):
    np.random.seed(seed)
    tf.random.set_seed(seed)


def create_sequences(data, target, window_size=DEFAULT_WINDOW_SIZE):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i : i + window_size])
        y.append(target[i + window_size])
    return np.array(X), np.array(y)


def dinh_dang_ten_mo_hinh(model_name):
    return TEN_HIEN_THI_MO_HINH.get(model_name, model_name.upper().replace("_", " "))


def load_experiment_data(ticker, db_path, window_size=DEFAULT_WINDOW_SIZE):
    conn = sqlite3.connect(db_path)
    try:
        df = pd.read_sql_query(
            """
            SELECT time, open, high, low, close, volume
            FROM stock_prices
            WHERE ticker = ?
            ORDER BY time ASC
            """,
            conn,
            params=[ticker.upper()],
        )
    finally:
        conn.close()

    if df.empty:
        raise ValueError(f"Không tìm thấy dữ liệu trong cơ sở dữ liệu cho mã '{ticker}'.")

    df["time"] = pd.to_datetime(df["time"])
    df = df.sort_values("time").reset_index(drop=True)

    lower_bound = df["close"].quantile(0.01)
    upper_bound = df["close"].quantile(0.99)
    df["close_winsorized"] = np.clip(df["close"], lower_bound, upper_bound)
    df["sma_10"] = df["close_winsorized"].rolling(window=10).mean()
    df["sma_20"] = df["close_winsorized"].rolling(window=20).mean()

    delta = df["close_winsorized"].diff()
    gains = delta.where(delta > 0, 0.0).rolling(window=14).mean()
    losses = (-delta.where(delta < 0, 0.0)).rolling(window=14).mean()
    rs = gains / losses
    df["rsi_14"] = 100 - (100 / (1 + rs))
    df["price_diff"] = df["close_winsorized"].diff()
    df = df.dropna().reset_index(drop=True)

    if len(df) < window_size * 3:
        raise ValueError(
            f"Mã '{ticker}' không đủ số dòng dữ liệu sau xử lý cho window_size={window_size}."
        )

    feature_values = df[FEATURE_COLUMNS].values
    target_values = df[["price_diff"]].values
    close_values = df["close_winsorized"].values
    date_values = df["time"].values

    n_rows = len(df)
    train_end = int(n_rows * 0.8)
    val_end = int(n_rows * 0.9)

    train_data = feature_values[:train_end]
    val_data = feature_values[train_end:val_end]
    test_data = feature_values[val_end:]

    train_target = target_values[:train_end]
    val_target = target_values[train_end:val_end]
    test_target = target_values[val_end:]

    feature_scaler = MinMaxScaler(feature_range=(0, 1))
    target_scaler = MinMaxScaler(feature_range=(-1, 1))

    scaled_train_data = feature_scaler.fit_transform(train_data)
    scaled_val_data = feature_scaler.transform(val_data)
    scaled_test_data = feature_scaler.transform(test_data)

    scaled_train_target = target_scaler.fit_transform(train_target)
    scaled_val_target = target_scaler.transform(val_target)
    scaled_test_target = target_scaler.transform(test_target)

    X_train, y_train = create_sequences(scaled_train_data, scaled_train_target, window_size)
    X_val, y_val = create_sequences(scaled_val_data, scaled_val_target, window_size)
    X_test, _ = create_sequences(scaled_test_data, scaled_test_target, window_size)

    y_test_diff = test_target[window_size:].reshape(-1)
    previous_price = close_values[val_end:][window_size - 1 : -1].reshape(-1)
    actual_price = close_values[val_end:][window_size:].reshape(-1)
    plot_dates = pd.to_datetime(date_values[val_end + window_size :]).to_numpy()

    expected_length = len(X_test)
    series_lengths = [len(y_test_diff), len(previous_price), len(actual_price), len(plot_dates)]
    if expected_length == 0 or any(length != expected_length for length in series_lengths):
        raise ValueError(
            f"Không thể căn chỉnh chuỗi dữ liệu cho mã '{ticker}'. "
            f"Kích thước: X_test={expected_length}, chuỗi={series_lengths}"
        )

    return ExperimentData(
        ticker=ticker.upper(),
        window_size=window_size,
        feature_columns=list(FEATURE_COLUMNS),
        scaler_X=feature_scaler,
        scaler_y=target_scaler,
        X_train=X_train,
        y_train=y_train,
        X_val=X_val,
        y_val=y_val,
        X_test=X_test,
        y_test_diff=y_test_diff.astype(np.float32),
        previous_price=previous_price.astype(np.float32),
        actual_price=actual_price.astype(np.float32),
        plot_dates=plot_dates,
        full_dates=pd.to_datetime(date_values).to_numpy(),
        full_price=close_values.astype(np.float32),
    )


def evaluate_predictions(y_true_price, y_pred_price, y_true_diff, y_pred_diff):
    y_true_price = np.asarray(y_true_price).reshape(-1)
    y_pred_price = np.asarray(y_pred_price).reshape(-1)
    y_true_diff = np.asarray(y_true_diff).reshape(-1)
    y_pred_diff = np.asarray(y_pred_diff).reshape(-1)

    non_zero_mask = y_true_price != 0
    if np.any(non_zero_mask):
        mape = np.mean(
            np.abs((y_true_price[non_zero_mask] - y_pred_price[non_zero_mask]) / y_true_price[non_zero_mask])
        ) * 100
    else:
        mape = np.nan

    directional_accuracy = np.mean(np.sign(y_true_diff) == np.sign(y_pred_diff)) * 100

    return {
        "RMSE": float(np.sqrt(mean_squared_error(y_true_price, y_pred_price))),
        "MAE": float(mean_absolute_error(y_true_price, y_pred_price)),
        "MAPE": float(mape),
        "R2": float(r2_score(y_true_price, y_pred_price)),
        "DA": float(directional_accuracy),
    }


def _plot_ticker_results(ticker, metrics_df, predictions_by_model, plot_dates, output_path):
    fig, axes = plt.subplots(1, 2, figsize=(20, 8))
    fig.suptitle(f"So sánh đối chứng mô hình cho {ticker}", fontsize=18)

    metric_labels = [dinh_dang_ten_mo_hinh(name) for name in metrics_df["model_name"]]
    rmse_values = metrics_df["RMSE"].tolist()
    best_rmse = min(rmse_values)
    bar_colors = ["#0ecb81" if value == best_rmse else "#4c78a8" for value in rmse_values]

    axes[0].barh(metric_labels, rmse_values, color=bar_colors, edgecolor="black")
    axes[0].set_title("So sánh RMSE")
    axes[0].invert_yaxis()
    axes[0].set_xlabel("RMSE")

    sample_size = min(100, len(predictions_by_model["actual"]))
    sample_slice = slice(-sample_size, None)
    sample_dates = plot_dates[sample_slice]

    axes[1].plot(
        sample_dates,
        predictions_by_model["actual"][sample_slice],
        color="black",
        linewidth=2.5,
        label="Giá thực tế",
    )
    for model_name, values in predictions_by_model.items():
        if model_name == "actual":
            continue
        axes[1].plot(
            sample_dates,
            values[sample_slice],
            linewidth=1.6,
            alpha=0.85,
            label=dinh_dang_ten_mo_hinh(model_name),
        )

    axes[1].set_title(f"So sánh giá thực tế và giá dự báo ({sample_size} điểm kiểm tra gần nhất)")
    axes[1].set_xlabel("Ngày giao dịch")
    axes[1].set_ylabel("Giá cổ phiếu")
    axes[1].grid(True, linestyle="--", alpha=0.4)
    axes[1].legend(fontsize=8, ncol=2)

    fig.autofmt_xdate()
    fig.tight_layout(rect=[0, 0.03, 1, 0.95])
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def _plot_original_price(ticker, full_dates, full_price, output_path):
    fig, ax = plt.subplots(figsize=(14, 6))
    ax.plot(full_dates, full_price, color="#1f77b4", linewidth=1.8)
    ax.set_title(f"Biểu đồ giá cổ phiếu gốc của {ticker}")
    ax.set_xlabel("Ngày giao dịch")
    ax.set_ylabel("Giá đóng cửa")
    ax.grid(True, linestyle="--", alpha=0.35)
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def _plot_model_forecast(ticker, model_name, plot_dates, actual_price, predicted_price, output_path):
    fig, ax = plt.subplots(figsize=(14, 6))
    ax.plot(plot_dates, actual_price, color="black", linewidth=2.0, label="Giá gốc")
    ax.plot(plot_dates, predicted_price, color="#d62728", linewidth=1.8, linestyle="--", label="Giá dự báo")
    ax.set_title(f"{ticker} - {dinh_dang_ten_mo_hinh(model_name)}: giá dự báo so với giá gốc")
    ax.set_xlabel("Ngày giao dịch")
    ax.set_ylabel("Giá cổ phiếu")
    ax.grid(True, linestyle="--", alpha=0.35)
    ax.legend()
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def run_ablation(
    tickers=DEFAULT_TICKERS,
    db_path="data/database/stock_data.db",
    output_dir=DEFAULT_OUTPUT_DIR,
    epochs=150,
    batch_size=16,
):
    set_global_seed()

    output_root = Path(output_dir)
    output_root.mkdir(parents=True, exist_ok=True)

    results = []

    for ticker in tickers:
        print(f"\n=== Chạy đối chứng mô hình cho {ticker.upper()} ===")
        data = load_experiment_data(ticker=ticker, db_path=db_path, window_size=DEFAULT_WINDOW_SIZE)
        ticker_dir = output_root / data.ticker
        ticker_dir.mkdir(parents=True, exist_ok=True)

        _plot_original_price(
            ticker=data.ticker,
            full_dates=data.full_dates,
            full_price=data.full_price,
            output_path=ticker_dir / f"{data.ticker}_original_price_chart.png",
        )

        ticker_predictions = {"actual": data.actual_price.copy()}
        ticker_results = []

        for model_name, builder in MODEL_BUILDERS.items():
            tf.keras.backend.clear_session()
            gc.collect()
            set_global_seed()

            print(f"Huấn luyện {dinh_dang_ten_mo_hinh(model_name)} cho {data.ticker}...")
            model = builder((data.window_size, len(data.feature_columns)))

            callbacks = [
                EarlyStopping(monitor="val_loss", patience=20, restore_best_weights=True, verbose=0),
                ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=10, min_lr=0.00001, verbose=0),
            ]

            model.fit(
                data.X_train,
                data.y_train,
                validation_data=(data.X_val, data.y_val),
                epochs=epochs,
                batch_size=batch_size,
                callbacks=callbacks,
                verbose=0,
            )

            model_path = ticker_dir / f"{model_name}.h5"
            model.save(model_path, include_optimizer=True)

            y_pred_scaled = model.predict(data.X_test, verbose=0)
            y_pred_diff = data.scaler_y.inverse_transform(y_pred_scaled).reshape(-1)
            y_pred_price = data.previous_price + y_pred_diff

            metrics = evaluate_predictions(
                y_true_price=data.actual_price,
                y_pred_price=y_pred_price,
                y_true_diff=data.y_test_diff,
                y_pred_diff=y_pred_diff,
            )

            ticker_predictions[model_name] = y_pred_price

            _plot_model_forecast(
                ticker=data.ticker,
                model_name=model_name,
                plot_dates=data.plot_dates,
                actual_price=data.actual_price,
                predicted_price=y_pred_price,
                output_path=ticker_dir / f"{model_name}_forecast_vs_actual.png",
            )

            record = {
                "ticker": data.ticker,
                "model_name": model_name,
                **metrics,
            }
            ticker_results.append(record)
            results.append(record)

        ticker_metrics_df = pd.DataFrame(ticker_results)
        ticker_metrics_df = ticker_metrics_df[["ticker", "model_name", "RMSE", "MAE", "MAPE", "R2", "DA"]]
        ticker_metrics_df.to_csv(ticker_dir / f"{data.ticker}_ablation_results.csv", index=False)

        _plot_ticker_results(
            ticker=data.ticker,
            metrics_df=ticker_metrics_df,
            predictions_by_model=ticker_predictions,
            plot_dates=data.plot_dates,
            output_path=ticker_dir / f"{data.ticker}_ablation_chart.png",
        )

    results_df = pd.DataFrame(results)
    if results_df.empty:
        raise RuntimeError("Không tạo được kết quả đối chứng nào.")

    results_df = results_df[["ticker", "model_name", "RMSE", "MAE", "MAPE", "R2", "DA"]]
    results_df.to_csv(output_root / "ablation_results.csv", index=False)
    return results_df


def parse_args():
    parser = argparse.ArgumentParser(description="Chạy thực nghiệm đối chứng các mô hình dự báo giá cổ phiếu ngân hàng.")
    parser.add_argument(
        "--tickers",
        nargs="+",
        default=list(DEFAULT_TICKERS),
        help="Danh sách mã cổ phiếu cần đánh giá. Mặc định: VCB BID CTG",
    )
    parser.add_argument(
        "--db-path",
        default="data/database/stock_data.db",
        help="Đường dẫn đến cơ sở dữ liệu SQLite chứa bảng stock_prices.",
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help="Thư mục lưu mô hình đã huấn luyện, biểu đồ và tệp CSV đầu ra.",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=150,
        help="Số epoch huấn luyện tối đa cho mỗi mô hình.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Kích thước batch dùng trong quá trình huấn luyện.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    results_df = run_ablation(
        tickers=[ticker.upper() for ticker in args.tickers],
        db_path=args.db_path,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
    )
    print("\nĐã hoàn tất quá trình đối chứng mô hình.")
    print(results_df.to_string(index=False))


if __name__ == "__main__":
    main()
