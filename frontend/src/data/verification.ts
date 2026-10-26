import REAL_HISTORY_DATA from './real_history.json'
import { STOCKS, STOCK_MAP, type Stock, type Bar } from './market'
import { clamp } from '@/lib/format'
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
  returnPct: number
  predictedValue: number
  predictedReturnPct: number
}

export interface StockDailyStep {
  day: number
  dateStr: string
  price: number
  high: number
  low: number
  changePct: number
  returnFromEntryPct: number
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
  targetPct: number
  stopPct: number
  predictedReturnPct: number
  currentPrice: number
  realizedReturnPct: number
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

  // Summary Metrics
  predictedReturnPct: number
  predictedPnl: number
  realizedReturnPct: number
  realizedPnl: number
  alphaDeviationPct: number
  directionalHit: boolean
  targetHitCount: number
  stopHitCount: number
  winRatePct: number
  maxDrawdownPct: number

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
  entryDateIndex?: number // if omitted, defaults to 245 (23 Oct 2026)
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
    // Default to Oct 23, 2026 if available, else latest - horizon
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
      ? opts.selectedSymbols.map((sym) => STOCK_MAP[sym]).filter(Boolean)
      : STOCKS.filter((s) => s.sector !== 'ETF')

  // Analyze candidates at entry date (NO LOOKAHEAD BIAS)
  const scored = pool.map((s) => {
    const bars = realHistoryMap[s.symbol] || []
    const entryBar = bars[entryIdx]
    const p0 = entryBar ? entryBar.c : s.price

    // Calculate rolling drift and vol from authentic bars up to entryIdx
    const pastBars = bars.slice(Math.max(0, entryIdx - 40), entryIdx + 1)
    let sumRet = 0
    let count = 0
    for (let i = 1; i < pastBars.length; i++) {
      sumRet += pastBars[i].c / pastBars[i - 1].c - 1
      count++
    }
    const rollingDrift = count > 5 ? sumRet / count : s.drift
    const effVol = s.vol * (riskModel === 'gjr' ? 1.02 : riskModel === 'hybrid' ? 0.96 : 1.0)
    const effDv = effVol / Math.sqrt(252)
    const sigmaH = effDv * Math.sqrt(horizon)

    // Expected return over horizon
    let driftMultiplier = 1.0
    if (feature === 'mlp') driftMultiplier += 0.05
    if (returnModel === 'lstm') driftMultiplier += 0.09
    else if (returnModel === 'sarimax') driftMultiplier += 0.03

    const expRet = rollingDrift * driftMultiplier * horizon
    const targetPct = Math.max(0.015, Math.max(expRet, 1.5 * sigmaH))
    const stopPct = Math.max(0.012, 1.85 * sigmaH) // downside tail
    const targetPrice = p0 * (1 + targetPct)
    const stopPrice = p0 * (1 - stopPct)
    const score = expRet / Math.max(0.001, sigmaH)

    return {
      stock: s,
      p0,
      effVol,
      sigmaH,
      expRet,
      targetPct,
      stopPct,
      targetPrice,
      stopPrice,
      score,
      tail: -stopPct,
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
  const rawWeights = selected.map((item) => {
    switch (resolvedStrategy) {
      case 'cvar':
        return Math.max(0.01, item.score / Math.max(0.005, Math.abs(item.tail)))
      case 'trc':
        return 1 / Math.max(0.01, item.effVol)
      case 'mpt':
        return Math.pow(Math.max(0.01, item.score), 2) / Math.max(0.01, item.effVol)
      case 'equal':
      default:
        return 1
    }
  })

  // Normalize and cap weights at 18%
  const MAX_W = 0.18
  const sumRaw = rawWeights.reduce((a, b) => a + b, 0) || 1
  let weights = rawWeights.map((w) => (w / sumRaw) * deploy)
  // Simple cap iteration
  for (let iter = 0; iter < 5; iter++) {
    let excess = 0
    let uncappedSum = 0
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] > MAX_W) {
        excess += weights[i] - MAX_W
        weights[i] = MAX_W
      } else {
        uncappedSum += weights[i]
      }
    }
    if (excess > 0 && uncappedSum > 0) {
      for (let i = 0; i < weights.length; i++) {
        if (weights[i] < MAX_W) {
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
        const changePct = ((close - prevClose) / prevClose) * 100
        const returnFromEntryPct = ((close - item.p0) / item.p0) * 100

        dailySteps.push({
          day: d,
          dateStr: sess.dateStr,
          price: close,
          high,
          low,
          changePct,
          returnFromEntryPct,
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
          changePct: 0,
          returnFromEntryPct: ((finalClose - item.p0) / item.p0) * 100,
          isSettled: false,
        })
      }
    }

    const realizedReturnPct = ((finalClose - item.p0) / item.p0) * 100
    const realizedPnl = shares * (finalClose - item.p0)

    let status: AssetOutcome = 'IN_PROGRESS'
    if (hitTarget) {
      status = 'TARGET_HIT'
    } else if (hitStop) {
      status = 'STOP_BREACHED'
    } else if (isFullySettled) {
      if (realizedReturnPct > 0.05) status = 'PROFIT'
      else if (realizedReturnPct < -0.05) status = 'LOSS'
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
      targetPct: item.targetPct * 100,
      stopPct: item.stopPct * 100,
      predictedReturnPct: item.expRet * 100,
      currentPrice: finalClose,
      realizedReturnPct,
      realizedPnl,
      dailySteps,
      status,
      hitTarget,
      hitStop,
    }
  })

  const cashReserve = capital - totalInvestedStock

  // Total Portfolio Expected Return (weighted sum)
  const predictedReturnPct =
    rows.reduce((sum, r) => sum + (r.invested / capital) * r.predictedReturnPct, 0) +
    (cashReserve / capital) * (0.065 * (horizon / 252) * 100) // cash earn ~6.5% p.a.
  const predictedPnl = capital * (predictedReturnPct / 100)

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
    returnPct: 0,
    predictedValue: capital,
    predictedReturnPct: 0,
  })

  let maxDrawdownPct = 0

  for (let d = 1; d <= horizon; d++) {
    const fIdx = entryIdx + d
    const predValueDay = capital * (1 + (predictedReturnPct / 100) * (d / horizon))
    const predRetDay = predictedReturnPct * (d / horizon)

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
      const returnPct = (pnl / capital) * 100

      const dd = ((capital - totalVal) / capital) * 100
      if (dd > maxDrawdownPct) maxDrawdownPct = dd

      timeline.push({
        day: d,
        dateStr: sess.dateStr,
        displayDate: sess.displayDate,
        isSettled: true,
        isToday: fIdx === totalSessions - 1,
        portfolioValue: totalVal,
        pnl,
        returnPct,
        predictedValue: predValueDay,
        predictedReturnPct: predRetDay,
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
        returnPct: lastSettled.returnPct,
        predictedValue: predValueDay,
        predictedReturnPct: predRetDay,
      })
    }
  }

  // Final summary statistics
  const latestStep = timeline[settledDays] || timeline[0]
  const realizedReturnPct = latestStep.returnPct
  const realizedPnl = latestStep.pnl
  const alphaDeviationPct = realizedReturnPct - predictedReturnPct

  const directionalHit =
    (predictedReturnPct >= 0 && realizedReturnPct >= 0) ||
    (predictedReturnPct < 0 && realizedReturnPct < 0)

  const targetHitCount = rows.filter((r) => r.hitTarget).length
  const stopHitCount = rows.filter((r) => r.hitStop).length
  const winRatePct = rows.length > 0 ? (rows.filter((r) => r.realizedReturnPct > 0).length / rows.length) * 100 : 0

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

    predictedReturnPct,
    predictedPnl,
    realizedReturnPct,
    realizedPnl,
    alphaDeviationPct,
    directionalHit,
    targetHitCount,
    stopHitCount,
    winRatePct,
    maxDrawdownPct,

    totalDays: horizon,
    settledDays,
    isFullySettled,

    investedStockCapital: totalInvestedStock,
    cashReserve,
    rows,
    timeline,
  }
}
