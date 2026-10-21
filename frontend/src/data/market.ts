import { clamp } from '@/lib/format'

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
// symbol, name, sector, sector label, price, change %, annual vol, (optional drift override)
const RAW: Raw[] = [
  ['RELIANCE', 'Reliance Industries Ltd', 'Energy', 'Energy, Oil & Power', 1680.0, 1.24, 0.242, 0.0077],
  ['HDFCBANK', 'HDFC Bank Ltd', 'Bank', 'Private Banking', 1742.3, 0.86, 0.198, 0.0052],
  ['ICICIBANK', 'ICICI Bank Ltd', 'Bank', 'Private Banking', 1268.45, 1.12, 0.214, 0.0061],
  ['SBIN', 'State Bank of India', 'Bank', 'PSU Banking', 812.6, -0.42, 0.268, 0.0024],
  ['KOTAKBANK', 'Kotak Mahindra Bank', 'Bank', 'Private Banking', 1915.2, -0.18, 0.221, 0.0014],
  ['AXISBANK', 'Axis Bank Ltd', 'Bank', 'Private Banking', 1142.75, 0.64, 0.241, 0.0033],
  ['INDUSINDBK', 'IndusInd Bank Ltd', 'Bank', 'Private Banking', 985.4, -1.86, 0.354, -0.0031],
  ['BANKBARODA', 'Bank of Baroda', 'Bank', 'PSU Banking', 248.15, 0.92, 0.312, 0.0019],
  ['PNB', 'Punjab National Bank', 'Bank', 'PSU Banking', 104.3, -0.71, 0.338, -0.0012],
  ['TCS', 'Tata Consultancy Services', 'IT', 'IT Services', 4125.6, 1.48, 0.186, 0.0064],
  ['INFY', 'Infosys Ltd', 'IT', 'IT Services', 1862.4, 1.05, 0.214, 0.0049],
  ['WIPRO', 'Wipro Ltd', 'IT', 'IT Services', 298.55, -0.38, 0.236, 0.0006],
  ['HCLTECH', 'HCL Technologies Ltd', 'IT', 'IT Services', 1754.9, 0.72, 0.204, 0.0043],
  ['TECHM', 'Tech Mahindra Ltd', 'IT', 'IT Services', 1612.3, -0.92, 0.262, -0.0008],
  ['LTIM', 'LTIMindtree Ltd', 'IT', 'IT Services', 5842.1, 0.31, 0.248, 0.0017],
  ['ONGC', 'Oil & Natural Gas Corp', 'Energy', 'Oil & Gas Exploration', 268.4, -0.55, 0.284, 0.0009],
  ['NTPC', 'NTPC Ltd', 'Energy', 'Power Generation', 362.75, 0.88, 0.226, 0.0041],
  ['POWERGRID', 'Power Grid Corp of India', 'Energy', 'Power Transmission', 318.2, 0.42, 0.198, 0.0036],
  ['ADANIGREEN', 'Adani Green Energy', 'Energy', 'Renewables', 1045.6, -2.34, 0.486, -0.0042],
  ['TATAPOWER', 'Tata Power Company', 'Energy', 'Power Utilities', 412.35, 1.36, 0.318, 0.0028],
  ['COALINDIA', 'Coal India Ltd', 'Energy', 'Mining & Fuel', 398.5, 0.21, 0.254, 0.0011],
  ['MARUTI', 'Maruti Suzuki India', 'Auto', 'Passenger Vehicles', 12480.0, 0.94, 0.218, 0.0046],
  ['TATAMOTORS', 'Tata Motors Ltd', 'Auto', 'Automobiles', 742.85, -1.24, 0.342, -0.0019],
  ['M&M', 'Mahindra & Mahindra', 'Auto', 'Automobiles', 2985.4, 1.62, 0.256, 0.0058],
  ['BAJAJ-AUTO', 'Bajaj Auto Ltd', 'Auto', 'Two & Three Wheelers', 9124.5, 0.48, 0.232, 0.0031],
  ['EICHERMOT', 'Eicher Motors Ltd', 'Auto', 'Two Wheelers', 4865.2, 0.76, 0.244, 0.0038],
  ['HEROMOTOCO', 'Hero MotoCorp Ltd', 'Auto', 'Two Wheelers', 4512.3, -0.34, 0.238, 0.0007],
  ['SUNPHARMA', 'Sun Pharmaceutical Inds', 'Pharma', 'Pharmaceuticals', 1812.6, 0.68, 0.192, 0.0044],
  ['DRREDDY', "Dr. Reddy's Laboratories", 'Pharma', 'Pharmaceuticals', 1268.9, -0.26, 0.206, 0.0013],
  ['CIPLA', 'Cipla Ltd', 'Pharma', 'Pharmaceuticals', 1485.75, 0.54, 0.198, 0.0034],
  ['DIVISLAB', "Divi's Laboratories", 'Pharma', 'API Manufacturing', 5912.4, 1.18, 0.252, 0.0047],
  ['APOLLOHOSP', 'Apollo Hospitals Enterprise', 'Pharma', 'Healthcare Services', 7045.8, 0.36, 0.228, 0.0029],
  ['HINDUNILVR', 'Hindustan Unilever Ltd', 'FMCG', 'Consumer Staples', 2412.55, -0.44, 0.168, 0.0008],
  ['ITC', 'ITC Ltd', 'FMCG', 'Diversified FMCG', 468.2, 0.58, 0.176, 0.0032],
  ['NESTLEIND', 'Nestle India Ltd', 'FMCG', 'Packaged Foods', 2298.4, -0.62, 0.172, -0.0006],
  ['BRITANNIA', 'Britannia Industries', 'FMCG', 'Packaged Foods', 5124.6, 0.22, 0.188, 0.0015],
  ['TATACONSUM', 'Tata Consumer Products', 'FMCG', 'Beverages & Foods', 1086.3, 0.81, 0.224, 0.0035],
  ['TATASTEEL', 'Tata Steel Ltd', 'Metals', 'Steel', 152.4, -1.42, 0.326, -0.0016],
  ['JSWSTEEL', 'JSW Steel Ltd', 'Metals', 'Steel', 985.6, 0.48, 0.284, 0.0022],
  ['HINDALCO', 'Hindalco Industries', 'Metals', 'Aluminium & Copper', 648.25, 1.34, 0.302, 0.0039],
  ['VEDL', 'Vedanta Ltd', 'Metals', 'Diversified Metals', 452.8, -0.86, 0.364, -0.0004],
  ['NIFTYBEES', 'Nippon India Nifty 50 BeES', 'ETF', 'Index ETF', 268.45, 0.58, 0.142, 0.0021],
  ['BANKBEES', 'Nippon India Bank BeES', 'ETF', 'Sector ETF', 542.3, 0.71, 0.178, 0.0026],
  ['ITBEES', 'Nippon India IT BeES', 'ETF', 'Sector ETF', 42.15, 1.02, 0.196, 0.0031],
  ['GOLDBEES', 'Nippon India Gold BeES', 'ETF', 'Commodity ETF', 68.75, 0.18, 0.124, 0.0012],
  ['LIQUIDBEES', 'Nippon India Liquid BeES', 'ETF', 'Overnight Cash ETF', 1000.0, 0.02, 0.004, 0.00025],
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
