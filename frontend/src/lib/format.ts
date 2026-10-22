const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** ₹1,25,000 style (Indian digit grouping). */
export function inr(v: number, decimals: 0 | 2 = 0): string {
  const f = decimals === 2 ? inr2 : inr0
  const s = f.format(Math.abs(v))
  return `${v < 0 ? '-' : ''}₹${s}`
}

/** Signed rupee value: +₹3,850 / -₹2,450 */
export function inrSigned(v: number, decimals: 0 | 2 = 0): string {
  return `${v >= 0 ? '+' : '-'}${inr(Math.abs(v), decimals)}`
}

export function num(v: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)
}

/** Percent from a fraction: 0.0385 -> "+3.85%" */
export function pct(fraction: number, decimals = 2, signed = true): string {
  const v = fraction * 100
  const sign = signed && v > 0 ? '+' : ''
  return `${sign}${v.toFixed(decimals)}%`
}

/** Compact lakh/crore label: 100000 -> ₹1L */
export function inrCompact(v: number): string {
  if (v >= 1e7) return `₹${+(v / 1e7).toFixed(2)}Cr`
  if (v >= 1e5) return `₹${+(v / 1e5).toFixed(2)}L`
  if (v >= 1e3) return `₹${+(v / 1e3).toFixed(1)}K`
  return `₹${v}`
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
