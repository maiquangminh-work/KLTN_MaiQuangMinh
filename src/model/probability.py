from pathlib import Path

import numpy as np
import pandas as pd


DEFAULT_TICKERS = ("VCB", "BID", "CTG", "MBB", "TCB", "VPB", "ACB", "HDB", "SHB", "VIB")
DEFAULT_WINDOW_SIZE = 30
DEFAULT_HORIZON_DAYS = 5
DEFAULT_ALPHA_THRESHOLD = 0.01
MIN_DYNAMIC_ALPHA_THRESHOLD = 0.006
MAX_DYNAMIC_ALPHA_THRESHOLD = 0.025
DATA_DIR = Path("data/processed")

BASE_FEATURE_COLUMNS = [
    "open",
    "high",
    "low",
    "close_winsorized",
    "volume",
    "sma_10",
    "sma_20",
    "rsi_14",
]
ENGINEERED_FEATURE_COLUMNS = [
    "return_1d",
    "return_3d",
    "return_5d",
    "return_10d",
    "volatility_10d",
    "volatility_20d",
    "volume_zscore_20",
    "price_vs_sma10",
    "price_vs_sma20",
    "sma10_vs_sma20",
    "rsi_delta_5",
    "drawdown_20d",
    "benchmark_return_1d",
    "benchmark_return_3d",
    "benchmark_return_5d",
    "benchmark_return_10d",
    "alpha_1d",
    "alpha_3d",
    "alpha_5d_past",
    "alpha_10d",
    "relative_volatility_20d",
]
FEATURE_COLUMNS = [*BASE_FEATURE_COLUMNS, *ENGINEERED_FEATURE_COLUMNS]

CLASS_NAMES = ["underperform", "neutral", "outperform"]
CLASS_LABELS = {
    "underperform": "Underperform",
    "neutral": "Neutral",
    "outperform": "Outperform",
}
CLASS_TO_INDEX = {name: idx for idx, name in enumerate(CLASS_NAMES)}
INDEX_TO_CLASS = {idx: name for idx, name in enumerate(CLASS_NAMES)}


def load_processed_frame(ticker, data_dir=DATA_DIR):
    path = Path(data_dir) / f"{ticker.upper()}_features.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing processed feature file: {path}")

    df = pd.read_csv(path)
    if "close_winsorized" not in df.columns and "close" in df.columns:
        df["close_winsorized"] = df["close"]
    df["time"] = pd.to_datetime(df["time"]).dt.strftime("%Y-%m-%d")
    return df.sort_values("time").reset_index(drop=True)


def add_forward_return(df, horizon_days=DEFAULT_HORIZON_DAYS):
    result = df.copy()
    close = result["close_winsorized"].astype(float)
    result[f"return_{horizon_days}d"] = (close.shift(-horizon_days) - close) / close
    return result


def add_engineered_features(df):
    result = df.copy()
    close = result["close_winsorized"].astype(float)
    volume = result["volume"].astype(float)
    daily_return = close.pct_change()

    for horizon in (1, 3, 5, 10):
        result[f"return_{horizon}d"] = close.pct_change(horizon)

    result["volatility_10d"] = daily_return.rolling(10).std()
    result["volatility_20d"] = daily_return.rolling(20).std()

    volume_mean = volume.rolling(20).mean()
    volume_std = volume.rolling(20).std().replace(0, np.nan)
    result["volume_zscore_20"] = (volume - volume_mean) / volume_std

    result["price_vs_sma10"] = close / result["sma_10"].astype(float) - 1
    result["price_vs_sma20"] = close / result["sma_20"].astype(float) - 1
    result["sma10_vs_sma20"] = result["sma_10"].astype(float) / result["sma_20"].astype(float) - 1
    result["rsi_delta_5"] = result["rsi_14"].astype(float).diff(5)

    rolling_high = close.rolling(20).max()
    result["drawdown_20d"] = close / rolling_high - 1
    return result


def build_peer_close_table(tickers=DEFAULT_TICKERS, data_dir=DATA_DIR):
    frames = []
    for ticker in tickers:
        df = load_processed_frame(ticker, data_dir)
        frames.append(df[["time", "close_winsorized"]].rename(columns={"close_winsorized": ticker.upper()}))

    if not frames:
        raise ValueError("No processed ticker data available for peer feature table.")

    close_table = frames[0]
    for frame in frames[1:]:
        close_table = close_table.merge(frame, on="time", how="outer")
    return close_table.sort_values("time").reset_index(drop=True)


def add_peer_relative_features(df, ticker, tickers=DEFAULT_TICKERS, data_dir=DATA_DIR, peer_close_table=None):
    ticker = ticker.upper()
    result = df.copy()

    if peer_close_table is None:
        peer_close_table = build_peer_close_table(tickers, data_dir)

    peer_columns = [col for col in peer_close_table.columns if col != "time" and col != ticker]
    if not peer_columns:
        peer_columns = [col for col in peer_close_table.columns if col != "time"]

    benchmark = peer_close_table[["time"]].copy()
    for horizon in (1, 3, 5, 10):
        returns = peer_close_table[peer_columns].pct_change(horizon, fill_method=None)
        benchmark[f"benchmark_return_{horizon}d"] = returns.mean(axis=1, skipna=True)

    peer_daily_returns = peer_close_table[peer_columns].pct_change(fill_method=None)
    benchmark["benchmark_volatility_20d"] = peer_daily_returns.mean(axis=1, skipna=True).rolling(20).std()

    result = result.merge(benchmark, on="time", how="left")
    result["alpha_1d"] = result["return_1d"] - result["benchmark_return_1d"]
    result["alpha_3d"] = result["return_3d"] - result["benchmark_return_3d"]
    result["alpha_5d_past"] = result["return_5d"] - result["benchmark_return_5d"]
    result["alpha_10d"] = result["return_10d"] - result["benchmark_return_10d"]
    result["relative_volatility_20d"] = result["volatility_20d"] / result["benchmark_volatility_20d"].replace(0, np.nan)
    return result


def build_peer_return_table(
    tickers=DEFAULT_TICKERS,
    data_dir=DATA_DIR,
    horizon_days=DEFAULT_HORIZON_DAYS,
):
    frames = []
    return_col = f"return_{horizon_days}d"

    for ticker in tickers:
        df = add_forward_return(load_processed_frame(ticker, data_dir), horizon_days)
        frames.append(
            df[["time", return_col]]
            .rename(columns={return_col: ticker.upper()})
            .dropna()
        )

    if not frames:
        raise ValueError("No processed ticker data available for peer benchmark.")

    peer_table = frames[0]
    for frame in frames[1:]:
        peer_table = peer_table.merge(frame, on="time", how="outer")
    return peer_table.sort_values("time").reset_index(drop=True)


def prepare_probability_frame(
    ticker,
    peer_return_table=None,
    peer_close_table=None,
    tickers=DEFAULT_TICKERS,
    data_dir=DATA_DIR,
    horizon_days=DEFAULT_HORIZON_DAYS,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    use_dynamic_threshold=True,
):
    ticker = ticker.upper()
    return_col = f"return_{horizon_days}d"

    if peer_return_table is None:
        peer_return_table = build_peer_return_table(tickers, data_dir, horizon_days)

    df = load_processed_frame(ticker, data_dir)
    df = add_engineered_features(df)
    df = add_peer_relative_features(df, ticker, tickers, data_dir, peer_close_table)
    df = add_forward_return(df, horizon_days)

    peer_columns = [col for col in peer_return_table.columns if col != "time" and col != ticker]
    if not peer_columns:
        peer_columns = [col for col in peer_return_table.columns if col != "time"]
    benchmark = peer_return_table[["time"]].copy()
    forward_benchmark_col = f"benchmark_forward_return_{horizon_days}d"
    benchmark[forward_benchmark_col] = peer_return_table[peer_columns].mean(axis=1, skipna=True)

    df = df.merge(benchmark, on="time", how="left")
    df[f"alpha_{horizon_days}d"] = df[return_col] - df[forward_benchmark_col]

    alpha_col = f"alpha_{horizon_days}d"
    dynamic_threshold = (
        df["alpha_1d"].rolling(20).std().fillna(df["alpha_1d"].expanding().std())
        * np.sqrt(horizon_days)
        * 0.5
    )
    dynamic_threshold = dynamic_threshold.clip(
        lower=MIN_DYNAMIC_ALPHA_THRESHOLD,
        upper=MAX_DYNAMIC_ALPHA_THRESHOLD,
    )
    df["alpha_threshold_used"] = np.where(use_dynamic_threshold, dynamic_threshold, alpha_threshold)
    df["alpha_threshold_used"] = df["alpha_threshold_used"].fillna(alpha_threshold)

    df["alpha_class"] = np.select(
        [
            df[alpha_col] < -df["alpha_threshold_used"],
            df[alpha_col] > df["alpha_threshold_used"],
        ],
        [
            CLASS_TO_INDEX["underperform"],
            CLASS_TO_INDEX["outperform"],
        ],
        default=CLASS_TO_INDEX["neutral"],
    ).astype(int)

    required_columns = ["time", return_col, forward_benchmark_col, alpha_col, "alpha_threshold_used", "alpha_class", *FEATURE_COLUMNS]
    return df.dropna(subset=required_columns).reset_index(drop=True)


def prepare_live_probability_frame(
    ticker,
    live_df,
    tickers=DEFAULT_TICKERS,
    data_dir=DATA_DIR,
    peer_close_table=None,
):
    df = live_df.copy()
    df["time"] = pd.to_datetime(df["time"]).dt.strftime("%Y-%m-%d")
    df = df.sort_values("time").reset_index(drop=True)
    if "close_winsorized" not in df.columns and "close" in df.columns:
        df["close_winsorized"] = df["close"]

    df = add_engineered_features(df)
    df = add_peer_relative_features(df, ticker, tickers, data_dir, peer_close_table)
    return df.dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)


def create_sequences(data, target, window_size=DEFAULT_WINDOW_SIZE):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i : i + window_size])
        y.append(target[i + window_size])
    return np.asarray(X), np.asarray(y)


def make_probability_config(
    ticker,
    tickers=DEFAULT_TICKERS,
    horizon_days=DEFAULT_HORIZON_DAYS,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    window_size=DEFAULT_WINDOW_SIZE,
    use_dynamic_threshold=True,
):
    return {
        "prediction_mode": "alpha_probability",
        "ticker": ticker.upper(),
        "horizon_days": int(horizon_days),
        "alpha_threshold": float(alpha_threshold),
        "use_dynamic_threshold": bool(use_dynamic_threshold),
        "min_dynamic_alpha_threshold": float(MIN_DYNAMIC_ALPHA_THRESHOLD),
        "max_dynamic_alpha_threshold": float(MAX_DYNAMIC_ALPHA_THRESHOLD),
        "calibration_method": "temperature_scaling_on_validation_softmax",
        "confidence_gate": {
            "min_action_probability": 0.45,
            "min_probability_edge": 0.12,
        },
        "window_size": int(window_size),
        "benchmark": "banking_peer_group_ex_ticker",
        "feature_columns": list(FEATURE_COLUMNS),
        "class_names": list(CLASS_NAMES),
        "class_labels": dict(CLASS_LABELS),
        "peer_tickers": [item.upper() for item in tickers],
    }


def apply_probability_calibrator(probabilities, calibrator_payload):
    probabilities = np.asarray(probabilities, dtype=float).reshape(-1)
    if not calibrator_payload:
        return probabilities, False

    method = calibrator_payload.get("method")
    if method == "temperature_scaling":
        temperature = float(calibrator_payload.get("temperature", 1.0) or 1.0)
        logits = np.log(np.clip(probabilities, 1e-8, 1.0))
        calibrated = softmax(logits / max(temperature, 1e-6))
        return calibrated, True

    calibrator = calibrator_payload.get("model")
    classes = calibrator_payload.get("classes")
    if calibrator is None or classes is None:
        return probabilities, False

    calibrated_partial = calibrator.predict_proba([probabilities])[0]
    calibrated = np.zeros(len(CLASS_NAMES), dtype=float)
    for class_index, class_probability in zip(classes, calibrated_partial):
        calibrated[int(class_index)] = float(class_probability)

    if calibrated.sum() <= 0:
        return probabilities, False
    calibrated = calibrated / calibrated.sum()
    return calibrated, True


def softmax(logits):
    logits = np.asarray(logits, dtype=float)
    shifted = logits - np.max(logits, axis=-1, keepdims=True)
    exp_values = np.exp(shifted)
    return exp_values / np.sum(exp_values, axis=-1, keepdims=True)


def fit_temperature_scaler(probabilities, y_true):
    probabilities = np.asarray(probabilities, dtype=float)
    y_true = np.asarray(y_true).astype(int)
    logits = np.log(np.clip(probabilities, 1e-8, 1.0))
    temperatures = np.concatenate([
        np.linspace(0.45, 0.95, 11),
        np.linspace(1.0, 3.0, 21),
    ])

    best_temperature = 1.0
    best_nll = np.inf
    for temperature in temperatures:
        calibrated = softmax(logits / temperature)
        nll = -np.mean(np.log(np.clip(calibrated[np.arange(len(y_true)), y_true], 1e-8, 1.0)))
        if nll < best_nll:
            best_nll = nll
            best_temperature = float(temperature)

    return {
        "method": "temperature_scaling",
        "temperature": best_temperature,
        "validation_nll": float(best_nll),
    }


def probability_payload(probabilities, config, calibrated=False):
    probabilities = np.asarray(probabilities, dtype=float).reshape(-1)
    if probabilities.size != len(CLASS_NAMES):
        raise ValueError(f"Expected {len(CLASS_NAMES)} probabilities, got {probabilities.size}.")

    prob_map = {name: float(probabilities[idx]) for idx, name in enumerate(CLASS_NAMES)}
    predicted_index = int(np.argmax(probabilities))
    predicted_class = INDEX_TO_CLASS[predicted_index]
    threshold = float(config.get("alpha_threshold", DEFAULT_ALPHA_THRESHOLD))

    return {
        "mode": config.get("prediction_mode", "alpha_probability"),
        "calibrated": bool(calibrated),
        "calibration_method": config.get("calibration_method"),
        "confidence_gate": config.get("confidence_gate", {}),
        "horizon_days": int(config.get("horizon_days", DEFAULT_HORIZON_DAYS)),
        "benchmark": config.get("benchmark", "banking_peer_group_ex_ticker"),
        "alpha_threshold": threshold,
        "probabilities": prob_map,
        "predicted_class": predicted_class,
        "predicted_label": CLASS_LABELS[predicted_class],
        "outperform_probability": prob_map["outperform"],
        "neutral_probability": prob_map["neutral"],
        "underperform_probability": prob_map["underperform"],
        "probability_edge": prob_map["outperform"] - prob_map["underperform"],
        "expected_alpha_proxy": (prob_map["outperform"] - prob_map["underperform"]) * threshold,
    }
