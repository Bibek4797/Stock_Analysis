import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { SECTORS, STOCKS, type Sector, type Stock } from '@/data/market'
import { Label, Seg } from '@/components/ui'
import { clamp, cx, num, pct } from '@/lib/format'

const CAPITAL_PRESETS = [
  { value: 100000, label: '1L' },
  { value: 500000, label: '5L' },
  { value: 1000000, label: '10L' },
  { value: 2500000, label: '25L' },
]
const HORIZONS = [3, 5, 7, 10]

import { resolveAutoStrategy, isMarketInCrash, type Strategy } from '@/data/portfolio'
import { resolveFeatureSet, type FeatureSet } from '@/data/validation'

export function Sidebar({
  capital,
  onCapital,
  horizon,
  onHorizon,
  symbol,
  onSymbol,
  prices,
  stocks,
  strategyMode = 'auto',
  onStrategyMode,
  selectedSymbols,
  onSelectSymbols,
  feature = 'auto',
  onFeatureChange,
}: {
  feature?: FeatureSet
  onFeatureChange?: (f: FeatureSet) => void
  capital: number
  onCapital: (v: number) => void
  horizon: number
  onHorizon: (v: number) => void
  symbol: string
  onSymbol: (s: string) => void
  prices: Record<string, number>
  stocks?: Stock[]
  strategyMode?: Strategy | 'auto'
  onStrategyMode?: (s: Strategy | 'auto') => void
  selectedSymbols?: string[] | null
  onSelectSymbols?: (symbols: string[] | null) => void
}) {
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState<'All' | Sector>('All')
  const [capitalText, setCapitalText] = useState<string | null>(null)
  const [daysText, setDaysText] = useState<string | null>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = stocks && stocks.length > 0 ? stocks : STOCKS
    return pool.filter(
      (s) =>
        (sector === 'All' || s.sector === sector) &&
        (!q ||
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)),
    )
  }, [query, sector, stocks])

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

        {/* Portfolio Theory Strategy Selector */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Portfolio Theory</Label>
            <span className="text-[10px] text-accent font-semibold uppercase">{strategyMode === 'auto' ? `Auto (${resolveAutoStrategy().toUpperCase()})` : strategyMode}</span>
          </div>
          <Seg
            label="Optimization strategy"
            className="w-full text-[10.5px]"
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'cvar', label: 'CVaR' },
              { value: 'trc', label: 'TRC' },
              { value: 'mpt', label: 'MPT' },
              { value: 'equal', label: '1/N' },
            ]}
            value={strategyMode}
            onChange={(s) => onStrategyMode?.(s as Strategy | 'auto')}
          />
        </div>

        {/* Input Feature Representation Selector with Rule of Thumb */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Input Features</Label>
            <span className="text-[10px] text-accent font-semibold uppercase">
              {feature === 'auto' ? `Auto (${resolveFeatureSet('auto', isMarketInCrash().isCrash).toUpperCase()})` : feature.toUpperCase()}
            </span>
          </div>
          <Seg
            label="Input features"
            className="w-full text-[10px]"
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'logret', label: 'LogRet' },
              { value: 'mlp', label: 'MLP' },
            ]}
            value={feature}
            onChange={(f) => onFeatureChange?.(f as FeatureSet)}
          />
          <div className="mt-1 text-[9.5px] text-fg-4 leading-tight">
            {(feature === 'auto' ? resolveFeatureSet('auto', isMarketInCrash().isCrash) : feature) === 'logret'
              ? 'Log Returns active → Linked to SARIMAX (Linear Stationary)'
              : 'MLP Bottleneck active → Linked to Deep Sequence LSTM (Non-Linear)'}
          </div>
        </div>

        {selectedSymbols && selectedSymbols.length > 0 && (
          <div className="flex items-center justify-between rounded border border-accent/40 bg-accent/10 px-2 py-1 text-[11px]">
            <span className="font-semibold text-accent truncate">Custom Basket ({selectedSymbols.length})</span>
            <button
              onClick={() => onSelectSymbols?.(null)}
              className="text-fg-3 hover:text-fg text-[10px] underline ml-1 shrink-0"
            >
              Reset
            </button>
          </div>
        )}
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
