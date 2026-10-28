import { useMemo, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { forecast, type Stock } from '@/data/market'
import {
  RETURN_NAMES,
  VOL_NAMES,
  getValidation,
  adaptValidation,
  type FeatureSet,
  type ReturnKey,
  type ReturnModelSel,
  type RiskModelSel,
  type VolKey,
} from '@/data/validation'
import type { QuantForecastResponse } from '@/types'
import { Chip, Field, Panel, Seg, Select, Stat, TD, TH } from '@/components/ui'
import { SIGNAL_TONE } from '../terminal/OutlookPanel'
import { cx, inr, pct } from '@/lib/format'
import { DistChart, VolChart } from './RiskCharts'

function PassFail({ p }: { p: number }) {
  const ok = p > 0.05
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px]">
      <span className={cx('size-1.5 rounded-full', ok ? 'bg-up' : 'bg-down')} />
      <span className={ok ? 'text-fg-2' : 'text-down'}>
        {ok ? 'Pass' : 'Fail'}
      </span>
      <span className="num text-fg-4">{p.toFixed(2)}</span>
    </span>
  )
}

function Legend({ items }: { items: Array<[ReactNode, string]> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map(([sw, label]) => (
        <span
          key={label}
          className="flex items-center gap-1.5 text-[10.5px] text-fg-3"
        >
          {sw}
          {label}
        </span>
      ))}
    </div>
  )
}

const ROW_ACTIVE = 'bg-surface-2 shadow-[inset_2px_0_0_var(--color-accent)]'

export function RiskScreen({
  stock,
  price,
  horizon,
  onHorizon,
  onBusy,
  feature = 'mlp',
  onFeatureChange,
  returnModel = 'auto',
  onReturnModelChange,
  volModel = 'auto',
  onVolModelChange,
  refit = 0,
  onRefit,
  rawQuantForecast,
}: {
  stock: Stock
  price: number
  horizon: number
  onHorizon: (h: number) => void
  onBusy: (b: boolean) => void
  feature?: FeatureSet
  onFeatureChange?: (f: FeatureSet) => void
  returnModel?: ReturnModelSel
  onReturnModelChange?: (m: ReturnModelSel) => void
  volModel?: RiskModelSel
  onVolModelChange?: (m: RiskModelSel) => void
  refit?: number
  onRefit?: () => void
  rawQuantForecast?: QuantForecastResponse | null
}) {
  const [localFeature, setLocalFeature] = useState<FeatureSet>(feature)
  const [localRetSel, setLocalRetSel] = useState<ReturnModelSel>(returnModel)
  const [localRiskSel, setLocalRiskSel] = useState<RiskModelSel>(volModel)
  const [refitting, setRefitting] = useState(false)

  const activeFeature = onFeatureChange ? feature : localFeature
  const activeRetSel = onReturnModelChange ? returnModel : localRetSel
  const activeRiskSel = onVolModelChange ? volModel : localRiskSel

  const handleFeature = (f: FeatureSet) => {
    setLocalFeature(f)
    onFeatureChange?.(f)
  }
  const handleRetSel = (m: ReturnModelSel) => {
    setLocalRetSel(m)
    onReturnModelChange?.(m)
  }
  const handleRiskSel = (m: RiskModelSel) => {
    setLocalRiskSel(m)
    onVolModelChange?.(m)
  }

  const v = useMemo(() => {
    if (rawQuantForecast) {
      return adaptValidation(rawQuantForecast, stock, price)
    }
    return getValidation(stock.symbol, horizon, activeFeature, refit)
  }, [rawQuantForecast, stock, price, horizon, activeFeature, refit])
  const retKey: ReturnKey = activeRetSel === 'auto' ? v.returnWinner : activeRetSel
  const volKey: VolKey = activeRiskSel === 'auto' ? v.volWinner : activeRiskSel
  const ret = v.returns.find((r) => r.key === retKey)!
  const vol = v.vol.find((r) => r.key === volKey)!
  const series = v.series[volKey === 'hybrid' ? 'hybrid' : 'gjr']
  const fc = forecast(stock, price, horizon, {
    feature: activeFeature,
    returnModel: activeRetSel,
    riskModel: activeRiskSel,
    refit,
  })
  const horizons = Array.from(new Set([3, 5, 7, 10, horizon])).sort(
    (a, b) => a - b,
  )
  const psiStable = v.psi < 0.1

  const doRefit = () => {
    if (refitting) return
    setRefitting(true)
    onBusy(true)
    setTimeout(() => {
      onRefit?.()
      setRefitting(false)
      onBusy(false)
    }, 1200)
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-3 p-3">
      {/* header + controls */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pt-1">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold tracking-tight text-fg">
            {stock.symbol}{' '}
            <span className="font-normal text-fg-3">model validation</span>
          </h1>
          <p className="num mt-0.5 text-[11.5px] text-fg-3">
            Walk-forward · 80/20 split · {v.vol[0].n} out-of-sample sessions ·
            LTP {inr(price, 2)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <Field label="Features">
            <Seg
              label="Feature set"
              value={activeFeature}
              onChange={handleFeature}
              options={[
                { value: 'mlp', label: 'MLP bottleneck' },
                { value: 'logret', label: 'Log returns' },
              ]}
            />
          </Field>
          <Field label="Return model" className="w-[150px]">
            <Select
              label="Return model"
              value={activeRetSel}
              onChange={handleRetSel}
              options={[
                { value: 'auto', label: 'Auto (best OOS)' },
                { value: 'sarimax', label: 'SARIMAX' },
                { value: 'lstm', label: 'Deep LSTM' },
              ]}
            />
          </Field>
          <Field label="Risk model" className="w-[160px]">
            <Select
              label="Risk model"
              value={activeRiskSel}
              onChange={handleRiskSel}
              options={[
                { value: 'auto', label: 'Auto (best QLIKE)' },
                { value: 'gjr', label: 'GJR-GARCH(1,1,1)' },
                { value: 'hybrid', label: 'Hybrid GJR-LSTM' },
              ]}
            />
          </Field>
          <Field label="Horizon">
            <Seg
              label="Horizon"
              options={[3, 5, 7, 10].map((d) => ({ value: d, label: `${d}D` }))}
              value={[3, 5, 7, 10].includes(horizon) ? horizon : null}
              onChange={onHorizon}
            />
          </Field>
          <button
            onClick={doRefit}
            disabled={refitting}
            className="flex h-7 items-center gap-1.5 rounded-md border border-line-2 bg-surface-2 px-2.5 text-[11.5px] font-medium text-fg transition-colors hover:border-fg-4 hover:bg-surface-3 disabled:opacity-60"
          >
            <RefreshCw
              className={cx('size-3.5', refitting && 'animate-spin')}
            />
            {refitting ? 'Refitting…' : 'Refit'}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <section className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          loading={refitting}
          label="Return model"
          right={<Chip>{activeRetSel === 'auto' ? 'Auto' : 'Manual'}</Chip>}
          value={RETURN_NAMES[retKey]}
          sub={
            <span className="num">
              OOS RMSE {ret.oosRmse.toFixed(4)} · hit rate{' '}
              {ret.hitRate.toFixed(1)}%
            </span>
          }
        />
        <Stat
          loading={refitting}
          label="Volatility model"
          right={<Chip>{activeRiskSel === 'auto' ? 'Auto' : 'Manual'}</Chip>}
          value={
            volKey === 'hybrid'
              ? 'Hybrid GJR-LSTM'
              : VOL_NAMES[volKey].split('(')[0]
          }
          sub={
            <span className="num">
              QLIKE {vol.qlike.toFixed(3)} · Kupiec p {vol.kupiecP.toFixed(2)}
            </span>
          }
        />
        <Stat
          loading={refitting}
          label="Leverage effect γ"
          value={<span className="num">{v.gamma.toFixed(3)}</span>}
          sub={
            <span className="num">
              Sell-offs lift vol {v.leverage.toFixed(1)}× · α{' '}
              {v.alpha.toFixed(3)} β {v.beta.toFixed(3)}
            </span>
          }
        />
        <Stat
          loading={refitting}
          label="Regime stability · PSI"
          right={
            <Chip tone={psiStable ? 'up' : 'warn'} dot>
              {psiStable ? 'Stable' : 'Shifting'}
            </Chip>
          }
          value={<span className="num">{v.psi.toFixed(3)}</span>}
          tone={psiStable ? 'neutral' : 'warn'}
          sub={
            psiStable
              ? 'Signal gate fully open · threshold 0.100'
              : 'Signal gate throttled to 60% · threshold 0.100'
          }
        />
      </section>

      {/* tournaments */}
      <div
        className={cx(
          'grid gap-3 transition-opacity xl:grid-cols-2',
          refitting && 'opacity-50',
        )}
      >
        <Panel
          title="Return model tournament"
          right={
            <span className="text-[11px] text-fg-4">Lower OOS RMSE wins</span>
          }
        >
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="border-b border-line">
                <tr>
                  <th className={TH}>Model</th>
                  <th className={cx(TH, 'text-right')}>IS RMSE</th>
                  <th className={cx(TH, 'text-right')}>OOS RMSE</th>
                  <th className={TH}>Hit rate</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {v.returns.map((r) => (
                  <tr
                    key={r.key}
                    className={cx(r.key === retKey && ROW_ACTIVE)}
                  >
                    <td className={cx(TD, 'h-11')}>
                      <div className="font-medium text-fg">{r.name}</div>
                      <div className="text-[10.5px] text-fg-3">{r.spec}</div>
                    </td>
                    <td className={cx(TD, 'num text-right text-fg-3')}>
                      {r.isRmse.toFixed(4)}
                    </td>
                    <td
                      className={cx(TD, 'num text-right font-medium text-fg')}
                    >
                      {r.oosRmse.toFixed(4)}
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-fg-2"
                            style={{
                              width: `${((r.hitRate - 40) / 30) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="num text-fg-2">
                          {r.hitRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className={cx(TD, 'text-right')}>
                      {r.key === v.returnWinner && (
                        <Chip tone="accent">Best</Chip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Volatility model tournament"
          right={
            <span className="num text-[11px] text-fg-4">
              Expected VaR95 breaches 12.5
            </span>
          }
        >
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="border-b border-line">
                <tr>
                  <th className={TH}>Model</th>
                  <th className={cx(TH, 'text-right')}>QLIKE</th>
                  <th className={cx(TH, 'text-right')}>Log-lik</th>
                  <th className={cx(TH, 'text-right')}>Breaches</th>
                  <th className={TH}>Kupiec POF</th>
                  <th className={TH}>Independence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {v.vol.map((r) => (
                  <tr
                    key={r.key}
                    className={cx(r.key === volKey && ROW_ACTIVE)}
                  >
                    <td className={cx(TD, 'h-11')}>
                      <div className="flex items-center gap-2 font-medium text-fg">
                        {r.name}
                        {r.key === v.volWinner && (
                          <Chip tone="accent">Best</Chip>
                        )}
                      </div>
                      <div className="text-[10.5px] text-fg-3">{r.spec}</div>
                    </td>
                    <td
                      className={cx(TD, 'num text-right font-medium text-fg')}
                    >
                      {r.qlike.toFixed(3)}
                    </td>
                    <td className={cx(TD, 'num text-right text-fg-3')}>
                      {r.loglik.toFixed(1)}
                    </td>
                    <td
                      className={cx(
                        TD,
                        'num text-right',
                        Math.abs(r.breaches - 12.5) > 6
                          ? 'text-down'
                          : 'text-fg-2',
                      )}
                    >
                      {r.breaches}
                      <span className="text-fg-4">/{r.n}</span>
                    </td>
                    <td className={TD}>
                      <PassFail p={r.kupiecP} />
                    </td>
                    <td className={TD}>
                      <PassFail p={r.indepP} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* charts */}
      <div className="grid gap-3 xl:grid-cols-2">
        <Panel
          className="h-[340px]"
          title="Out-of-sample volatility & VaR breaches"
          right={
            <span className="num text-[11px] text-fg-3">
              <span className="text-down">
                {series.filter((d) => d.breach).length}
              </span>{' '}
              breaches
            </span>
          }
          bodyClassName="flex flex-col px-3 pt-2 pb-1"
        >
          <Legend
            items={[
              [<i className="h-2.5 w-px bg-fg-3" />, '|Realised return|'],
              [
                <i className="h-0.5 w-3 bg-accent" />,
                `${volKey === 'hybrid' ? 'Hybrid' : 'GJR'} 95% band`,
              ],
              [
                <i className="h-0.5 w-3 bg-fg-4" />,
                `${volKey === 'hybrid' ? 'GJR' : 'Hybrid'} 95% band`,
              ],
              [
                <i className="h-0 w-3 border-t border-dashed border-down" />,
                'VaR cut-off',
              ],
            ]}
          />
          <div className="mt-1 min-h-0 flex-1">
            <VolChart
              data={series}
              modelLabel={volKey === 'hybrid' ? 'Hybrid' : 'GJR'}
            />
          </div>
        </Panel>
        <Panel
          className="h-[340px]"
          title={`${horizon}-day return distribution`}
          right={
            <span className="text-[11px] text-fg-4">
              Fat-tailed vs Gaussian
            </span>
          }
          bodyClassName="flex flex-col px-3 pt-2 pb-1"
        >
          <Legend
            items={[
              [<i className="h-0.5 w-3 bg-accent" />, 'Student-t (ν = 4)'],
              [
                <i className="h-0 w-3 border-t border-dashed border-fg-3" />,
                'Normal',
              ],
              [<i className="h-2 w-3 rounded-[2px] bg-down/40" />, '5% tail'],
            ]}
          />
          <div className="mt-1 min-h-0 flex-1">
            <DistChart mean={fc.expRet} sigma={fc.sigmaH} tail={fc.tail} />
          </div>
        </Panel>
      </div>

      {/* multi-horizon matrix */}
      <Panel
        title="Multi-horizon forecast matrix"
        right={
          <span className="text-[11px] text-fg-4">
            Select a row to change horizon
          </span>
        }
      >
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-line">
              <tr>
                <th className={TH}>Horizon</th>
                <th className={cx(TH, 'text-right')}>Exp. return</th>
                <th className={cx(TH, 'text-right')}>Target price</th>
                <th className={cx(TH, 'text-right')}>Swing</th>
                <th className={cx(TH, 'text-right')}>CVaR 95%</th>
                <th className={cx(TH, 'text-right')}>Reward / risk</th>
                <th className={cx(TH, 'text-right')}>Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {horizons.map((hz) => {
                const f = forecast(stock, price, hz)
                const active = hz === horizon
                return (
                  <tr
                    key={hz}
                    onClick={() => onHorizon(hz)}
                    className={cx(
                      'cursor-pointer transition-colors',
                      active ? ROW_ACTIVE : 'hover:bg-surface-2',
                    )}
                  >
                    <td
                      className={cx(
                        TD,
                        'num font-medium',
                        active ? 'text-fg' : 'text-fg-2',
                      )}
                    >
                      {hz}D
                    </td>
                    <td
                      className={cx(
                        TD,
                        'num text-right font-medium',
                        f.expRet >= 0 ? 'text-up' : 'text-down',
                      )}
                    >
                      {pct(f.expRet)}
                    </td>
                    <td className={cx(TD, 'num text-right text-fg')}>
                      {inr(f.target, 2)}
                    </td>
                    <td className={cx(TD, 'num text-right text-fg-2')}>
                      ±{(f.swing * 100).toFixed(2)}%
                    </td>
                    <td className={cx(TD, 'num text-right text-down')}>
                      {pct(f.tail)}
                    </td>
                    <td className={cx(TD, 'num text-right text-fg-2')}>
                      {f.rewardRisk.toFixed(2)}×
                    </td>
                    <td className={cx(TD, 'text-right')}>
                      <Chip tone={SIGNAL_TONE[f.signal]}>{f.signal}</Chip>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
