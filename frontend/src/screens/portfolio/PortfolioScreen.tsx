import { useState, useMemo } from 'react'

import { Download, Search, X, Check, SlidersHorizontal, Sparkles } from 'lucide-react'

import {

  FEE_RATE,

  REGIME_META,

  STRATEGY_META,

  getBacktest,

  adaptBacktest,

  type Action,

  type Portfolio,

  type Strategy,

} from '@/data/portfolio'

import type { PortfolioResponse } from '@/types'

import { STOCKS, SECTORS, type Sector } from '@/data/market'

import { Chip, Panel, Seg, Stat, TD, TH, type Tone } from '@/components/ui'

import { cx, inr, inrSigned, num, pct } from '@/lib/format'

import { PrcChart, WealthChart } from './PortfolioCharts'



const ACTION_TONE: Record<Action, Tone> = {

  BUY: 'up',

  TRIM: 'down',

  HOLD: 'neutral',

}

const ROW_ACTIVE = 'bg-surface-2 shadow-[inset_2px_0_0_var(--color-accent)]'



function CustomBasketModal({

  isOpen,

  onClose,

  selectedSymbols,

  onApply,

}: {

  isOpen: boolean

  onClose: () => void

  selectedSymbols: string[] | null

  onApply: (symbols: string[] | null) => void

}) {

  const [search, setSearch] = useState('')

  const [sector, setSector] = useState<'All' | Sector>('All')

  const nonEtfStocks = STOCKS.filter((s) => s.sector !== 'ETF')

  const [tempSelected, setTempSelected] = useState<string[]>(() => {

    if (selectedSymbols && selectedSymbols.length > 0) return [...selectedSymbols]

    return nonEtfStocks.slice(0, 8).map((s) => s.symbol)

  })



  if (!isOpen) return null



  const filtered = nonEtfStocks.filter(

    (s) =>

      (sector === 'All' || s.sector === sector) &&

      (!search ||

        s.symbol.toLowerCase().includes(search.toLowerCase()) ||

        s.name.toLowerCase().includes(search.toLowerCase()))

  )



  const toggle = (sym: string) => {

    setTempSelected((prev) =>

      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]

    )

  }



  const selectAll = () => {

    setTempSelected(nonEtfStocks.map((s) => s.symbol))

  }



  const clearAll = () => {

    setTempSelected([])

  }



  const resetAuto = () => {

    onApply(null)

    onClose()

  }



  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">

      <div className="flex h-[580px] w-full max-w-2xl flex-col rounded-xl border border-line bg-surface shadow-2xl overflow-hidden">

        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4 bg-surface-2">

          <div className="flex items-center gap-2">

            <SlidersHorizontal className="size-4 text-accent" />

            <h3 className="text-[13px] font-semibold text-fg">Customize Tradable Universe</h3>

            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10.5px] font-medium text-fg-3">

              {tempSelected.length} of {nonEtfStocks.length} selected

            </span>

          </div>

          <button

            onClick={onClose}

            className="rounded p-1 text-fg-4 transition-colors hover:bg-surface-3 hover:text-fg"

          >

            <X className="size-4" />

          </button>

        </header>



        <div className="space-y-2 border-b border-line p-3 bg-surface">

          <div className="flex items-center gap-2">

            <div className="relative flex-1">

              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-4" />

              <input

                value={search}

                onChange={(e) => setSearch(e.target.value)}

                placeholder="Search symbol or company name..."

                className="h-8 w-full rounded-md border border-line bg-canvas pl-8 pr-3 text-[12px] text-fg outline-none focus:border-accent"

              />

            </div>

            <button

              onClick={selectAll}

              className="rounded border border-line px-2.5 py-1 text-[11px] font-medium text-fg-3 hover:bg-surface-2 hover:text-fg"

            >

              Select All

            </button>

            <button

              onClick={clearAll}

              className="rounded border border-line px-2.5 py-1 text-[11px] font-medium text-fg-3 hover:bg-surface-2 hover:text-fg"

            >

              Clear

            </button>

            <button

              onClick={resetAuto}

              className="rounded border border-up/40 bg-up/10 px-2.5 py-1 text-[11px] font-semibold text-up hover:bg-up/20"

            >

              Reset to Auto

            </button>

          </div>



          <div className="scroll-none flex gap-1.5 overflow-x-auto pt-1">

            {SECTORS.filter((s) => s !== 'ETF').map((s) => (

              <button

                key={s}

                onClick={() => setSector(s)}

                className={cx(

                  'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',

                  sector === s

                    ? 'bg-accent/20 text-accent font-semibold border border-accent/40'

                    : 'text-fg-3 hover:text-fg-2 hover:bg-surface-2 border border-transparent'

                )}

              >

                {s}

              </button>

            ))}

          </div>

        </div>



        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">

            {filtered.map((s) => {

              const checked = tempSelected.includes(s.symbol)

              return (

                <button

                  key={s.symbol}

                  onClick={() => toggle(s.symbol)}

                  className={cx(

                    'flex items-center justify-between rounded-lg border p-2 text-left transition-colors',

                    checked

                      ? 'border-accent/50 bg-accent/10 text-fg shadow-sm'

                      : 'border-line bg-canvas/60 text-fg-3 hover:border-line-2 hover:bg-surface-2'

                  )}

                >

                  <div className="min-w-0 pr-1">

                    <span className="block truncate text-[11.5px] font-semibold text-fg">

                      {s.symbol}

                    </span>

                    <span className="block truncate text-[10px] text-fg-3">

                      {s.name}

                    </span>

                    <span className="num text-[10.5px] font-medium text-fg-2">

                      ₹{s.price.toFixed(1)}

                    </span>

                  </div>

                  <div

                    className={cx(

                      'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',

                      checked

                        ? 'border-accent bg-accent text-canvas'

                        : 'border-line-2 bg-surface-3'

                    )}

                  >

                    {checked && <Check className="size-3 stroke-[3]" />}

                  </div>

                </button>

              )

            })}

          </div>

        </div>



        <footer className="flex h-12 shrink-0 items-center justify-between border-t border-line px-4 bg-surface-2">

          <span className="text-[11.5px] text-fg-3">

            <strong className="text-fg">{tempSelected.length}</strong> stocks will be used for portfolio weights

          </span>

          <div className="flex gap-2">

            <button

              onClick={onClose}

              className="rounded px-3 py-1.5 text-[11.5px] font-medium text-fg-3 hover:bg-surface-3 hover:text-fg"

            >

              Cancel

            </button>

            <button

              onClick={() => {

                onApply(tempSelected.length > 0 ? tempSelected : null)

                onClose()

              }}

              className="rounded bg-accent px-4 py-1.5 text-[11.5px] font-semibold text-canvas shadow transition-opacity hover:opacity-90"

            >

              Apply Basket

            </button>

          </div>

        </footer>

      </div>

    </div>

  )

}



export function PortfolioScreen({

  portfolio,

  horizon,

  onHorizon,

  onStrategy,

  strategyMode = 'auto',

  onStrategyMode,

  selectedSymbols = null,

  onSelectSymbols,

  rawPortfolioData,

}: {

  portfolio: Portfolio

  horizon: number

  onHorizon?: (h: number) => void

  onStrategy?: (s: Strategy) => void

  strategyMode?: Strategy | 'auto'

  onStrategyMode?: (s: Strategy | 'auto') => void

  selectedSymbols?: string[] | null

  onSelectSymbols?: (symbols: string[] | null) => void

  rawPortfolioData?: PortfolioResponse | null

}) {

  const [view, setView] = useState<'wealth' | 'drawdown'>('wealth')

  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)

  const bt = useMemo(() => {

    if (rawPortfolioData) {

      return adaptBacktest(rawPortfolioData)

    }

    return getBacktest()

  }, [rawPortfolioData])

  const { capital, strategy } = portfolio

  const regime = REGIME_META[portfolio.regime]

  const active = bt.stats.find((s) => s.key === strategy)!



  const handleStrategyChange = (s: Strategy | 'auto') => {

    if (onStrategyMode) {

      onStrategyMode(s)

    } else if (onStrategy) {

      onStrategy(s === 'auto' ? bt.winner : s)

    }

  }



  const rows = [

    ...portfolio.positions.map((p) => ({

      symbol: p.stock.symbol,

      action: p.action,

      verdict: p.fc.signal,

      weight: p.actualWeight,

      ltp: p.fc.price,

      shares: p.shares,

      invested: p.invested,

      stop: p.fc.stop as number | null,

      target: p.fc.target as number | null,

      buffer: p.bufferSaved,

      fees: p.fees,

    })),

    {

      symbol: 'LIQUIDBEES',

      action: 'BUY' as Action,

      verdict: 'Cash Shield',

      weight: portfolio.cash.weight,

      ltp: portfolio.cash.price,

      shares: portfolio.cash.shares,

      invested: portfolio.cash.invested,

      stop: null,

      target: null,

      buffer: 0,

      fees: portfolio.cash.invested * FEE_RATE,

    },

  ]

  const totalBuffer = rows.reduce((a, r) => a + r.buffer, 0)



  const exportCsv = () => {

    const head = [

      'Asset',

      'Exchange',

      'Action',

      'Quant Verdict',

      'Weight %',

      'LTP',

      'Qty',

      'Invested',

      'GTT Stop-Loss',

      'GTT Target',

      'Buffer Saved',

      'Est Fees',

    ]

    const lines = rows.map((r) =>

      [

        r.symbol,

        'NSE',

        r.action,

        r.verdict,

        (r.weight * 100).toFixed(2),

        r.ltp.toFixed(2),

        r.shares,

        r.invested.toFixed(2),

        r.stop?.toFixed(2) ?? '',

        r.target?.toFixed(2) ?? '',

        r.buffer.toFixed(0),

        r.fees.toFixed(2),

      ].join(','),

    )

    const blob = new Blob([[head.join(','), ...lines].join('\n')], {

      type: 'text/csv',

    })

    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')

    a.href = url

    a.download = `qalpha-basket-${strategy}-${horizon}d-${new Date().toISOString().slice(0, 10)}.csv`

    a.click()

    URL.revokeObjectURL(url)

  }



  return (

    <div className="mx-auto max-w-[1680px] space-y-3 p-3">

      {/* header */}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pt-1">

        <div className="min-w-0">

          <h1 className="text-[17px] font-semibold tracking-tight text-fg">

            Portfolio optimisation{' '}

            <span className="font-normal text-fg-3">&amp; order execution</span>

          </h1>

          <p className="mt-0.5 text-[11.5px] text-fg-3">

            Walk-forward OOS tournament · {horizon}-day hold · NSE delivery

            (CNC)

          </p>

        </div>

        <div className="flex items-center gap-5 text-[11.5px] text-fg-3">

          <span>

            Capital{' '}

            <span className="num ml-1 text-[13px] font-semibold text-fg">

              {inr(capital)}

            </span>

          </span>

          <span className="h-4 w-px bg-line-2" />

          <span className="flex items-center gap-2">

            Regime

            <Chip tone={regime.tone} dot>

              {regime.label}

            </Chip>

          </span>

        </div>

      </div>



      {/* ── OPTIMIZER & BASKET CONTROL TOOLBAR ──────────────── */}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">

        {/* Left: Model / Strategy Selection */}

        <div className="flex flex-wrap items-center gap-2">

          <span className="text-[11px] font-medium text-fg-3 uppercase tracking-wider">

            Optimisation Model:

          </span>

          <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-canvas p-0.5">

            {[

              { id: 'auto', label: 'Auto Best', badge: bt.winner.toUpperCase() },

              { id: 'cvar', label: 'Rockafellar CVaR', badge: null },

              { id: 'trc', label: 'Dalio TRC', badge: null },

              { id: 'mpt', label: 'Markowitz MPT', badge: null },

              { id: 'equal', label: '1/N Equal', badge: null },

            ].map((opt) => {

              const active = strategyMode === opt.id

              return (

                <button

                  key={opt.id}

                  onClick={() => handleStrategyChange(opt.id as Strategy | 'auto')}

                  className={cx(

                    'flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors',

                    active

                      ? 'bg-accent/15 text-accent font-semibold border border-accent/40 shadow-sm'

                      : 'text-fg-3 hover:text-fg-2 hover:bg-surface-2 border border-transparent'

                  )}

                >

                  <span>{opt.label}</span>

                  {opt.badge && (

                    <span className="rounded bg-accent/20 px-1 py-0.2 text-[9px] font-bold text-accent">

                      {opt.badge}

                    </span>

                  )}

                </button>

              )

            })}

          </div>

        </div>



        {/* Middle: Holding Horizon */}

        <div className="flex flex-wrap items-center gap-2">

          <span className="text-[11px] font-medium text-fg-3 uppercase tracking-wider">

            Holding Horizon:

          </span>

          <div className="flex items-center gap-1 rounded-md border border-line bg-canvas p-0.5">

            {[3, 5, 7, 10].map((h) => {

              const active = horizon === h

              return (

                <button

                  key={h}

                  onClick={() => onHorizon?.(h)}

                  className={cx(

                    'rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors',

                    active

                      ? 'bg-accent/15 text-accent font-semibold border border-accent/40 shadow-sm'

                      : 'text-fg-3 hover:text-fg-2 hover:bg-surface-2 border border-transparent'

                  )}

                >

                  {h}D

                </button>

              )

            })}

          </div>

        </div>



        {/* Right: Universe / Stock Selection Mode */}

        <div className="flex flex-wrap items-center gap-2">

          <span className="text-[11px] font-medium text-fg-3 uppercase tracking-wider">

            Stock Basket:

          </span>

          <div className="flex items-center gap-1 rounded-md border border-line bg-canvas p-0.5">

            <button

              onClick={() => onSelectSymbols?.(null)}

              className={cx(

                'rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors',

                selectedSymbols === null

                  ? 'bg-up/15 text-up font-semibold border border-up/40'

                  : 'text-fg-3 hover:text-fg-2 hover:bg-surface-2 border border-transparent'

              )}

            >

              Auto Quant Screen (Top 8)

            </button>

            <button

              onClick={() => setIsCustomModalOpen(true)}

              className={cx(

                'flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors',

                selectedSymbols !== null

                  ? 'bg-accent/15 text-accent font-semibold border border-accent/40'

                  : 'text-fg-3 hover:text-fg-2 hover:bg-surface-2 border border-transparent'

              )}

            >

              <SlidersHorizontal className="size-3" />

              <span>Custom Basket</span>

              <span className="rounded bg-surface-3 px-1.5 py-0.2 text-[10px] font-semibold text-fg-2">

                {selectedSymbols ? `${selectedSymbols.length} picked` : 'Pick'}

              </span>

            </button>

          </div>

        </div>

      </div>



      {/* KPIs */}

      <section className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">

        <Stat

          label="Active strategy"

          value={STRATEGY_META[strategy].name}

          sub={STRATEGY_META[strategy].desc}

          right={

            strategyMode === 'auto' ? (

              <Chip tone="accent">Auto ({bt.winner.toUpperCase()})</Chip>

            ) : strategy === bt.winner ? (

              <Chip tone="accent">OOS best</Chip>

            ) : (

              <Chip tone="neutral">Manual override</Chip>

            )

          }

        />

        <Stat
          label="Expected return"
          tone={active.annRet >= 0 ? 'up' : 'down'}
          value={
            <span className="num">
              {pct(active.annRet, 1)}{' '}
              <span className="text-[13px] font-medium text-fg-3">p.a.</span>
            </span>
          }
          sub={
            <span className="num">
              {inrSigned(active.annRet * capital)}/yr · {pct(active.annRet * (horizon / 252))}{' '}
              over {horizon}D
            </span>
          }
        />
        <Stat
          label="Portfolio CVaR 95%"
          tone="down"
          value={<span className="num">{pct(-Math.abs(active.cvar) * Math.sqrt(horizon))}</span>}
          sub={
            <span className="num">
              {inrSigned(-Math.abs(active.cvar) * Math.sqrt(horizon) * capital)} worst-5% loss over {horizon}D
            </span>
          }
        />

        <Stat

          label="Cash shield · LIQUIDBEES"

          value={

            <span className="num">

              {(portfolio.cash.weight * 100).toFixed(1)}%

            </span>

          }

          sub={

            <span className="num">

              {inr(portfolio.cash.invested)} overnight · ~6.5% yield

            </span>

          }

        />

      </section>



      {/* tournament */}

      <Panel

        title="Strategy tournament · walk-forward OOS"

        right={

          <span className="text-[11px] text-fg-4">

            Select a strategy to re-optimise the basket

          </span>

        }

      >

        <div className="scroll-thin overflow-x-auto">

          <table className="w-full text-[12px]">

            <thead className="border-b border-line">

              <tr>

                <th className={TH}>Strategy</th>

                <th className={cx(TH, 'text-right')}>Train Sharpe</th>

                <th className={cx(TH, 'text-right')}>OOS Sharpe</th>

                <th className={cx(TH, 'text-right')}>PSR</th>

                <th className={cx(TH, 'text-right')}>Sortino</th>

                <th className={cx(TH, 'text-right')}>Calmar</th>

                <th className={cx(TH, 'text-right')}>Ann. return</th>

                <th className={cx(TH, 'text-right')}>Max DD</th>

                <th className={cx(TH, 'text-right')}>CVaR</th>

                <th className={cx(TH, 'text-right')}>Turnover saved</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-line">

              {bt.stats.map((s) => {

                const isBench = s.key === 'nifty'

                const isActive = s.key === strategy

                return (

                  <tr

                    key={s.key}

                    onClick={

                      isBench ? undefined : () => handleStrategyChange(s.key as Strategy)

                    }

                    className={cx(

                      'transition-colors',

                      !isBench && 'cursor-pointer',

                      isActive ? ROW_ACTIVE : !isBench && 'hover:bg-surface-2',

                    )}

                  >

                    <td className={TD}>

                      <span className="flex items-center gap-2">

                        <span

                          className={cx(

                            'font-medium',

                            isBench ? 'text-fg-3' : 'text-fg',

                          )}

                        >

                          {STRATEGY_META[s.key].name}

                        </span>

                        {s.key === bt.winner && <Chip tone="accent">Best</Chip>}

                        {isActive && <Chip>Active</Chip>}

                        {isBench && <Chip>Benchmark</Chip>}

                      </span>

                    </td>

                    <td className={cx(TD, 'num text-right text-fg-3')}>

                      {s.trainSharpe.toFixed(2)}

                    </td>

                    <td

                      className={cx(TD, 'num text-right font-semibold text-fg')}

                    >

                      {s.sharpe.toFixed(2)}

                    </td>

                    <td

                      className={cx(

                        TD,

                        'num text-right',

                        s.psr > 0.95 ? 'text-up' : 'text-fg-2',

                      )}

                    >

                      {(s.psr * 100).toFixed(1)}%

                    </td>

                    <td className={cx(TD, 'num text-right text-fg-2')}>

                      {s.sortino.toFixed(2)}

                    </td>

                    <td className={cx(TD, 'num text-right text-fg-2')}>

                      {s.calmar.toFixed(2)}

                    </td>

                    <td

                      className={cx(

                        TD,

                        'num text-right',

                        s.annRet >= 0 ? 'text-up' : 'text-down',

                      )}

                    >

                      {pct(s.annRet, 1)}

                    </td>

                    <td className={cx(TD, 'num text-right text-down')}>

                      {pct(s.maxDD, 1)}

                    </td>

                    <td className={cx(TD, 'num text-right text-fg-2')}>

                      {pct(s.cvar)}

                    </td>

                    <td className={cx(TD, 'num text-right text-fg-2')}>

                      {s.turnoverSaved === null ? '—' : pct(s.turnoverSaved)}

                    </td>

                  </tr>

                )

              })}

            </tbody>

          </table>

        </div>

      </Panel>



      {/* charts */}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">

        <Panel

          className="h-[340px]"

          title={

            view === 'wealth'

              ? 'Wealth curve · ₹1,00,000 base'

              : 'Underwater drawdown'

          }

          right={

            <Seg

              label="Backtest view"

              value={view}

              onChange={setView}

              options={[

                { value: 'wealth', label: 'Wealth' },

                { value: 'drawdown', label: 'Drawdown' },

              ]}

            />

          }

          bodyClassName="flex flex-col px-3 pt-2 pb-1"

        >

          <div className="flex flex-wrap gap-x-3 gap-y-1">

            {(['cvar', 'trc', 'mpt', 'equal', 'nifty'] as const).map((k) => (

              <span

                key={k}

                className={cx(

                  'flex items-center gap-1.5 text-[10.5px]',

                  k === strategy ? 'text-fg' : 'text-fg-3',

                )}

              >

                <i

                  className={cx(

                    'w-3',

                    k === 'nifty' ? 'h-0 border-t border-dashed' : 'h-0.5',

                  )}

                  style={

                    k === 'nifty'

                      ? { borderColor: STRATEGY_META[k].color }

                      : {

                          background:

                            k === strategy ? '#4D8DFF' : STRATEGY_META[k].color,

                        }

                  }

                />

                {k === 'nifty'

                  ? 'NIFTY 50'

                  : STRATEGY_META[k].name.split(' ').slice(-1)[0]}

              </span>

            ))}

          </div>

          <div className="mt-1 min-h-0 flex-1">

            <WealthChart bt={bt} view={view} active={strategy} />

          </div>

        </Panel>

        <Panel

          className="h-[340px]"

          title="Capital weight vs risk contribution"

          right={

            <span className="text-[11px] text-fg-4">Ratio = risk ÷ weight</span>

          }

          bodyClassName="flex flex-col px-3 pt-2 pb-1"

        >

          <div className="flex gap-3 text-[10.5px] text-fg-3">

            <span className="flex items-center gap-1.5">

              <i className="size-2 rounded-[2px] bg-[#4A515D]" />

              Capital weight

            </span>

            <span className="flex items-center gap-1.5">

              <i className="size-2 rounded-[2px] bg-accent" />

              Risk contribution

            </span>

          </div>

          <div className="mt-1 min-h-0 flex-1">

            <PrcChart positions={portfolio.positions} />

          </div>

        </Panel>

      </div>



      {/* execution table */}

      <Panel

        title={

          <>

            Order execution{' '}

            <span className="font-normal text-fg-3">· {rows.length} lines</span>

          </>

        }

        right={

          <button

            onClick={exportCsv}

            className="flex h-6 items-center gap-1.5 rounded-md bg-accent px-2.5 text-[11.5px] font-semibold text-canvas transition-colors hover:bg-[#6aa0ff]"

          >

            <Download className="size-3.5" /> Export CSV

          </button>

        }

      >

        <div className="scroll-thin overflow-x-auto">

          <table className="w-full text-[12px]">

            <thead className="border-b border-line">

              <tr>

                <th className={TH}>Asset</th>

                <th className={TH}>Action</th>

                <th className={TH}>Verdict</th>

                <th className={cx(TH, 'text-right')}>Weight</th>

                <th className={cx(TH, 'text-right')}>LTP</th>

                <th className={cx(TH, 'text-right')}>Qty</th>

                <th className={cx(TH, 'text-right')}>Invested</th>

                <th className={cx(TH, 'text-right')}>GTT stop</th>

                <th className={cx(TH, 'text-right')}>GTT target</th>

                <th className={cx(TH, 'text-right')}>Buffer saved</th>

                <th className={cx(TH, 'text-right')}>Charges</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-line">

              {rows.map((r) => (

                <tr

                  key={r.symbol}

                  className="transition-colors hover:bg-surface-2"

                >

                  <td className={cx(TD, 'font-semibold text-fg')}>

                    {r.symbol}

                  </td>

                  <td className={TD}>

                    <Chip tone={ACTION_TONE[r.action]}>

                      {r.action === 'HOLD' ? 'HOLD · deadband' : r.action}

                    </Chip>

                  </td>

                  <td className={cx(TD, 'text-fg-3')}>{r.verdict}</td>

                  <td className={cx(TD, 'num text-right text-fg')}>

                    {(r.weight * 100).toFixed(2)}%

                  </td>

                  <td className={cx(TD, 'num text-right text-fg-2')}>

                    {num(r.ltp)}

                  </td>

                  <td

                    className={cx(TD, 'num text-right font-semibold text-fg')}

                  >

                    {r.shares}

                  </td>

                  <td className={cx(TD, 'num text-right text-fg')}>

                    {inr(r.invested, 2)}

                  </td>

                  <td className={cx(TD, 'num text-right text-down')}>

                    {r.stop ? (

                      num(r.stop)

                    ) : (

                      <span className="text-fg-4">—</span>

                    )}

                  </td>

                  <td className={cx(TD, 'num text-right text-up')}>

                    {r.target ? (

                      num(r.target)

                    ) : (

                      <span className="text-fg-4">—</span>

                    )}

                  </td>

                  <td

                    className={cx(

                      TD,

                      'num text-right',

                      r.buffer ? 'text-fg-2' : 'text-fg-4',

                    )}

                  >

                    {r.buffer ? inr(r.buffer) : '—'}

                  </td>

                  <td className={cx(TD, 'num text-right text-fg-3')}>

                    {num(r.fees)}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        <footer className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t border-line px-3 py-2.5 text-[11.5px] text-fg-3">

          <span>

            Total invested{' '}

            <span className="num ml-1 font-medium text-fg">

              {inr(portfolio.totalInvested, 2)}

            </span>

          </span>

          <span>

            Residual cash{' '}

            <span className="num ml-1 font-medium text-fg">

              {inr(portfolio.residual, 2)}

            </span>

          </span>

          <span>

            Deadband turnover saved{' '}

            <span className="num ml-1 font-medium text-fg">

              {inr(totalBuffer)}

            </span>

          </span>

          <span>

            Charges{' '}

            <span className="num ml-1 font-medium text-fg">

              {inr(portfolio.fees, 2)}

            </span>

            <span className="num ml-1 text-fg-4">

              ({(FEE_RATE * 100).toFixed(2)}% statutory · zero brokerage)

            </span>

          </span>

        </footer>

      </Panel>



      <CustomBasketModal

        isOpen={isCustomModalOpen}

        onClose={() => setIsCustomModalOpen(false)}

        selectedSymbols={selectedSymbols}

        onApply={(syms) => onSelectSymbols?.(syms)}

      />

    </div>

  )

}

