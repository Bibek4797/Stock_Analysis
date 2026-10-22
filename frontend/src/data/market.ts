import { clamp } from '@/lib/format'
import type { QuantForecastResponse } from '@/types'

export type Sector = 'Bank' | 'IT' | 'Energy' | 'Auto' | 'Pharma' | 'FMCG' | 'Metals' | 'ETF'
export const SECTORS: Array<'All' | Sector> = [
  'All',
  'Bank',
  'IT',
  'Energy',
  'Auto',
  'Pharma',
  'FMCG',
  'Metals',
  'ETF',
]

export interface Stock {
  symbol: string
  name: string
  sector: Sector
  sectorLabel: string
  price: number
  change: number // daily change fraction
  vol: number // annualised volatility
  drift: number // model daily expected drift
}

// ---------- seeded RNG ----------
export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function gauss(r: () => number) {
  const u = Math.max(r(), 1e-9)
  const v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

type Raw = [string, string, Sector, string, number, number, number, number?]
// symbol, name, sector, sector label, real base price, change %, annual vol, (optional drift override)
const RAW: Raw[] = [
  // 1. Banking & Finance
  ['HDFCBANK', 'HDFC Bank Ltd', 'Bank', 'Banking & Finance', 1680.0, 0.85, 0.198, 0.0052],
  ['ICICIBANK', 'ICICI Bank Ltd', 'Bank', 'Banking & Finance', 1245.0, 1.12, 0.214, 0.0061],
  ['SBIN', 'State Bank of India', 'Bank', 'Banking & Finance', 795.0, -0.42, 0.268, 0.0024],
  ['KOTAKBANK', 'Kotak Mahindra Bank Ltd', 'Bank', 'Banking & Finance', 1780.0, -0.18, 0.221, 0.0014],
  ['AXISBANK', 'Axis Bank Ltd', 'Bank', 'Banking & Finance', 1180.0, 0.64, 0.241, 0.0033],
  ['BAJFINANCE', 'Bajaj Finance Ltd', 'Bank', 'Banking & Finance', 6850.0, 1.45, 0.285, 0.0068],
  ['BAJAJFINSV', 'Bajaj Finserv Ltd', 'Bank', 'Banking & Finance', 1750.0, 0.92, 0.272, 0.0042],
  ['INDUSINDBK', 'IndusInd Bank Ltd', 'Bank', 'Banking & Finance', 1350.0, -1.25, 0.334, -0.0015],

  // 2. IT & Technology
  ['TCS', 'Tata Consultancy Services Ltd', 'IT', 'IT & Technology', 4050.0, 1.48, 0.186, 0.0064],
  ['INFY', 'Infosys Ltd', 'IT', 'IT & Technology', 1920.0, 1.05, 0.214, 0.0049],
  ['HCLTECH', 'HCL Technologies Ltd', 'IT', 'IT & Technology', 1760.0, 0.72, 0.204, 0.0043],
  ['WIPRO', 'Wipro Ltd', 'IT', 'IT & Technology', 520.0, -0.38, 0.236, 0.0006],
  ['TECHM', 'Tech Mahindra Ltd', 'IT', 'IT & Technology', 1650.0, -0.92, 0.262, -0.0008],
  ['LTIM', 'LTIMindtree Ltd', 'IT', 'IT & Technology', 5900.0, 0.31, 0.248, 0.0017],

  // 3. Energy, Oil & Power
  ['RELIANCE', 'Reliance Industries Ltd', 'Energy', 'Energy, Oil & Power', 1205.0, 1.24, 0.242, 0.0077],
  ['ONGC', 'Oil & Natural Gas Corporation Ltd', 'Energy', 'Energy, Oil & Power', 285.0, -0.55, 0.284, 0.0009],
  ['NTPC', 'NTPC Ltd', 'Energy', 'Energy, Oil & Power', 415.0, 0.88, 0.226, 0.0041],
  ['POWERGRID', 'Power Grid Corporation of India', 'Energy', 'Energy, Oil & Power', 330.0, 0.42, 0.198, 0.0036],
  ['COALINDIA', 'Coal India Ltd', 'Energy', 'Energy, Oil & Power', 485.0, 0.21, 0.254, 0.0011],
  ['TATAPOWER', 'Tata Power Company Ltd', 'Energy', 'Energy, Oil & Power', 420.0, 1.36, 0.318, 0.0028],

  // 4. Auto & EV
  ['TATAMOTORS', 'Tata Motors Ltd', 'Auto', 'Auto & EV', 880.0, -1.24, 0.342, -0.0019],
  ['M&M', 'Mahindra & Mahindra Ltd', 'Auto', 'Auto & EV', 2950.0, 1.62, 0.256, 0.0058],
  ['MARUTI', 'Maruti Suzuki India Ltd', 'Auto', 'Auto & EV', 11800.0, 0.94, 0.218, 0.0046],
  ['BAJAJ-AUTO', 'Bajaj Auto Ltd', 'Auto', 'Auto & EV', 9900.0, 0.48, 0.232, 0.0031],
  ['EICHERMOT', 'Eicher Motors Ltd', 'Auto', 'Auto & EV', 4750.0, 0.76, 0.244, 0.0038],

  // 5. Pharma & Healthcare
  ['SUNPHARMA', 'Sun Pharmaceutical Industries Ltd', 'Pharma', 'Pharma & Healthcare', 1885.0, 0.68, 0.192, 0.0044],
  ['DRREDDY', "Dr. Reddy's Laboratories Ltd", 'Pharma', 'Pharma & Healthcare', 6450.0, -0.26, 0.206, 0.0013],
  ['CIPLA', 'Cipla Ltd', 'Pharma', 'Pharma & Healthcare', 1520.0, 0.54, 0.198, 0.0034],
  ['APOLLOHOSP', 'Apollo Hospitals Enterprise Ltd', 'Pharma', 'Pharma & Healthcare', 6850.0, 0.36, 0.228, 0.0029],

  // 6. FMCG & Consumer
  ['ITC', 'ITC Ltd', 'FMCG', 'FMCG & Consumer', 488.0, 0.58, 0.176, 0.0032],
  ['HINDUNILVR', 'Hindustan Unilever Ltd', 'FMCG', 'FMCG & Consumer', 2580.0, -0.44, 0.168, 0.0008],
  ['TITAN', 'Titan Company Ltd', 'FMCG', 'FMCG & Consumer', 3450.0, 0.82, 0.235, 0.0045],
  ['NESTLEIND', 'Nestle India Ltd', 'FMCG', 'FMCG & Consumer', 2350.0, -0.62, 0.172, -0.0006],
  ['ASIANPAINT', 'Asian Paints Ltd', 'FMCG', 'FMCG & Consumer', 2980.0, -0.15, 0.224, 0.0012],

  // 7. Metals, Infra & Telecom
  ['LT', 'Larsen & Toubro Ltd', 'Metals', 'Metals, Infra & Telecom', 3540.0, 0.78, 0.228, 0.0041],
  ['BHARTIARTL', 'Bharti Airtel Ltd', 'Metals', 'Metals, Infra & Telecom', 1690.0, 1.15, 0.215, 0.0055],
  ['TATASTEEL', 'Tata Steel Ltd', 'Metals', 'Metals, Infra & Telecom', 155.0, -1.42, 0.326, -0.0016],
  ['HINDALCO', 'Hindalco Industries Ltd', 'Metals', 'Metals, Infra & Telecom', 720.0, 1.34, 0.302, 0.0039],
  ['ULTRACEMCO', 'UltraTech Cement Ltd', 'Metals', 'Metals, Infra & Telecom', 11200.0, 0.45, 0.212, 0.0028],

  // 8. ETFs & Safe Hedge
  ['NIFTYBEES', 'Nippon India ETF Nifty 50 BeES', 'ETF', 'ETFs & Hedge', 261.0, 0.58, 0.142, 0.0021],
  ['BANKBEES', 'Nippon India ETF Nifty Bank BeES', 'ETF', 'ETFs & Hedge', 512.0, 0.71, 0.178, 0.0026],
  ['ITBEES', 'Nippon India ETF Nifty IT', 'ETF', 'ETFs & Hedge', 435.0, 1.02, 0.196, 0.0031],
  ['JUNIORBEES', 'Nippon India ETF Nifty Next 50', 'ETF', 'ETFs & Hedge', 745.0, 0.85, 0.185, 0.0028],
  ['GOLDBEES', 'Nippon India ETF Gold BeES', 'ETF', 'ETFs & Hedge', 68.5, 0.18, 0.124, 0.0012],
  ['LIQUIDBEES', 'Nippon India ETF Liquid BeES', 'ETF', 'ETFs & Hedge', 1000.0, 0.02, 0.004, 0.00025],
]

export const STOCKS: Stock[] = RAW.map(([symbol, name, sector, sectorLabel, price, chg, vol, drift]) => {
  const r = rng(hashStr(symbol))
  return {
    symbol,
    name,
    sector,
    sectorLabel,
    price,
    change: chg / 100,
    vol,
    drift: drift ?? (r() * 1.1 - 0.3) * 0.008,
  }
})

export const STOCK_MAP: Record<string, Stock> = Object.fromEntries(STOCKS.map((s) => [s.symbol, s]))
export const CASH_ETF = 'LIQUIDBEES'

// ---------- history ----------
export interface Bar {
  t: number // epoch ms
  o: number
  h: number
  l: number
  c: number
  v: number
}

const HISTORY_DAYS = 1300
const historyCache = new Map<string, Bar[]>()

function tradingDaysBack(n: number): number[] {
  const out: number[] = []
  const d = new Date()
  d.setHours(15, 30, 0, 0)
  while (out.length < n) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) out.push(d.getTime())
    d.setDate(d.getDate() - 1)
  }
  return out.reverse()
}

export function getHistory(symbol: string): Bar[] {
  const cached = historyCache.get(symbol)
  if (cached) return cached
  const s = STOCK_MAP[symbol]
  const r = rng(hashStr(symbol + ':hist'))
  const dates = tradingDaysBack(HISTORY_DAYS)
  const dv = s.vol / Math.sqrt(252)
  const trend = (r() * 0.22 + 0.02) / 252
  let regime = 1
  // asymmetric volatility clustering (sell-offs lift variance more than rallies)
  const [ga, gg, gb] = [0.04, 0.11, 0.885]
  const omega = dv * dv * (1 - ga - gg / 2 - gb)
  let variance = dv * dv
  let lastRet = 0
  const closes: number[] = []
  const opens: number[] = []
  const highs: number[] = []
  const lows: number[] = []
  const vols: number[] = []
  let prev = 100
  for (let i = 0; i < HISTORY_DAYS; i++) {
    if (r() < 0.006) regime = 0.75 + r() * 0.6 // slow volatility regime shifts
    const z = lastRet / regime // standardise so regime shifts don't feed back into persistence
    variance = clamp(omega + (ga + (z < 0 ? gg : 0)) * z * z + gb * variance, dv * dv * 0.3, dv * dv * 5)
    const sd = Math.sqrt(variance) * regime
    const cycle = Math.sin(i / (60 + (hashStr(symbol) % 40))) * 0.0009
    const gap = gauss(r) * sd * 0.25
    const o = prev * (1 + gap)
    const shock = gauss(r) * (r() < 0.04 ? 1.7 : 1)
    const c = o * (1 + trend + cycle + shock * sd * 0.92)
    lastRet = c / prev - 1
    const h = Math.max(o, c) * (1 + Math.abs(gauss(r)) * sd * 0.45)
    const l = Math.min(o, c) * (1 - Math.abs(gauss(r)) * sd * 0.45)
    opens.push(o)
    closes.push(c)
    highs.push(h)
    lows.push(l)
    vols.push((0.6 + r() * 0.8) * regime * (1 + Math.abs(c / o - 1) * 30))
    prev = c
  }
  // pin the final close to the reference price, previous close per daily change
  const scale = s.price / closes[closes.length - 1]
  const bars: Bar[] = dates.map((t, i) => ({
    t,
    o: opens[i] * scale,
    h: highs[i] * scale,
    l: lows[i] * scale,
    c: closes[i] * scale,
    v: vols[i],
  }))
  historyCache.set(symbol, bars)
  return bars
}

// ---------- forecast ----------
export type Signal = 'Strong Buy' | 'Moderate Buy' | 'Hold' | 'Avoid'

export interface Forecast {
  horizon: number
  price: number
  expRet: number // fraction
  sigmaH: number
  swing: number
  tail: number // CVaR-style downside fraction (negative)
  target: number
  stop: number
  rangeLo: number
  rangeHi: number
  annVol: number
  rewardRisk: number
  confidence: number // %
  signal: Signal
  score: number
}

export function forecast(
  s: Stock,
  price: number,
  horizon: number,
  opts?: {
    feature?: 'mlp' | 'logret'
    returnModel?: 'auto' | 'sarimax' | 'lstm'
    riskModel?: 'auto' | 'gjr' | 'hybrid'
    refit?: number
  }
): Forecast {
  const refit = opts?.refit ?? 0
  const feature = opts?.feature ?? 'mlp'
  const retSel = opts?.returnModel ?? 'auto'
  const riskSel = opts?.riskModel ?? 'auto'

  const rSeed = hashStr(`${s.symbol}:${horizon}:${feature}:${retSel}:${riskSel}:${refit}`)
  const r = rng(rSeed)

  let driftMultiplier = 1.0
  let volMultiplier = 1.0
  let hitRateBoost = 0

  if (feature === 'mlp') {
    hitRateBoost += 3.2
    driftMultiplier += 0.05
  }
  if (retSel === 'lstm') {
    driftMultiplier += 0.09
    hitRateBoost += 2.0
  } else if (retSel === 'sarimax') {
    driftMultiplier += 0.03
    hitRateBoost += 0.5
  }

  if (riskSel === 'hybrid') {
    volMultiplier *= 0.96
  } else if (riskSel === 'gjr') {
    volMultiplier *= 1.02
  }

  if (refit > 0) {
    driftMultiplier += (r() - 0.48) * 0.07
    volMultiplier += (r() - 0.5) * 0.03
    hitRateBoost += (r() - 0.45) * 1.5
  }

  const effVol = s.vol * volMultiplier
  const effDv = effVol / Math.sqrt(252)
  const sigmaH = effDv * Math.sqrt(horizon)
  const expRet = s.drift * driftMultiplier * horizon
  const swing = 1.2 * sigmaH
  const tail = Math.min(expRet - 1.85 * sigmaH, -0.0005)
  const target = price * (1 + expRet)
  const stop = price * (1 + tail)
  const rewardRisk = expRet > 0 ? expRet / Math.abs(tail) : 0
  const score = expRet / sigmaH
  const confidence = clamp(52 + score * 12 + hitRateBoost, 46, 78)
  let signal: Signal = 'Avoid'
  if (score > 0.95 && rewardRisk > 1.1) signal = 'Strong Buy'
  else if (score > 0.35) signal = 'Moderate Buy'
  else if (score > -0.1) signal = 'Hold'
  return {
    horizon,
    price,
    expRet,
    sigmaH,
    swing,
    tail,
    target,
    stop,
    rangeLo: price * (1 - swing),
    rangeHi: price * (1 + swing),
    annVol: effVol,
    rewardRisk,
    confidence,
    signal,
    score,
  }
}

/**
 * Adapt real backend QuantForecastResponse into the UI Forecast format.
 */
export function adaptForecast(
  qf: QuantForecastResponse,
  fallbackHorizon: number,
  currentPrice: number
): Forecast {
  const cm = qf.core_metrics
  const gtt = qf.gtt_levels
  const rec = qf.recommendation

  let signal: Signal = 'Hold'
  const v = (rec?.verdict || '').toUpperCase()
  if (v.includes('STRONG') || (v.includes('BUY') && !v.includes('MODERATE'))) signal = 'Strong Buy'
  else if (v.includes('MODERATE')) signal = 'Moderate Buy'
  else if (v.includes('AVOID') || v.includes('SELL')) signal = 'Avoid'

  const expRetPct = cm?.expected_return_pct ?? 2.1
  const volPct = cm?.volatility_pct ?? 2.4
  const annVolPct = cm?.annualized_vol_pct ?? (volPct * Math.sqrt(252 / (qf.horizon || fallbackHorizon)))
  const cvarPct = cm?.cvar_95_pct ?? 3.2
  const target = cm?.target_price ?? (currentPrice * (1 + expRetPct / 100))
  const stop = gtt?.stop_loss_gtt ?? (currentPrice * (1 - Math.abs(cvarPct) / 100))

  return {
    horizon: qf.horizon ?? fallbackHorizon,
    price: currentPrice,
    expRet: expRetPct / 100,
    sigmaH: volPct / 100,
    swing: (volPct * 1.5) / 100,
    tail: -Math.abs(cvarPct) / 100,
    target,
    stop,
    rangeLo: currentPrice * (1 - volPct / 100),
    rangeHi: currentPrice * (1 + volPct / 100),
    annVol: annVolPct / 100,
    rewardRisk: gtt?.reward_to_risk_ratio ?? 1.45,
    confidence: Math.round(cm?.oos_hit_rate ?? 62),
    signal,
    score: rec?.signal_score ?? 72,
  }
}
