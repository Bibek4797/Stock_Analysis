import { useEffect, useMemo, useRef, useState } from 'react'
import { STOCK_MAP, forecast } from '@/data/market'
import { buildPortfolio, getBacktest, type Strategy } from '@/data/portfolio'
import { type FeatureSet, type ReturnModelSel, type RiskModelSel } from '@/data/validation'
import { TopNav, type Tab } from '@/components/TopNav'
import { useISTClock, useLivePrices } from '@/lib/hooks'
import { TerminalScreen } from '@/screens/terminal/TerminalScreen'
import { RiskScreen } from '@/screens/risk/RiskScreen'
import { PortfolioScreen } from '@/screens/portfolio/PortfolioScreen'
import { AdminScreen } from '@/screens/admin/AdminScreen'
import { LoginScreen } from '@/screens/auth/LoginScreen'
import { getCurrentUser, logout, type UserAccount } from '@/lib/auth'

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUser())
  const [tab, setTab] = useState<Tab>('terminal')
  const [capital, setCapital] = useState(1000000)
  const [horizon, setHorizon] = useState(5)
  const [symbol, setSymbol] = useState('RELIANCE')

  // Portfolio Optimisation & Universe State (Managed in Portfolio Tab, reactive in Terminal)
  const [strategyMode, setStrategyMode] = useState<Strategy | 'auto'>('auto')
  const [selectedSymbols, setSelectedSymbols] = useState<string[] | null>(null)

  // Risk & Econometric Model State (Managed in Risk Tab, reactive in Terminal)
  const [feature, setFeature] = useState<FeatureSet>('mlp')
  const [retSel, setRetSel] = useState<ReturnModelSel>('auto')
  const [riskSel, setRiskSel] = useState<RiskModelSel>('auto')
  const [refit, setRefit] = useState<number>(0)

  const [navBusy, setNavBusy] = useState(false)
  const [workBusy, setWorkBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const { time, status } = useISTClock()
  const prices = useLivePrices(status === 'OPEN')
  const stock = STOCK_MAP[symbol]
  const price = prices[symbol] ?? stock.price

  // Guard against non-admin accessing admin tab
  useEffect(() => {
    if (tab === 'admin' && currentUser?.role !== 'admin') {
      setTab('terminal')
    }
  }, [tab, currentUser])

  // Active Strategy: resolves 'auto' to the tournament winner
  const resolvedStrategy: Strategy = useMemo(() => {
    return strategyMode === 'auto' ? getBacktest().winner : strategyMode
  }, [strategyMode])

  // Predictive Forecast (Reflects refit, features, and model overrides)
  const fc = useMemo(
    () => forecast(stock, price, horizon, { feature, returnModel: retSel, riskModel: riskSel, refit }),
    [stock, price, horizon, feature, retSel, riskSel, refit]
  )

  // Multi-Asset Portfolio (Reflects strategy choice and custom selected stocks)
  const portfolio = useMemo(
    () => buildPortfolio(capital, horizon, prices, resolvedStrategy, selectedSymbols, { feature, refit }),
    [capital, horizon, prices, resolvedStrategy, selectedSymbols, feature, refit]
  )

  useEffect(() => {
    if (currentUser) {
      document.title = `${symbol} ${price.toFixed(2)} · Q-ALPHA Terminal`
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
            prices={prices}
            fc={fc}
            portfolio={portfolio}
            onTab={go}
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
