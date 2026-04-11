function TopNavigation({ activeTab, handleTabChange, ticker, handleBankChange }) {
  return (
    <>
      <div className="header">
        <h1>
          HỆ THỐNG AI HỖ TRỢ NGƯỜI DÙNG DỰ ĐOÁN CỔ PHIẾU <span>| Kỹ thuật: CNN-LSTM-Attention</span>
        </h1>
      </div>

      <div className="nav-tabs">
        <div className={`nav-tab ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => handleTabChange('chart')}>
          BIỂU ĐỒ KỸ THUẬT
        </div>
        <div className={`nav-tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => handleTabChange('info')}>
          THÔNG TIN CƠ BẢN
        </div>
        <div className={`nav-tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => handleTabChange('news')}>
          TIN TỨC THỊ TRƯỜNG
        </div>
      </div>

      {(activeTab === 'chart' || activeTab === 'info') && (
        <div className="btn-group">
          {['VCB', 'BID', 'CTG'].map((bank) => (
            <button key={bank} className={`btn ${ticker === bank ? 'active' : ''}`} onClick={() => handleBankChange(bank)}>
              {bank}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default TopNavigation;
