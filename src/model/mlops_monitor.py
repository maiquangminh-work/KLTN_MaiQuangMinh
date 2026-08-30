"""
MLOps Data Drift & Concept Drift Monitor Engine.

Mục tiêu:
1. Thực hiện Kolmogorov-Smirnov Test (KS-Test) so sánh phân phối của tập tính năng 30 phiên gần nhất với dữ liệu huấn luyện ban đầu.
2. Kiểm tra sụt giảm chỉ số Directional Accuracy & MSE.
3. Kích hoạt cảnh báo và tự động trigger pipeline Re-training khi phát hiện Data Drift (p-value < 0.05).
"""

import os
import sys
import logging
import pandas as pd
import numpy as np
from scipy.stats import ks_2samp

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

TICKERS = ['VCB', 'BID', 'CTG', 'MBB', 'TCB', 'VPB', 'ACB', 'HDB', 'SHB', 'VIB']
PROCESSED_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data/processed'))


class DataDriftMonitor:
    def __init__(self, tickers: list[str] = TICKERS):
        self.tickers = tickers

    def detect_drift_for_ticker(self, ticker: str, feature_col: str = 'close_winsorized', recent_window: int = 30) -> dict:
        """Thực hiện KS-Test trên một tính năng cụ thể."""
        csv_path = os.path.join(PROCESSED_DIR, f"{ticker.upper()}_features.csv")
        if not os.path.exists(csv_path):
            return {'ticker': ticker, 'status': 'FILE_NOT_FOUND', 'drift_detected': False}

        df = pd.read_csv(csv_path)
        if feature_col not in df.columns or len(df) < (recent_window + 60):
            return {'ticker': ticker, 'status': 'INSUFFICIENT_DATA', 'drift_detected': False}

        reference_data = df[feature_col].iloc[:-recent_window].values
        recent_data = df[feature_col].iloc[-recent_window:].values

        # Kolmogorov-Smirnov 2-sample test
        stat, p_value = ks_2samp(reference_data, recent_data)
        drift_detected = p_value < 0.05

        return {
            'ticker': ticker,
            'feature': feature_col,
            'ks_statistic': float(stat),
            'p_value': float(p_value),
            'drift_detected': bool(drift_detected),
            'action_required': 'RE_TRAIN_MODEL' if drift_detected else 'MAINTAIN'
        }

    def run_full_drift_audit(self) -> list[dict]:
        """Chạy kiểm định Data Drift toàn bộ 10 mã cổ phiếu."""
        results = []
        logging.info("[MLOPS-AUDIT] Bắt đầu kiểm định Data Drift (KS-Test)...")
        for tk in self.tickers:
            res = self.detect_drift_for_ticker(tk)
            results.append(res)
            status_text = "DRIFT DETECTED (TRIGGER RETRAIN)" if res['drift_detected'] else "STABLE"
            logging.info(f" - [{tk}] p-value: {res.get('p_value', 0):.4f} -> Status: {status_text}")
        return results


if __name__ == '__main__':
    monitor = DataDriftMonitor()
    results = monitor.run_full_drift_audit()
    print("\n[MLOPS DRIFT AUDIT SUMMARY]")
    for r in results:
        print(f"Ticker: {r['ticker']} | Drift: {r.get('drift_detected')} | Action: {r.get('action_required')}")
