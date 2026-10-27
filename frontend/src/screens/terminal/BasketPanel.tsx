import { REGIME_META, type Portfolio } from '@/data/portfolio'
import { Chip, Label, Panel, accentShade } from '@/components/ui'
import { cx, inr, inrSigned, pct } from '@/lib/format'

export function BasketPanel({
  symbol,
  portfolio,
  onOpen,
}: {
  symbol: string
  portfolio: Portfolio
  onOpen: (s: string) => void
}) {
  const regime = REGIME_META[portfolio.regime]
  const { capital } = portfolio
  const rows = [...portfolio.positions].sort(
    (a, b) => b.actualWeight - a.actualWeight,
  )
  const n = rows.length
  const maxW = Math.max(
    portfolio.cash.weight,
    ...rows.map((r) => r.actualWeight),
  )
  const deployedPct = portfolio.stockInvested / capital

  const grossPnl = portfolio.expRet * capital
  const charges = portfolio.fees
  const netPnl = grossPnl - charges

  return (
    <Panel
      className="h-full"
      title="Model basket"
      right={
        <Chip tone={regime.tone} dot>
          {regime.short}
        </Chip>
      }
      bodyClassName="flex flex-col pt-3"
    >
      <div className="flex items-end justify-between gap-3 px-3">
        <div>
          <Label>Deployed in equities</Label>
          <div className="num mt-0.5 text-[22px] leading-8 font-semibold tracking-tight text-fg">
            {inr(portfolio.stockInvested)}
          </div>
        </div>
        <div className="text-right">
          <Label>Exp. P&amp;L (Gross / Net)</Label>
          <div
            className={cx(
              'num mt-0.5 text-[14px] leading-8 font-semibold',
              grossPnl >= 0 ? 'text-up' : 'text-down',
            )}
          >
            {pct(portfolio.expRet)}
            <span
              className={cx(
                'ml-1.5 text-[11px] font-mono font-medium',
                netPnl >= 0 ? 'text-up' : 'text-down',
              )}
            >
              (Net {pct(netPnl / capital)})
            </span>
          </div>
        </div>
      </div>

      <div
        className="mx-3 mt-2 flex h-1.5 gap-px overflow-hidden rounded-full"
        aria-hidden
      >
        {rows.map((p, i) => (
          <span
            key={p.stock.symbol}
            style={{
              width: `${p.actualWeight * 100}%`,
              background: accentShade(i, n),
            }}
          />
        ))}
        <span
          className="bg-fg-4"
          style={{ width: `${portfolio.cash.weight * 100}%` }}
        />
      </div>
      <div className="num mt-1 flex justify-between px-3 text-[10.5px] text-fg-3">
        <span>
          {(deployedPct * 100).toFixed(1)}% · {n} stocks
        </span>
        <span>{(portfolio.cash.weight * 100).toFixed(1)}% cash</span>
      </div>

      <table className="mt-2 w-full text-[11.5px]">
        <thead>
          <tr className="text-[10px] tracking-[0.04em] text-fg-4 uppercase">
            <th className="h-6 pl-3 text-left font-medium">Symbol</th>
            <th className="h-6 w-[38%] font-medium" />
            <th className="h-6 text-right font-medium">Wt</th>
            <th className="h-6 pr-3 text-right font-medium">Exp</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const active = p.stock.symbol === symbol
            return (
              <tr
                key={p.stock.symbol}
                onClick={() => onOpen(p.stock.symbol)}
                className={cx(
                  'cursor-pointer transition-colors',
                  active ? 'bg-surface-3' : 'hover:bg-surface-2',
                )}
              >
                <td
                  className={cx(
                    'h-[22px] pl-3 font-medium',
                    active ? 'text-fg' : 'text-fg-2',
                  )}
                >
                  {p.stock.symbol}
                </td>
                <td className="px-2">
                  <div className="h-1 rounded-full bg-line">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(p.actualWeight / maxW) * 100}%`,
                        background: accentShade(i, n),
                      }}
                    />
                  </div>
                </td>
                <td className="num text-right text-fg">
                  {(p.actualWeight * 100).toFixed(1)}%
                </td>
                <td
                  className={cx(
                    'num pr-3 text-right',
                    p.fc.expRet >= 0 ? 'text-up' : 'text-down',
                  )}
                >
                  {pct(p.fc.expRet, 1)}
                </td>
              </tr>
            )
          })}
          <tr className="text-fg-3">
            <td className="h-[22px] pl-3">LIQUIDBEES</td>
            <td className="px-2">
              <div className="h-1 rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-fg-4"
                  style={{ width: `${(portfolio.cash.weight / maxW) * 100}%` }}
                />
              </div>
            </td>
            <td className="num text-right">
              {(portfolio.cash.weight * 100).toFixed(1)}%
            </td>
            <td className="num pr-3 text-right">cash</td>
          </tr>
        </tbody>
      </table>

      <footer className="mt-auto flex h-9 items-center justify-between gap-3 border-t border-line px-3 text-[11px]">
        <span className="text-fg-3">
          Gross{' '}
          <span
            className={cx(
              'num',
              grossPnl >= 0 ? 'text-up' : 'text-down',
            )}
          >
            {inrSigned(grossPnl)}
          </span>
          <span className="mx-1 text-fg-4">·</span>
          Net{' '}
          <span
            className={cx(
              'num font-medium',
              netPnl >= 0 ? 'text-up' : 'text-down',
            )}
          >
            {inrSigned(netPnl)}
          </span>
          <span className="mx-1 text-fg-4">·</span>
          Charges{' '}
          <span className="num text-amber-400">
            {inr(charges, 0)}
          </span>
        </span>
        <span className="num text-fg-4">
          {inr(portfolio.residual, 0)} cash
        </span>
      </footer>
    </Panel>
  )
}
