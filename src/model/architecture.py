import tensorflow as tf
from tensorflow.keras.layers import Input, Conv1D, MaxPooling1D, LSTM, Dense, Dropout, Layer
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
    
    # Tầng kết nối với Dropout 0.2 theo đúng khóa luận
    x = Dense(units=32, activation='relu', name="Dense_Layer")(x)
    x = Dropout(0.2, name="Dropout_1")(x)
    outputs = Dense(units=1, activation='linear', name="Output_Layer")(x)
    
    model = Model(inputs=inputs, outputs=outputs, name="CNN_LSTM_Attention_Standard")
    
    # BẮT BUỘC: Dùng MSE làm hàm mất mát để trừng phạt sai số lớn
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), 
                  loss='mean_squared_error', 
                  metrics=['mae'])
    
    return model