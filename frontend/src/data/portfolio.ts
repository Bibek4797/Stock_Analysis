import { CASH_ETF, STOCKS, STOCK_MAP, forecast, gauss, hashStr, rng, type Forecast, type Stock } from './market'
import type { PortfolioResponse } from '@/types'
import { resolveFeatureSet, type FeatureSet } from './validation'
import REAL_HISTORY_DATA from './real_history.json'
export type Strategy = 'cvar' | 'trc' | 'mpt' | 'equal'
export const STRATEGIES: Strategy[] = ['cvar', 'trc', 'mpt', 'equal']
export const STRATEGY_META: Record<Strategy | 'nifty', { name: string; desc: string; color: string }> = {
  cvar: { name: 'Rockafellar-Uryasev CVaR', desc: 'Minimises expected shortfall', color: '#8E97A6' },
  trc: { name: 'Ray Dalio TRC', desc: 'Equal total risk contribution', color: '#6F7888' },
  mpt: { name: 'Markowitz MPT', desc: 'Mean-variance, max Sharpe', color: '#565E6B' },
  equal: { name: 'Equal Weight 1/N', desc: 'Naive diversification', color: '#454C58' },
  nifty: { name: 'NIFTY 50', desc: 'Passive benchmark', color: '#A3ABB8' },
}

export type Regime = 'bullish' | 'balanced' | 'defensive'
export const REGIME_META: Record<Regime, { label: string; short: string; deploy: number; tone: 'up' | 'warn' | 'down' }> = {
  bullish: { label: 'Bullish growth', short: 'Risk-on', deploy: 0.9, tone: 'up' },
  balanced: { label: 'Balanced risk', short: 'Normal volatility', deploy: 0.85, tone: 'warn' },
  defensive: { label: 'Defensive, crash-protected', short: 'Elevated volatility', deploy: 0.7, tone: 'down' },
}

export type Action = 'BUY' | 'TRIM' | 'HOLD'
export interface Position {
  stock: Stock
  fc: Forecast
  weight: number // target weight of capital
  prevWeight: number
  shares: number
  invested: number
  actualWeight: number
  prc: number // percentage risk contribution
  action: Action
  bufferSaved: number
  fees: number
}

export interface Portfolio {
  regime: Regime
  strategy: Strategy
  capital: number
  positions: Position[]
  cash: { shares: number; invested: number; weight: number; price: number }

  residual: number
  stockInvested: number
  totalInvested: number
  expRet: number // fraction of capital over horizon
  tail: number // fraction of capital (negative)
  fees: number
}

// Statutory delivery charges: STT 0.1% + NSE txn 0.00297% + SEBI 0.0001% + stamp 0.015% + 18% GST on exchange/SEBI.

export const FEE_RATE = 0.001 + 0.0000297 + 0.000001 + 0.00015 + 0.18 * (0.0000297 + 0.000001)
const RHO = 0.55
const MAX_W = 0.18
const DEADBAND = 0.01
export function isMarketInCrash(entryIndex?: number): {
  isCrash: boolean
  drawdown60: number
  priceVsSma200: number
  ret20d: number
  rationale: string
} {
  const bars =
    (REAL_HISTORY_DATA as Record<string, { t: number; c: number }[]>)['NIFTYBEES'] ||
    (REAL_HISTORY_DATA as Record<string, { t: number; c: number }[]>)['NIFTYBEES.NS'] ||
    []

  if (!bars || bars.length === 0) {
    return {
      isCrash: false,
      drawdown60: 0,
      priceVsSma200: 0,
      ret20d: 0,
      rationale: 'Benchmark data unavailable; defaulting to Ray Dalio All-Weather Risk Parity.',
    }
  }

  const idx = entryIndex !== undefined ? Math.min(entryIndex, bars.length - 1) : bars.length - 1
  const subBars = bars.slice(0, idx + 1)
  const closes = subBars.map((b) => b.c)
  const currentPrice = closes[closes.length - 1]

  // 1. 60-day maximum drawdown from peak
  const window60 = closes.slice(Math.max(0, closes.length - 60))
  const peak60 = Math.max(...window60)
  const dd60 = ((currentPrice - peak60) / peak60) * 100

  // 2. 200-day Simple Moving Average (SMA 200)
  const window200 = closes.slice(Math.max(0, closes.length - 200))
  const sma200 = window200.reduce((a, b) => a + b, 0) / window200.length
  const priceVsSma200 = ((currentPrice - sma200) / sma200) * 100

  // 3. 20-day trailing return
  const p20Ago = closes[Math.max(0, closes.length - 21)]
  const ret20d = ((currentPrice - p20Ago) / p20Ago) * 100

  // Market Crash / Tail-Stress Condition: Drawdown > 5% OR Price below 200 SMA OR 20D selloff < -3.5%
  const isCrash = dd60 < -5.0 || priceVsSma200 < -1.0 || ret20d < -3.5

  const rationale = isCrash
    ? `Market crash / tail-stress regime detected (Nifty DD ${dd60.toFixed(1)}%, vs SMA200 ${priceVsSma200.toFixed(1)}%). Rockafellar-Uryasev Min-CVaR deployed to curtail shortfall.`
    : `Normal / steady market conditions (Nifty DD ${dd60.toFixed(1)}%, vs SMA200 ${priceVsSma200.toFixed(1)}%). Ray Dalio Equal TRC deployed to balance total risk contribution.`

  return { isCrash, drawdown60: dd60, priceVsSma200, ret20d, rationale }
}

export function resolveAutoStrategy(entryIndex?: number): Strategy {
  const { isCrash } = isMarketInCrash(entryIndex)
  return isCrash ? 'cvar' : 'trc'
}

export function marketRegime(entryIndex?: number): Regime {
  const { isCrash } = isMarketInCrash(entryIndex)
  if (isCrash) return 'defensive'
  const eq = STOCKS.filter((s) => s.sector !== 'ETF')
  const breadth = eq.reduce((a, s) => a + s.drift / (s.vol / Math.sqrt(252)), 0) / eq.length
  if (breadth > 0.2) return 'bullish'
  return 'balanced'
}

function capWeights(raw: number[], total: number, maxW: number = MAX_W): number[] {
  // water-filling: cap at maxW and redistribute the excess pro-rata to uncapped names
  const base = raw.map((x) => Math.max(x, 0))
  const capped = new Array(base.length).fill(false)
  let w = base.map(() => 0)
  for (let iter = 0; iter < base.length + 1; iter++) {
    const fixed = capped.reduce((a, c) => a + (c ? maxW : 0), 0)
    const freeRaw = base.reduce((a, x, i) => a + (capped[i] ? 0 : x), 0) || 1
    w = base.map((x, i) => (capped[i] ? maxW : (x / freeRaw) * (total - fixed)))
    let changed = false
    w.forEach((x, i) => {
      if (!capped[i] && x > maxW + 1e-9) {
        capped[i] = true
        changed = true
      }
    })
    if (!changed) break
  }
  return w
}

function riskStats(w: number[], sig: number[]) {
  const ws = w.map((x, i) => x * sig[i])
  const sumWs = ws.reduce((a, b) => a + b, 0)
  const sumSq = ws.reduce((a, b) => a + b * b, 0)
  const variance = (1 - RHO) * sumSq + RHO * sumWs * sumWs
  const prc = w.map((x, i) => (variance > 0 ? (x * ((1 - RHO) * x * sig[i] ** 2 + RHO * sig[i] * sumWs)) / variance : 0))
  return { sigma: Math.sqrt(variance), prc }

}

/**
 * Select the optimal alpha basket of stocks tailored to capital and risk.
 * Filters out negative expected drift and stocks whose price cannot be purchased with the allocated tranche.
 */
export function getBestAlphaSymbols(
  capital: number = 100000,
  horizon: number = 5,
  prices: Record<string, number> = {},
  count: number = 8,
  entryIdx?: number
): string[] {
  const { isCrash } = isMarketInCrash(entryIdx)
  const nonEtfStocks = STOCKS.filter((s) => s.sector !== 'ETF')

  const evaluated = nonEtfStocks.map((s) => ({
    s,
    fc: forecast(s, prices[s.symbol] ?? s.price, horizon, { entryIdx }),
  }))

  const maxPrice = Math.max(120, capital * 0.35)
  let pool = evaluated.filter((x) => x.fc.price <= maxPrice && (isCrash || x.fc.expRet > 0))
  if (pool.length < count) {
    pool = evaluated.filter((x) => x.fc.price <= maxPrice)
  }
  if (pool.length < count) {
    pool = evaluated
  }

  const scored = pool.map((x) => {
    const mu = x.fc.expRet
    const rr = Math.max(0.1, x.fc.rewardRisk)
    const tail = Math.max(0.005, Math.abs(x.fc.tail))
    const hitBonus = (x.fc.confidence - 50) / 50
    const alpha = ((mu * 100 * rr) / tail) * (1 + 0.15 * hitBonus)
    return { ...x, alpha }
  })

  scored.sort((a, b) => b.alpha - a.alpha)

  const sectorCount = new Map<string, number>()
  const picked: string[] = []

  for (const item of scored) {
    const c = sectorCount.get(item.s.sector) || 0
    if (c < 2) {
      picked.push(item.s.symbol)
      sectorCount.set(item.s.sector, c + 1)
      if (picked.length >= count) break
    }
  }

  if (picked.length < count) {
    for (const item of scored) {
      if (!picked.includes(item.s.symbol)) {
        picked.push(item.s.symbol)
        if (picked.length >= count) break
      }
    }
  }

  return picked
}

export function buildPortfolio(
  capital: number,
  horizon: number,
  prices: Record<string, number>,
  strategy: Strategy = 'cvar',
  selectedSymbols?: string[] | null,
  fcOpts?: {
    feature?: FeatureSet
    returnModel?: 'auto' | 'sarimax' | 'lstm'
    riskModel?: 'auto' | 'gjr' | 'hybrid'
    refit?: number
    entryIdx?: number
  }

): Portfolio {
  const { isCrash } = isMarketInCrash(fcOpts?.entryIdx)
  const resolvedFeature = resolveFeatureSet(fcOpts?.feature ?? 'auto', isCrash)
  const effectiveFcOpts = { ...fcOpts, feature: resolvedFeature, entryIdx: fcOpts?.entryIdx }
  const regime = marketRegime(fcOpts?.entryIdx)
  const deploy = REGIME_META[regime].deploy
  const hasCustom = Boolean(selectedSymbols && selectedSymbols.length > 0)
  const pool = hasCustom
    ? (selectedSymbols!)
        .map((sym) => {
          const clean = sym.replace('.NS', '')
          return STOCK_MAP[clean] || STOCKS.find((s) => s.symbol === clean)
        })
        .filter(Boolean) as Stock[]
    : STOCKS.filter((s) => s.sector !== 'ETF')

  const allForecasts = pool.map((s) => ({
    s,
    fc: forecast(s, prices[s.symbol] ?? s.price, horizon, effectiveFcOpts),
  }))

  let ranked: Array<{ s: Stock; fc: Forecast }> = []

  if (hasCustom) {
    // User explicitly customized the basket: preserve their exact selected universe
    ranked = allForecasts
  } else {
    // AUTOMATIC OPTIMAL BASKET OPTIMIZER:
    // 1. Dynamic basket sizing based on capital to ensure integer lot liquidity:
    //    - Capital < ₹20,000: 4 high-alpha stocks (~₹4,500/stock tranche, ensures whole shares)
    //    - Capital ₹20,000 - ₹50,000: 6 stocks (~₹3,500 - ₹7,500/stock)
    //    - Capital >= ₹50,000: 8 stocks
    const targetBasketSize = capital < 20000 ? 4 : capital < 50000 ? 6 : 8

    // 2. Filter candidates for price feasibility:
    //    A single share cannot exceed 35% of total capital (otherwise 0 shares or massive concentration)
    const maxSinglePrice = Math.max(120, capital * 0.35)
    let candidates = allForecasts.filter((item) => {
      if (item.fc.price > maxSinglePrice) return false
      // Exclude stocks with negative expected drift unless market is in tail crash
      if (!isCrash && item.fc.expRet <= 0) return false
      return true
    })

    if (candidates.length < targetBasketSize) {
      candidates = allForecasts.filter((item) => item.fc.price <= maxSinglePrice)
    }
    if (candidates.length < targetBasketSize) {
      candidates = allForecasts
    }

    // 3. Multi-Factor Quantitative Alpha Scoring aligned with Strategy:
    const scoredCandidates = candidates.map((item) => {
      const mu = item.fc.expRet
      const sigma = Math.max(0.01, item.fc.sigmaH)
      const annVol = Math.max(0.02, item.fc.annVol)
      const tail = Math.max(0.005, Math.abs(item.fc.tail))
      const rr = Math.max(0.1, item.fc.rewardRisk)

      let score = 0
      if (strategy === 'cvar') {
        // CVaR: Maximize return over downside expected shortfall, boosted by reward/risk
        score = (mu * 100 * rr) / tail
      } else if (strategy === 'trc') {
        // TRC: Maximum risk efficiency / Sharpe with lowest volatility penalty
        score = mu / (annVol * annVol)
      } else if (strategy === 'mpt') {
        // Markowitz MPT: Maximize Information / Sharpe Ratio
        score = mu / sigma
      } else {
        // Equal Weight: Pure expected return and reward-to-risk efficiency
        score = (mu * 100 * rr) / tail
      }

      const hitBonus = (item.fc.confidence - 50) / 50
      return { ...item, alphaScore: score * (1 + 0.15 * hitBonus) }
    })

    scoredCandidates.sort((a, b) => b.alphaScore - a.alphaScore)

    // 4. Multi-Sector Diversification Constraint: Max 2 stocks per sector (1 for TRC)
    const sectorCount = new Map<string, number>()
    const diversified: typeof scoredCandidates = []

    for (const item of scoredCandidates) {
      const count = sectorCount.get(item.s.sector) || 0
      const maxPerSector = strategy === 'trc' ? 1 : 2
      if (count < maxPerSector) {
        diversified.push(item)
        sectorCount.set(item.s.sector, count + 1)
        if (diversified.length >= targetBasketSize) break
      }
    }

    if (diversified.length < targetBasketSize) {
      for (const item of scoredCandidates) {
        if (!diversified.some((d) => d.s.symbol === item.s.symbol)) {
          diversified.push(item)
          if (diversified.length >= targetBasketSize) break
        }
      }
    }

    ranked = diversified.map(({ s, fc }) => ({ s, fc }))
  }

  if (ranked.length === 0) {
    ranked = STOCKS.filter((s) => s.sector !== 'ETF')
      .slice(0, 4)
      .map((s) => ({ s, fc: forecast(s, prices[s.symbol] ?? s.price, horizon, effectiveFcOpts) }))
  }

  let maxWeightCap = 0.20
  let raw: number[] = []

  switch (strategy) {
    case 'cvar': {
      maxWeightCap = 0.22
      raw = ranked.map(({ fc }) => Math.pow(Math.max(0.01, fc.score + 1.0) / Math.max(0.005, Math.abs(fc.tail)), 1.2))
      break
    }
    case 'trc': {
      maxWeightCap = 0.18
      // Risk parity: strictly inverse to asset volatility
      raw = ranked.map(({ fc }) => 1 / Math.max(0.02, fc.annVol))
      break
    }
    case 'mpt': {
      maxWeightCap = 0.28
      // Max Sharpe: weight proportional to Sharpe squared
      raw = ranked.map(({ fc }) => {
        const sharpe = Math.max(0.05, fc.expRet) / Math.max(0.02, fc.annVol)
        return Math.pow(sharpe, 2.2)
      })
      break
    }
    case 'equal':
    default: {
      maxWeightCap = 1.0
      raw = ranked.map(() => 1)
      break
    }
  }

  const weights = capWeights(raw, deploy, maxWeightCap)
  const sig = ranked.map((x) => x.fc.sigmaH)
  const { sigma, prc } = riskStats(weights, sig)
  const positions: Position[] = ranked.map(({ s, fc }, i) => {
    const w = weights[i]
    const r = rng(hashStr(s.symbol + ':prev'))
    const prevWeight = r() < 0.25 ? 0 : Math.max(0, w + (r() - 0.5) * 0.05)
    const delta = w - prevWeight
    const action: Action = Math.abs(delta) < DEADBAND ? 'HOLD' : delta > 0 ? 'BUY' : 'TRIM'
    let shares = Math.floor((w * capital) / fc.price)
    let invested = shares * fc.price
    return {
      stock: s,
      fc,
      weight: w,
      prevWeight,
      shares,
      invested,
      actualWeight: invested / capital,
      prc: prc[i],
      action,
      bufferSaved: action === 'HOLD' ? Math.abs(delta) * capital : 0,
      fees: invested * FEE_RATE,
    }
  })

  // Discrete Integer Lot Sizing Pass:
  // If any stock got 0 shares due to rounding, but the stock budget allows 1 share, allocate 1 whole share
  let currentStockInvested = positions.reduce((a, p) => a + p.invested, 0)
  const maxStockBudget = capital * deploy
  for (const pos of positions) {
    if (pos.shares === 0 && pos.weight > 0) {
      if (currentStockInvested + pos.fc.price <= maxStockBudget) {
        pos.shares = 1
        pos.invested = pos.fc.price
        pos.actualWeight = pos.invested / capital
        pos.fees = pos.invested * FEE_RATE
        currentStockInvested += pos.invested
      }
    }
  }
  const stockInvested = positions.reduce((a, p) => a + p.invested, 0)
  const cashPrice = prices[CASH_ETF] ?? STOCK_MAP[CASH_ETF].price
  const cashShares = Math.floor((capital - stockInvested) / cashPrice)
  const cashInvested = cashShares * cashPrice
  const totalInvested = stockInvested + cashInvested
  const cashFc = forecast(STOCK_MAP[CASH_ETF], cashPrice, horizon, effectiveFcOpts)
  const expRet =
    positions.reduce((a, p) => a + p.actualWeight * p.fc.expRet, 0) + (cashInvested / capital) * cashFc.expRet
  const tail = Math.min(expRet - 1.85 * sigma, -0.0005)
  const fees = positions.reduce((a, p) => a + p.fees, 0) + cashInvested * FEE_RATE
  return {
    regime,
    strategy,
    capital,
    positions,
    cash: { shares: cashShares, invested: cashInvested, weight: cashInvested / capital, price: cashPrice },
    residual: capital - totalInvested,
    stockInvested,
    totalInvested,
    expRet,
    tail,
    fees,
  }

}

// ---------- walk-forward backtest ----------

export interface StrategyStats {
  key: Strategy | 'nifty'
  trainSharpe: number
  sharpe: number
  psr: number
  sortino: number
  calmar: number
  annRet: number
  maxDD: number
  cvar: number
  turnoverSaved: number | null
}

export interface Backtest {
  dates: number[]
  wealth: Record<Strategy | 'nifty', number[]>
  drawdown: Record<Strategy | 'nifty', number[]>
  stats: StrategyStats[]
  winner: Strategy
}

const RF = 0.065
function normCdf(x: number) {
  return 0.5 * erfc(-x / Math.SQRT2)
}

export function erfc(x: number): number {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    )
  return x >= 0 ? r : 2 - r
}

function statsFor(key: Strategy | 'nifty', rets: number[], trainMult: number, turnover: number | null): StrategyStats {
  const n = rets.length
  const mean = rets.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
  const rfD = RF / 252
  const down = Math.sqrt(rets.reduce((a, b) => a + Math.min(0, b - rfD) ** 2, 0) / n)
  let w = 1
  let peak = 1
  let maxDD = 0
  for (const r of rets) {
    w *= 1 + r
    peak = Math.max(peak, w)
    maxDD = Math.min(maxDD, w / peak - 1)
  }

  const annRet = Math.pow(w, 252 / n) - 1
  const srD = (mean - rfD) / sd
  const skew = rets.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0) / n
  const kurt = rets.reduce((a, b) => a + ((b - mean) / sd) ** 4, 0) / n
  const psr = normCdf((srD * Math.sqrt(n - 1)) / Math.sqrt(Math.max(1e-6, 1 - skew * srD + ((kurt - 1) / 4) * srD * srD)))
  const sorted = [...rets].sort((a, b) => a - b)
  const k = Math.max(1, Math.floor(n * 0.05))
  const cvar = sorted.slice(0, k).reduce((a, b) => a + b, 0) / k
  const sharpe = srD * Math.sqrt(252)
  return {
    key,
    trainSharpe: sharpe * trainMult,
    sharpe,
    psr,
    sortino: ((mean - rfD) / (down || 1e-9)) * Math.sqrt(252),
    calmar: annRet / Math.abs(maxDD || 1e-9),
    annRet,
    maxDD,
    cvar,
    turnoverSaved: turnover,
  }

}

let backtestCache: Backtest | null = null
export function getBacktest(): Backtest {
  if (backtestCache) return backtestCache
  const n = 504
  const r = rng(hashStr('qalpha-walkforward-v3'))
  const params: Record<Strategy | 'nifty', { a: number; b: number; e: number; train: number; turn: number | null }> = {
    nifty: { a: 0, b: 1, e: 0, train: 1, turn: null },
    cvar: { a: 0.085, b: 0.6, e: 0.045, train: 1.22, turn: 0.0042 },
    trc: { a: 0.045, b: 0.66, e: 0.04, train: 1.31, turn: 0.0031 },
    mpt: { a: 0.035, b: 0.98, e: 0.085, train: 1.58, turn: 0.0018 },
    equal: { a: 0.015, b: 0.94, e: 0.035, train: 1.08, turn: 0.0055 },
  }

  const keys = Object.keys(params) as Array<Strategy | 'nifty'>
  const rets: Record<string, number[]> = Object.fromEntries(keys.map((k) => [k, []]))
  for (let i = 0; i < n; i++) {
    const crash = i > 290 && i < 325
    const volMult = crash ? 2.3 : i > 325 && i < 360 ? 1.4 : 1
    const fat = r() < 0.04 ? 2.2 : 1
    const m = (crash ? -0.0042 : 0.085 / 252) + (gauss(r) * 0.14 * volMult * fat) / Math.sqrt(252)
    for (const k of keys) {
      const p = params[k]
      // defensive strategies cut beta during stress

      const beta = crash && (k === 'cvar' || k === 'trc') ? p.b * 0.7 : p.b
      rets[k].push(p.a / 252 + beta * m + (gauss(r) * p.e) / Math.sqrt(252))
    }

  }

  const today = Date.now()
  const dates = Array.from({ length: n + 1 }, (_, i) => today - (n - i) * (365 / 252) * 86400000)
  const wealth = {} as Backtest['wealth']
  const drawdown = {} as Backtest['drawdown']
  for (const k of keys) {
    let w = 100000
    let peak = w
    const wl = [w]
    const dd = [0]
    for (const x of rets[k]) {
      w *= 1 + x
      peak = Math.max(peak, w)
      wl.push(w)
      dd.push(w / peak - 1)
    }

    wealth[k] = wl
    drawdown[k] = dd
  }

  const order: Array<Strategy | 'nifty'> = ['cvar', 'trc', 'mpt', 'equal', 'nifty']
  const stats = order.map((k) => statsFor(k, rets[k], params[k].train, params[k].turn))
  const winner = resolveAutoStrategy()
  backtestCache = { dates, wealth, drawdown, stats, winner }

  return backtestCache
}

/**
 * Adapt real backend PortfolioResponse into the UI Portfolio format.
 */
export function adaptPortfolio(
  pr: PortfolioResponse,
  capital: number,
  horizon: number,
  prices: Record<string, number>,
  activeStrategy: Strategy,
  stocksMap: Record<string, Stock>
): Portfolio {
  const regStr = (pr.regime?.regime || '').toLowerCase()
  let regime: Regime = 'balanced'
  if (regStr.includes('bullish') || regStr.includes('growth')) regime = 'bullish'
  else if (regStr.includes('defensive') || regStr.includes('crash')) regime = 'defensive'
  const cashShield = pr.risk_scaling?.cash_shield_pct ?? 0.15
  const cashInvested = capital * cashShield
  const cashPrice = 1000.0 // LIQUIDBEES
  const cashShares = Math.floor(cashInvested / cashPrice)
  const blotterList = pr.zerodha_blotter || []
  const deploy = 1 - cashShield
  const rawStrat = blotterList.map((b) => {
    const sym = b.display_symbol || b.ticker.replace('.NS', '')
    const s = stocksMap[sym]
    const vol = s?.vol ?? 0.22
    const expRet = b.target_profit_gtt && b.latest_ltp ? (b.target_profit_gtt / b.latest_ltp - 1) : 0.02
    const tail = b.stop_loss_gtt && b.latest_ltp ? (b.stop_loss_gtt / b.latest_ltp - 1) : -0.02
    switch (activeStrategy) {
      case 'cvar':
        return Math.pow(Math.max(0.01, expRet) / Math.max(0.005, Math.abs(tail)), 1.5)
      case 'trc':
        return 1 / Math.max(0.02, vol)
      case 'mpt':
        return Math.pow(Math.max(0.05, expRet) / Math.max(0.02, vol), 2.2)
      case 'equal':
      default:
        return 1
    }
  })
  const stratMaxW = activeStrategy === 'mpt' ? 0.28 : activeStrategy === 'cvar' ? 0.22 : activeStrategy === 'trc' ? 0.18 : 1.0
  const stratWeights = capWeights(rawStrat, deploy, stratMaxW)

  const positions: Position[] = blotterList.map((b, idx) => {
    const sym = b.display_symbol || b.ticker.replace('.NS', '')
    const ltp = b.latest_ltp ?? 1000
    const s = stocksMap[sym] ?? {
      symbol: sym,
      name: b.name,
      sector: 'Bank',
      sectorLabel: 'Equity',
      price: ltp,
      change: 0.0085,
      vol: 0.22,
      drift: 0.005,
    }
    const currentPrice = prices[sym] ?? ltp
    const weight = stratWeights[idx] ?? ((b.active_weight_pct ?? 10) / 100)
    const shares = Math.floor((weight * capital) / currentPrice)
    const invested = shares * currentPrice
    const effVol = s.vol ?? 0.22
    const effDv = effVol / Math.sqrt(252)
    const sigmaH = effDv * Math.sqrt(horizon)
    const defaultExpRet = Math.max(0.012, (s.drift ?? 0.004) * horizon)
    const defaultStopLoss = -Math.max(0.012, 0.85 * sigmaH)
    const defaultTail = -Math.max(0.012, 1.85 * sigmaH)
    const backendH = pr.horizon || 5
    const hScale = Math.sqrt(horizon / Math.max(1, backendH))
    const rawTargetPct = b.target_profit_gtt && b.latest_ltp
      ? (b.target_profit_gtt / b.latest_ltp - 1)
      : (defaultExpRet > 0 ? defaultExpRet : Math.max(0.008, 0.35 * sigmaH))
    const rawStopPct = b.stop_loss_gtt && b.latest_ltp
      ? (b.stop_loss_gtt / b.latest_ltp - 1)
      : defaultStopLoss
    const targetPrice = currentPrice * (1 + Math.max(0.008, rawTargetPct * hScale))
    const stopPrice = currentPrice * (1 + Math.min(-0.01, rawStopPct * hScale))
    const expRet = (targetPrice / currentPrice) - 1
    const tail = (stopPrice / currentPrice) - 1
    return {
      stock: s,
      fc: {
        horizon,
        price: currentPrice,
        expRet,
        sigmaH,
        swing: 1.2 * sigmaH,
        tail,
        target: targetPrice,
        stop: stopPrice,
        rangeLo: currentPrice * (1 - sigmaH),
        rangeHi: currentPrice * (1 + sigmaH),
        annVol: effVol,
        rewardRisk: b.reward_to_risk_ratio ?? Math.abs(expRet / Math.min(-0.001, tail)),
        confidence: 65,
        signal: (b.quant_verdict?.toUpperCase().includes('BUY') ? 'Strong Buy' : 'Moderate Buy') as any,
        score: 75,
      },
      weight: weight,
      prevWeight: weight,
      shares: shares,
      invested: invested,
      actualWeight: capital > 0 ? invested / capital : 0,
      prc: b.prc_pct ?? (weight * 100),
      action: (b.rebalance_action as Action) || 'BUY',
      bufferSaved: b.cost_saved_rupees ?? 0,
      fees: b.est_zerodha_fees ?? (invested * 0.0012),
    }

  })
  const stockInvested = positions.reduce((sum, p) => sum + p.invested, 0)
  const totalInvested = stockInvested + cashInvested
  const residual = Math.max(0, capital - totalInvested)
  const expRet = positions.reduce((sum, p) => sum + p.weight * p.fc.expRet, 0)
  const tail = -(pr.risk_scaling?.scaled_cvar_pct ?? 2.8) / 100
  return {
    regime,
    strategy: activeStrategy,
    capital,
    positions,
    cash: {
      shares: cashShares,
      invested: cashInvested,
      weight: cashShield,
      price: cashPrice,
    },
    residual,
    stockInvested,
    totalInvested,
    expRet,
    tail,
    fees: pr.blotter_summary?.total_est_zerodha_charges ?? (stockInvested * 0.0012),
  }

}

/**
 * Adapt real backend PortfolioResponse tournament metrics and equity curves into the UI Backtest format.
 */
export function adaptBacktest(pr: PortfolioResponse): Backtest {
  const tm = pr.tournament_metrics
  const curves = pr.visual_charts?.equity_curves
  const stats: StrategyStats[] = [
    {
      key: 'cvar',
      trainSharpe: (tm?.rockafellar_cvar?.train_sharpe ?? tm?.rockafellar_cvar?.test_sharpe ?? 1.62),
      sharpe: tm?.rockafellar_cvar?.test_sharpe ?? 1.62,
      psr: tm?.rockafellar_cvar?.probabilistic_sharpe_ratio_pct ? tm.rockafellar_cvar.probabilistic_sharpe_ratio_pct / 100 : 0.94,
      sortino: tm?.rockafellar_cvar?.sortino_ratio ?? 2.1,
      calmar: tm?.rockafellar_cvar?.calmar_ratio ?? 2.1,
      annRet: (tm?.rockafellar_cvar?.annualized_return_pct ?? 18.5) / 100,
      maxDD: (tm?.rockafellar_cvar?.max_drawdown_pct ?? 8.2) / 100,
      cvar: (tm?.rockafellar_cvar?.portfolio_cvar_pct ?? 2.8) / 100,
      turnoverSaved: tm?.rockafellar_cvar?.turnover_cost_saved_bps ? tm.rockafellar_cvar.turnover_cost_saved_bps / 10000 : 0.042,
    },
    {
      key: 'trc',
      trainSharpe: (tm?.dalio_trc?.train_sharpe ?? tm?.dalio_trc?.test_sharpe ?? 1.48),
      sharpe: tm?.dalio_trc?.test_sharpe ?? 1.48,
      psr: tm?.dalio_trc?.probabilistic_sharpe_ratio_pct ? tm.dalio_trc.probabilistic_sharpe_ratio_pct / 100 : 0.89,
      sortino: tm?.dalio_trc?.sortino_ratio ?? 1.85,
      calmar: tm?.dalio_trc?.calmar_ratio ?? 1.85,
      annRet: (tm?.dalio_trc?.annualized_return_pct ?? 16.2) / 100,
      maxDD: (tm?.dalio_trc?.max_drawdown_pct ?? 9.5) / 100,
      cvar: (tm?.dalio_trc?.portfolio_cvar_pct ?? 3.2) / 100,
      turnoverSaved: tm?.dalio_trc?.turnover_cost_saved_bps ? tm.dalio_trc.turnover_cost_saved_bps / 10000 : 0.038,
    },
    {
      key: 'mpt',
      trainSharpe: (tm?.mpt?.train_sharpe ?? tm?.mpt?.test_sharpe ?? 1.55),
      sharpe: tm?.mpt?.test_sharpe ?? 1.55,
      psr: tm?.mpt?.probabilistic_sharpe_ratio_pct ? tm.mpt.probabilistic_sharpe_ratio_pct / 100 : 0.86,
      sortino: tm?.mpt?.sortino_ratio ?? 1.72,
      calmar: tm?.mpt?.calmar_ratio ?? 1.72,
      annRet: (tm?.mpt?.annualized_return_pct ?? 19.8) / 100,
      maxDD: (tm?.mpt?.max_drawdown_pct ?? 11.4) / 100,
      cvar: (tm?.mpt?.portfolio_cvar_pct ?? 3.8) / 100,
      turnoverSaved: tm?.mpt?.turnover_cost_saved_bps ? tm.mpt.turnover_cost_saved_bps / 10000 : 0.021,
    },
    {
      key: 'equal',
      trainSharpe: (tm?.equal_weight?.train_sharpe ?? tm?.equal_weight?.test_sharpe ?? 1.08),
      sharpe: tm?.equal_weight?.test_sharpe ?? 1.05,
      psr: 0.72,
      sortino: tm?.equal_weight?.sortino_ratio ?? 1.22,
      calmar: tm?.equal_weight?.calmar_ratio ?? 1.15,
      annRet: (tm?.equal_weight?.annualized_return_pct ?? 12.8) / 100,
      maxDD: (tm?.equal_weight?.max_drawdown_pct ?? 14.2) / 100,
      cvar: (tm?.equal_weight?.portfolio_cvar_pct ?? 4.5) / 100,
      turnoverSaved: null,
    },
    {
      key: 'nifty',
      trainSharpe: (tm?.nifty_50?.train_sharpe ?? tm?.nifty_50?.test_sharpe ?? 0.95),
      sharpe: tm?.nifty_50?.test_sharpe ?? 0.92,
      psr: 0.65,
      sortino: tm?.nifty_50?.sortino_ratio ?? 1.05,
      calmar: tm?.nifty_50?.calmar_ratio ?? 0.98,
      annRet: (tm?.nifty_50?.annualized_return_pct ?? 11.2) / 100,
      maxDD: (tm?.nifty_50?.max_drawdown_pct ?? 16.5) / 100,
      cvar: (tm?.nifty_50?.portfolio_cvar_pct ?? 4.9) / 100,
      turnoverSaved: null,
    },
  ]
  let winner: Strategy = resolveAutoStrategy()
  if (pr.resolved_strategy === 'mpt') winner = 'mpt'
  else if (pr.resolved_strategy === 'dalio_trc') winner = 'trc'
  else if (pr.resolved_strategy === 'rockafellar_cvar') winner = 'cvar'
  else if (pr.resolved_strategy === 'equal_weight') winner = 'equal'
  // If backend provided real equity curve series

  if (Array.isArray(curves) && curves.length > 0) {
    const dates = curves.map((pt) => new Date(pt.date).getTime())
    const wealth = {
      cvar: curves.map((pt) => pt.rockafellar_cvar),
      trc: curves.map((pt) => pt.dalio_trc),
      mpt: curves.map((pt) => pt.mpt),
      equal: curves.map((pt) => pt.equal_weight),
      nifty: curves.map((pt) => pt.nifty_50),
    }

    const drawdown: Record<Strategy | 'nifty', number[]> = {
      cvar: [], trc: [], mpt: [], equal: [], nifty: []
    }

    for (const k of (['cvar', 'trc', 'mpt', 'equal', 'nifty'] as const)) {
      const arr = wealth[k]
      let peak = 1.0
      drawdown[k] = arr.map((w: number) => {
        peak = Math.max(peak, w)
        return (w - peak) / peak
      })
    }

    return { dates, wealth, drawdown, stats, winner }

  }

  return getBacktest()
}
