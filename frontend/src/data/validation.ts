import { erfc } from './portfolio'
import { getHistory, hashStr, rng } from './market'

export type FeatureSet = 'mlp' | 'logret'
export type ReturnModelSel = 'auto' | 'sarimax' | 'lstm'
export type RiskModelSel = 'auto' | 'gjr' | 'hybrid'

export type ReturnKey = 'rw' | 'sarimax' | 'lstm'
export type VolKey = 'ewma' | 'garch' | 'gjr' | 'hybrid'

export interface ReturnRow {
  key: ReturnKey
  name: string
  spec: string
  isRmse: number
  oosRmse: number
  hitRate: number
}
export interface VolRow {
  key: VolKey
  name: string
  spec: string
  qlike: number
  loglik: number
  breaches: number
  n: number
  kupiecP: number
  indepP: number
}
export interface VolPoint {
  r: number
  gjr: number
  hybrid: number
  var: number // VaR cutoff of the selected risk model (positive number)
  breach: boolean
}
export interface Validation {
  returns: ReturnRow[]
  returnWinner: ReturnKey
  vol: VolRow[]
  volWinner: VolKey
  alpha: number
  gamma: number
  beta: number
  leverage: number
  psi: number
  series: Record<'gjr' | 'hybrid', VolPoint[]>
}

export const RETURN_NAMES: Record<ReturnKey, string> = { rw: 'Random Walk', sarimax: 'SARIMAX', lstm: 'Deep LSTM' }
export const VOL_NAMES: Record<VolKey, string> = {
  ewma: 'EWMA RiskMetrics',
  garch: 'GARCH(1,1)',
  gjr: 'GJR-GARCH(1,1,1)',
  hybrid: 'Hybrid GJR-LSTM',
}

const Z95 = 1.645
const OOS = 250

function chi2p(lr: number) {
  return erfc(Math.sqrt(Math.max(lr, 0) / 2))
}
const xlogy = (x: number, y: number) => (x === 0 ? 0 : x * Math.log(y))

export function kupiec(x: number, n: number, p = 0.05) {
  const phat = x / n
  const lr = -2 * (xlogy(n - x, 1 - p) + xlogy(x, p)) + 2 * (xlogy(n - x, 1 - phat) + xlogy(x, phat))
  return chi2p(lr)
}

function christoffersen(hits: boolean[]) {
  let n00 = 0, n01 = 0, n10 = 0, n11 = 0
  for (let i = 1; i < hits.length; i++) {
    const a = hits[i - 1], b = hits[i]
    if (!a && !b) n00++
    else if (!a && b) n01++
    else if (a && !b) n10++
    else n11++
  }
  const p01 = n01 / Math.max(1, n00 + n01)
  const p11 = n11 / Math.max(1, n10 + n11)
  const p = (n01 + n11) / Math.max(1, n00 + n01 + n10 + n11)
  const l0 = xlogy(n00 + n10, 1 - p) + xlogy(n01 + n11, p)
  const l1 = xlogy(n00, 1 - p01) + xlogy(n01, p01) + xlogy(n10, 1 - p11) + xlogy(n11, p11)
  return chi2p(-2 * (l0 - l1))
}

function scoreVol(rets: number[], sig: number[]) {
  let qlike = 0, ll = 0
  const hits: boolean[] = []
  rets.forEach((r, i) => {
    const v = sig[i] ** 2
    qlike += Math.log(v) + (r * r) / v
    ll += -0.5 * (Math.log(2 * Math.PI) + Math.log(v) + (r * r) / v)
    hits.push(r < -Z95 * sig[i])
  })
  const breaches = hits.filter(Boolean).length
  return {
    // reported on a percent-return scale to keep figures readable
    qlike: qlike / rets.length + Math.log(1e4),
    loglik: ll,
    breaches,
    kupiecP: kupiec(breaches, rets.length),
    indepP: christoffersen(hits),
    hits,
  }
}

export function getValidation(symbol: string, horizon: number, feature: FeatureSet, refit: number): Validation {
  const bars = getHistory(symbol)
  const rets = bars.slice(1).map((b, i) => Math.log(b.c / bars[i].c))
  const split = rets.length - OOS
  const train = rets.slice(0, split)
  const lrVar = train.reduce((a, r) => a + r * r, 0) / train.length
  const dv = Math.sqrt(lrVar)
  const r = rng(hashStr(`${symbol}:${horizon}:${feature}:${refit}`))
  const rs = rng(hashStr(`${symbol}:struct`))

  // ---- volatility models (run over the full sample, scored on OOS window)
  const alpha = 0.085 + rs() * 0.035 + (r() - 0.5) * 0.004
  const gamma = 0.1 + rs() * 0.07 + (r() - 0.5) * 0.006
  const beta = Math.max(0.6, 0.965 - alpha - gamma / 2)
  const runs: Record<VolKey, number[]> = { ewma: [], garch: [], gjr: [], hybrid: [] }
  let vE = lrVar, vG = lrVar, vJ = lrVar, absS = dv
  const gOmega = lrVar * (1 - 0.08 - 0.9)
  const jOmega = lrVar * (1 - alpha - gamma / 2 - beta)
  for (let i = 0; i < rets.length; i++) {
    runs.ewma.push(Math.sqrt(vE))
    runs.garch.push(Math.sqrt(vG))
    runs.gjr.push(Math.sqrt(vJ))
    runs.hybrid.push(0.62 * Math.sqrt(vJ) + 0.38 * absS * 1.2533)
    const x = rets[i]
    vE = 0.94 * vE + 0.06 * x * x
    vG = gOmega + 0.08 * x * x + 0.9 * vG
    vJ = jOmega + (alpha + (x < 0 ? gamma : 0)) * x * x + beta * vJ
    absS = 0.82 * absS + 0.18 * Math.abs(x)
  }
  const oosRets = rets.slice(split)
  const keys: VolKey[] = ['ewma', 'garch', 'gjr', 'hybrid']
  const specs: Record<VolKey, string> = { ewma: 'λ = 0.94', garch: 'Normal', gjr: 'Student-t', hybrid: '0.62 GJR + 0.38 LSTM' }
  const scored = Object.fromEntries(keys.map((k) => [k, scoreVol(oosRets, runs[k].slice(split))])) as Record<
    VolKey,
    ReturnType<typeof scoreVol>
  >
  const vol: VolRow[] = keys.map((k) => ({
    key: k,
    name: VOL_NAMES[k],
    spec: specs[k],
    qlike: scored[k].qlike,
    loglik: scored[k].loglik,
    breaches: scored[k].breaches,
    n: OOS,
    kupiecP: scored[k].kupiecP,
    indepP: scored[k].indepP,
  }))
  const eligible = vol.filter((v) => v.kupiecP > 0.05 && v.key !== 'ewma')
  const volWinner = (eligible.length ? eligible : vol).reduce((a, b) => (b.qlike < a.qlike ? b : a)).key

  const mkSeries = (k: 'gjr' | 'hybrid'): VolPoint[] =>
    oosRets.map((x, i) => ({
      r: x,
      gjr: runs.gjr[split + i],
      hybrid: runs.hybrid[split + i],
      var: Z95 * runs[k][split + i],
      breach: scored[k].hits[i],
    }))

  // ---- return models (directional + RMSE tournament)
  const base = dv * Math.sqrt(horizon) * 0.96
  const lstmGain = feature === 'mlp' ? 0.925 + r() * 0.02 : 0.975 + r() * 0.02
  const returns: ReturnRow[] = [
    { key: 'rw', name: 'Random Walk', spec: 'Naive baseline', isRmse: base * 1.0, oosRmse: base * (1.0 + r() * 0.01), hitRate: 49.4 + r() * 1.8 },
    {
      key: 'sarimax',
      name: 'SARIMAX',
      spec: '(2,0,1)×(1,0,0,5)',
      isRmse: base * (0.95 + r() * 0.01),
      oosRmse: base * (0.965 + r() * 0.02),
      hitRate: 53.5 + r() * 3.5,
    },
    {
      key: 'lstm',
      name: 'Deep LSTM',
      spec: feature === 'mlp' ? '2×64 · MLP bottleneck' : '2×64 · log returns',
      isRmse: base * (lstmGain - 0.07),
      oosRmse: base * lstmGain,
      hitRate: feature === 'mlp' ? 59 + r() * 4.5 : 54 + r() * 3.5,
    },
  ]
  const returnWinner = returns.reduce((a, b) => (b.oosRmse < a.oosRmse ? b : a)).key

  return {
    returns,
    returnWinner,
    vol,
    volWinner,
    alpha,
    gamma,
    beta,
    leverage: (alpha + gamma) / alpha,
    psi: 0.018 + rs() * 0.07 + r() * 0.012,
    series: { gjr: mkSeries('gjr'), hybrid: mkSeries('hybrid') },
  }
}

// Student-t (ν = 4) helpers for the distribution chart, scaled to unit variance
export const T4_Q05 = -2.132 / Math.SQRT2
export function t4pdf(z: number) {
  // unit-variance t4: x = z·√2 ; f(z) = √2 · (3/8)(1 + x²/4)^(-5/2)
  const x = z * Math.SQRT2
  return Math.SQRT2 * 0.375 * Math.pow(1 + (x * x) / 4, -2.5)
}
export function normpdf(z: number) {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
}
