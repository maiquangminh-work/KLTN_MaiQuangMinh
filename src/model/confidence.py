"""
Confidence gate + temperature scaling cho model regression log-return.

Ý tưởng cốt lõi:
  - Magnitude của predicted_log_return là signal về độ tự tin của model:
    |pred| nhỏ → model không chắc về direction → có thể là noise
    |pred| lớn → model tự tin → tín hiệu giao dịch đáng tin cậy
  - Gate: chỉ trade khi |pred| > threshold → filter ra các tín hiệu noise
  - Temperature scaling: ép magnitude predicted match với actual để confidence
    score có ý nghĩa vật lý (không underestimate/overestimate).

Metric:
  - Coverage: % samples vượt threshold (% lần model đưa ra tín hiệu)
  - Filtered DA: DA chỉ tính trên subset filtered (tín hiệu mạnh)
  - Gated MAE/MAPE: sai số trên subset filtered

Dùng như thế nào:
    from src.model.confidence import (
        fit_temperature,
        compute_confidence_scores,
        find_optimal_threshold,
        evaluate_gate,
    )
    T = fit_temperature(val_pred_log, val_true_log)
    scores = compute_confidence_scores(test_pred_log * T, reference_std=train_std)
    threshold = find_optimal_threshold(val_pred_log, val_true_log)
    report = evaluate_gate(test_pred_log, test_true_log, test_actual_diff, threshold)
"""
from __future__ import annotations

import numpy as np


def fit_temperature(pred_log_return: np.ndarray,
                    true_log_return: np.ndarray) -> float:
    """Fit temperature T sao cho pred * T có std khớp với true std.

    Mục tiêu: nếu model dự báo flat (std_pred nhỏ), temperature scaling sẽ
    "khuyếch đại" magnitude để match thực tế. Nếu model overshoot, T<1
    để giảm magnitude.

    Args:
        pred_log_return: prediction trên validation set (raw, non-scaled)
        true_log_return: ground truth trên validation set

    Returns:
        Temperature T (float > 0). T=1.0 nếu không có data hợp lệ.
    """
    pred = np.asarray(pred_log_return, dtype=float).flatten()
    true = np.asarray(true_log_return, dtype=float).flatten()
    if pred.size == 0 or true.size == 0:
        return 1.0

    std_pred = float(np.std(pred))
    std_true = float(np.std(true))
    if std_pred < 1e-12:
        return 1.0
    T = std_true / std_pred
    # Giới hạn T trong [0.5, 5.0] để tránh overshoot quá mức
    return float(np.clip(T, 0.5, 5.0))


def compute_confidence_scores(pred_log_return: np.ndarray,
                              reference_std: float | None = None) -> np.ndarray:
    """Tính confidence score = |pred| / reference_std.

    Args:
        pred_log_return: predicted log-return (sau khi đã scale temperature)
        reference_std: std tham chiếu (thường là std của log_return training).
                       Nếu None, dùng std của chính pred_log_return.

    Returns:
        Confidence scores ∈ [0, ∞). Lớn hơn → đáng tin cậy hơn.
    """
    pred = np.asarray(pred_log_return, dtype=float).flatten()
    if reference_std is None or reference_std < 1e-12:
        reference_std = float(np.std(pred) + 1e-12)
    return np.abs(pred) / float(reference_std)


def find_optimal_threshold(pred_log_return: np.ndarray,
                           true_log_return: np.ndarray,
                           coverage_targets=(0.5, 0.3, 0.2, 0.1),
                           reference_std: float | None = None) -> dict:
    """Tìm threshold cho nhiều coverage targets, report DA ở mỗi mức.

    Strategy: với mỗi coverage target (% samples giữ lại), tính threshold
    sao cho đúng % samples có confidence >= threshold. Đo DA trên subset đó.

    Args:
        pred_log_return: val/test predictions
        true_log_return: val/test ground truth
        coverage_targets: các mức coverage muốn test (0.5 = giữ 50% samples...)
        reference_std: std tham chiếu cho confidence (default std(train_pred))

    Returns:
        dict {coverage_target: {"threshold": ..., "da": ..., "n": ..., "coverage_actual": ...}}
    """
    pred = np.asarray(pred_log_return, dtype=float).flatten()
    true = np.asarray(true_log_return, dtype=float).flatten()
    confidence = compute_confidence_scores(pred, reference_std)

    results = {}
    # Baseline: full DA (coverage=1.0)
    full_da = float(np.mean(np.sign(pred) == np.sign(true)) * 100) if pred.size > 0 else 0.0
    results['baseline_full'] = {
        'threshold': 0.0,
        'da': full_da,
        'n': int(pred.size),
        'coverage_actual': 1.0,
    }

    for target in coverage_targets:
        if confidence.size == 0:
            continue
        # Quantile: giữ top (target * 100)% samples theo confidence
        quantile = 1.0 - float(target)
        threshold = float(np.quantile(confidence, quantile))
        mask = confidence >= threshold
        n = int(mask.sum())
        if n == 0:
            continue
        da_filtered = float(np.mean(np.sign(pred[mask]) == np.sign(true[mask])) * 100)
        results[f'coverage_{int(target*100)}'] = {
            'threshold': threshold,
            'da': da_filtered,
            'n': n,
            'coverage_actual': float(n / confidence.size),
        }
    return results


def evaluate_gate(pred_log_return: np.ndarray,
                  true_log_return: np.ndarray,
                  threshold: float,
                  reference_std: float | None = None) -> dict:
    """Đánh giá gate tại một threshold cụ thể.

    Returns:
        dict với keys: "n_total", "n_trades", "coverage", "da_filtered",
        "avg_pred_magnitude_on_trades", "avg_true_magnitude_on_trades"
    """
    pred = np.asarray(pred_log_return, dtype=float).flatten()
    true = np.asarray(true_log_return, dtype=float).flatten()
    confidence = compute_confidence_scores(pred, reference_std)
    mask = confidence >= threshold
    n = int(mask.sum())

    result = {
        'n_total': int(pred.size),
        'n_trades': n,
        'coverage': float(n / max(pred.size, 1)),
        'threshold': float(threshold),
        'reference_std': float(reference_std) if reference_std is not None else float(np.std(pred) + 1e-12),
    }
    if n == 0:
        result['da_filtered'] = 0.0
        result['avg_pred_magnitude_on_trades'] = 0.0
        result['avg_true_magnitude_on_trades'] = 0.0
    else:
        result['da_filtered'] = float(np.mean(np.sign(pred[mask]) == np.sign(true[mask])) * 100)
        result['avg_pred_magnitude_on_trades'] = float(np.mean(np.abs(pred[mask])))
        result['avg_true_magnitude_on_trades'] = float(np.mean(np.abs(true[mask])))
    return result
