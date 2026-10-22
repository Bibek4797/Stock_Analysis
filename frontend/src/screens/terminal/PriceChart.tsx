import { useMemo, useState, type ReactNode } from 'react'
import { CandlestickChart as ChartCandlestick, LineChart as ChartLine } from 'lucide-react'
import { getHistory, type Bar, type Forecast, type Stock } from '@/data/market'
import { Seg } from '@/components/ui'
import { useSize } from '@/lib/hooks'
import { clamp, cx, inr, num, pct } from '@/lib/format'

type Range = '3M' | '6M' | '1Y' | '2Y' | '5Y'
const RANGE_DAYS: Record<Range, number> = {
  '3M': 63,
  '6M': 126,
  '1Y': 252,
  '2Y': 504,
  '5Y': 1250,
}

interface Agg extends Bar {
  sma: number | null
  bbU: number | null
  bbL: number | null
}

const C = {
  up: '#2EBD85',
  down: '#F0555A',
  accent: '#4D8DFF',
  sma: '#C9CED8',
  band: 'rgba(163,171,184,0.32)',
  grid: 'rgba(255,255,255,0.045)',
  axis: '#697282',
  fg: '#E6E9EE',
}

function rolling(values: number[], n: number) {
  const mean: Array<number | null> = []
  const sd: Array<number | null> = []
  let sum = 0
  let sq = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    sq += values[i] ** 2
    if (i >= n) {
      sum -= values[i - n]
      sq -= values[i - n] ** 2
    }
    if (i >= n - 1) {
      const m = sum / n
      mean.push(m)
      sd.push(Math.sqrt(Math.max(0, sq / n - m * m)))
    } else {
      mean.push(null)
      sd.push(null)
    }
  }
  return { mean, sd }
}

function niceTicks(lo: number, hi: number, count = 5) {
  const span = hi - lo
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 1) ??
    mag * 10
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v)
  return out
}

function addTradingDays(t: number, n: number) {
  const d = new Date(t)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d
}

const fmtDate = (t: number | Date, long: boolean) =>
  new Intl.DateTimeFormat(
    'en-IN',
    long
      ? { month: 'short', year: '2-digit' }
      : { day: '2-digit', month: 'short' },
  ).format(t)

export function PriceChart({
  stock,
  price,
  fc,
  bars: customBars,
}: {
  stock: Stock
  price: number
  fc: Forecast
  bars?: Bar[]
}) {
  const [range, setRange] = useState<Range>('6M')
  const [mode, setMode] = useState<'candles' | 'line'>('candles')
  const [showCone, setShowCone] = useState(true)
  const [showBands, setShowBands] = useState(true)
  const [showSma, setShowSma] = useState(true)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [ref, { width, height }] = useSize<HTMLDivElement>()

  const bars = useMemo<Agg[]>(() => {
    const hist = customBars && customBars.length > 0 ? customBars : getHistory(stock.symbol)
    const last = hist[hist.length - 1]
    const full = [
      ...hist.slice(0, -1),
      {
        ...last,
        c: price,
        h: Math.max(last.h, price),
        l: Math.min(last.l, price),
      },
    ]
    const closes = full.map((b) => b.c)
    const sma = rolling(closes, 200).mean
    const bb = rolling(closes, 20)
    const days = RANGE_DAYS[range]
    const group = days > 300 ? 5 : 1
    const out: Agg[] = []
    for (let end = full.length; end > full.length - days; end -= group) {
      const slice = full.slice(Math.max(0, end - group), end)
      const idx = end - 1
      out.push({
        t: slice[slice.length - 1].t,
        o: slice[0].o,
        h: Math.max(...slice.map((b) => b.h)),
        l: Math.min(...slice.map((b) => b.l)),
        c: slice[slice.length - 1].c,
        v: slice.reduce((a, b) => a + b.v, 0),
        sma: sma[idx],
        bbU: bb.mean[idx] !== null ? bb.mean[idx]! + 2 * bb.sd[idx]! : null,
        bbL: bb.mean[idx] !== null ? bb.mean[idx]! - 2 * bb.sd[idx]! : null,
      })
    }
    return out.reverse()
  }, [stock.symbol, price, range, customBars])

  const H = fc.horizon
  const dv = stock.vol / Math.sqrt(252)
  const cone = useMemo(
    () =>
      Array.from({ length: H + 1 }, (_, t) => {
        const mean = price * (1 + (fc.expRet * t) / H)
        const s = dv * Math.sqrt(t)
        return {
          t,
          mean,
          u1: mean * (1 + s),
          l1: mean * (1 - s),
          u2: mean * (1 + 1.96 * s),
          l2: mean * (1 - 1.96 * s),
        }
      }),
    [H, price, fc.expRet, dv],
  )

  // ---- layout
  const PAD = { l: 0, r: 72, t: 12, b: 24 }
  const plotW = Math.max(0, width - PAD.l - PAD.r)
  const plotH = Math.max(0, height - PAD.t - PAD.b)
  const volH = plotH * 0.12
  const priceH = plotH - volH - 8
  const futureW = clamp(plotW * 0.18, 90, 230)
  const histW = plotW - futureW
  const n = bars.length
  const step = n ? histW / n : 1
  const xi = (i: number) => PAD.l + step * (i + 0.5)
  const xNow = PAD.l + histW
  const xt = (t: number) => xNow + (t / H) * (futureW - 14)

  let lo = Infinity
  let hi = -Infinity
  for (const b of bars) {
    lo = Math.min(lo, b.l)
    hi = Math.max(hi, b.h)
    if (showBands && b.bbU !== null && b.bbL !== null) {
      lo = Math.min(lo, b.bbL)
      hi = Math.max(hi, b.bbU)
    }
    if (showSma && b.sma !== null) {
      lo = Math.min(lo, b.sma)
      hi = Math.max(hi, b.sma)
    }
  }
  lo = Math.min(lo, fc.stop, showCone ? cone[H].l2 : Infinity)
  hi = Math.max(hi, fc.target, showCone ? cone[H].u2 : -Infinity)
  const padV = (hi - lo) * 0.05
  lo -= padV
  hi += padV
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * priceH
  const vMax = Math.max(1, ...bars.map((b) => b.v))
  const volTop = PAD.t + priceH + 8
  const yv = (v: number) => volTop + volH - (v / vMax) * volH

  const ticks = width ? niceTicks(lo, hi, 6) : []
  const longDates = RANGE_DAYS[range] > 300
  const dateIdx = n
    ? Array.from({ length: 6 }, (_, k) => Math.round(((k + 0.5) / 6) * (n - 1)))
    : []

  const path = (pts: Array<[number, number]>) =>
    pts
      .map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`)
      .join('')
  const seriesPath = (get: (b: Agg) => number | null) => {
    let d = ''
    let pen = false
    bars.forEach((b, i) => {
      const v = get(b)
      if (v === null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${xi(i).toFixed(1)},${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }
  const band = (
    upper: Array<[number, number]>,
    lower: Array<[number, number]>,
  ) =>
    `${path(upper)}L${[...lower]
      .reverse()
      .map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`)
      .join('L')}Z`

  const bbPts = bars
    .map((b, i) =>
      b.bbU !== null && b.bbL !== null ? { i, u: b.bbU, l: b.bbL } : null,
    )
    .filter(Boolean) as Array<{
    i: number
    u: number
    l: number
  }>

  // price tags on the right axis, de-overlapped
  const tags = [
    { key: 'target', v: fc.target, color: C.up, text: '#04130d' },
    { key: 'ltp', v: price, color: C.fg, text: '#08090C' },
    { key: 'stop', v: fc.stop, color: C.down, text: '#1a0509' },
  ]
    .map((t) => ({ ...t, y: y(t.v) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < tags.length; i++)
    if (tags[i].y - tags[i - 1].y < 18) tags[i].y = tags[i - 1].y + 18

  // hover
  let tip: null | {
    x: number
    lines: Array<[string, string, string?]>
    title: string
    yLine?: number
  } = null
  if (hoverX !== null && n) {
    if (hoverX < xNow) {
      const i = clamp(Math.floor((hoverX - PAD.l) / step), 0, n - 1)
      const b = bars[i]
      const ch = b.c / b.o - 1
      tip = {
        x: xi(i),
        yLine: y(b.c),
        title:
          fmtDate(b.t, false) +
          (longDates ? ` ’${new Date(b.t).getFullYear() % 100} · wk` : ''),
        lines: [
          ['O', num(b.o)],
          ['H', num(b.h)],
          ['L', num(b.l)],
          ['C', num(b.c), ch >= 0 ? C.up : C.down],
          ['Δ', pct(ch), ch >= 0 ? C.up : C.down],
        ],
      }
    } else if (showCone) {
      const t = clamp(Math.round(((hoverX - xNow) / (futureW - 14)) * H), 1, H)
      const c = cone[t]
      tip = {
        x: xt(t),
        yLine: y(c.mean),
        title: `T+${t} · ${fmtDate(addTradingDays(bars[n - 1].t, t), false)} · forecast`,
        lines: [
          ['Upper 95%', inr(c.u2, 2), C.up],
          ['Mean path', inr(c.mean, 2), C.accent],
          ['Lower 95%', inr(c.l2, 2), C.down],
        ],
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-line px-2.5">
        <div className="flex items-center gap-2">
          <Seg
            label="Chart range"
            options={(Object.keys(RANGE_DAYS) as Range[]).map((r) => ({
              value: r,
              label: r,
            }))}
            value={range}
            onChange={setRange}
          />
          <Seg
            label="Chart type"
            value={mode}
            onChange={setMode}
            options={[
              {
                value: 'candles',
                label: <ChartCandlestick aria-label="Candles" />,
              },
              { value: 'line', label: <ChartLine aria-label="Line" /> },
            ]}
          />
          <span className="hidden text-[11px] text-fg-4 md:inline">
            {longDates ? 'Weekly' : 'Daily'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Toggle
            on={showSma}
            onClick={() => setShowSma((v) => !v)}
            swatch={
              <i className="h-0.5 w-3 rounded" style={{ background: C.sma }} />
            }
          >
            SMA 200
          </Toggle>
          <Toggle
            on={showBands}
            onClick={() => setShowBands((v) => !v)}
            swatch={
              <i className="h-2 w-3 rounded-[2px] border border-fg-3/60 bg-fg-3/10" />
            }
          >
            BB 20·2σ
          </Toggle>
          <Toggle
            on={showCone}
            onClick={() => setShowCone((v) => !v)}
            swatch={<i className="h-2 w-3 rounded-[2px] bg-accent/40" />}
          >
            {H}D cone
          </Toggle>
        </div>
      </header>

      <div ref={ref} className="relative min-h-0 flex-1 select-none">
        {width > 0 && height > 0 && (
          <svg
            width={width}
            height={height}
            className="absolute inset-0"
            onMouseMove={(e) =>
              setHoverX(
                e.clientX - e.currentTarget.getBoundingClientRect().left,
              )
            }
            onMouseLeave={() => setHoverX(null)}
            role="img"
            aria-label={`${stock.symbol} price chart with ${H}-day forecast cone`}
          >
            <defs>
              <linearGradient id="coneFill" x1="0" x2="1">
                <stop offset="0" stopColor={C.accent} stopOpacity="0.22" />
                <stop offset="1" stopColor={C.accent} stopOpacity="0.06" />
              </linearGradient>
              <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={C.accent} stopOpacity="0.16" />
                <stop offset="1" stopColor={C.accent} stopOpacity="0" />
              </linearGradient>
              <pattern
                id="futureHatch"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="rgba(255,255,255,0.025)"
                  strokeWidth="2"
                />
              </pattern>
            </defs>

            {/* grid */}
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.l}
                  x2={PAD.l + plotW}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={C.grid}
                />
                <text
                  x={PAD.l + plotW + 8}
                  y={y(v) + 3.5}
                  fill={C.axis}
                  fontSize="10"
                  className="num"
                >
                  {num(v, v >= 1000 ? 0 : 2)}
                </text>
              </g>
            ))}
            {dateIdx.map((i) => (
              <g key={i}>
                <line
                  x1={xi(i)}
                  x2={xi(i)}
                  y1={PAD.t}
                  y2={volTop + volH}
                  stroke={C.grid}
                />
                <text
                  x={xi(i)}
                  y={height - 8}
                  fill={C.axis}
                  fontSize="10"
                  textAnchor="middle"
                  className="num"
                >
                  {fmtDate(bars[i].t, longDates)}
                </text>
              </g>
            ))}

            {/* future zone */}
            <rect
              x={xNow}
              y={PAD.t}
              width={futureW}
              height={priceH}
              fill="url(#futureHatch)"
            />
            <line
              x1={xNow}
              x2={xNow}
              y1={PAD.t}
              y2={volTop + volH}
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="2 3"
            />
            <text
              x={xNow + 6}
              y={PAD.t + 10}
              fill={C.axis}
              fontSize="9.5"
              className="num"
              letterSpacing="0.06em"
            >
              T+{H}
            </text>

            {/* bollinger */}
            {showBands && bbPts.length > 1 && (
              <g>
                <path
                  d={band(
                    bbPts.map((p) => [xi(p.i), y(p.u)]),
                    bbPts.map((p) => [xi(p.i), y(p.l)]),
                  )}
                  fill="rgba(163,171,184,0.045)"
                />
                <path
                  d={path(bbPts.map((p) => [xi(p.i), y(p.u)]))}
                  fill="none"
                  stroke={C.band}
                  strokeWidth="1"
                />
                <path
                  d={path(bbPts.map((p) => [xi(p.i), y(p.l)]))}
                  fill="none"
                  stroke={C.band}
                  strokeWidth="1"
                />
              </g>
            )}

            {/* volume */}
            {bars.map((b, i) => (
              <rect
                key={`v${i}`}
                x={xi(i) - Math.max(0.5, step * 0.31)}
                width={Math.max(1, step * 0.62)}
                y={yv(b.v)}
                height={volTop + volH - yv(b.v)}
                fill={b.c >= b.o ? C.up : C.down}
                opacity="0.2"
              />
            ))}

            {/* price */}
            {mode === 'candles' ? (
              bars.map((b, i) => {
                const up = b.c >= b.o
                const col = up ? C.up : C.down
                const bw = Math.max(1, step * 0.62)
                const top = y(Math.max(b.o, b.c))
                const bh = Math.max(1, Math.abs(y(b.o) - y(b.c)))
                return (
                  <g key={i}>
                    <line
                      x1={xi(i)}
                      x2={xi(i)}
                      y1={y(b.h)}
                      y2={y(b.l)}
                      stroke={col}
                      strokeWidth="1"
                    />
                    <rect
                      x={xi(i) - bw / 2}
                      y={top}
                      width={bw}
                      height={bh}
                      fill={col}
                      rx={bw > 4 ? 1 : 0}
                    />
                  </g>
                )
              })
            ) : (
              <g>
                <path
                  d={`${seriesPath((b) => b.c)}L${xi(n - 1)},${PAD.t + priceH}L${xi(0)},${PAD.t + priceH}Z`}
                  fill="url(#lineFill)"
                />
                <path
                  d={seriesPath((b) => b.c)}
                  fill="none"
                  stroke={C.accent}
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* SMA 200 */}
            {showSma && (
              <path
                d={seriesPath((b) => b.sma)}
                fill="none"
                stroke={C.sma}
                strokeWidth="1.25"
                opacity="0.75"
              />
            )}

            {/* forecast cone */}
            {showCone && (
              <g>
                <path
                  d={band(
                    cone.map((c) => [xt(c.t), y(c.u2)]),
                    cone.map((c) => [xt(c.t), y(c.l2)]),
                  )}
                  fill="url(#coneFill)"
                />
                <path
                  d={band(
                    cone.map((c) => [xt(c.t), y(c.u1)]),
                    cone.map((c) => [xt(c.t), y(c.l1)]),
                  )}
                  fill={C.accent}
                  opacity="0.14"
                />
                <path
                  d={path(cone.map((c) => [xt(c.t), y(c.u2)]))}
                  fill="none"
                  stroke={C.accent}
                  strokeOpacity="0.4"
                  strokeWidth="1"
                />
                <path
                  d={path(cone.map((c) => [xt(c.t), y(c.l2)]))}
                  fill="none"
                  stroke={C.accent}
                  strokeOpacity="0.4"
                  strokeWidth="1"
                />
                <path
                  d={path(cone.map((c) => [xt(c.t), y(c.mean)]))}
                  fill="none"
                  stroke={C.accent}
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
                <circle cx={xt(H)} cy={y(cone[H].mean)} r="3" fill={C.accent} />
              </g>
            )}

            {/* level lines */}
            <line
              x1={PAD.l}
              x2={PAD.l + plotW}
              y1={y(fc.target)}
              y2={y(fc.target)}
              stroke={C.up}
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity="0.6"
            />
            <line
              x1={PAD.l}
              x2={PAD.l + plotW}
              y1={y(price)}
              y2={y(price)}
              stroke={C.fg}
              strokeWidth="1"
              opacity="0.35"
              strokeDasharray="1 2"
            />
            <line
              x1={PAD.l}
              x2={PAD.l + plotW}
              y1={y(fc.stop)}
              y2={y(fc.stop)}
              stroke={C.down}
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity="0.6"
            />
            <text
              x={xNow - 6}
              y={y(fc.target) - 5}
              fill={C.up}
              fontSize="10"
              textAnchor="end"
              className="num"
              fontWeight="500"
            >
              Target {inr(fc.target, 2)} ({pct(fc.expRet)})
            </text>
            <text
              x={xNow - 6}
              y={y(fc.stop) + 13}
              fill={C.down}
              fontSize="10"
              textAnchor="end"
              className="num"
              fontWeight="500"
            >
              Stop {inr(fc.stop, 2)} ({pct(fc.tail)})
            </text>

            {tags.map((t) => (
              <g key={t.key}>
                <rect
                  x={PAD.l + plotW + 2}
                  y={t.y - 8}
                  width={PAD.r - 4}
                  height={16}
                  rx={3}
                  fill={t.color}
                />
                <text
                  x={PAD.l + plotW + 2 + (PAD.r - 4) / 2}
                  y={t.y + 3.5}
                  fill={t.text}
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                  className="num"
                >
                  {num(t.v, t.v >= 10000 ? 0 : 2)}
                </text>
              </g>
            ))}

            {/* crosshair */}
            {tip && (
              <g pointerEvents="none">
                <line
                  x1={tip.x}
                  x2={tip.x}
                  y1={PAD.t}
                  y2={volTop + volH}
                  stroke="rgba(230,233,238,0.3)"
                  strokeDasharray="2 3"
                />
                {tip.yLine !== undefined && (
                  <line
                    x1={PAD.l}
                    x2={PAD.l + plotW}
                    y1={tip.yLine}
                    y2={tip.yLine}
                    stroke="rgba(230,233,238,0.18)"
                    strokeDasharray="2 3"
                  />
                )}
                {hoverX !== null && hoverX >= xNow && showCone && (
                  <rect
                    x={tip.x - 3}
                    y={PAD.t}
                    width={6}
                    height={priceH}
                    fill={C.accent}
                    opacity="0.08"
                  />
                )}
              </g>
            )}
          </svg>
        )}

        {tip && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[148px] rounded-md border border-line-2 bg-surface-2/95 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur"
            style={
              tip.x > width / 2
                ? { right: width - tip.x + 12 }
                : { left: tip.x + 12 }
            }
          >
            <div className="mb-1 text-[10.5px] font-medium text-fg-2">
              {tip.title}
            </div>
            {tip.lines.map(([k, v, col]) => (
              <div
                key={k}
                className="flex justify-between gap-4 text-[11px] leading-[18px]"
              >
                <span className="text-fg-3">{k}</span>
                <span
                  className="num font-medium"
                  style={{ color: col ?? C.fg }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Toggle({
  on,
  onClick,
  swatch,
  children,
}: {
  on: boolean
  onClick: () => void
  swatch: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        'flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium whitespace-nowrap transition-colors',
        on
          ? 'text-fg-2 hover:bg-surface-2'
          : 'text-fg-4 line-through decoration-fg-4 hover:text-fg-3',
      )}
    >
      <span className={cx('flex items-center', !on && 'opacity-40')}>
        {swatch}
      </span>
      {children}
    </button>
  )
}
