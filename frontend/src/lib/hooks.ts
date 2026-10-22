import { useEffect, useRef, useState } from 'react'
import { STOCKS, gauss, rng } from '@/data/market'

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.floor(width), height: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

export type MarketStatus = 'OPEN' | 'PRE-OPEN' | 'CLOSED'

function istParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { h: +get('hour') % 24, m: +get('minute'), s: +get('second'), wd: get('weekday') }
}

export function marketStatusAt(d: Date): MarketStatus {
  const { h, m, wd } = istParts(d)
  if (wd === 'Sat' || wd === 'Sun') return 'CLOSED'
  const mins = h * 60 + m
  if (mins >= 9 * 60 && mins < 9 * 60 + 15) return 'PRE-OPEN'
  if (mins >= 9 * 60 + 15 && mins < 15 * 60 + 30) return 'OPEN'
  return 'CLOSED'
}

export function useISTClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const { h, m, s } = istParts(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { time: `${pad(h)}:${pad(m)}:${pad(s)}`, status: marketStatusAt(now) }
}

const BASE_PRICES: Record<string, number> = Object.fromEntries(STOCKS.map((s) => [s.symbol, s.price]))

/** Simulated tick stream: small random walk around reference prices while the market is open. */
export function useLivePrices(active: boolean) {
  const [prices, setPrices] = useState(BASE_PRICES)
  const r = useRef(rng(Date.now() % 100000))
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      setPrices((prev) => {
        const next: Record<string, number> = {}
        for (const s of STOCKS) {
          const step = gauss(r.current) * (s.vol / Math.sqrt(252)) * 0.035
          const drifted = prev[s.symbol] * (1 + step)
          // mean-revert gently toward reference so the session stays plausible
          next[s.symbol] = +(drifted + (s.price - drifted) * 0.02).toFixed(2)
        }
        return next
      })
    }, 2500)
    return () => clearInterval(id)
  }, [active])
  return prices
}
