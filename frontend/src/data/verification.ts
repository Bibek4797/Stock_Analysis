import REAL_HISTORY_DATA from './real_history.json'
import { STOCKS, STOCK_MAP, forecast, type Stock, type Bar } from './market'
import type { Strategy } from './portfolio'
import type { FeatureSet, ReturnModelSel, RiskModelSel } from './validation'

export interface HistoricalSession {
  index: number
  dateStr: string // YYYY-MM-DD
  displayDate: string // e.g. "23 Oct 2026, Fri"
  dayOfWeek: string
  settledForwardDays: number // how many trading days exist after this date
}

export interface DayStep {
  day: number // 0 for entry, 1..H
  dateStr: string
  displayDate: string
  isSettled: boolean
  isToday: boolean
  portfolioValue: number
  pnl: number
  returnRate: number // fraction: -0.0118 for -1.18%
  predictedValue: number
  predictedReturnRate: number // fraction: 0.0185 for +1.85%
}

export interface StockDailyStep {
  day: number
  dateStr: string
  price: number
  high: number
  low: number
  changeRate: number // fraction
  returnFromEntryRate: number // fraction
  isSettled: boolean
}

export type AssetOutcome = 'TARGET_HIT' | 'STOP_BREACHED' | 'PROFIT' | 'LOSS' | 'IN_PROGRESS'

export interface AssetVerificationRow {
  symbol: string
  name: string
  sector: string
  weight: number
  shares: number
  invested: number
  entryPrice: number
  targetPrice: number
  stopPrice: number
  targetPct: number // fraction
  stopPct: number // fraction
  predictedReturnRate: number // fraction
  currentPrice: number
  realizedReturnRate: number // fraction
  realizedPnl: number
  dailySteps: StockDailyStep[]
  status: AssetOutcome
  hitTarget: boolean
  hitStop: boolean
}

export interface VerificationReport {
  entryDateStr: string
  entryDisplayDate: string
  horizon: number
  capital: number
  strategy: Strategy | 'auto'
  resolvedStrategy: Strategy
  feature: FeatureSet
  returnModel: ReturnModelSel
  riskModel: RiskModelSel

  // Summary Metrics (as fractions for pct() formatting)
  predictedReturnRate: number // e.g. 0.0185 -> "+1.85%"
  predictedPnl: number
  realizedReturnRate: number // e.g. -0.0118 -> "-1.18%"
  realizedPnl: number
  alphaDeviationRate: number // realizedReturnRate - predictedReturnRate (e.g. -0.0303 -> "-3.03%")
  directionalHit: boolean
  targetHitCount: number
  stopHitCount: number
  winRatePct: number // percentage 0..100
  maxDrawdownRate: number // fraction

  // Status
  totalDays: number
  settledDays: number
  isFullySettled: boolean

  // Basket allocations
  investedStockCapital: number
  cashReserve: number
  rows: AssetVerificationRow[]

  // Day-by-Day timeline
  timeline: DayStep[]
}

const realHistoryMap = REAL_HISTORY_DATA as Record<string, Bar[]>

// Format timestamp into IST (UTC+5:30) date parts
function formatISTDate(ts: number): { dateStr: string; displayDate: string; dayOfWeek: string } {
  const d = new Date(ts + 5.5 * 3600 * 1000)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const dateStr = `${yyyy}-${mm}-${dd}`

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayOfWeek = days[d.getUTCDay()]
  const displayDate = `${dd} ${months[d.getUTCMonth()]} ${yyyy}, ${dayOfWeek}`

  return { dateStr, displayDate, dayOfWeek }
}

// 1. Get all available historical sessions with metadata
export function getHistoricalSessions(): HistoricalSession[] {
  const refSymbol = 'RELIANCE'
  const bars = realHistoryMap[refSymbol] || []
  const total = bars.length

  const sessions: HistoricalSession[] = []
  for (let i = 0; i < total; i++) {
    const { dateStr, displayDate, dayOfWeek } = formatISTDate(bars[i].t)
    sessions.push({
      index: i,
      dateStr,
      displayDate,
      dayOfWeek,
      settledForwardDays: total - 1 - i,
    })
  }

  return sessions
}

export interface RunVerificationOptions {
  entryDateIndex?: number
  horizon: number // 3, 5, 7, 10
  capital: number
  strategy?: Strategy | 'auto'
  selectedSymbols?: string[] | null
  feature?: FeatureSet
  returnModel?: ReturnModelSel
  riskModel?: RiskModelSel
  livePrices?: Record<string, number>
}

// 2. Run Comprehensive Model Backtest / Forward Reality Check
export function runModelVerification(opts: RunVerificationOptions): VerificationReport {
  const sessions = getHistoricalSessions()
  const totalSessions = sessions.length
  const horizon = opts.horizon || 3
  const capital = opts.capital || 1000000
  const stratMode = opts.strategy || 'auto'
  const feature = opts.feature || 'mlp'
  const returnModel = opts.returnModel || 'auto'
  const riskModel = opts.riskModel || 'auto'

  // Default entry session to 23 Oct 2026 (index 245) or latest valid index
  let entryIdx = opts.entryDateIndex
  if (entryIdx === undefined || entryIdx < 0 || entryIdx >= totalSessions) {
    const oct23 = sessions.find((s) => s.dateStr === '2026-10-23')
    entryIdx = oct23 ? oct23.index : Math.max(0, totalSessions - horizon - 1)
  }

  const entrySession = sessions[entryIdx]
  const availableForward = totalSessions - 1 - entryIdx
  const settledDays = Math.min(horizon, availableForward)
  const isFullySettled = settledDays === horizon

  // Strategy resolution
  const resolvedStrategy: Strategy =
    stratMode === 'auto'
      ? entrySession.dayOfWeek === 'Mon' || entrySession.dayOfWeek === 'Wed'
        ? 'cvar'
        : 'trc'
      : stratMode

  // Candidate symbols: custom selection or top quality universe
  const pool =
    opts.selectedSymbols && opts.selectedSymbols.length > 0
      ? opts.selectedSymbols
          .map((sym) => {
            const clean = sym.replace('.NS', '')
            return STOCK_MAP[clean] || STOCKS.find((s) => s.symbol === clean)
          })
          .filter(Boolean) as Stock[]
      : STOCKS.filter((s) => s.sector !== 'ETF')

  // Generate authentic quant predictions at entry date (NO LOOKAHEAD BIAS)
  // Calls the exact quantitative econometric forecast engine (MLP / SARIMAX / GJR-GARCH)
  const scored = pool.map((s) => {
    const bars = realHistoryMap[s.symbol] || []
    const entryBar = bars[entryIdx]
    const p0 = entryBar ? entryBar.c : s.price

    // Unified model forecast on the selected entry date
    const fc = forecast(s, p0, horizon, {
      feature,
      returnModel,
      riskModel,
    })

    const targetPct = (fc.target - p0) / p0
    const stopPct = (p0 - fc.stop) / p0

    return {
      stock: s,
      p0,
      effVol: fc.annVol,
      sigmaH: fc.sigmaH,
      expRet: fc.expRet, // e.g. 0.0185 (+1.85%)
      targetPct, // fraction
      stopPct, // fraction
      targetPrice: fc.target,
      stopPrice: fc.stop,
      score: fc.score,
      tail: fc.tail,
    }
  })

  // Pick candidate stocks according to the strategy's core selection philosophy
  let selected = scored
  if (!opts.selectedSymbols || opts.selectedSymbols.length === 0) {
    if (resolvedStrategy === 'trc') {
      // Ray Dalio All-Weather Risk Parity: 1 top quality stock per sector, sorted by lowest vol
      const bySector = new Map<string, (typeof scored)[0]>()
      const sortedByLowVol = [...scored].sort((a, b) => a.effVol - b.effVol)
      for (const item of sortedByLowVol) {
        if (!bySector.has(item.stock.sector)) {
          bySector.set(item.stock.sector, item)
        }
      }
      selected = Array.from(bySector.values()).slice(0, 8)
    } else if (resolvedStrategy === 'mpt') {
      // Markowitz MPT: Maximize Sharpe Ratio (score / effVol)
      selected = [...scored]
        .sort((a, b) => (b.score / Math.max(0.01, b.effVol)) - (a.score / Math.max(0.01, a.effVol)))
        .slice(0, 8)
    } else if (resolvedStrategy === 'equal') {
      // Equal Weight: Top largecap core names
      selected = [...scored]
        .filter((x) => ['Bank', 'IT', 'Energy', 'Auto', 'FMCG'].includes(x.stock.sector))
        .sort((a, b) => b.p0 - a.p0)
        .slice(0, 8)
    } else {
      // Rockafellar CVaR: Maximize tail return over downside expected shortfall
      selected = [...scored]
        .filter((x) => x.score > 0.1 || ['Bank', 'IT', 'Energy'].includes(x.stock.sector))
        .sort((a, b) => (b.score / Math.max(0.005, Math.abs(b.tail))) - (a.score / Math.max(0.005, Math.abs(a.tail))))
        .slice(0, 8)
    }
  }

  if (selected.length === 0) {
    selected = scored.slice(0, 5)
  }

  // Calculate Strategy Weights
  const deploy = 0.85
  let maxWeightCap = 0.20
  let rawWeights: number[] = []

  switch (resolvedStrategy) {
    case 'cvar': {
      maxWeightCap = 0.22
      rawWeights = selected.map((item) =>
        Math.pow(Math.max(0.01, item.score) / Math.max(0.005, Math.abs(item.tail)), 1.5)
      )
      break
    }
    case 'trc': {
      maxWeightCap = 0.18
      rawWeights = selected.map((item) => 1 / Math.max(0.02, item.effVol))
      break
    }
    case 'mpt': {
      maxWeightCap = 0.28
      rawWeights = selected.map((item) => {
        const sharpe = Math.max(0.05, item.expRet) / Math.max(0.02, item.effVol)
        return Math.pow(sharpe, 2.2)
      })
      break
    }
    case 'equal':
    default: {
      maxWeightCap = 1.0
      rawWeights = selected.map(() => 1)
      break
    }
  }

  const sumRaw = rawWeights.reduce((a, b) => a + b, 0) || 1
  let weights = rawWeights.map((w) => (w / sumRaw) * deploy)
  for (let iter = 0; iter < 5; iter++) {
    let excess = 0
    let uncappedSum = 0
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] > maxWeightCap) {
        excess += weights[i] - maxWeightCap
        weights[i] = maxWeightCap
      } else {
        uncappedSum += weights[i]
      }
    }
    if (excess > 0 && uncappedSum > 0) {
      for (let i = 0; i < weights.length; i++) {
        if (weights[i] < maxWeightCap) {
          weights[i] += (weights[i] / uncappedSum) * excess
        }
      }
    }
  }

  // Whole Share Allocation
  let totalInvestedStock = 0
  const rows: AssetVerificationRow[] = selected.map((item, idx) => {
    const w = weights[idx]
    const alloc = w * capital
    const shares = Math.floor(alloc / item.p0)
    const invested = shares * item.p0
    totalInvestedStock += invested

    const bars = realHistoryMap[item.stock.symbol] || []

    // Forward day tracking
    const dailySteps: StockDailyStep[] = []
    let maxHigh = item.p0
    let minLow = item.p0
    let finalClose = item.p0
    let hitTarget = false
    let hitStop = false

    for (let d = 1; d <= horizon; d++) {
      const fIdx = entryIdx + d
      if (fIdx < totalSessions) {
        const bar = bars[fIdx]
        const sess = sessions[fIdx]
        const close = bar ? bar.c : item.p0
        const high = bar ? bar.h : close
        const low = bar ? bar.l : close
        if (high > maxHigh) maxHigh = high
        if (low < minLow) minLow = low
        if (high >= item.targetPrice) hitTarget = true
        if (low <= item.stopPrice) hitStop = true

        finalClose = close
        const prevBar = bars[fIdx - 1]
        const prevClose = prevBar ? prevBar.c : item.p0
        const changeRate = (close - prevClose) / prevClose
        const returnFromEntryRate = (close - item.p0) / item.p0

        dailySteps.push({
          day: d,
          dateStr: sess.dateStr,
          price: close,
          high,
          low,
          changeRate,
          returnFromEntryRate,
          isSettled: true,
        })
      } else {
        // Pending future session
        dailySteps.push({
          day: d,
          dateStr: `Day +${d}`,
          price: finalClose,
          high: finalClose,
          low: finalClose,
          changeRate: 0,
          returnFromEntryRate: (finalClose - item.p0) / item.p0,
          isSettled: false,
        })
      }
    }

    const realizedReturnRate = (finalClose - item.p0) / item.p0
    const realizedPnl = shares * (finalClose - item.p0)

    let status: AssetOutcome = 'IN_PROGRESS'
    if (hitTarget) {
      status = 'TARGET_HIT'
    } else if (hitStop) {
      status = 'STOP_BREACHED'
    } else if (isFullySettled) {
      if (realizedReturnRate > 0.0005) status = 'PROFIT'
      else if (realizedReturnRate < -0.0005) status = 'LOSS'
      else status = 'IN_PROGRESS'
    } else {
      status = 'IN_PROGRESS'
    }

    return {
      symbol: item.stock.symbol,
      name: item.stock.name,
      sector: item.stock.sectorLabel,
      weight: w,
      shares,
      invested,
      entryPrice: item.p0,
      targetPrice: item.targetPrice,
      stopPrice: item.stopPrice,
      targetPct: item.targetPct,
      stopPct: item.stopPct,
      predictedReturnRate: item.expRet,
      currentPrice: finalClose,
      realizedReturnRate,
      realizedPnl,
      dailySteps,
      status,
      hitTarget,
      hitStop,
    }
  })

  const cashReserve = capital - totalInvestedStock

  // Total Portfolio Expected Return (weighted sum fraction)
  const predictedReturnRate =
    rows.reduce((sum, r) => sum + (r.invested / capital) * r.predictedReturnRate, 0) +
    (cashReserve / capital) * (0.065 * (horizon / 252)) // cash yield ~6.5% p.a.
  const predictedPnl = capital * predictedReturnRate

  // Construct Day-by-Day Portfolio Timeline (Day 0 to Day H)
  const timeline: DayStep[] = []
  // Day 0: Entry Session
  timeline.push({
    day: 0,
    dateStr: entrySession.dateStr,
    displayDate: entrySession.displayDate,
    isSettled: true,
    isToday: entryIdx === totalSessions - 1,
    portfolioValue: capital,
    pnl: 0,
    returnRate: 0,
    predictedValue: capital,
    predictedReturnRate: 0,
  })

  let maxDrawdownRate = 0

  // Authentic daily compounding expected return trajectory (Martingale conditional expectation)
  const dailyCompoundingRate = Math.pow(Math.max(0.0001, 1 + predictedReturnRate), 1 / horizon) - 1

  for (let d = 1; d <= horizon; d++) {
    const fIdx = entryIdx + d
    const predRetDay = Math.pow(1 + dailyCompoundingRate, d) - 1
    const predValueDay = capital * (1 + predRetDay)

    if (fIdx < totalSessions) {
      const sess = sessions[fIdx]
      // Sum equity values across all stocks
      let stockVal = 0
      for (const row of rows) {
        const step = row.dailySteps[d - 1]
        stockVal += row.shares * (step ? step.price : row.entryPrice)
      }
      const totalVal = stockVal + cashReserve
      const pnl = totalVal - capital
      const returnRate = pnl / capital

      const dd = (capital - totalVal) / capital
      if (dd > maxDrawdownRate) maxDrawdownRate = dd

      timeline.push({
        day: d,
        dateStr: sess.dateStr,
        displayDate: sess.displayDate,
        isSettled: true,
        isToday: fIdx === totalSessions - 1,
        portfolioValue: totalVal,
        pnl,
        returnRate,
        predictedValue: predValueDay,
        predictedReturnRate: predRetDay,
      })
    } else {
      // Future pending session
      const lastSettled = timeline[timeline.length - 1]
      timeline.push({
        day: d,
        dateStr: `Day +${d}`,
        displayDate: `Session +${d} (Pending)`,
        isSettled: false,
        isToday: false,
        portfolioValue: lastSettled.portfolioValue,
        pnl: lastSettled.pnl,
        returnRate: lastSettled.returnRate,
        predictedValue: predValueDay,
        predictedReturnRate: predRetDay,
      })
    }
  }

  // Final summary statistics
  const latestStep = timeline[settledDays] || timeline[0]
  const realizedReturnRate = latestStep.returnRate
  const realizedPnl = latestStep.pnl
  const alphaDeviationRate = realizedReturnRate - predictedReturnRate

  const directionalHit =
    (predictedReturnRate >= 0 && realizedReturnRate >= 0) ||
    (predictedReturnRate < 0 && realizedReturnRate < 0)

  const targetHitCount = rows.filter((r) => r.hitTarget).length
  const stopHitCount = rows.filter((r) => r.hitStop).length
  const winRatePct = rows.length > 0 ? (rows.filter((r) => r.realizedReturnRate > 0).length / rows.length) * 100 : 0

  return {
    entryDateStr: entrySession.dateStr,
    entryDisplayDate: entrySession.displayDate,
    horizon,
    capital,
    strategy: stratMode,
    resolvedStrategy,
    feature,
    returnModel,
    riskModel,

    predictedReturnRate,
    predictedPnl,
    realizedReturnRate,
    realizedPnl,
    alphaDeviationRate,
    directionalHit,
    targetHitCount,
    stopHitCount,
    winRatePct,
    maxDrawdownRate,

    totalDays: horizon,
    settledDays,
    isFullySettled,

    investedStockCapital: totalInvestedStock,
    cashReserve,
    rows,
    timeline,
  }
}
