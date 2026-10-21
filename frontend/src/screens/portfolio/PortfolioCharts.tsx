import { useState } from 'react'
import { STRATEGY_META, type Backtest, type Position } from '@/data/portfolio'
import { useSize } from '@/lib/hooks'
import { clamp, cx, inr, pct } from '@/lib/format'

const AX = '#697282'
const GRID = 'rgba(255,255,255,0.045)'
const ACC = '#4D8DFF'
const ORDER = ['nifty', 'equal', 'mpt', 'trc', 'cvar'] as const

export function WealthChart({
  bt,
  view,
  active,
}: {
  bt: Backtest
  view: 'wealth' | 'drawdown'
  active: string
}) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const P = { l: 58, r: 12, t: 10, b: 22 }
  const w = Math.max(0, width - P.l - P.r)
  const h = Math.max(0, height - P.t - P.b)
  const src = view === 'wealth' ? bt.wealth : bt.drawdown
  const n = bt.dates.length
  const all = ORDER.flatMap((k) => src[k])
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (view === 'drawdown') hi = 0
  const pad = (hi - lo) * 0.06
  lo -= pad
  hi += view === 'wealth' ? pad : 0.002
  const x = (i: number) => P.l + (i / (n - 1)) * w
  const y = (v: number) => P.t + ((hi - v) / (hi - lo)) * h
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
  const months = Array.from({ length: 5 }, (_, i) =>
    Math.round((i / 4) * (n - 1)),
  )
  const color = (k: typeof ORDER[number]) =>
    k === active ? ACC : STRATEGY_META[k].color
  const drawOrder = [
    ...ORDER.filter((k) => k !== active),
    ...ORDER.filter((k) => k === active),
  ]
  const fmtY = (v: number) =>
    view === 'wealth'
      ? `₹${(v / 1000).toFixed(0)}K`
      : `${(v * 100).toFixed(0)}%`

  return (
    <div ref={ref} className="relative h-full min-h-[220px]">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="absolute inset-0"
          onMouseMove={(e) => {
            const px = e.clientX - e.currentTarget.getBoundingClientRect().left
            setHover(clamp(Math.round(((px - P.l) / w) * (n - 1)), 0, n - 1))
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={P.l} x2={P.l + w} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text
                x={P.l - 8}
                y={y(t) + 3}
                fill={AX}
                fontSize="9.5"
                textAnchor="end"
                className="num"
              >
                {fmtY(t)}
              </text>
            </g>
          ))}
          {months.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              fill={AX}
              fontSize="9.5"
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              className="num"
            >
              {new Intl.DateTimeFormat('en-IN', {
                month: 'short',
                year: '2-digit',
              }).format(bt.dates[i])}
            </text>
          ))}
          {view === 'wealth' && (
            <line
              x1={P.l}
              x2={P.l + w}
              y1={y(100000)}
              y2={y(100000)}
              stroke="rgba(255,255,255,0.14)"
              strokeDasharray="2 3"
            />
          )}
          {drawOrder.map((k) => {
            const d = src[k]
              .map(
                (v, i) =>
                  `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`,
              )
              .join('')
            const isActive = k === active
            return (
              <g key={k}>
                {view === 'drawdown' && isActive && (
                  <path
                    d={`${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`}
                    fill={ACC}
                    opacity="0.12"
                  />
                )}
                <path
                  d={d}
                  fill="none"
                  stroke={color(k)}
                  strokeWidth={isActive ? 1.8 : 1.1}
                  strokeOpacity={isActive ? 1 : 0.8}
                  strokeDasharray={k === 'nifty' ? '4 3' : undefined}
                />
              </g>
            )
          })}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={P.t}
              y2={P.t + h}
              stroke="rgba(230,233,238,0.3)"
              strokeDasharray="2 3"
            />
          )}
        </svg>
      )}
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 min-w-[180px] rounded-md border border-line-2 bg-surface-2/95 px-2.5 py-2 text-[11px] leading-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          style={
            x(hover) > width / 2
              ? { right: width - x(hover) + 10 }
              : { left: x(hover) + 10 }
          }
        >
          <div className="mb-0.5 font-medium text-fg-2">
            {new Intl.DateTimeFormat('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }).format(bt.dates[hover])}
          </div>
          {[...ORDER].reverse().map((k) => (
            <div key={k} className="flex justify-between gap-4">
              <span
                className={cx(
                  'flex items-center gap-1.5',
                  k === active ? 'text-fg' : 'text-fg-3',
                )}
              >
                <i
                  className="size-1.5 rounded-full"
                  style={{ background: color(k) }}
                />
                {k === 'nifty' ? 'NIFTY 50' : k.toUpperCase()}
              </span>
              <span
                className={cx(
                  'num font-medium',
                  k === active ? 'text-fg' : 'text-fg-2',
                )}
              >
                {view === 'wealth' ? inr(src[k][hover]) : pct(src[k][hover], 1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PrcChart({ positions }: { positions: Position[] }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const P = { l: 38, r: 8, t: 10, b: 34 }
  const w = Math.max(0, width - P.l - P.r)
  const h = Math.max(0, height - P.t - P.b)
  const max =
    Math.max(...positions.flatMap((p) => [p.actualWeight, p.prc]), 0.05) * 1.15
  const y = (v: number) => P.t + h - (v / max) * h
  const slot = w / Math.max(1, positions.length)
  const bw = Math.min(16, slot * 0.3)
  const ticks = [0, max / 3, (2 * max) / 3, max]

  return (
    <div ref={ref} className="relative h-full min-h-[220px]">
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={P.l}
                x2={P.l + w}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? 'rgba(255,255,255,0.12)' : GRID}
              />
              <text
                x={P.l - 6}
                y={y(t) + 3}
                fill={AX}
                fontSize="9.5"
                textAnchor="end"
                className="num"
              >
                {(t * 100).toFixed(0)}%
              </text>
            </g>
          ))}
          {positions.map((p, i) => {
            const cx = P.l + slot * (i + 0.5)
            return (
              <g key={p.stock.symbol}>
                <rect
                  x={cx - bw - 1}
                  y={y(p.actualWeight)}
                  width={bw}
                  height={y(0) - y(p.actualWeight)}
                  rx="1.5"
                  fill="#4A515D"
                >
                  <title>{`${p.stock.symbol} weight ${(p.actualWeight * 100).toFixed(1)}%`}</title>
                </rect>
                <rect
                  x={cx + 1}
                  y={y(p.prc)}
                  width={bw}
                  height={y(0) - y(p.prc)}
                  rx="1.5"
                  fill={ACC}
                >
                  <title>{`${p.stock.symbol} risk contribution ${(p.prc * 100).toFixed(1)}%`}</title>
                </rect>
                <text
                  x={cx}
                  y={height - P.b + 14}
                  fill="#A3ABB8"
                  fontSize="9.5"
                  textAnchor="middle"
                  className="num"
                >
                  {p.stock.symbol.length > 9
                    ? p.stock.symbol.slice(0, 8) + '…'
                    : p.stock.symbol}
                </text>
                <text
                  x={cx}
                  y={height - P.b + 26}
                  fill={p.prc > p.actualWeight / 0.85 ? '#F0555A' : '#697282'}
                  fontSize="9"
                  textAnchor="middle"
                  className="num"
                >
                  {(p.prc / Math.max(1e-6, p.actualWeight)).toFixed(2)}x
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
