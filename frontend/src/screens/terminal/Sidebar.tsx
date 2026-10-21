import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { SECTORS, STOCKS, type Sector } from '@/data/market'
import { Label, Seg } from '@/components/ui'
import { clamp, cx, num, pct } from '@/lib/format'

const CAPITAL_PRESETS = [
  { value: 100000, label: '1L' },
  { value: 500000, label: '5L' },
  { value: 1000000, label: '10L' },
  { value: 2500000, label: '25L' },
]
const HORIZONS = [3, 5, 7, 10]

export function Sidebar({
  capital,
  onCapital,
  horizon,
  onHorizon,
  symbol,
  onSymbol,
  prices,
}: {
  capital: number
  onCapital: (v: number) => void
  horizon: number
  onHorizon: (v: number) => void
  symbol: string
  onSymbol: (s: string) => void
  prices: Record<string, number>
}) {
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState<'All' | Sector>('All')
  const [capitalText, setCapitalText] = useState<string | null>(null)
  const [daysText, setDaysText] = useState<string | null>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return STOCKS.filter(
      (s) =>
        (sector === 'All' || s.sector === sector) &&
        (!q ||
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)),
    )
  }, [query, sector])

  const commitCapital = () => {
    if (capitalText === null) return
    const v = Number(capitalText.replace(/[^\d]/g, ''))
    if (v >= 10000) onCapital(Math.min(v, 1e9))
    setCapitalText(null)
  }
  const commitDays = () => {
    if (daysText === null) return
    const v = parseInt(daysText, 10)
    if (!Number.isNaN(v)) onHorizon(clamp(v, 1, 30))
    setDaysText(null)
  }
  const custom = !HORIZONS.includes(horizon)

  return (
    <aside className="flex min-h-0 flex-col border-line bg-surface max-lg:rounded-lg max-lg:border lg:sticky lg:top-[49px] lg:h-[calc(100dvh-49px)] lg:border-r">
      {/* parameters */}
      <div className="space-y-3 border-b border-line p-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Capital</Label>
            <span className="text-[10.5px] text-fg-4">INR</span>
          </div>
          <label className="flex h-9 items-center gap-1.5 rounded-md border border-line bg-canvas px-2.5 transition-colors focus-within:border-accent hover:border-line-2">
            <span className="text-[13px] text-fg-3">₹</span>
            <input
              aria-label="Investment capital"
              inputMode="numeric"
              value={
                capitalText ?? new Intl.NumberFormat('en-IN').format(capital)
              }
              onFocus={() => setCapitalText(String(capital))}
              onChange={(e) => setCapitalText(e.target.value)}
              onBlur={commitCapital}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                (e.currentTarget as HTMLInputElement).blur()
              }
              className="num w-full bg-transparent text-[14px] font-semibold text-fg outline-none"
            />
          </label>
          <Seg
            label="Capital presets"
            className="mt-1.5"
            options={CAPITAL_PRESETS}
            value={capital}
            onChange={onCapital}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Holding period</Label>
            <span className="num text-[10.5px] text-fg-4">trading days</span>
          </div>
          <div className="flex gap-1.5">
            <Seg
              label="Holding horizon"
              className="flex-1"
              options={HORIZONS.map((d) => ({ value: d, label: `${d}D` }))}
              value={custom ? null : horizon}
              onChange={onHorizon}
            />
            <label
              className={cx(
                'flex h-7 w-14 items-center rounded-md border bg-canvas px-2 transition-colors focus-within:border-accent',
                custom ? 'border-accent/70' : 'border-line',
              )}
            >
              <input
                aria-label="Custom holding days, 1 to 30"
                inputMode="numeric"
                placeholder="—"
                value={daysText ?? (custom ? String(horizon) : '')}
                onChange={(e) =>
                  setDaysText(e.target.value.replace(/\D/g, '').slice(0, 2))
                }
                onBlur={commitDays}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  (e.currentTarget as HTMLInputElement).blur()
                }
                className="num w-full bg-transparent text-[11.5px] font-medium text-fg outline-none placeholder:text-fg-4"
              />
              <span className="text-[10.5px] text-fg-4">D</span>
            </label>
          </div>
        </div>
      </div>

      {/* watchlist */}
      <div className="flex min-h-0 flex-1 flex-col max-lg:h-[420px]">
        <div className="space-y-2 px-3 pt-3">
          <div className="flex items-center justify-between">
            <Label>Watchlist</Label>
            <span className="num text-[10.5px] text-fg-4">
              {list.length}/{STOCKS.length}
            </span>
          </div>
          <label className="flex h-8 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 transition-colors focus-within:border-accent">
            <Search className="size-3.5 text-fg-3" />
            <input
              aria-label="Search stocks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Symbol or company"
              className="w-full bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-4"
            />
          </label>
        </div>
        <div
          role="tablist"
          aria-label="Sector filter"
          className="scroll-none flex shrink-0 gap-3 overflow-x-auto border-b border-line px-3"
        >
          {SECTORS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={s === sector}
              onClick={() => setSector(s)}
              className={cx(
                'relative h-8 shrink-0 text-[11.5px] font-medium transition-colors',
                s === sector ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
              )}
            >
              {s}
              {s === sector && (
                <span className="absolute inset-x-0 -bottom-px h-px bg-accent" />
              )}
            </button>
          ))}
        </div>
        <div className="flex h-6 shrink-0 items-center px-3 text-[10px] font-medium tracking-[0.04em] text-fg-4 uppercase">
          <span className="flex-1">Symbol</span>
          <span className="w-[68px] text-right">Last</span>
          <span className="w-[58px] text-right">Chg</span>
        </div>
        <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-2">
          {list.map((s) => {
            const p = prices[s.symbol] ?? s.price
            const chg = (1 + s.change) * (p / s.price) - 1
            const active = s.symbol === symbol
            return (
              <li key={s.symbol}>
                <button
                  onClick={() => onSymbol(s.symbol)}
                  aria-current={active}
                  className={cx(
                    'relative flex h-10 w-full items-center px-3 text-left transition-colors',
                    active ? 'bg-surface-3' : 'hover:bg-surface-2',
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-accent" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        'block text-[12px] font-semibold',
                        active ? 'text-fg' : 'text-fg/90',
                      )}
                    >
                      {s.symbol}
                    </span>
                    <span className="block truncate text-[10.5px] text-fg-3">
                      {s.name}
                    </span>
                  </span>
                  <span className="num w-[68px] text-right text-[12px] text-fg">
                    {num(p)}
                  </span>
                  <span
                    className={cx(
                      'num w-[58px] text-right text-[11.5px]',
                      chg >= 0 ? 'text-up' : 'text-down',
                    )}
                  >
                    {pct(chg)}
                  </span>
                </button>
              </li>
            )
          })}
          {list.length === 0 && (
            <li className="px-4 py-10 text-center text-[12px] text-fg-3">
              No symbols match “{query}”.
            </li>
          )}
        </ul>
        <div className="shrink-0 border-t border-line px-3 py-2 text-[10.5px] text-fg-4">
          ^NSEI excluded (non-tradable)
        </div>
      </div>
    </aside>
  )
}
