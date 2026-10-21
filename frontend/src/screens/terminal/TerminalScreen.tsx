import type { Forecast, Stock } from '@/data/market'
import type { Portfolio } from '@/data/portfolio'
import { Sidebar } from './Sidebar'
import { InstrumentHeader } from './InstrumentHeader'
import { PriceChart } from './PriceChart'
import { OutlookPanel } from './OutlookPanel'
import { PositionPanel } from './PositionPanel'
import { BasketPanel } from './BasketPanel'

export function TerminalScreen(props: {
  capital: number
  onCapital: (v: number) => void
  horizon: number
  onHorizon: (v: number) => void
  stock: Stock
  onSymbol: (s: string) => void
  prices: Record<string, number>
  fc: Forecast
  portfolio: Portfolio
  onTab: (t: 'risk' | 'portfolio') => void
}) {
  const { stock, prices, fc, portfolio } = props
  const price = prices[stock.symbol] ?? stock.price
  return (
    <div className="gap-3 max-lg:flex max-lg:flex-col max-lg:p-3 lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-0">
      <Sidebar
        capital={props.capital}
        onCapital={props.onCapital}
        horizon={props.horizon}
        onHorizon={props.onHorizon}
        symbol={stock.symbol}
        onSymbol={props.onSymbol}
        prices={prices}
      />
      <div className="scroll-thin flex min-w-0 flex-col gap-3 lg:h-[calc(100dvh-49px)] lg:overflow-y-auto lg:p-3">
        <InstrumentHeader stock={stock} price={price} />
        <div className="flex h-[440px] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-surface lg:h-auto lg:min-h-[340px] lg:flex-1">
          <PriceChart stock={stock} price={price} fc={fc} />
        </div>
        <div className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-[1.12fr_0.92fr_1fr]">
          <OutlookPanel
            stock={stock}
            fc={fc}
            onValidate={() => props.onTab('risk')}
          />
          <PositionPanel
            stock={stock}
            portfolio={portfolio}
            onOpen={() => props.onTab('portfolio')}
          />
          <div className="md:col-span-2 xl:col-span-1">
            <BasketPanel
              symbol={stock.symbol}
              portfolio={portfolio}
              onOpen={props.onSymbol}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
