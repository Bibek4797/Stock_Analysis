import { ArrowUpRight } from 'lucide-react'
import type { Stock } from '@/data/market'
import type { Portfolio } from '@/data/portfolio'
import { Chip, KV, Label, Panel } from '@/components/ui'
import { cx, inr, inrSigned, pct } from '@/lib/format'

export function PositionPanel({
  stock,
  portfolio,
  onOpen,
}: {
  stock: Stock
  portfolio: Portfolio
  onOpen: () => void
}) {
  const pos = portfolio.positions.find((p) => p.stock.symbol === stock.symbol)
  return (
    <Panel
      title="Suggested position"
      right={
        <Chip tone={pos ? 'accent' : 'neutral'}>
          {pos ? 'In model basket' : 'Not selected'}
        </Chip>
      }
      bodyClassName="flex flex-col px-3 pt-3"
    >
      {pos ? (
        <>
          <Label>Order</Label>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[28px] leading-8 font-semibold tracking-tight text-fg">
              <span className="text-up">Buy</span>{' '}
              <span className="num">{pos.shares}</span>
            </span>
            <span className="text-[12px] text-fg-3">shares</span>
          </div>
          <div className="num mt-1 text-[12px] text-fg-2">
            {inr(pos.invested)} <span className="text-fg-4">·</span>{' '}
            {(pos.actualWeight * 100).toFixed(1)}% of capital
          </div>

          <div className="mt-3 border-t border-line pt-1.5">
            <KV k="Entry (LTP)" v={inr(pos.fc.price, 2)} />
            <KV
              k="GTT target"
              v={inr(pos.fc.target, 2)}
              sub={inrSigned(pos.shares * (pos.fc.target - pos.fc.price))}
            />
            <KV
              k="GTT stop-loss"
              v={inr(pos.fc.stop, 2)}
              sub={inrSigned(pos.shares * (pos.fc.stop - pos.fc.price))}
            />
            <KV k="Risk contribution" v={pct(pos.prc, 1, false)} />
            <KV
              k="Rebalance vs prior"
              v={pos.action}
              tone={
                pos.action === 'BUY'
                  ? 'up'
                  : pos.action === 'TRIM'
                    ? 'down'
                    : undefined
              }
            />
            <KV k="Statutory charges" v={inr(pos.fees, 2)} />
          </div>
        </>
      ) : (
        <>
          <Label>Order</Label>
          <div className="mt-0.5 text-[28px] leading-8 font-semibold tracking-tight text-fg-4">
            No trade
          </div>
          <p className="mt-2 max-w-[34ch] text-[12px] leading-relaxed text-fg-3">
            {stock.sector === 'ETF'
              ? 'ETFs serve as index or cash sleeves and are not ranked in the alpha basket.'
              : `Ranked outside the top 8 by edge-to-volatility for a ${portfolio.positions[0]?.fc.horizon ?? ''}-day hold.`}
          </p>
          <div className="mt-3 border-t border-line pt-1.5">
            <KV k="Basket cut-off" v="Top 8 · score > 0.20" />
            <KV k="Weight cap" v="18% per name" />
          </div>
        </>
      )}

      <footer
        className={cx(
          'mt-auto flex h-9 items-center justify-end border-t border-line',
          'mt-3',
        )}
      >
        <button
          onClick={onOpen}
          className="group flex items-center gap-1 text-[11.5px] font-medium text-fg-2 transition-colors hover:text-accent"
        >
          Execution plan
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
        </button>
      </footer>
    </Panel>
  )
}
