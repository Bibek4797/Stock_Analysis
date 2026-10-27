import { ArrowUpRight } from 'lucide-react'
import type { Forecast, Signal, Stock } from '@/data/market'
import type { Position } from '@/data/portfolio'
import { Chip, KV, Label, Panel, type Tone } from '@/components/ui'
import { cx, inr, inrSigned, num, pct } from '@/lib/format'
import { calculateStockPnL } from '@/lib/charges'

export const SIGNAL_TONE: Record<Signal, Tone> = {
  'Strong Buy': 'up',
  'Moderate Buy': 'up',
  Hold: 'neutral',
  Avoid: 'down',
}

/** Horizontal price ladder: range band, stop → LTP → target. */
function Ladder({ fc }: { fc: Forecast }) {
  const pts = [fc.rangeLo, fc.rangeHi, fc.stop, fc.target, fc.price]
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  const pad = (hi - lo) * 0.04
  const x = (v: number) => ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100
  const seg = (a: number, b: number) => ({
    left: `${x(Math.min(a, b))}%`,
    width: `${Math.abs(x(b) - x(a))}%`,
  })
  const marks: Array<{ v: number; label: string; cls: string }> = [
    { v: fc.stop, label: 'Stop', cls: 'text-down' },
    { v: fc.price, label: 'LTP', cls: 'text-fg' },
    {
      v: fc.target,
      label: 'Target',
      cls: fc.target >= fc.price ? 'text-up' : 'text-down',
    },
  ]
  return (
    <div
      className="relative h-[62px]"
      aria-label="Price ladder: stop, last price and target"
    >
      {marks.map((m) => (
        <div
          key={m.label}
          className="absolute top-0 -translate-x-1/2 text-center"
          style={{ left: `${x(m.v)}%` }}
        >
          <div className={cx('text-[10px] font-medium', m.cls)}>{m.label}</div>
        </div>
      ))}
      <div className="absolute inset-x-0 top-[22px] h-1.5 rounded-full bg-line">
        <span
          className="absolute inset-y-0 rounded-full bg-fg-4/50"
          style={seg(fc.rangeLo, fc.rangeHi)}
        />
        <span
          className="absolute inset-y-0 bg-down/70"
          style={seg(fc.stop, fc.price)}
        />
        <span
          className={cx(
            'absolute inset-y-0',
            fc.target >= fc.price ? 'bg-up/70' : 'bg-down/40',
          )}
          style={seg(fc.price, fc.target)}
        />
      </div>
      {marks.map((m) => (
        <span
          key={m.label}
          className={cx(
            'absolute top-[17px] h-4 w-0.5 -translate-x-1/2 rounded-full',
            m.label === 'LTP'
              ? 'bg-fg'
              : m.label === 'Stop'
                ? 'bg-down'
                : 'bg-up',
          )}
          style={{ left: `${x(m.v)}%` }}
        />
      ))}
      {marks.map((m) => (
        <div
          key={m.label}
          className="num absolute top-[38px] -translate-x-1/2 text-[11px] font-medium text-fg-2"
          style={{ left: `${x(m.v)}%` }}
        >
          {num(m.v)}
        </div>
      ))}
      <div className="num absolute top-[52px] left-0 text-[9.5px] text-fg-4">
        {num(fc.rangeLo, 0)}
      </div>
      <div className="num absolute top-[52px] right-0 text-[9.5px] text-fg-4">
        {num(fc.rangeHi, 0)}
      </div>
    </div>
  )
}

export function OutlookPanel({
  stock,
  fc,
  capital = 100000,
  pos,
  onValidate,
}: {
  stock: Stock
  fc: Forecast
  capital?: number
  pos?: Position
  onValidate: () => void
}) {
  const H = fc.horizon
  const upRet = fc.expRet >= 0

  // Sizing: if position exists in basket, use pos.invested & pos.shares.
  // Otherwise, use 1 standard tranche of capital (12.5% slot or stock price)
  const allocCapital = pos ? pos.invested : Math.max(stock.price, Math.round(capital * 0.125))
  const forcedShares = pos ? pos.shares : undefined

  const pnl = calculateStockPnL({
    stockPrice: fc.price,
    capitalAllocated: allocCapital,
    expRet: fc.expRet,
    targetPrice: fc.target,
    stopPrice: fc.stop,
    isEtf: stock.sector === 'ETF',
    forcedShares,
  })

  return (
    <Panel
      title={`${H}-day outlook · ${stock.symbol}`}
      right={
        <Chip tone={SIGNAL_TONE[fc.signal]} dot>
          {fc.signal}
        </Chip>
      }
      bodyClassName="flex flex-col px-3 pt-3"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <Label>Expected return</Label>
          <div
            className={cx(
              'num mt-0.5 text-[28px] leading-8 font-semibold tracking-tight',
              upRet ? 'text-up' : 'text-down',
            )}
          >
            {pct(fc.expRet)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono">
            <span className="text-fg-4">Net return:</span>
            <span
              className={cx(
                'font-semibold',
                pnl.netReturnPct >= 0 ? 'text-up' : 'text-down',
              )}
            >
              {pct(pnl.netReturnPct / 100)}
            </span>
            <span className="text-[10px] text-fg-4">after Zerodha charges</span>
          </div>
        </div>
        <div className="w-[125px] pb-1">
          <div className="flex items-baseline justify-between">
            <Label>Hit rate</Label>
            <span className="num text-[12px] font-medium text-fg">
              {fc.confidence.toFixed(0)}%
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-fg-2"
              style={{ width: `${fc.confidence}%` }}
            />
          </div>
          <div className="mt-1 text-right text-[10px] text-fg-4 font-mono truncate">
            {pnl.shares > 0 ? `${pnl.shares} sh @ ${inr(fc.price, 0)}` : `Min 1 sh: ${inr(fc.price, 0)}`}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Ladder fc={fc} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-5 border-t border-line pt-1.5">
        <KV k="Target" v={inr(fc.target, 2)} />
        <KV k="Stop" v={inr(fc.stop, 2)} />
        <KV
          k="Exp. P&L (Gross)"
          v={inrSigned(pnl.grossPnl)}
          sub={pnl.shares > 0 ? `${pnl.shares} sh · ${inr(pnl.invested)}` : '0 sh (Exceeds slot)'}
          tone={pnl.grossPnl >= 0 ? 'up' : 'down'}
        />
        <KV
          k="Exp. P&L (After charges)"
          v={inrSigned(pnl.netPnl)}
          sub={pnl.shares > 0 ? `${pct(pnl.netReturnPct / 100)} net` : 'No whole share'}
          tone={pnl.netPnl >= 0 ? 'up' : 'down'}
        />
        <KV
          k="Zerodha charges (Est.)"
          v={inr(pnl.charges.totalCharges, 2)}
          sub={pnl.shares > 0 ? `STT ${inr(pnl.charges.stt, 0)} · DP ₹15.34 · GST` : '₹0 charges'}
        />
        <KV
          k="Target P&L (Net)"
          v={inrSigned(pnl.targetPnl.netPnl)}
          sub={`At ${inr(fc.target, 2)}`}
          tone={pnl.targetPnl.netPnl >= 0 ? 'up' : 'down'}
        />
        <KV
          k="Stop loss (Net)"
          v={inrSigned(pnl.stopPnl.netPnl)}
          sub={`At ${inr(fc.stop, 2)}`}
          tone="down"
        />
        <KV
          k="CVaR 95% Tail risk"
          v={inrSigned(fc.tail * (pnl.invested > 0 ? pnl.invested : allocCapital))}
          tone="down"
        />
        <KV k="Ann. volatility" v={`${(fc.annVol * 100).toFixed(1)}%`} />
        <KV
          k="Reward / risk"
          v={`${fc.rewardRisk.toFixed(2)}×`}
          tone={fc.rewardRisk >= 1 ? 'up' : undefined}
        />
      </div>

      <footer className="mt-auto flex h-9 items-center justify-between border-t border-line">
        <span className="text-[11px] text-fg-4">
          Walk-forward ensemble · illustrative
        </span>
        <button
          onClick={onValidate}
          className="group flex items-center gap-1 text-[11.5px] font-medium text-fg-2 transition-colors hover:text-accent"
        >
          Model validation
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
        </button>
      </footer>
    </Panel>
  )
}
