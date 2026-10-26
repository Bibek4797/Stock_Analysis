import { useState, useMemo } from 'react'
import {
  getHistoricalSessions,
  runModelVerification,
  type HistoricalSession,
  type VerificationReport,
  type DayStep,
} from '@/data/verification'
import type { Strategy } from '@/data/portfolio'
import type { FeatureSet, ReturnModelSel, RiskModelSel } from '@/data/validation'
import { STRATEGY_META } from '@/data/portfolio'
import { Panel, Chip, Seg, Stat } from '@/components/ui'
import { inr, inrSigned, num, pct, cx } from '@/lib/format'
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  Target,
  BarChart3,
  RefreshCw,
} from 'lucide-react'

interface VerificationScreenProps {
  capital: number
  onCapital: (c: number) => void
  horizon: number
  onHorizon: (h: number) => void
  strategyMode: Strategy | 'auto'
  onStrategyMode: (s: Strategy | 'auto') => void
  selectedSymbols: string[] | null
  feature: FeatureSet
  returnModel: ReturnModelSel
  riskModel: RiskModelSel
  livePrices?: Record<string, number>
}

export function VerificationScreen({
  capital,
  onCapital,
  horizon,
  onHorizon,
  strategyMode,
  onStrategyMode,
  selectedSymbols,
  feature,
  returnModel,
  riskModel,
  livePrices,
}: VerificationScreenProps) {
  // Available historical sessions (last 50 sessions for convenient selection)
  const allSessions = useMemo(() => getHistoricalSessions(), [])
  const recentSessions = useMemo(() => {
    return allSessions.slice(Math.max(0, allSessions.length - 45)).reverse()
  }, [allSessions])

  // Default to 23 Oct 2026 (index 245) or recent session
  const defaultIndex = useMemo(() => {
    const oct23 = allSessions.find((s) => s.dateStr === '2026-10-23')
    return oct23 ? oct23.index : allSessions[allSessions.length - 1].index
  }, [allSessions])

  const [selectedEntryIdx, setSelectedEntryIdx] = useState<number>(defaultIndex)
  const [activeTabSub, setActiveTabSub] = useState<'audit' | 'timeline' | 'methodology'>('audit')
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  // Run the deterministic, zero-lookahead backtest / forward verification engine
  const report: VerificationReport = useMemo(() => {
    return runModelVerification({
      entryDateIndex: selectedEntryIdx,
      horizon,
      capital,
      strategy: strategyMode,
      selectedSymbols,
      feature,
      returnModel,
      riskModel,
      livePrices,
    })
  }, [
    selectedEntryIdx,
    horizon,
    capital,
    strategyMode,
    selectedSymbols,
    feature,
    returnModel,
    riskModel,
    livePrices,
  ])

  // SVG Chart Dimensions
  const chartW = 740
  const chartH = 220
  const padL = 60
  const padR = 40
  const padT = 20
  const padB = 30
  const plotW = chartW - padL - padR
  const plotH = chartH - padT - padB

  // Compute Chart Bounds
  const allVals = report.timeline.flatMap((t) => [t.portfolioValue, t.predictedValue])
  const minV = Math.min(capital * 0.98, ...allVals) * 0.998
  const maxV = Math.max(capital * 1.02, ...allVals) * 1.002
  const vRange = maxV - minV || 1

  const getX = (day: number) => padL + (day / report.totalDays) * plotW
  const getY = (val: number) => padT + plotH - ((val - minV) / vRange) * plotH

  // Path generators
  const predPoints = report.timeline.map((t) => `${getX(t.day).toFixed(1)},${getY(t.predictedValue).toFixed(1)}`).join(' ')
  const settledPoints = report.timeline
    .filter((t) => t.isSettled)
    .map((t) => `${getX(t.day).toFixed(1)},${getY(t.portfolioValue).toFixed(1)}`)
    .join(' ')

  const selectedSession = allSessions[selectedEntryIdx]

  return (
    <div className="mx-auto max-w-[1560px] p-4 md:p-6 space-y-6">
      {/* ── TOP HEADER & BREADCRUMB ──────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-accent uppercase tracking-wider">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>Quantitative Model Audit &amp; Forward Verification</span>
            <Chip tone="up" className="ml-1 text-[10px]">
              AUTHENTIC NSE SETTLED DATA
            </Chip>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">
            Prediction vs. Reality Blotter
          </h1>
          <p className="mt-1 text-[13px] text-fg-3">
            Select an entry trading date to audit the model's exact stock recommendations, whole-share allocations, and target/stop GTT bounds against authentic settled market outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedEntryIdx(defaultIndex)}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-medium text-fg-2 hover:bg-surface-2 transition-colors"
          >
            <RefreshCw className="size-3.5 text-accent" />
            <span>Reset to 23 Oct 2026</span>
          </button>
        </div>
      </div>

      {/* ── CONTROL PANEL BAR ───────────────────────────── */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* 1. Historical Entry Date Picker */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-fg-3 uppercase tracking-wider">
              <Calendar className="size-3.5 text-accent" />
              <span>Historical Entry Date (Day 0)</span>
            </label>
            <select
              value={selectedEntryIdx}
              onChange={(e) => setSelectedEntryIdx(Number(e.target.value))}
              aria-label="Select Historical Entry Date"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[12.5px] font-medium text-fg focus:border-accent outline-none cursor-pointer"
            >
              {recentSessions.map((s) => {
                const statusTag =
                  s.settledForwardDays >= horizon
                    ? `[${horizon}D Complete · Settled]`
                    : s.settledForwardDays > 0
                      ? `[${s.settledForwardDays}D Settled, ${horizon - s.settledForwardDays}D In Progress]`
                      : '[Latest Session · Entry Day]'
                return (
                  <option key={s.index} value={s.index} className="bg-surface text-fg">
                    {s.displayDate} · {statusTag}
                  </option>
                )
              })}
            </select>
            <div className="text-[11px] text-fg-4">
              {selectedSession?.settledForwardDays >= horizon ? (
                <span className="text-emerald-400">✓ All {horizon} forward days settled with authentic closes</span>
              ) : selectedSession?.settledForwardDays > 0 ? (
                <span className="text-cyan-400">
                  ● {selectedSession.settledForwardDays} day(s) settled, {horizon - selectedSession.settledForwardDays} day(s) active
                </span>
              ) : (
                <span className="text-amber-400">● Position opened on latest close</span>
              )}
            </div>
          </div>

          {/* 2. Holding Horizon */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-fg-3 uppercase tracking-wider">
              <Clock className="size-3.5 text-cyan-400" />
              <span>Holding Horizon</span>
            </label>
            <Seg
              value={horizon}
              onChange={(h) => onHorizon(Number(h))}
              options={[
                { value: 3, label: '3 Days' },
                { value: 5, label: '5 Days' },
                { value: 7, label: '7 Days' },
                { value: 10, label: '10 Days' },
              ]}
            />
            <div className="text-[11px] text-fg-4">Synchronized with main portfolio trading horizon</div>
          </div>

          {/* 3. Portfolio Strategy */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-fg-3 uppercase tracking-wider">
              <Layers className="size-3.5 text-indigo-400" />
              <span>Optimization Strategy</span>
            </label>
            <select
              value={strategyMode}
              onChange={(e) => onStrategyMode(e.target.value as Strategy | 'auto')}
              aria-label="Select Optimization Strategy"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[12.5px] font-medium text-fg focus:border-accent outline-none cursor-pointer"
            >
              <option value="auto" className="bg-surface">Auto Best ({report.resolvedStrategy.toUpperCase()})</option>
              <option value="cvar" className="bg-surface">Rockafellar-Uryasev CVaR</option>
              <option value="trc" className="bg-surface">Ray Dalio TRC (Risk Parity)</option>
              <option value="mpt" className="bg-surface">Markowitz MPT (Max Sharpe)</option>
              <option value="equal" className="bg-surface">Equal Weight 1/N</option>
            </select>
            <div className="text-[11px] text-fg-4">
              Active: {STRATEGY_META[report.resolvedStrategy]?.name || 'Auto Strategy'}
            </div>
          </div>

          {/* 4. Capital Input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-fg-3 uppercase tracking-wider">
              <Sparkles className="size-3.5 text-emerald-400" />
              <span>Trading Capital (₹)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={50000}
                step={50000}
                value={capital}
                onChange={(e) => onCapital(Math.max(10000, Number(e.target.value)))}
                aria-label="Trading Capital in INR"
                className="w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-[13px] font-bold text-fg focus:border-accent outline-none"
              />
              <div className="flex gap-1">
                {[500000, 1000000, 2500000].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onCapital(c)}
                    className={cx(
                      'rounded px-1.5 py-1 text-[10px] font-bold border transition-colors',
                      capital === c
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-line bg-surface-2 text-fg-3 hover:text-fg'
                    )}
                  >
                    {c >= 10000000 ? `${c / 10000000}Cr` : `${c / 100000}L`}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-fg-4">Whole shares allocated dynamically</div>
          </div>
        </div>
      </div>

      {/* ── HERO KPI REALITY CHECK ROW ──────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Model Prediction */}
        <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between text-fg-3 text-[11px] font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-400">1</span>
                <span>Model Prediction (Day 0)</span>
              </span>
              <Target className="size-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-cyan-400 font-mono">
              {pct(report.predictedReturnRate)}
            </div>
            <div className="mt-0.5 text-[12px] font-medium text-fg-2">
              Expected Return: <span className="text-cyan-400 font-bold">{inrSigned(report.predictedPnl)}</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-[11px] text-fg-3">
            <span>Forecast Window</span>
            <span className="font-semibold text-fg-2">{report.totalDays} Trading Days Target</span>
          </div>
        </div>

        {/* KPI 2: Realized Market Outcome */}
        <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between text-fg-3 text-[11px] font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold text-fg-2">2</span>
                <span>Actual Market Outcome</span>
              </span>
              {report.realizedReturnRate >= 0 ? (
                <TrendingUp className="size-4 text-emerald-400" />
              ) : (
                <TrendingDown className="size-4 text-rose-400" />
              )}
            </div>
            <div
              className={cx(
                'mt-2 text-2xl font-bold tracking-tight font-mono',
                report.realizedReturnRate >= 0 ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {pct(report.realizedReturnRate)}
            </div>
            <div className="mt-0.5 text-[12px] font-medium text-fg-2">
              Realized P&amp;L:{' '}
              <span className={cx('font-bold', report.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {inrSigned(report.realizedPnl)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-[11px] text-fg-3">
            <span>Market Settlement</span>
            <span
              className={cx(
                'font-semibold',
                report.isFullySettled ? 'text-emerald-400' : 'text-cyan-400'
              )}
            >
              {report.settledDays}/{report.totalDays} Days Settled (NSE Closes)
            </span>
          </div>
        </div>

        {/* KPI 3: Alpha / Tracking Error */}
        <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between text-fg-3 text-[11px] font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-400">3</span>
                <span>Alpha / Tracking Deviation</span>
              </span>
              <BarChart3 className="size-4 text-indigo-400" />
            </div>
            <div
              className={cx(
                'mt-2 text-2xl font-bold tracking-tight font-mono',
                report.alphaDeviationRate >= 0 ? 'text-emerald-400' : 'text-amber-400'
              )}
            >
              {pct(report.alphaDeviationRate)}
            </div>
            <div className="mt-0.5 text-[12px] font-medium text-fg-2">
              Reality vs. Model:{' '}
              {report.alphaDeviationRate >= 0 ? (
                <span className="text-emerald-400 font-bold">Beat Forecast (+Alpha)</span>
              ) : (
                <span className="text-amber-400 font-bold">Lagged Forecast</span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-[11px] text-fg-3">
            <span>Basket Win Rate</span>
            <span className="font-semibold text-fg-2">{report.winRatePct.toFixed(0)}% Profitable</span>
          </div>
        </div>

        {/* KPI 4: GTT Risk Controls */}
        <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between text-fg-3 text-[11px] font-semibold uppercase tracking-wider">
              <span>GTT Target &amp; Stop Hits</span>
              <ShieldCheck className="size-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-fg font-mono">
              <span className="text-emerald-400">{report.targetHitCount} Target</span>
              <span className="text-fg-4 text-lg font-normal"> / </span>
              <span className="text-rose-400">{report.stopHitCount} Stop</span>
            </div>
            <div className="mt-0.5 text-[12px] font-medium text-fg-3">
              {report.targetHitCount} Target(s) reached · {report.stopHitCount} Stop(s) triggered
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-[11px] text-fg-3">
            <span>Max Drawdown</span>
            <span className="font-semibold text-rose-400">-{pct(report.maxDrawdownRate, 2, false)}</span>
          </div>
        </div>
      </div>

      {/* ── EXPLAINER BANNER: UNDERSTANDING THE 3 CARDS ────────── */}
      <div className="rounded-xl border border-line bg-surface/90 p-3.5 text-[12px] shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-fg shrink-0 pr-3 md:border-r md:border-line">
            <Sparkles className="size-4 text-cyan-400" />
            <span>How to Read These 3 Cards:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 text-[11.5px] text-fg-3">
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-cyan-400 shrink-0">[1] Model Prediction:</span>
              <span>Target return &amp; profit projected on entry (Day 0) by the quantitative forecast model.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-emerald-400 shrink-0">[2] Actual Outcome:</span>
              <span>Realized profit &amp; return calculated from authentic NSE settled closing auction prices.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-indigo-400 shrink-0">[3] Alpha / Tracking:</span>
              <span>Reality [2] minus Forecast [1]. Shows if the real market beat (+) or trailed (-) the forecast.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── TRAJECTORY VISUALIZATION CHART ───────────────── */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-fg flex items-center gap-2">
              <span>Cumulative Return Trajectory: Model vs. Real Market</span>
              <Chip tone="accent">Day-by-Day Progression</Chip>
            </h2>
            <p className="text-[12px] text-fg-3">
              Cyan line shows the model's Day 0 predicted path. Solid emerald/rose line shows actual portfolio equity value realized on settled daily closes.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-5 rounded-full bg-cyan-400" />
              <span className="text-fg-3 font-medium">Model Predicted Path</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-5 rounded-full bg-emerald-400" />
              <span className="text-fg-3 font-medium">Actual Settled Realization</span>
            </div>
            {!report.isFullySettled && (
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-5 border border-dashed border-amber-400" />
                <span className="text-fg-3 font-medium">Upcoming Sessions</span>
              </div>
            )}
          </div>
        </div>

        {/* SVG Chart */}
        <div className="relative w-full overflow-x-auto">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto select-none overflow-visible">
            <defs>
              <linearGradient id="actualGradUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pctg) => {
              const y = padT + pctg * plotH
              const val = maxV - pctg * vRange
              const diffPct = ((val - capital) / capital) * 100
              return (
                <g key={pctg}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={chartW - padR}
                    y2={y}
                    stroke="#1E2430"
                    strokeDasharray={pctg === 0.5 ? 'none' : '3 3'}
                  />
                  <text
                    x={padL - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="#6F7888"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {inr(val)} ({diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                  </text>
                </g>
              )
            })}

            {/* Vertical Day Lines */}
            {report.timeline.map((t) => {
              const x = getX(t.day)
              return (
                <g key={t.day}>
                  <line
                    x1={x}
                    y1={padT}
                    x2={x}
                    y2={padT + plotH}
                    stroke="#1A202C"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={x}
                    y={chartH - 8}
                    textAnchor="middle"
                    fill={t.isSettled ? '#A3ABB8' : '#F59E0B'}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight={t.isSettled ? 'normal' : 'bold'}
                  >
                    {t.day === 0 ? 'Day 0 (Entry)' : `Day ${t.day}`}
                  </text>
                </g>
              )
            })}

            {/* Predicted Trajectory Line (Cyan) */}
            <polyline
              fill="none"
              stroke="#06B6D4"
              strokeWidth="2.5"
              strokeDasharray="5 4"
              points={predPoints}
            />

            {/* Settled Realized Trajectory Line */}
            {settledPoints && (
              <polyline
                fill="none"
                stroke={report.realizedReturnRate >= 0 ? '#10B981' : '#F43F5E'}
                strokeWidth="3"
                points={settledPoints}
              />
            )}

            {/* Active / In-Progress Dashed Line */}
            {!report.isFullySettled && (
              <polyline
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeDasharray="4 3"
                opacity="0.75"
                points={report.timeline.map((t) => `${getX(t.day).toFixed(1)},${getY(t.portfolioValue).toFixed(1)}`).join(' ')}
              />
            )}

            {/* Data Dots for each day */}
            {report.timeline.map((t) => {
              const x = getX(t.day)
              const yActual = getY(t.portfolioValue)
              const yPred = getY(t.predictedValue)
              const isHovered = hoveredDay === t.day

              return (
                <g
                  key={t.day}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredDay(t.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Predicted Dot */}
                  <circle cx={x} cy={yPred} r={isHovered ? 5 : 3.5} fill="#06B6D4" />

                  {/* Actual Dot (if settled) */}
                  {t.isSettled ? (
                    <circle
                      cx={x}
                      cy={yActual}
                      r={isHovered ? 6 : 4.5}
                      fill={t.returnRate >= 0 ? '#10B981' : '#F43F5E'}
                      stroke="#080B10"
                      strokeWidth="2"
                    />
                  ) : (
                    <circle
                      cx={x}
                      cy={yActual}
                      r={3.5}
                      fill="#F59E0B"
                      stroke="#080B10"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Hover Callout */}
                  {isHovered && (
                    <g>
                      <rect
                        x={Math.min(chartW - 170, Math.max(10, x - 80))}
                        y={Math.max(10, Math.min(yActual, yPred) - 65)}
                        width="160"
                        height="55"
                        rx="6"
                        fill="#0D1119"
                        stroke="#2D3748"
                        strokeWidth="1"
                      />
                      <text
                        x={Math.min(chartW - 90, Math.max(90, x))}
                        y={Math.max(10, Math.min(yActual, yPred) - 65) + 16}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        {t.day === 0 ? 'Entry Date' : `Trading Day ${t.day}`}: {t.dateStr}
                      </text>
                      <text
                        x={Math.min(chartW - 90, Math.max(90, x))}
                        y={Math.max(10, Math.min(yActual, yPred) - 65) + 32}
                        textAnchor="middle"
                        fill={t.isSettled ? (t.returnRate >= 0 ? '#10B981' : '#F43F5E') : '#F59E0B'}
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {t.isSettled
                          ? `Realized: ${inr(t.portfolioValue)} (${pct(t.returnRate)})`
                          : 'Pending Market Close'}
                      </text>
                      <text
                        x={Math.min(chartW - 90, Math.max(90, x))}
                        y={Math.max(10, Math.min(yActual, yPred) - 65) + 47}
                        textAnchor="middle"
                        fill="#06B6D4"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        Predicted: {inr(t.predictedValue)} ({pct(t.predictedReturnRate)})
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Day-by-Day Step Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2 border-t border-line/60">
          {report.timeline.map((step) => (
            <div
              key={step.day}
              className={cx(
                'rounded-lg border p-2.5 transition-all text-left',
                step.isSettled
                  ? 'border-line bg-surface-2'
                  : 'border-dashed border-line bg-surface/50 opacity-75'
              )}
            >
              <div className="flex items-center justify-between text-[10px] text-fg-3">
                <span className="font-bold">{step.day === 0 ? 'ENTRY' : `DAY ${step.day}`}</span>
                {step.isSettled ? (
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                ) : (
                  <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-fg truncate">
                {step.dateStr}
              </div>
              <div className="mt-1 text-[12px] font-bold num text-fg">
                {inr(step.portfolioValue)}
              </div>
              <div
                className={cx(
                  'text-[10.5px] font-bold num',
                  step.returnRate >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {step.day === 0 ? '₹0 (0.00%)' : `${inrSigned(step.pnl)} (${pct(step.returnRate)})`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SUB-TABS: ASSET AUDIT / DETAILED TIMELINE / METHODOLOGY ── */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          onClick={() => setActiveTabSub('audit')}
          className={cx(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            activeTabSub === 'audit'
              ? 'bg-accent/20 text-accent border border-accent/30'
              : 'text-fg-3 hover:text-fg'
          )}
        >
          <Layers className="size-4" />
          <span>Asset-by-Asset Audit Table ({report.rows.length} Stocks)</span>
        </button>

        <button
          onClick={() => setActiveTabSub('timeline')}
          className={cx(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            activeTabSub === 'timeline'
              ? 'bg-accent/20 text-accent border border-accent/30'
              : 'text-fg-3 hover:text-fg'
          )}
        >
          <Calendar className="size-4" />
          <span>Day-by-Day Price Ledger</span>
        </button>

        <button
          onClick={() => setActiveTabSub('methodology')}
          className={cx(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            activeTabSub === 'methodology'
              ? 'bg-accent/20 text-accent border border-accent/30'
              : 'text-fg-3 hover:text-fg'
          )}
        >
          <ShieldCheck className="size-4" />
          <span>Audit Methodology &amp; Integrity</span>
        </button>
      </div>

      {/* ── TAB 1: ASSET-BY-ASSET AUDIT TABLE ─────────────── */}
      {activeTabSub === 'audit' && (
        <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-fg-3 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-3 text-right">Weight</th>
                  <th className="py-3 px-3 text-right">Shares</th>
                  <th className="py-3 px-3 text-right">Entry Close (₹)</th>
                  <th className="py-3 px-3 text-right">Model Target (₹)</th>
                  <th className="py-3 px-3 text-right">Stop GTT (₹)</th>
                  <th className="py-3 px-3 text-right">Latest Close (₹)</th>
                  <th className="py-3 px-3 text-right">Realized Return</th>
                  <th className="py-3 px-3 text-right">P&amp;L (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {report.rows.map((row) => (
                  <tr key={row.symbol} className="hover:bg-surface-2/60 transition-colors">
                    {/* Symbol & Name */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-fg">{row.symbol}</div>
                      <div className="text-[10.5px] text-fg-3 truncate max-w-[150px]">
                        {row.name} · {row.sector}
                      </div>
                    </td>

                    {/* Weight */}
                    <td className="py-3 px-3 text-right font-medium text-fg-2 num">
                      {(row.weight * 100).toFixed(1)}%
                    </td>

                    {/* Shares */}
                    <td className="py-3 px-3 text-right font-bold text-fg num">
                      {row.shares.toLocaleString()}
                    </td>

                    {/* Entry Price */}
                    <td className="py-3 px-3 text-right text-fg-2 font-mono">
                      ₹{row.entryPrice.toFixed(2)}
                    </td>

                    {/* Target GTT */}
                    <td className="py-3 px-3 text-right text-cyan-400 font-mono">
                      ₹{row.targetPrice.toFixed(2)}
                      <span className="text-[10px] text-cyan-500/80 block">
                        ({pct(row.predictedReturnRate)})
                      </span>
                    </td>

                    {/* Stop GTT */}
                    <td className="py-3 px-3 text-right text-rose-400 font-mono">
                      ₹{row.stopPrice.toFixed(2)}
                      <span className="text-[10px] text-rose-500/80 block">
                        (-{pct(row.stopPct, 2, false)})
                      </span>
                    </td>

                    {/* Latest Close */}
                    <td className="py-3 px-3 text-right font-bold text-fg font-mono">
                      ₹{row.currentPrice.toFixed(2)}
                    </td>

                    {/* Realized Return */}
                    <td
                      className={cx(
                        'py-3 px-3 text-right font-bold font-mono',
                        row.realizedReturnRate >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {pct(row.realizedReturnRate)}
                    </td>

                    {/* Realized PnL */}
                    <td
                      className={cx(
                        'py-3 px-3 text-right font-bold font-mono',
                        row.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {inrSigned(row.realizedPnl)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      {row.status === 'TARGET_HIT' && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-bold text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="size-3" />
                          <span>TARGET HIT</span>
                        </span>
                      )}
                      {row.status === 'STOP_BREACHED' && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-[10.5px] font-bold text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="size-3" />
                          <span>STOP BREACHED</span>
                        </span>
                      )}
                      {row.status !== 'TARGET_HIT' && row.status !== 'STOP_BREACHED' && report.isFullySettled && (
                        <span
                          className={cx(
                            'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-bold',
                            row.realizedReturnRate >= 0
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          )}
                        >
                          {row.realizedReturnRate >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          <span>COMPLETED ({pct(row.realizedReturnRate)})</span>
                        </span>
                      )}
                      {row.status !== 'TARGET_HIT' && row.status !== 'STOP_BREACHED' && !report.isFullySettled && (
                        report.settledDays > 0 ? (
                          <span
                            className={cx(
                              'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-bold border',
                              row.realizedReturnRate >= 0
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            )}
                          >
                            <Clock className="size-3" />
                            <span>ACTIVE ({pct(row.realizedReturnRate)})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-bold text-amber-400">
                            <Clock className="size-3" />
                            <span>ENTRY SESSION</span>
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line bg-surface-2 font-semibold">
                <tr>
                  <td className="py-3 px-4 text-fg">Portfolio Basket Total</td>
                  <td className="py-3 px-3 text-right num">
                    {((report.investedStockCapital / report.capital) * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-right num">
                    {report.rows.reduce((a, b) => a + b.shares, 0).toLocaleString()}
                  </td>
                  <td colSpan={4} className="py-3 px-3 text-right text-fg-3 text-[11px]">
                    Invested: {inr(report.investedStockCapital)} · Cash Reserve: {inr(report.cashReserve)}
                  </td>
                  <td
                    className={cx(
                      'py-3 px-3 text-right num text-[13px] font-bold',
                      report.realizedReturnRate >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    )}
                  >
                    {pct(report.realizedReturnRate)}
                  </td>
                  <td
                    className={cx(
                      'py-3 px-3 text-right num text-[13px] font-bold',
                      report.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    )}
                  >
                    {inrSigned(report.realizedPnl)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                      {report.settledDays}/{report.totalDays} SETTLED
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: DETAILED DAY-BY-DAY PRICE LEDGER ────────── */}
      {activeTabSub === 'timeline' && (
        <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-fg-3 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-3 text-right">Entry Close (Day 0)</th>
                  {report.timeline.slice(1).map((t) => (
                    <th key={t.day} className="py-3 px-3 text-right">
                      Day {t.day} ({t.dateStr})
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">Total Net Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {report.rows.map((row) => (
                  <tr key={row.symbol} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-fg">
                      <div>{row.symbol}</div>
                      <div className="text-[10px] text-fg-3">{row.shares} shares</div>
                    </td>

                    {/* Entry Day 0 */}
                    <td className="py-3 px-3 text-right font-mono text-fg-2">
                      ₹{row.entryPrice.toFixed(2)}
                    </td>

                    {/* Subsequent days */}
                    {row.dailySteps.map((step) => (
                      <td key={step.day} className="py-3 px-3 text-right font-mono">
                        {step.isSettled ? (
                          <div>
                            <span className="text-fg font-medium">₹{step.price.toFixed(2)}</span>
                            <span
                              className={cx(
                                'block text-[10px] font-bold',
                                step.returnFromEntryRate >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              )}
                            >
                              {pct(step.returnFromEntryRate)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-400 text-[11px] font-sans">Upcoming</span>
                        )}
                      </td>
                    ))}

                    {/* Total Net Return */}
                    <td
                      className={cx(
                        'py-3 px-4 text-right font-mono font-bold text-[13px]',
                        row.realizedReturnRate >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {pct(row.realizedReturnRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: METHODOLOGY & AUDIT INTEGRITY ─────────── */}
      {activeTabSub === 'methodology' && (
        <div className="rounded-xl border border-line bg-surface p-6 space-y-4 text-fg-2 text-[13px]">
          <h2 className="text-lg font-bold text-fg flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-400" />
            <span>Institutional Backtest &amp; Forward Reality Verification Engine</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
              <h3 className="font-bold text-fg flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>Zero Lookahead Bias</span>
              </h3>
              <p className="text-fg-3 leading-relaxed">
                When you choose an entry date (e.g. 23 Oct 2026), the engine strictly slices historical price history up to that exact session. Drift, volatility clustering (GJR-GARCH), and momentum are calculated exclusively from past data.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
              <h3 className="font-bold text-fg flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>Authentic NSE Settled Prices</span>
              </h3>
              <p className="text-fg-3 leading-relaxed">
                Intermediate daily prices and exit prices are not synthetic random walks. They reflect the actual daily closing auction settlements from the National Stock Exchange of India (NSE).
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
              <h3 className="font-bold text-fg flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>Whole-Share Sizing &amp; Cash Drag</span>
              </h3>
              <p className="text-fg-3 leading-relaxed">
                Fractional shares are not traded on Indian exchanges. The blotter dynamically sizes whole share quantities ($\lfloor w_i \cdot C / P_0 \rfloor$) and tracks the exact unallocated cash reserve.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
              <h3 className="font-bold text-fg flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>GTT Stop-Loss &amp; Target Monitoring</span>
              </h3>
              <p className="text-fg-3 leading-relaxed">
                Intraday high and low bounds are audited against the model's GTT Target and Downside Tail (CVaR) Stop bounds. If the market touched or exceeded the price target, it is flagged as Target Hit.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
