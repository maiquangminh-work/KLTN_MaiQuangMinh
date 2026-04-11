function ChatWidget({
  isChatOpen,
  setIsChatOpen,
  chatSize,
  startResize,
  chatHistory,
  isTyping,
  chatEndRef,
  chatInput,
  setChatInput,
  handleSendMessage,
}) {
  return (
    <div className="chat-widget">
      {isChatOpen && (
        <div className="chat-window" style={{ width: `${chatSize.width}px`, height: `${chatSize.height}px` }}>
          <div
            onMouseDown={startResize}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '40px',
              height: '40px',
              cursor: 'nwse-resize',
              zIndex: 9999
            }}
            title="Kéo để đổi kích thước"
          />

          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '10px',
              pointerEvents: 'none',
              color: '#fcd535',
              fontSize: '18px',
              zIndex: 10000,
              fontWeight: 'bold'
            }}
          >
            ↖
          </div>

          <div className="chat-header">
            <span style={{ marginLeft: '25px' }}>TRỢ LÝ AI</span>
            <button
              onClick={() => setIsChatOpen(false)}
              style={{ background: 'none', border: 'none', color: '#848e9c', cursor: 'pointer', fontSize: '20px' }}
            >
              ×
            </button>
          </div>

          <div className="chat-messages">
            {chatHistory.map((message, index) => (
              <div key={index} className={`msg ${message.role}`}>{message.text}</div>
            ))}
            {isTyping && <div style={{ fontSize: 11, color: '#848e9c' }}>AI đang phân tích...</div>}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Hỏi AI..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className="send-btn" onClick={handleSendMessage}>GỬI</button>
          </div>
        </div>
      )}

      <button className="chat-bubble" onClick={() => setIsChatOpen(!isChatOpen)}>
        <span style={{ fontSize: 24 }}>{isChatOpen ? '↓' : '💬'}</span>
      </button>
    </div>
  );
}

export default ChatWidget;
