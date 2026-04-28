"""
Custom loss cho dự báo log-return chứng khoán.

Mục tiêu chính là khắc phục hiện tượng "flat prediction" (prediction collapse)
khi train chuỗi thời gian tài chính với MSE:
  - Do log_return có mean ≈ 0, MSE loss tối ưu bằng cách luôn dự đoán 0
  - Điều này dẫn tới Lag-1 corr ≈ 1.0 và DA ≈ 50% (bằng đồng xu)

VarianceMatchingMSE ép mô hình học ra prediction có:
  (i) phương sai tương đương target (chống flat prediction)
  (ii) đúng dấu với target ở mức tối đa có thể (tăng DA)
"""
import tensorflow as tf


class VarianceMatchingMSE(tf.keras.losses.Loss):
    """Composite loss = MSE + variance_gap_penalty + direction_mismatch_penalty

    L(y, ŷ) = MSE(y, ŷ)
            + λ_var · ReLU(Std(y) - Std(ŷ)) / Std(y)       # chỉ phạt khi pred "phẳng"
            + λ_dir · mean[(tanh(T·y) - tanh(T·ŷ))²]       # phạt khi sai hướng

    Ý nghĩa:
      - MSE: giữ mục tiêu regression cơ bản.
      - λ_var: phạt chỉ khi Var(ŷ) < Var(y) (pred quá phẳng). Không phạt khi
        Var(ŷ) > Var(y) để tránh ép pred "nhảy" quá mức.
      - λ_dir: smooth-sign mismatch dùng tanh với temperature T;
        T càng cao → càng gần hàm sign().

    Yêu cầu target đã được scale tuyến tính với zero-preserving (ví dụ MaxAbsScaler
    hoặc StandardScaler) để dấu trong không gian scaled trùng dấu raw.

    Args:
        variance_weight (float): λ_var (default 0.3).
        direction_weight (float): λ_dir (default 0.1).
        direction_temp (float): T, temperature trong tanh (default 20.0).
    """

    def __init__(self,
                 variance_weight: float = 0.3,
                 direction_weight: float = 0.1,
                 direction_temp: float = 20.0,
                 name: str = "variance_matching_mse",
                 **kwargs):
        super().__init__(name=name, **kwargs)
        self.variance_weight = float(variance_weight)
        self.direction_weight = float(direction_weight)
        self.direction_temp = float(direction_temp)

    def call(self, y_true, y_pred):
        y_true = tf.cast(y_true, tf.float32)
        y_pred = tf.cast(y_pred, tf.float32)

        # --- 1. MSE cơ bản ---
        mse = tf.reduce_mean(tf.square(y_true - y_pred))

        # --- 2. Std matching (std ổn định hơn variance vì chênh magnitude thấp hơn) ---
        std_true = tf.sqrt(tf.math.reduce_variance(y_true) + 1e-8)
        std_pred = tf.sqrt(tf.math.reduce_variance(y_pred) + 1e-8)
        var_gap = tf.nn.relu(std_true - std_pred) / (std_true + 1e-8)

        # --- 3. Direction mismatch (smooth sign) ---
        tt = tf.tanh(y_true * self.direction_temp)
        tp = tf.tanh(y_pred * self.direction_temp)
        direction_mismatch = tf.reduce_mean(tf.square(tt - tp))

        return (mse
                + self.variance_weight * var_gap
                + self.direction_weight * direction_mismatch)

    def get_config(self):
        cfg = super().get_config()
        cfg.update({
            "variance_weight": self.variance_weight,
            "direction_weight": self.direction_weight,
            "direction_temp": self.direction_temp,
        })
        return cfg
