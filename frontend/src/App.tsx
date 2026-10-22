import { useEffect, useMemo, useRef, useState } from 'react'
import {
  STOCK_MAP,
  STOCKS,
  forecast,
  adaptForecast,
  type Stock,
  type Bar,
  type Forecast,
  type Sector,
} from '@/data/market'
import {
  buildPortfolio,
  getBacktest,
  adaptPortfolio,
  type Strategy,
  type Portfolio,
} from '@/data/portfolio'
import {
  type FeatureSet,
  type ReturnModelSel,
  type RiskModelSel,
} from '@/data/validation'
import {
  fetchUniverse,
  fetchOhlcv,
  fetchQuantForecast,
  fetchPortfolioOptimize,
} from '@/services/api'
import type {
  QuantForecastResponse,
  PortfolioResponse,
} from '@/types'
import { TopNav, type Tab } from '@/components/TopNav'
import { useISTClock, useLivePrices } from '@/lib/hooks'
import { TerminalScreen } from '@/screens/terminal/TerminalScreen'
import { RiskScreen } from '@/screens/risk/RiskScreen'
import { PortfolioScreen } from '@/screens/portfolio/PortfolioScreen'
import { AdminScreen } from '@/screens/admin/AdminScreen'
import { LoginScreen } from '@/screens/auth/LoginScreen'
import { getCurrentUser, logout, syncUsersWithServer, type UserAccount } from '@/lib/auth'

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUser())
  const [tab, setTab] = useState<Tab>('terminal')
  const [capital, setCapital] = useState(1000000)
  const [horizon, setHorizon] = useState(5)
  const [symbol, setSymbol] = useState('RELIANCE')

  // Live universe & Real prices from backend
  const [stocksList, setStocksList] = useState<Stock[]>(STOCKS)
  const [livePriceMap, setLivePriceMap] = useState<Record<string, number>>({})
  const [chartBars, setChartBars] = useState<Bar[] | undefined>(undefined)

  // Real backend model responses
  const [rawQuantForecast, setRawQuantForecast] = useState<QuantForecastResponse | null>(null)
  const [rawPortfolioData, setRawPortfolioData] = useState<PortfolioResponse | null>(null)

  // Portfolio Optimisation & Universe State
  const [strategyMode, setStrategyMode] = useState<Strategy | 'auto'>('auto')
  const [selectedSymbols, setSelectedSymbols] = useState<string[] | null>(null)

  // Risk & Econometric Model State
  const [feature, setFeature] = useState<FeatureSet>('mlp')
  const [retSel, setRetSel] = useState<ReturnModelSel>('auto')
  const [riskSel, setRiskSel] = useState<RiskModelSel>('auto')
  const [refit, setRefit] = useState<number>(0)

  const [navBusy, setNavBusy] = useState(false)
  const [workBusy, setWorkBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const { time, status } = useISTClock()
  const simulatedTickPrices = useLivePrices(status === 'OPEN')

  // Unified stocks map
  const activeStockMap = useMemo(() => {
    const map: Record<string, Stock> = { ...STOCK_MAP }
    for (const s of stocksList) {
      map[s.symbol] = s
    }
    return map
  }, [stocksList])

  const stock = activeStockMap[symbol] ?? STOCK_MAP['RELIANCE'] ?? STOCKS[0]
  const price = livePriceMap[symbol] ?? simulatedTickPrices[symbol] ?? stock.price

  // Guard against non-admin accessing admin tab
  useEffect(() => {
    if (tab === 'admin' && currentUser?.role !== 'admin') {
      setTab('terminal')
    }
  }, [tab, currentUser])

  // 1. Sync Central Accounts & Fetch Universe from Real Backend on Mount
  useEffect(() => {
    syncUsersWithServer().catch(() => {})
    fetchUniverse()
      .then((res) => {
        if (res?.universe?.equities && res.universe.equities.length > 0) {
          const allItems = [...res.universe.equities, ...(res.universe.etfs || [])]
          const mapped: Stock[] = allItems.map((item) => {
            const sym = item.display_symbol || item.symbol.replace('.NS', '')
            let sec: Sector = 'Bank'
            const s = item.sector || ''
            if (s.includes('IT') || s.includes('Tech')) sec = 'IT'
            else if (s.includes('Energy') || s.includes('Oil') || s.includes('Power')) sec = 'Energy'
            else if (s.includes('Auto') || s.includes('EV')) sec = 'Auto'
            else if (s.includes('Pharma') || s.includes('Health')) sec = 'Pharma'
            else if (s.includes('FMCG') || s.includes('Consumer')) sec = 'FMCG'
            else if (s.includes('Metal') || s.includes('Infra')) sec = 'Metals'
            else if (s.includes('ETF') || s.includes('Hedge')) sec = 'ETF'

            const p = item.base_price ?? 1000.0
            const chg = item.change_pct !== undefined ? item.change_pct / 100 : 0.005
            return {
              symbol: sym,
              name: item.name,
              sector: sec,
              sectorLabel: item.sector,
              price: p,
              change: chg,
              vol: 0.22,
              drift: 0.005,
            }
          })
          if (mapped.length > 0) {
            setStocksList(mapped)
            const pMap: Record<string, number> = {}
            mapped.forEach((m) => {
              pMap[m.symbol] = m.price
            })
            setLivePriceMap((prev) => ({ ...pMap, ...prev }))
          }
        }
      })
      .catch((err) => {
        // Fallback to baseline STOCKS cleanly if backend is offline
        console.warn('Real universe fetch notice:', err.message)
      })
  }, [])

  // 2. Fetch Real Historical OHLCV on Ticker Change
  useEffect(() => {
    let cancelled = false
    const ticker = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
    fetchOhlcv(ticker, '1y', '1d')
      .then((res) => {
        if (!cancelled && res?.candles && res.candles.length > 0) {
          const bars: Bar[] = res.candles.map((c) => ({
            t: new Date(c.time).getTime(),
            o: c.open,
            h: c.high,
            l: c.low,
            c: c.close,
            v: c.volume,
          }))
          setChartBars(bars)
          if (res.metrics?.latest_close) {
            setLivePriceMap((prev) => ({ ...prev, [symbol]: res.metrics.latest_close }))
          }
        }
      })
      .catch((err) => {
        console.warn('Using baseline OHLCV candles:', err.message)
        setChartBars(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [symbol])

  // 3. Fetch Real Quant Forecast (SARIMAX / LSTM & GJR-GARCH / Hybrid)
  useEffect(() => {
    let cancelled = false
    setWorkBusy(true)
    const ticker = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
    const im = feature === 'mlp' ? 'mlp_embedding' : 'log_returns'
    const rm = retSel === 'auto' ? 'auto_best' : retSel
    const vm = riskSel === 'auto' ? 'auto_best' : riskSel === 'gjr' ? 'gjr_garch' : 'lstm_vol'

    fetchQuantForecast(ticker, im, rm, vm, horizon, refit > 0)
      .then((data) => {
        if (!cancelled && data && data.status === 'success') {
          setRawQuantForecast(data)
          if (data.last_close) {
            setLivePriceMap((prev) => ({ ...prev, [symbol]: data.last_close }))
          }
        }
        setWorkBusy(false)
      })
      .catch((err) => {
        console.warn('Using client quant forecast fallback:', err.message)
        setWorkBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [symbol, horizon, feature, retSel, riskSel, refit])

  // 4. Fetch Real Multi-Strategy Portfolio Optimization
  useEffect(() => {
    let cancelled = false
    const selectedTickers = selectedSymbols
      ? selectedSymbols.map((s) => (s.endsWith('.NS') ? s : `${s}.NS`))
      : null

    const stratMode =
      strategyMode === 'auto'
        ? 'auto_regime'
        : strategyMode === 'cvar'
          ? 'rockafellar_cvar'
          : strategyMode === 'trc'
            ? 'dalio_trc'
            : 'mpt'

    fetchPortfolioOptimize({
      capital,
      horizon,
      strategy_mode: stratMode,
      selection_mode: selectedSymbols ? 'manual' : 'auto_quant_screen',
      selected_tickers: selectedTickers ?? undefined,
      force_refresh: refit > 0,
    })
      .then((data) => {
        if (!cancelled && data && data.status === 'success') {
          setRawPortfolioData(data)
        }
      })
      .catch((err) => {
        console.warn('Using client portfolio optimization fallback:', err.message)
      })
    return () => {
      cancelled = true
    }
  }, [capital, horizon, strategyMode, selectedSymbols, refit])

  // Active Strategy: resolves 'auto' to the tournament winner
  const resolvedStrategy: Strategy = useMemo(() => {
    if (strategyMode === 'auto') {
      if (rawPortfolioData?.resolved_strategy) {
        if (rawPortfolioData.resolved_strategy === 'mpt') return 'mpt'
        if (rawPortfolioData.resolved_strategy === 'dalio_trc') return 'trc'
        return 'cvar'
      }
      return getBacktest().winner
    }
    return strategyMode
  }, [strategyMode, rawPortfolioData])

  // Predictive Forecast (Uses real backend model if loaded, else realistic baseline)
  const fc = useMemo(() => {
    if (rawQuantForecast) {
      return adaptForecast(rawQuantForecast, horizon, price)
    }
    return forecast(stock, price, horizon, { feature, returnModel: retSel, riskModel: riskSel, refit })
  }, [rawQuantForecast, stock, price, horizon, feature, retSel, riskSel, refit])

  // Multi-Asset Portfolio (Uses real backend optimization if loaded, else realistic baseline)
  const portfolio = useMemo(() => {
    const effectivePrices = { ...simulatedTickPrices, ...livePriceMap }
    if (rawPortfolioData) {
      return adaptPortfolio(rawPortfolioData, capital, horizon, effectivePrices, resolvedStrategy, activeStockMap)
    }
    return buildPortfolio(capital, horizon, effectivePrices, resolvedStrategy, selectedSymbols, { feature, refit })
  }, [rawPortfolioData, capital, horizon, simulatedTickPrices, livePriceMap, resolvedStrategy, selectedSymbols, activeStockMap, feature, refit])

  useEffect(() => {
    if (currentUser) {
      document.title = `${symbol} ₹${price.toFixed(2)} · Q-ALPHA Terminal`
    } else {
      document.title = 'Sign In · Q-ALPHA Terminal'
    }
  }, [symbol, price, currentUser])

  useEffect(() => () => clearTimeout(timer.current), [])

  const go = (t: Tab) => {
    if (t === tab) return
    setTab(t)
    window.scrollTo({ top: 0 })
    setNavBusy(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setNavBusy(false), 450)
  }

  const handleLogout = () => {
    logout()
    setCurrentUser(null)
    setTab('terminal')
  }

  // If user is not authenticated, render Login screen
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user)
          setTab('terminal')
        }}
      />
    )
  }

  return (
    <div className="min-h-dvh bg-canvas text-fg flex flex-col">
      <TopNav
        tab={tab}
        onTab={go}
        time={time}
        status={status}
        busy={navBusy || workBusy}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main key={tab} className="flex-1 animate-fade-in">
        {tab === 'terminal' && (
          <TerminalScreen
            capital={capital}
            onCapital={setCapital}
            horizon={horizon}
            onHorizon={setHorizon}
            stock={stock}
            onSymbol={setSymbol}
            prices={{ ...simulatedTickPrices, ...livePriceMap }}
            fc={fc}
            portfolio={portfolio}
            onTab={go}
            bars={chartBars}
            stocks={stocksList}
          />
        )}
        {tab === 'risk' && (
          <div className="w-full pb-16">
            <RiskScreen
              stock={stock}
              price={price}
              horizon={horizon}
              onHorizon={setHorizon}
              onBusy={setWorkBusy}
              feature={feature}
              onFeatureChange={setFeature}
              returnModel={retSel}
              onReturnModelChange={setRetSel}
              volModel={riskSel}
              onVolModelChange={setRiskSel}
              refit={refit}
              onRefit={() => setRefit((n) => n + 1)}
              rawQuantForecast={rawQuantForecast}
            />
          </div>
        )}
        {tab === 'portfolio' && (
          <div className="w-full pb-16">
            <PortfolioScreen
              portfolio={portfolio}
              horizon={horizon}
              strategyMode={strategyMode}
              onStrategyMode={setStrategyMode}
              selectedSymbols={selectedSymbols}
              onSelectSymbols={setSelectedSymbols}
              rawPortfolioData={rawPortfolioData}
            />
          </div>
        )}
        {tab === 'admin' && currentUser.role === 'admin' && (
          <div className="w-full pb-16">
            <AdminScreen
              currentUser={currentUser}
              onUserSessionUpdate={(updated) => setCurrentUser(updated)}
            />
          </div>
        )}
      </main>
    </div>
  )
}
