import { useState } from 'react'
import type { VolPoint } from '@/data/validation'
import { T4_Q05, normpdf, t4pdf } from '@/data/validation'
import { useSize } from '@/lib/hooks'
import { clamp, pct } from '@/lib/format'

const AX = '#697282'
const GRID = 'rgba(255,255,255,0.045)'
const ACC = '#4D8DFF'
const ALT = '#5F6878'
const DOWN = '#F0555A'
const UP = '#2EBD85'

export function VolChart({
  data,
  modelLabel,
}: {
  data: VolPoint[]
  modelLabel: string
}) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const P = { l: 46, r: 12, t: 12, b: 22 }
  const w = Math.max(0, width - P.l - P.r)
  const h = Math.max(0, height - P.t - P.b)
  const n = data.length
  const m =
    Math.max(
      ...data.map((d) =>
        Math.max(Math.abs(d.r), d.var, d.gjr * 1.645, d.hybrid * 1.645),
      ),
    ) * 1.08
  const x = (i: number) => P.l + (i / Math.max(1, n - 1)) * w
  const y = (v: number) => P.t + ((m - v) / (2 * m)) * h
  const line = (f: (d: VolPoint) => number) =>
    data
      .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(f(d)).toFixed(1)}`)
      .join('')
  const ticks = [-m * 0.8, -m * 0.4, 0, m * 0.4, m * 0.8]
  const hd = hover !== null ? data[hover] : null
  const hybrid = modelLabel === 'Hybrid'

  return (
    <div ref={ref} className="relative h-full min-h-[240px]">
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
                {(t * 100).toFixed(1)}%
              </text>
            </g>
          ))}
          {data.map((d, i) => (
            <line
              key={i}
              x1={x(i)}
              x2={x(i)}
              y1={y(0)}
              y2={y(d.r)}
              stroke={d.breach ? DOWN : 'rgba(163,171,184,0.28)'}
              strokeWidth={d.breach ? 1.4 : 1}
            />
          ))}
          <path
            d={line((d) => d.gjr * 1.645)}
            fill="none"
            stroke={hybrid ? ALT : ACC}
            strokeWidth={hybrid ? 1.1 : 1.5}
          />
          <path
            d={line((d) => d.hybrid * 1.645)}
            fill="none"
            stroke={hybrid ? ACC : ALT}
            strokeWidth={hybrid ? 1.5 : 1.1}
          />
          <path
            d={line((d) => -d.var)}
            fill="none"
            stroke={DOWN}
            strokeOpacity="0.8"
            strokeWidth="1.1"
            strokeDasharray="4 3"
          />
          {data.map((d, i) =>
            d.breach ? (
              <circle
                key={`b${i}`}
                cx={x(i)}
                cy={y(d.r)}
                r="3"
                fill={DOWN}
                stroke="#0D1015"
                strokeWidth="1"
              />
            ) : null,
          )}
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
          <text
            x={P.l + w}
            y={height - 6}
            fill={AX}
            fontSize="9.5"
            textAnchor="end"
            className="num"
          >
            OOS day {n} →
          </text>
          <text x={P.l} y={height - 6} fill={AX} fontSize="9.5" className="num">
            day 1
          </text>
        </svg>
      )}
      {hd && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-md border border-line-2 bg-surface-2/95 px-2.5 py-2 text-[11px] leading-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          style={
            x(hover) > width / 2
              ? { right: width - x(hover) + 10 }
              : { left: x(hover) + 10 }
          }
        >
          <div className="mb-0.5 font-medium text-fg-2">
            OOS day {hover + 1}
          </div>
          <Row k="Return" v={pct(hd.r)} c={hd.r >= 0 ? UP : DOWN} />
          <Row
            k="GJR 95% band"
            v={`±${(hd.gjr * 164.5).toFixed(2)}%`}
            c={hybrid ? undefined : ACC}
          />
          <Row
            k="Hybrid 95% band"
            v={`±${(hd.hybrid * 164.5).toFixed(2)}%`}
            c={hybrid ? ACC : undefined}
          />
          <Row k={`VaR (${modelLabel})`} v={pct(-hd.var)} c={DOWN} />
          {hd.breach && (
            <div className="mt-1 font-medium text-down">VaR breach</div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-fg-3">{k}</span>
      <span className="num font-medium" style={{ color: c ?? '#E6E9EE' }}>
        {v}
      </span>
    </div>
  )
}

export function DistChart({
  mean,
  sigma,
  tail,
}: {
  mean: number
  sigma: number
  tail: number
}) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const P = { l: 12, r: 12, t: 26, b: 24 }
  const w = Math.max(0, width - P.l - P.r)
  const h = Math.max(0, height - P.t - P.b)
  const zMin = -4.5
  const zMax = 4.5
  const N = 160
  const zs = Array.from(
    { length: N + 1 },
    (_, i) => zMin + ((zMax - zMin) * i) / N,
  )
  const peak = Math.max(t4pdf(0), normpdf(0)) * 1.08
  const x = (z: number) => P.l + ((z - zMin) / (zMax - zMin)) * w
  const y = (p: number) => P.t + h - (p / peak) * h
  const curve = (f: (z: number) => number) =>
    zs.map(
      (z, i) => `${i ? 'L' : 'M'}${x(z).toFixed(1)},${y(f(z)).toFixed(1)}`,
    ).join('')
  const qZ = T4_Q05
  const tailZs = zs.filter((z) => z <= qZ)
  const tailPath =
    tailZs.length > 1
      ? `M${x(tailZs[0])},${y(0)}` +
        tailZs
          .map((z) => `L${x(z).toFixed(1)},${y(t4pdf(z)).toFixed(1)}`)
          .join('') +
        `L${x(qZ)},${y(t4pdf(qZ))}L${x(qZ)},${y(0)}Z`
      : ''
  const tailZ = clamp((tail - mean) / sigma, zMin + 0.2, zMax)
  const toRet = (z: number) => mean + z * sigma
  const xTicks = [-4, -2, 0, 2, 4]

  return (
    <div ref={ref} className="relative h-full min-h-[240px]">
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0">
          <defs>
            <linearGradient id="tFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={ACC} stopOpacity="0.18" />
              <stop offset="1" stopColor={ACC} stopOpacity="0" />
            </linearGradient>
          </defs>
          {xTicks.map((z) => (
            <g key={z}>
              <line x1={x(z)} x2={x(z)} y1={P.t} y2={P.t + h} stroke={GRID} />
              <text
                x={x(z)}
                y={height - 7}
                fill={AX}
                fontSize="9.5"
                textAnchor="middle"
                className="num"
              >
                {pct(toRet(z), 1)}
              </text>
            </g>
          ))}
          <line
            x1={P.l}
            x2={P.l + w}
            y1={y(0)}
            y2={y(0)}
            stroke="rgba(255,255,255,0.12)"
          />
          <path
            d={`${curve(t4pdf)}L${x(zMax)},${y(0)}L${x(zMin)},${y(0)}Z`}
            fill="url(#tFill)"
          />
          <path d={tailPath} fill={DOWN} opacity="0.35" />
          <path
            d={curve(normpdf)}
            fill="none"
            stroke={ALT}
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          <path d={curve(t4pdf)} fill="none" stroke={ACC} strokeWidth="1.6" />

          <line
            x1={x(0)}
            x2={x(0)}
            y1={P.t - 6}
            y2={y(0)}
            stroke="#E6E9EE"
            strokeOpacity="0.5"
            strokeWidth="1"
          />
          <text
            x={x(0) + 5}
            y={P.t - 10}
            fill="#E6E9EE"
            fontSize="10"
            fontWeight="500"
            className="num"
          >
            μ {pct(mean)}
          </text>
          <line
            x1={x(qZ)}
            x2={x(qZ)}
            y1={P.t + h * 0.35}
            y2={y(0)}
            stroke={DOWN}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x={x(qZ) + 4}
            y={P.t + h * 0.35 + 2}
            fill={AX}
            fontSize="9.5"
            className="num"
          >
            VaR95 {pct(toRet(qZ))}
          </text>
          <circle
            cx={x(tailZ)}
            cy={y(0)}
            r="3.5"
            fill={DOWN}
            stroke="#0D1015"
            strokeWidth="1.5"
          />
          <text
            x={x(tailZ)}
            y={y(0) - 10}
            fill={DOWN}
            fontSize="10"
            fontWeight="500"
            textAnchor="middle"
            className="num"
          >
            Tail {pct(tail)}
          </text>
        </svg>
      )}
    </div>
  )
}
