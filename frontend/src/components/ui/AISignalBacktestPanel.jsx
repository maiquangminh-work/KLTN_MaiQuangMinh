import { useMemo } from 'react'

const COPY = {
  vi: {
    kicker: 'Kiểm chứng tín hiệu',
    title: 'AI Signal Backtest',
    note: 'So sánh từng tín hiệu với biến động thực tế ở phiên ghi nhận kế tiếp.',
    loading: 'Đang tải backtest tín hiệu...',
    empty: 'Chưa có đủ lịch sử tín hiệu để kiểm chứng.',
    hitRate: 'Tỷ lệ đúng',
    evaluated: 'Đã kiểm chứng',
    avgMove: 'Biến động TB',
    latest: 'Tín hiệu gần nhất',
    correct: 'Đúng',
    incorrect: 'Sai',
    pending: 'Chờ',
    viewFull: 'Xem chi tiết',
    probability: 'Xác suất',
    price: 'Giá',
    labels: {
      positive: 'KHẢ QUAN',
      neutral: 'TRUNG LẬP',
      negative: 'KÉM KHẢ QUAN',
      loading: 'ĐANG TẢI',
    },
    verdicts: {
      thin: 'Cần thêm mẫu sau khi đổi sang mô hình xác suất.',
      strong: 'Backtest đang ủng hộ tín hiệu hiện tại.',
      mixed: 'Tín hiệu dùng được nhưng nên kiểm soát tỷ trọng.',
      weak: 'Tín hiệu cần thận trọng, chưa đủ ổn định.',
    },
  },
  en: {
    kicker: 'Signal validation',
    title: 'AI Signal Backtest',
    note: 'Compares each issued signal with the next recorded market outcome.',
    loading: 'Loading signal backtest...',
    empty: 'Not enough signal history to validate yet.',
    hitRate: 'Hit rate',
    evaluated: 'Evaluated',
    avgMove: 'Avg move',
    latest: 'Latest signals',
    correct: 'Correct',
    incorrect: 'Wrong',
    pending: 'Pending',
    viewFull: 'View detail',
    probability: 'Probability',
    price: 'Price',
    labels: {
      positive: 'OUTPERFORM',
      neutral: 'NEUTRAL',
      negative: 'UNDERPERFORM',
      loading: 'UPDATING',
    },
    verdicts: {
      thin: 'Needs more samples after the probability-model switch.',
      strong: 'Backtest currently supports the signal layer.',
      mixed: 'Usable, but position sizing should stay controlled.',
      weak: 'Signal quality is not stable enough yet.',
    },
  },
}

const TONE_COLORS = {
  positive: 'var(--accent-green)',
  neutral: 'var(--accent-yellow)',
  negative: 'var(--accent-red)',
  loading: 'var(--text-muted)',
}

function formatPercent(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return '--'
  return `${Number(value).toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

function getResultCopy(result, copy) {
  if (result === 'correct') return { label: copy.correct, tone: 'correct' }
  if (result === 'incorrect') return { label: copy.incorrect, tone: 'incorrect' }
  return { label: copy.pending, tone: 'pending' }
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function resolveSignalTone(item) {
  const raw = normalizeText(item?.recommendation)
  if (raw.includes('KEM KHA QUAN') || raw.includes('UNDERPERFORM') || raw.includes('BAN')) return 'negative'
  if (raw.includes('KHA QUAN') || raw.includes('OUTPERFORM') || raw.includes('MUA')) return 'positive'
  if (raw.includes('TRUNG') || raw.includes('GIU') || raw.includes('NEUTRAL') || raw.includes('HOLD')) return 'neutral'
  return item?.signal_tone || 'neutral'
}

function resolveResult(item, tone) {
  const move = Number(item?.actual_return_percent)
  if (!Number.isFinite(move)) return null
  const actualDirection = move >= 0.5 ? 'positive' : move <= -0.5 ? 'negative' : 'neutral'
  return actualDirection === tone ? 'correct' : 'incorrect'
}

export default function AISignalBacktestPanel({ data, loading, language }) {
  const copy = COPY[language] || COPY.vi

  const stats = useMemo(() => {
    const signals = (Array.isArray(data?.signals) ? data.signals : []).map((item) => {
      const signalTone = resolveSignalTone(item)
      return {
        ...item,
        signal_tone: signalTone,
        result: resolveResult(item, signalTone),
      }
    })
    const evaluated = signals.filter((item) => item.result === 'correct' || item.result === 'incorrect')
    const avgMove = evaluated.length
      ? evaluated.reduce((sum, item) => sum + Number(item.actual_return_percent || 0), 0) / evaluated.length
      : null
    const correctCount = evaluated.filter((item) => item.result === 'correct').length
    const winRate = evaluated.length ? (correctCount / evaluated.length) * 100 : null
    const verdict = evaluated.length < 5
      ? copy.verdicts.thin
      : winRate >= 60
        ? copy.verdicts.strong
        : winRate >= 50
          ? copy.verdicts.mixed
          : copy.verdicts.weak

    return {
      signals,
      recent: signals.slice(0, 3),
      evaluatedCount: evaluated.length,
      correctCount,
      totalCount: Number(data?.total_signals || signals.length || 0),
      winRate: Number.isFinite(winRate) ? winRate : null,
      avgMove,
      verdict,
    }
  }, [data, copy])

  return (
    <div className="card ai-backtest-panel">
      <div className="ai-backtest-head">
        <div>
          <div className="ai-backtest-kicker">{copy.kicker}</div>
          <h3 className="ai-backtest-title">{copy.title}</h3>
          <p className="ai-backtest-note">{copy.note}</p>
        </div>
      </div>

      {loading ? (
        <div className="ai-backtest-state">{copy.loading}</div>
      ) : !stats.signals.length ? (
        <div className="ai-backtest-state">{copy.empty}</div>
      ) : (
        <>
          <div className="ai-backtest-grid">
            <div className="ai-backtest-stat">
              <span>{copy.hitRate}</span>
              <strong>{stats.winRate !== null ? formatPercent(stats.winRate, 1) : '--'}</strong>
            </div>
            <div className="ai-backtest-stat">
              <span>{copy.evaluated}</span>
              <strong>{stats.evaluatedCount}/{stats.totalCount}</strong>
            </div>
            <div className="ai-backtest-stat">
              <span>{copy.avgMove}</span>
              <strong className={Number.isFinite(stats.avgMove) ? (stats.avgMove >= 0 ? 'positive' : 'negative') : ''}>
                {stats.avgMove !== null ? `${stats.avgMove >= 0 ? '+' : ''}${formatPercent(stats.avgMove, 2)}` : '--'}
              </strong>
            </div>
          </div>

          <div className="ai-backtest-verdict">{stats.verdict}</div>

          <div className="ai-backtest-list-head">{copy.latest}</div>
          <div className="ai-backtest-list">
            {stats.recent.map((item, index) => {
              const tone = item.signal_tone || 'neutral'
              const result = getResultCopy(item.result, copy)
              const mode = item.prediction_mode === 'alpha_probability' ? copy.probability : copy.price
              const move = Number(item.actual_return_percent)

              return (
                <div className="ai-backtest-row" key={`${item.date}-${index}`}>
                  <span className="ai-backtest-date">{item.date}</span>
                  <span className="ai-backtest-mode">{mode}</span>
                  <span className={`ai-backtest-move ${Number.isFinite(move) && move >= 0 ? 'positive' : Number.isFinite(move) ? 'negative' : ''}`}>
                    {Number.isFinite(move) ? `${move >= 0 ? '+' : ''}${formatPercent(move, 2)}` : '--'}
                  </span>
                  <span className="ai-backtest-signal" style={{ color: TONE_COLORS[tone] || TONE_COLORS.neutral }}>
                    {copy.labels[tone] || copy.labels.neutral}
                  </span>
                  <span className={`ai-backtest-result ${result.tone}`}>{result.label}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
