import { ArrowUpRight } from 'lucide-react'
import type { Stock, Forecast } from '@/data/market'
import type { Portfolio } from '@/data/portfolio'
import { Chip, KV, Label, Panel } from '@/components/ui'
import { cx, inr, inrSigned, pct } from '@/lib/format'
import { calculateStockPnL } from '@/lib/charges'

export function PositionPanel({
  stock,
  portfolio,
  fc,
  onOpen,
}: {
  stock: Stock
  portfolio: Portfolio
  fc?: Forecast
  onOpen: () => void
}) {
  const pos = portfolio.positions.find((p) => p.stock.symbol === stock.symbol)
  const price = fc?.price ?? stock.price
  const expRet = fc?.expRet ?? stock.drift
  const target = fc?.target ?? (price * 1.03)
  const stop = fc?.stop ?? (price * 0.97)

  // Basket position calculation (with whole shares and Zerodha charges)
  const posCalc = pos
    ? calculateStockPnL({
        stockPrice: pos.fc.price,
        capitalAllocated: pos.invested,
        expRet: pos.fc.expRet,
        targetPrice: pos.fc.target,
        stopPrice: pos.fc.stop,
        isEtf: stock.sector === 'ETF',
        forcedShares: pos.shares,
      })
    : null

  // Standalone sizing calculation if stock is outside the 8-stock alpha basket
  const standaloneSlot = Math.max(price, Math.round(portfolio.capital * 0.125))
  const standaloneCalc = !pos
    ? calculateStockPnL({
        stockPrice: price,
        capitalAllocated: standaloneSlot,
        expRet,
        targetPrice: target,
        stopPrice: stop,
        isEtf: stock.sector === 'ETF',
      })
    : null

  return (
    <Panel
      title="Suggested position"
      right={
        <Chip tone={pos ? 'accent' : 'neutral'}>
          {pos ? 'In model basket' : 'Standalone sizing'}
        </Chip>
      }
      bodyClassName="flex flex-col px-3 pt-3"
    >
      {pos && posCalc ? (
        <>
          <Label>Order (Portfolio Basket)</Label>
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
              k="Exp. P&L (Gross)"
              v={inrSigned(posCalc.grossPnl)}
              sub={pct(pos.fc.expRet)}
              tone={posCalc.grossPnl >= 0 ? 'up' : 'down'}
            />
            <KV
              k="Exp. P&L (After charges)"
              v={inrSigned(posCalc.netPnl)}
              sub={`${pct(posCalc.netReturnPct / 100)} net`}
              tone={posCalc.netPnl >= 0 ? 'up' : 'down'}
            />
            <KV
              k="Statutory charges"
              v={inr(posCalc.charges.totalCharges, 2)}
              sub="STT + DP ₹15.34 + GST"
            />
            <KV
              k="GTT target"
              v={inr(pos.fc.target, 2)}
              sub={`${inrSigned(posCalc.targetPnl.netPnl)} net`}
            />
            <KV
              k="GTT stop-loss"
              v={inr(pos.fc.stop, 2)}
              sub={`${inrSigned(posCalc.stopPnl.netPnl)} net`}
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
          </div>
        </>
      ) : (
        <>
          <Label>Order (Standalone Sizing)</Label>
          <div className="mt-0.5 flex items-baseline gap-2">
            {standaloneCalc && standaloneCalc.shares > 0 ? (
              <>
                <span className="text-[28px] leading-8 font-semibold tracking-tight text-fg">
                  <span className="text-cyan-400">Size</span>{' '}
                  <span className="num">{standaloneCalc.shares}</span>
                </span>
                <span className="text-[12px] text-fg-3">shares</span>
              </>
            ) : (
              <span className="text-[22px] leading-8 font-semibold tracking-tight text-fg-4">
                0 shares <span className="text-[11px] font-normal text-fg-4">(Price &gt; slot capital)</span>
              </span>
            )}
          </div>
          <div className="num mt-1 text-[12px] text-fg-2">
            {standaloneCalc && standaloneCalc.shares > 0
              ? `${inr(standaloneCalc.invested)} · ${(
                  (standaloneCalc.invested / portfolio.capital) *
                  100
                ).toFixed(1)}% capital slot`
              : 'Ranked outside top 8 alpha basket'}
          </div>

          <div className="mt-3 border-t border-line pt-1.5">
            <KV k="Entry (LTP)" v={inr(price, 2)} />
            {standaloneCalc && standaloneCalc.shares > 0 ? (
              <>
                <KV
                  k="Exp. P&L (Gross)"
                  v={inrSigned(standaloneCalc.grossPnl)}
                  sub={pct(expRet)}
                  tone={standaloneCalc.grossPnl >= 0 ? 'up' : 'down'}
                />
                <KV
                  k="Exp. P&L (After charges)"
                  v={inrSigned(standaloneCalc.netPnl)}
                  sub={`${pct(standaloneCalc.netReturnPct / 100)} net`}
                  tone={standaloneCalc.netPnl >= 0 ? 'up' : 'down'}
                />
                <KV
                  k="Statutory charges"
                  v={inr(standaloneCalc.charges.totalCharges, 2)}
                  sub="STT + DP ₹15.34 + GST"
                />
                <KV
                  k="GTT target"
                  v={inr(target, 2)}
                  sub={`${inrSigned(standaloneCalc.targetPnl.netPnl)} net`}
                />
                <KV
                  k="GTT stop-loss"
                  v={inr(stop, 2)}
                  sub={`${inrSigned(standaloneCalc.stopPnl.netPnl)} net`}
                />
              </>
            ) : null}
            <KV
              k="Basket status"
              v={
                stock.sector === 'ETF'
                  ? 'Index / Cash Sleeve'
                  : 'Outside Top 8 Alpha'
              }
            />
            <KV k="Model weight cap" v="18% per name" />
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
