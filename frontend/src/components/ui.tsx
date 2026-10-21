import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '@/lib/format'

export type Tone = 'neutral' | 'accent' | 'up' | 'down' | 'warn'

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-fg',
  accent: 'text-accent',
  up: 'text-up',
  down: 'text-down',
  warn: 'text-warn',
}
const CHIP: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-2',
  accent: 'bg-accent/12 text-accent',
  up: 'bg-up/12 text-up',
  down: 'bg-down/12 text-down',
  warn: 'bg-warn/12 text-warn',
}
const DOT: Record<Tone, string> = {
  neutral: 'bg-fg-3',
  accent: 'bg-accent',
  up: 'bg-up',
  down: 'bg-down',
  warn: 'bg-warn',
}

/** Monochrome ramp used for multi-series data instead of a rainbow palette. */
export function accentShade(i: number, n: number) {
  const a = 1 - (i / Math.max(1, n - 1)) * 0.68
  return `rgba(77,141,255,${a.toFixed(2)})`
}

export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cx(
        'flex min-w-0 flex-col rounded-lg border border-line bg-surface',
        className,
      )}
    >
      {(title || right) && (
        <header className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-line px-3">
          <h2 className="truncate text-[12px] font-semibold text-fg">
            {title}
          </h2>
          {right && (
            <div className="flex shrink-0 items-center gap-2">{right}</div>
          )}
        </header>
      )}
      <div className={cx('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Chip({
  tone = 'neutral',
  children,
  dot,
  className,
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex h-[18px] items-center gap-1.5 rounded-[4px] px-1.5 text-[10.5px] font-semibold whitespace-nowrap',
        CHIP[tone],
        className,
      )}
    >
      {dot && <span className={cx('size-1.5 rounded-full', DOT[tone])} />}
      {children}
    </span>
  )
}

export function StatusDot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative flex size-1.5">
      {pulse && (
        <span
          className={cx(
            'absolute inline-flex size-full animate-ping rounded-full opacity-60',
            DOT[tone],
          )}
        />
      )}
      <span
        className={cx('relative inline-flex size-1.5 rounded-full', DOT[tone])}
      />
    </span>
  )
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Array<{ value: T; label: ReactNode }>
  value: T | null
  onChange: (v: T) => void
  label?: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        'flex h-7 items-center rounded-md border border-line bg-canvas p-0.5',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex h-full flex-1 items-center justify-center gap-1.5 rounded-[4px] px-2 text-[11.5px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent [&>svg]:size-3.5',
              active
                ? 'bg-surface-3 text-fg shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]'
                : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  label: string
  className?: string
}) {
  return (
    <label className={cx('relative block', className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-7 w-full cursor-pointer appearance-none rounded-md border border-line bg-canvas pr-7 pl-2 text-[11.5px] font-medium text-fg transition-colors outline-none hover:border-line-2 focus-visible:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-fg-3" />
    </label>
  )
}

export function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function Label({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'text-[10.5px] font-medium tracking-[0.04em] text-fg-3 uppercase',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function KV({
  k,
  v,
  tone,
  sub,
  className,
}: {
  k: ReactNode
  v: ReactNode
  tone?: Tone
  sub?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex h-[22px] items-center justify-between gap-3',
        className,
      )}
    >
      <span className="truncate text-[11.5px] text-fg-3">{k}</span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span
          className={cx(
            'num text-[12px] font-medium',
            tone ? TONE_TEXT[tone] : 'text-fg',
          )}
        >
          {v}
        </span>
        {sub && <span className="num text-[11px] text-fg-3">{sub}</span>}
      </span>
    </div>
  )
}

/** KPI cell for strip layouts. */
export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
  loading,
  right,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  loading?: boolean
  right?: ReactNode
}) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {right}
      </div>
      {loading ? (
        <div className="mt-2 space-y-1.5">
          <div className="skeleton h-6 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      ) : (
        <div className="animate-fade-in">
          <div
            className={cx(
              'mt-1 truncate text-[20px] leading-7 font-semibold tracking-tight',
              TONE_TEXT[tone],
            )}
          >
            {value}
          </div>
          {sub && (
            <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{sub}</div>
          )}
        </div>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded', className)} />
}

export const TH =
  'h-8 px-3 text-left text-[10.5px] font-medium tracking-[0.04em] text-fg-3 uppercase whitespace-nowrap'
export const TD = 'h-9 px-3 whitespace-nowrap'
