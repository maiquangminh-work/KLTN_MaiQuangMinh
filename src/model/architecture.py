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
    
    # BẮT BUỘC: Dùng MSE làm hàm mất mát để trừng phạt sai số lớn
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), 
                  loss='mean_squared_error', 
                  metrics=['mae'])
    
    return model

# python src\model\architecture.py (file to define the model architecture)


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


MODEL_BUILDERS = {
    "lstm_only": build_lstm_only_model,
    "cnn_only": build_cnn_only_model,
    "attention_only": build_attention_only_model,
    "cnn_lstm": build_cnn_lstm_model,
    "lstm_attention": build_lstm_attention_model,
    "cnn_attention": build_cnn_attention_model,
    "cnn_lstm_attention": build_cnn_lstm_attention_model,
}
