import tensorflow as tf
from tensorflow.keras.layers import Input, Conv1D, MaxPooling1D, LSTM, Dense, Dropout, Flatten, Layer
from tensorflow.keras.models import Model

class AttentionLayer(Layer):
    def __init__(self, **kwargs):
        super(AttentionLayer, self).__init__(**kwargs)

    def build(self, input_shape):
        self.W = self.add_weight(name="att_weight", shape=(input_shape[-1], 1), initializer="normal")
        self.b = self.add_weight(name="att_bias", shape=(input_shape[1], 1), initializer="zeros")
        super(AttentionLayer, self).build(input_shape)

    def call(self, x):
        e = tf.keras.backend.tanh(tf.keras.backend.dot(x, self.W) + self.b)
        a = tf.keras.backend.softmax(e, axis=1)
        output = x * a
        return tf.keras.backend.sum(output, axis=1)

def build_cnn_lstm_attention_model(input_shape):
    inputs = Input(shape=input_shape, name="Input_Layer")
    
    # CNN trích xuất đặc trưng với 64 filters theo đúng chuẩn
    x = Conv1D(filters=64, kernel_size=3, activation='relu', name="1D_CNN_Layer")(inputs)
    x = MaxPooling1D(pool_size=2, name="MaxPooling_Layer")(x)
    
    # LSTM với 50 units
    x = LSTM(units=50, return_sequences=True, name="LSTM_Layer")(x)
    
    # Tích hợp Attention
    x = AttentionLayer(name="Attention_Layer")(x)
    
    # Tầng kết nối với Dropout 0.2
    x = Dense(units=32, activation='relu', name="Dense_Layer")(x)
    x = Dropout(0.2, name="Dropout_1")(x)
    outputs = Dense(units=1, activation='linear', name="Output_Layer")(x)
    
    model = Model(inputs=inputs, outputs=outputs, name="CNN_LSTM_Attention_Standard")
    
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
                  loss='mean_squared_error',
                  metrics=['mae'])

    return model


def _compile_model(model):
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='mean_squared_error',
        metrics=['mae']
    )
    return model


def _apply_dense_head(x):
    x = Dense(units=32, activation='relu', name="Dense_Layer")(x)
    x = Dropout(0.2, name="Dropout_1")(x)
    return Dense(units=1, activation='linear', name="Output_Layer")(x)


def build_lstm_only_model(input_shape):
    inputs = Input(shape=input_shape, name="Input_Layer")
    x = LSTM(units=50, name="LSTM_Layer")(inputs)
    outputs = _apply_dense_head(x)
    model = Model(inputs=inputs, outputs=outputs, name="LSTM_Only")
    return _compile_model(model)


def build_cnn_only_model(input_shape):
    inputs = Input(shape=input_shape, name="Input_Layer")
    x = Conv1D(filters=64, kernel_size=3, activation='relu', name="1D_CNN_Layer")(inputs)
    x = MaxPooling1D(pool_size=2, name="MaxPooling_Layer")(x)
    x = Flatten(name="Flatten_Layer")(x)
    outputs = _apply_dense_head(x)
    model = Model(inputs=inputs, outputs=outputs, name="CNN_Only")
    return _compile_model(model)


def build_attention_only_model(input_shape):
    inputs = Input(shape=input_shape, name="Input_Layer")
    x = AttentionLayer(name="Attention_Layer")(inputs)
    outputs = _apply_dense_head(x)
    model = Model(inputs=inputs, outputs=outputs, name="Attention_Only")
    return _compile_model(model)


def build_cnn_lstm_model(input_shape):
    inputs = Input(shape=input_shape, name="Input_Layer")
    x = Conv1D(filters=64, kernel_size=3, activation='relu', name="1D_CNN_Layer")(inputs)
    x = MaxPooling1D(pool_size=2, name="MaxPooling_Layer")(x)
    x = LSTM(units=50, name="LSTM_Layer")(x)
    outputs = _apply_dense_head(x)
    model = Model(inputs=inputs, outputs=outputs, name="CNN_LSTM")
    return _compile_model(model)


def build_lstm_attention_model(input_shape):
    inputs = Input(shape=input_shape, name="Input_Layer")
    x = LSTM(units=50, return_sequences=True, name="LSTM_Layer")(inputs)
    x = AttentionLayer(name="Attention_Layer")(x)
    outputs = _apply_dense_head(x)
    model = Model(inputs=inputs, outputs=outputs, name="LSTM_Attention")
    return _compile_model(model)


def build_cnn_attention_model(input_shape):
    inputs = Input(shape=input_shape, name="Input_Layer")
    x = Conv1D(filters=64, kernel_size=3, activation='relu', name="1D_CNN_Layer")(inputs)
    x = MaxPooling1D(pool_size=2, name="MaxPooling_Layer")(x)
    x = AttentionLayer(name="Attention_Layer")(x)
    outputs = _apply_dense_head(x)
    model = Model(inputs=inputs, outputs=outputs, name="CNN_Attention")
    return _compile_model(model)


def build_cnn_lstm_attention_model(input_shape):
    inputs = Input(shape=input_shape, name="Input_Layer")
    x = Conv1D(filters=64, kernel_size=3, activation='relu', name="1D_CNN_Layer")(inputs)
    x = MaxPooling1D(pool_size=2, name="MaxPooling_Layer")(x)
    x = LSTM(units=50, return_sequences=True, name="LSTM_Layer")(x)
    x = AttentionLayer(name="Attention_Layer")(x)
    outputs = _apply_dense_head(x)
    model = Model(inputs=inputs, outputs=outputs, name="CNN_LSTM_Attention")
    return _compile_model(model)


def build_cnn_lstm_attention_classifier_model(input_shape, num_classes=3):
    inputs = Input(shape=input_shape, name="Input_Layer")
    x = Conv1D(filters=64, kernel_size=3, activation='relu', name="1D_CNN_Layer")(inputs)
    x = MaxPooling1D(pool_size=2, name="MaxPooling_Layer")(x)
    x = LSTM(units=50, return_sequences=True, name="LSTM_Layer")(x)
    x = AttentionLayer(name="Attention_Layer")(x)
    x = Dense(units=32, activation='relu', name="Dense_Layer")(x)
    x = Dropout(0.2, name="Dropout_1")(x)
    outputs = Dense(units=num_classes, activation='softmax', name="Probability_Output_Layer")(x)
    model = Model(inputs=inputs, outputs=outputs, name="CNN_LSTM_Attention_Alpha_Classifier")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model


def build_cnn_lstm_attention_multitask_model(input_shape, num_direction_classes=3):
    """Multi-task head — giữ nguyên backbone CNN-LSTM-Attention gốc.

    Share backbone: Conv1D → MaxPool → LSTM → Attention → Dense(32) + Dropout.
    Output branching:
      - regression_output: 1 unit linear — dự báo log-return magnitude (scaled)
      - direction_output: 3 units softmax — phân loại hướng {0:down, 1:flat, 2:up}

    Rationale (tăng DA):
      - Bắt model học 'hướng' rõ ràng qua classifier head → tín hiệu mạnh hơn cho DA
      - Magnitude regression vẫn được giữ để tái tạo giá
      - Shared representation giúp hai task regularize lẫn nhau
    """
    inputs = Input(shape=input_shape, name="Input_Layer")

    # Shared backbone — giữ nguyên kiến trúc chuẩn
    x = Conv1D(filters=64, kernel_size=3, activation='relu', name="1D_CNN_Layer")(inputs)
    x = MaxPooling1D(pool_size=2, name="MaxPooling_Layer")(x)
    x = LSTM(units=50, return_sequences=True, name="LSTM_Layer")(x)
    x = AttentionLayer(name="Attention_Layer")(x)

    # Task-specific branches
    shared = Dense(units=32, activation='relu', name="Shared_Dense")(x)
    shared = Dropout(0.2, name="Shared_Dropout")(shared)

    # Regression branch
    reg_hidden = Dense(units=16, activation='relu', name="Reg_Hidden")(shared)
    regression_output = Dense(units=1, activation='linear', name="regression_output")(reg_hidden)

    # Direction classification branch
    dir_hidden = Dense(units=16, activation='relu', name="Dir_Hidden")(shared)
    direction_output = Dense(units=num_direction_classes, activation='softmax',
                             name="direction_output")(dir_hidden)

    model = Model(inputs=inputs,
                  outputs={
                      'regression_output': regression_output,
                      'direction_output': direction_output,
                  },
                  name="CNN_LSTM_Attention_Multitask")

    # Composite loss: MSE cho regression + cross-entropy cho direction
    # Weight nghiêng về direction (alpha_dir=0.6) để đẩy DA lên
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss={
            'regression_output': 'mean_squared_error',
            'direction_output': 'sparse_categorical_crossentropy',
        },
        loss_weights={
            'regression_output': 0.4,
            'direction_output': 0.6,
        },
        metrics={
            'regression_output': ['mae'],
            'direction_output': ['accuracy'],
        },
    )
    return model


MODEL_BUILDERS = {
    "lstm_only": build_lstm_only_model,
    "cnn_only": build_cnn_only_model,
    "attention_only": build_attention_only_model,
    "cnn_lstm": build_cnn_lstm_model,
    "lstm_attention": build_lstm_attention_model,
    "cnn_attention": build_cnn_attention_model,
    "cnn_lstm_attention": build_cnn_lstm_attention_model,
}
