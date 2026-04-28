import { useMemo, useState } from 'react'
import { BANK_FINANCIAL_DATA, VALID_TICKERS } from '../../utils/constants'
import { formatPercent, formatVND } from '../../utils/formatting'

const TICKERS = VALID_TICKERS.filter((ticker) => BANK_FINANCIAL_DATA[ticker])

const COPY = {
  vi: {
    kicker: 'Bộ lọc ngân hàng',
    title: 'Bank Screener',
    note: 'Xếp hạng nhanh 10 ngân hàng theo tín hiệu AI, chất lượng sinh lời, định giá, rủi ro tài sản và thanh khoản.',
    filters: {
      all: 'Tất cả',
      ai: 'AI tích cực',
      value: 'Rẻ + ROE tốt',
      quality: 'Chất lượng cao',
      risk: 'Cần thận trọng',
    },
    columns: {
      ticker: 'Mã',
      ai: 'AI outlook',
      prob: 'P(outperform)',
      edge: 'Alpha edge',
      pb: 'P/B',
      roe: 'ROE',
      npl: 'Nợ xấu',
      nplRatio: 'Nợ xấu',
      nim: 'NIM',
      liquidity: 'Thanh khoản',
      tag: 'Nhãn đọc nhanh',
      totalScore: 'Điểm tổng hợp',
      outperform: 'P(outperform)',
      avgVolume20: 'Thanh khoản',
    },
    summaries: {
      bestSetup: 'Setup tốt nhất',
      highestAi: 'AI mạnh nhất',
      cheapest: 'P/B thấp nhất',
      quality: 'ROE cao nhất',
    },
    tags: {
      aiQuality: 'AI + chất lượng',
      value: 'Value watch',
      quality: 'Quality premium',
      risk: 'Rủi ro cao',
      neutral: 'Theo dõi',
      loading: 'Đang tải AI',
    },
    outlook: {
      positive: 'Khả quan',
      neutral: 'Trung lập',
      negative: 'Kém khả quan',
      loading: 'Đang tải',
    },
    empty: 'Không có ngân hàng phù hợp với bộ lọc hiện tại.',
    open: 'Mở hồ sơ',
    loading: 'Đang đồng bộ tín hiệu AI theo watchlist...',
  },
  en: {
    kicker: 'Bank filter',
    title: 'Bank Screener',
    note: 'Ranks the 10 tracked banks by AI signal, profitability quality, valuation, asset risk, and liquidity.',
    filters: {
      all: 'All',
      ai: 'Positive AI',
      value: 'Cheap + good ROE',
      quality: 'High quality',
      risk: 'Caution list',
    },
    columns: {
      ticker: 'Ticker',
      ai: 'AI outlook',
      prob: 'P(outperform)',
      edge: 'Alpha edge',
      pb: 'P/B',
      roe: 'ROE',
      npl: 'NPL',
      nplRatio: 'NPL',
      nim: 'NIM',
      liquidity: 'Liquidity',
      tag: 'Quick label',
      totalScore: 'Composite score',
      outperform: 'P(outperform)',
      avgVolume20: 'Liquidity',
    },
    summaries: {
      bestSetup: 'Best setup',
      highestAi: 'Strongest AI',
      cheapest: 'Lowest P/B',
      quality: 'Highest ROE',
    },
    tags: {
      aiQuality: 'AI + quality',
      value: 'Value watch',
      quality: 'Quality premium',
      risk: 'High risk',
      neutral: 'Watch',
      loading: 'Loading AI',
    },
    outlook: {
      positive: 'Outperform',
      neutral: 'Neutral',
      negative: 'Underperform',
      loading: 'Loading',
    },
    empty: 'No bank matches the current filter.',
    open: 'Open profile',
    loading: 'Synchronizing AI watchlist signals...',
  },
}

const SORT_OPTIONS = ['totalScore', 'outperform', 'pb', 'roe', 'nplRatio', 'avgVolume20']
const FILTERS = ['all', 'ai', 'value', 'quality', 'risk']

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function normalize(value, min, max, invert = false) {
  if (!Number.isFinite(value)) return 0.5
  const range = max - min || 1
  const raw = (value - min) / range
  return Math.max(0, Math.min(1, invert ? 1 - raw : raw))
}

function normalizeProbability(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return num > 1 ? num / 100 : num
}

function getProbabilitySet(snapshot) {
  const probabilityForecast = snapshot?.probability_forecast || {}
  const probabilities = probabilityForecast.probabilities || {}
  const outperform = normalizeProbability(
    probabilityForecast.outperform_probability ?? probabilities.outperform,
  )
  const underperform = normalizeProbability(
    probabilityForecast.underperform_probability ?? probabilities.underperform,
  )
  const neutral = normalizeProbability(
    probabilityForecast.neutral_probability ?? probabilities.neutral,
  )
  return {
    outperform,
    underperform,
    neutral,
    predictedClass: String(probabilityForecast.predicted_class || '').toLowerCase(),
  }
}

function getOutlook(snapshot, probabilitySet) {
  const recommendation = String(snapshot?.recommendation || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (probabilitySet.predictedClass.includes('outperform')) return 'positive'
  if (probabilitySet.predictedClass.includes('underperform')) return 'negative'
  if (recommendation.includes('kha quan') || recommendation.includes('outperform')) return 'positive'
  if (recommendation.includes('kem kha quan') || recommendation.includes('underperform')) return 'negative'

  if (probabilitySet.outperform !== null && probabilitySet.underperform !== null) {
    if (probabilitySet.outperform - probabilitySet.underperform >= 0.08) return 'positive'
    if (probabilitySet.underperform - probabilitySet.outperform >= 0.08) return 'negative'
    return 'neutral'
  }

  return snapshot ? 'neutral' : 'loading'
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return '--'
  return `${formatVND(value * 1000)} VND`
}

function formatVolume(value) {
  if (!Number.isFinite(value)) return '--'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(Math.round(value))
}

function tagFor(row, medians, copy) {
  if (!row.snapshot) return { label: copy.tags.loading, tone: 'neutral' }
  if (row.nplRatio > medians.nplRatio * 1.25) return { label: copy.tags.risk, tone: 'risk' }
  if (row.outlook === 'positive' && row.roe >= medians.roe && row.nplRatio <= medians.nplRatio) {
    return { label: copy.tags.aiQuality, tone: 'positive' }
  }
  if (row.pb <= medians.pb && row.roe >= medians.roe) return { label: copy.tags.value, tone: 'positive' }
  if (row.roe >= medians.roe && row.nim >= medians.nim) return { label: copy.tags.quality, tone: 'premium' }
  return { label: copy.tags.neutral, tone: 'neutral' }
}

export default function BankScreener({
  activeTicker,
  language,
  snapshots = {},
  activeSnapshot = null,
  loading = false,
  onSelectTicker,
}) {
  const copy = COPY[language] || COPY.vi
  const [filter, setFilter] = useState('all')
  const [sortKey, setSortKey] = useState('totalScore')

  const { rows, medians, summary } = useMemo(() => {
    const fundamentals = TICKERS.map((ticker) => ({ ticker, ...BANK_FINANCIAL_DATA[ticker] }))
    const med = {
      pb: median(fundamentals.map((item) => item.pb)),
      roe: median(fundamentals.map((item) => item.roe)),
      nplRatio: median(fundamentals.map((item) => item.nplRatio)),
      nim: median(fundamentals.map((item) => item.nim)),
    }
    const extents = {
      roe: [Math.min(...fundamentals.map((item) => item.roe)), Math.max(...fundamentals.map((item) => item.roe))],
      nim: [Math.min(...fundamentals.map((item) => item.nim)), Math.max(...fundamentals.map((item) => item.nim))],
      nplRatio: [
        Math.min(...fundamentals.map((item) => item.nplRatio)),
        Math.max(...fundamentals.map((item) => item.nplRatio)),
      ],
      pb: [Math.min(...fundamentals.map((item) => item.pb)), Math.max(...fundamentals.map((item) => item.pb))],
      avgVolume20: [
        Math.min(...fundamentals.map((item) => item.avgVolume20)),
        Math.max(...fundamentals.map((item) => item.avgVolume20)),
      ],
    }

    const builtRows = fundamentals.map((item) => {
      const snapshot = item.ticker === activeTicker && activeSnapshot ? activeSnapshot : snapshots[item.ticker]
      const probabilitySet = getProbabilitySet(snapshot)
      const rawAiScore = Number(snapshot?.recommendation_score ?? snapshot?.recommendation_confidence_score)
      const scoreFromAi = Number.isFinite(rawAiScore) ? rawAiScore / 100 : null
      const outperform = probabilitySet.outperform ?? scoreFromAi
      const underperform = probabilitySet.underperform ?? null
      const edge = probabilitySet.outperform !== null && probabilitySet.underperform !== null
        ? probabilitySet.outperform - probabilitySet.underperform
        : null
      const outlook = getOutlook(snapshot, probabilitySet)
      const qualityScore = (
        normalize(item.roe, ...extents.roe) * 0.42 +
        normalize(item.nim, ...extents.nim) * 0.28 +
        normalize(item.nplRatio, ...extents.nplRatio, true) * 0.3
      )
      const valuationScore = normalize(item.pb, ...extents.pb, true)
      const liquidityScore = normalize(item.avgVolume20, ...extents.avgVolume20)
      const aiScore = Number.isFinite(outperform) ? outperform : 0.5
      const totalScore = aiScore * 45 + qualityScore * 30 + valuationScore * 15 + liquidityScore * 10
      const currentPrice = Number(snapshot?.current_price)

      return {
        ...item,
        snapshot,
        currentPrice,
        outperform,
        underperform,
        edge,
        outlook,
        totalScore,
        qualityScore,
        valuationScore,
        liquidityScore,
      }
    })

    const taggedRows = builtRows.map((row) => ({
      ...row,
      tag: tagFor(row, med, copy),
    }))

    const sortedByScore = [...taggedRows].sort((a, b) => b.totalScore - a.totalScore)
    const byOutperform = [...taggedRows].sort((a, b) => (b.outperform ?? -1) - (a.outperform ?? -1))
    const byPb = [...taggedRows].sort((a, b) => a.pb - b.pb)
    const byRoe = [...taggedRows].sort((a, b) => b.roe - a.roe)

    return {
      rows: taggedRows,
      medians: med,
      summary: {
        bestSetup: sortedByScore[0],
        highestAi: byOutperform[0],
        cheapest: byPb[0],
        quality: byRoe[0],
      },
    }
  }, [activeTicker, activeSnapshot, snapshots, copy])

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (filter === 'ai') return row.outlook === 'positive' || (row.outperform ?? 0) >= 0.58
      if (filter === 'value') return row.pb <= medians.pb && row.roe >= medians.roe
      if (filter === 'quality') return row.roe >= medians.roe && row.nplRatio <= medians.nplRatio && row.nim >= medians.nim
      if (filter === 'risk') return row.nplRatio > medians.nplRatio * 1.25 || row.outlook === 'negative'
      return true
    })
    const lowerIsBetter = sortKey === 'pb' || sortKey === 'nplRatio'

    return [...filtered].sort((a, b) => {
      const av = Number(a[sortKey])
      const bv = Number(b[sortKey])
      if (!Number.isFinite(av) && !Number.isFinite(bv)) return a.ticker.localeCompare(b.ticker)
      if (!Number.isFinite(av)) return 1
      if (!Number.isFinite(bv)) return -1
      return lowerIsBetter ? av - bv : bv - av
    })
  }, [rows, filter, sortKey, medians])

  const summaryCards = [
    { label: copy.summaries.bestSetup, row: summary.bestSetup, value: `${Math.round(summary.bestSetup?.totalScore || 0)}/100` },
    { label: copy.summaries.highestAi, row: summary.highestAi, value: summary.highestAi?.outperform != null ? formatPercent(summary.highestAi.outperform * 100, 1) : '--' },
    { label: copy.summaries.cheapest, row: summary.cheapest, value: summary.cheapest?.pb?.toFixed(2) || '--' },
    { label: copy.summaries.quality, row: summary.quality, value: summary.quality ? formatPercent(summary.quality.roe, 1) : '--' },
  ]

  return (
    <section className="bank-screener">
      <div className="bank-screener-header">
        <div>
          <span className="bank-screener-kicker">{copy.kicker}</span>
          <h3 className="bank-screener-title">{copy.title}</h3>
          <p className="bank-screener-note">{copy.note}</p>
        </div>
        {loading && <span className="bank-screener-sync">{copy.loading}</span>}
      </div>

      <div className="bank-screener-summary">
        {summaryCards.map((card) => (
          <button
            key={card.label}
            type="button"
            className="bank-screener-summary-card"
            onClick={() => card.row && onSelectTicker?.(card.row.ticker)}
          >
            <span>{card.label}</span>
            <strong>{card.row?.ticker || '--'}</strong>
            <em>{card.value}</em>
          </button>
        ))}
      </div>

      <div className="bank-screener-controls">
        <div className="bank-screener-filter-row">
          {FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              className={`bank-screener-chip ${filter === id ? 'active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {copy.filters[id]}
            </button>
          ))}
        </div>
        <select
          className="bank-screener-sort"
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value)}
          aria-label="Sort bank screener"
        >
          {SORT_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {copy.columns[key] || key}
            </option>
          ))}
        </select>
      </div>

      <div className="bank-screener-table-scroll">
        <table className="bank-screener-table">
          <thead>
            <tr>
              <th>{copy.columns.ticker}</th>
              <th>{copy.columns.ai}</th>
              <th>{copy.columns.prob}</th>
              <th>{copy.columns.edge}</th>
              <th>{copy.columns.pb}</th>
              <th>{copy.columns.roe}</th>
              <th>{copy.columns.npl}</th>
              <th>{copy.columns.nim}</th>
              <th>{copy.columns.liquidity}</th>
              <th>{copy.columns.tag}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.ticker}
                className={row.ticker === activeTicker ? 'active' : ''}
                onClick={() => onSelectTicker?.(row.ticker)}
              >
                <td>
                  <div className="bank-screener-ticker">
                    <strong>{row.ticker}</strong>
                    <span>{formatPrice(row.currentPrice)}</span>
                  </div>
                </td>
                <td>
                  <span className={`bank-screener-outlook ${row.outlook}`}>
                    {copy.outlook[row.outlook]}
                  </span>
                </td>
                <td>
                  <div className="bank-screener-prob">
                    <strong>{row.outperform != null ? formatPercent(row.outperform * 100, 1) : '--'}</strong>
                    <span className="bank-screener-prob-track">
                      <span
                        className="bank-screener-prob-fill"
                        style={{ width: `${Math.max(4, Math.min(100, (row.outperform ?? 0) * 100))}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className={row.edge > 0 ? 'positive' : row.edge < 0 ? 'negative' : ''}>
                  {row.edge != null ? formatPercent(row.edge * 100, 1) : '--'}
                </td>
                <td>{row.pb.toFixed(2)}</td>
                <td>{formatPercent(row.roe, 1)}</td>
                <td className={row.nplRatio > medians.nplRatio ? 'negative' : 'positive'}>
                  {formatPercent(row.nplRatio, 2)}
                </td>
                <td>{formatPercent(row.nim, 2)}</td>
                <td>{formatVolume(row.avgVolume20)}</td>
                <td>
                  <span className={`bank-screener-tag ${row.tag.tone}`}>{row.tag.label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 && <div className="bank-screener-empty">{copy.empty}</div>}
      </div>
    </section>
  )
}
