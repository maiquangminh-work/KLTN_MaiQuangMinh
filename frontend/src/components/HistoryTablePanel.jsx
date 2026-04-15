function HistoryTablePanel({
  displayTableData,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  availableMonths,
  availableYears,
  formatVND,
}) {
  return (
    <div className="detail-stack" style={{ paddingTop: 0 }}>
      <div className="card order-book detail-card" style={{ padding: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2b3139', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>LỊCH SỬ THỊ TRƯỜNG</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="filter-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              <option value="All">Tất cả tháng</option>
              {availableMonths.map((month) => <option key={month} value={month}>Tháng {month}</option>)}
            </select>
            <select className="filter-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="All">Tất cả năm</option>
              {availableYears.map((year) => <option key={year} value={year}>Năm {year}</option>)}
            </select>
          </div>
        </div>

        <div className="order-book-scroll" style={{ maxHeight: '350px' }}>
          {displayTableData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#848e9c' }}>Không có dữ liệu giao dịch trong thời gian này.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Ngày</th><th>Mở</th><th>Cao</th><th>Thấp</th><th>Đóng</th><th>Vol (K)</th><th>RSI</th></tr>
              </thead>
              <tbody>
                {displayTableData.slice(0, 100).map((row, index) => {
                  const dateParts = row.time.split('-');
                  const displayDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                  return (
                    <tr key={index}>
                      <td style={{ color: '#848e9c' }}>{displayDate}</td>
                      <td>{formatVND(row.open)}</td>
                      <td>{formatVND(row.high)}</td>
                      <td>{formatVND(row.low)}</td>
                      <td className={row.colorClass} style={{ fontWeight: 'bold' }}>{formatVND(row.close)}</td>
                      <td>{formatVND(row.volume / 1000)}</td>
                      <td style={{ color: row.rsi_14 > 70 ? '#f6465d' : row.rsi_14 < 30 ? '#0ecb81' : '#eaecef' }}>{Number(row.rsi_14).toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default HistoryTablePanel;
