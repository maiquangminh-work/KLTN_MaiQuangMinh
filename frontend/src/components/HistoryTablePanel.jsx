function HistoryTablePanel({
  displayTableData,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  availableMonths,
  availableYears,
  formatVND,
  language = 'vi',
}) {
  const copy = language === 'en'
    ? {
        title: 'Market History',
        allMonths: 'All months',
        month: 'Month',
        allYears: 'All years',
        year: 'Year',
        empty: 'No trading data in this period.',
        date: 'Date',
        open: 'Open',
        high: 'High',
        low: 'Low',
        close: 'Close',
        foreignBuy: 'Foreign buy',
        foreignSell: 'Foreign sell',
        foreignNet: 'Net foreign',
      }
    : {
        title: 'L\u1ecaCH S\u1eec TH\u1eca TR\u01af\u1edcNG',
        allMonths: 'T\u1ea5t c\u1ea3 th\u00e1ng',
        month: 'Th\u00e1ng',
        allYears: 'T\u1ea5t c\u1ea3 n\u0103m',
        year: 'N\u0103m',
        empty: 'Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u giao d\u1ecbch trong th\u1eddi gian n\u00e0y.',
        date: 'Ng\u00e0y',
        open: 'M\u1edf',
        high: 'Cao',
        low: 'Th\u1ea5p',
        close: '\u0110\u00f3ng',
        foreignBuy: '\u0110TNN mua',
        foreignSell: '\u0110TNN b\u00e1n',
        foreignNet: '\u0110TNN r\u00f2ng',
      };

  const hasValue = (value) => value !== undefined && value !== null && value !== '';
  const hasForeignHistory = displayTableData.some((row) => (
    hasValue(row.foreign_buy_volume) ||
    hasValue(row.foreign_sell_volume) ||
    hasValue(row.foreign_net_volume)
  ));
  const formatOptionalVolume = (value) => (hasValue(value) ? formatVND(value) : '-');

  return (
    <div className="detail-stack" style={{ paddingTop: 0 }}>
      <div className="card order-book detail-card" style={{ padding: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2b3139', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>{copy.title}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="filter-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              <option value="All">{copy.allMonths}</option>
              {availableMonths.map((month) => <option key={month} value={month}>{copy.month} {month}</option>)}
            </select>
            <select className="filter-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="All">{copy.allYears}</option>
              {availableYears.map((year) => <option key={year} value={year}>{copy.year} {year}</option>)}
            </select>
          </div>
        </div>

        <div className="order-book-scroll" style={{ maxHeight: '350px' }}>
          {displayTableData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#848e9c' }}>{copy.empty}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{copy.date}</th>
                  <th>{copy.open}</th>
                  <th>{copy.high}</th>
                  <th>{copy.low}</th>
                  <th>{copy.close}</th>
                  <th>Vol (K)</th>
                  <th>RSI</th>
                  {hasForeignHistory && (
                    <>
                      <th>{copy.foreignBuy}</th>
                      <th>{copy.foreignSell}</th>
                      <th>{copy.foreignNet}</th>
                    </>
                  )}
                </tr>
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
                      <td
                        style={{
                          color: row.rsi_14 > 70
                            ? 'var(--accent-red)'
                            : row.rsi_14 < 30
                              ? 'var(--accent-green)'
                              : 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        {Number(row.rsi_14).toFixed(1)}
                      </td>
                      {hasForeignHistory && (
                        <>
                          <td className="text-green">{formatOptionalVolume(row.foreign_buy_volume)}</td>
                          <td className="text-red">{formatOptionalVolume(row.foreign_sell_volume)}</td>
                          <td
                            style={{
                              color: Number(row.foreign_net_volume || 0) > 0
                                ? 'var(--accent-green)'
                                : Number(row.foreign_net_volume || 0) < 0
                                  ? 'var(--accent-red)'
                                  : 'var(--text-secondary)',
                              fontWeight: 700,
                            }}
                          >
                            {hasValue(row.foreign_net_volume) && Number(row.foreign_net_volume) > 0 ? '+' : ''}
                            {formatOptionalVolume(row.foreign_net_volume)}
                          </td>
                        </>
                      )}
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
