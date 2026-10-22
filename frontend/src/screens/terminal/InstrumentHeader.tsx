import { useMemo } from 'react'
import { getHistory, type Bar, type Stock } from '@/data/market'
import { cx, num, pct } from '@/lib/format'

function compactQty(v: number) {
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(0)
}

export function InstrumentHeader({
  stock,
  price,
  bars: customBars,
}: {
  stock: Stock
  price: number
  bars?: Bar[]
}) {
  const stats = useMemo(() => {
    const hist = customBars && customBars.length > 0 ? customBars : getHistory(stock.symbol)
    const last = hist[hist.length - 1]
    const prev = hist.length > 1 ? hist[hist.length - 2] : last
    const yr = hist.slice(-252)
    const closes = hist.slice(-200).map((b) => b.c)
    return {
      open: last.o,
      high: Math.max(last.h, price),
      low: Math.min(last.l, price),
      prevClose: prev.c,
      hi52: Math.max(...yr.map((b) => b.h), price),
      lo52: Math.min(...yr.map((b) => b.l), price),
      avgVol: hist.slice(-20).reduce((a, b) => a + b.v, 0) / 20,
      sma200: closes.reduce((a, b) => a + b, 0) / closes.length,
    }
  }, [stock.symbol, price, customBars])

  const prevClose = stats.prevClose
  const dayChg = price - prevClose
  const up = dayChg >= 0
  const posIn52 = (price - stats.lo52) / Math.max(1e-9, stats.hi52 - stats.lo52)

  const cells: Array<[string, string, string?]> = [
    ['Open', num(stats.open)],
    ['High', num(stats.high)],
    ['Low', num(stats.low)],
    ['Prev close', num(prevClose)],
    ['Avg vol 20D', compactQty(stats.avgVol)],
    [
      'vs SMA 200',
      pct(price / stats.sma200 - 1),
      price >= stats.sma200 ? 'text-up' : 'text-down',
    ],
    ['Ann. vol', `${(stock.vol * 100).toFixed(1)}%`],
  ]

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-line bg-surface px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-5">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="text-[17px] font-semibold tracking-tight text-fg">
              {stock.symbol}
            </h1>
            <span className="rounded-[3px] border border-line-2 px-1 text-[9.5px] font-semibold tracking-[0.04em] text-fg-3">
              NSE
            </span>
          </div>
          <div className="truncate text-[11.5px] text-fg-3">
            {stock.name} · {stock.sectorLabel}
          </div>
        </div>
        <div>
          <div className="num text-[22px] leading-7 font-semibold text-fg">
            {num(price)}
          </div>
          <div
            className={cx(
              'num text-[12px] font-medium',
              up ? 'text-up' : 'text-down',
            )}
          >
            {up ? '+' : ''}
            {num(dayChg)} ({pct(price / prevClose - 1)})
          </div>
        </div>
      </div>

      <dl className="ml-auto grid grid-cols-4 gap-x-5 gap-y-1.5 sm:grid-cols-8">
        {cells.map(([k, v, c]) => (
          <div key={k} className="min-w-0">
            <dt className="truncate text-[10.5px] text-fg-3">{k}</dt>
            <dd className={cx('num text-[12px] font-medium', c ?? 'text-fg')}>
              {v}
            </dd>
          </div>
        ))}
        <div className="col-span-1 min-w-[96px]">
          <dt className="flex justify-between text-[10.5px] text-fg-3">
            <span>52W range</span>
          </dt>
          <dd className="mt-1.5">
            <div className="relative h-1 rounded-full bg-line-2">
              <span
                className="absolute -top-[3px] h-2.5 w-0.5 rounded-full bg-fg"
                style={{ left: `calc(${(posIn52 * 100).toFixed(1)}% - 1px)` }}
              />
            </div>
            <div className="num mt-1 flex justify-between text-[10px] text-fg-3">
              <span>{num(stats.lo52, 0)}</span>
              <span>{num(stats.hi52, 0)}</span>
            </div>
          </dd>
        </div>
      </dl>
    </section>
  )
}
