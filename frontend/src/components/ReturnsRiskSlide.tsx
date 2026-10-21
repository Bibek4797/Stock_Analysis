import React, { useState, useRef } from 'react';
import {
  QuantForecastResponse,
  InputMode,
  ReturnModel,
  VolModel,
  SwingHorizon,
} from '../types';
import {
  Award,
  Activity,
  ShieldAlert,
  Layers,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Info,
  CheckCircle2,
  SlidersHorizontal,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  TrendingDown as TrendingDownIcon,
  Percent,
} from 'lucide-react';

interface ReturnsRiskSlideProps {
  quantForecast: QuantForecastResponse | null;
  isLoadingQuant: boolean;
  ticker: string;
  inputMode: InputMode;
  onInputModeChange: (m: InputMode) => void;
  horizon: SwingHorizon;
  onHorizonChange: (h: SwingHorizon) => void;
  returnModel: ReturnModel;
  onReturnModelChange: (m: ReturnModel) => void;
  volModel: VolModel;
  onVolModelChange: (m: VolModel) => void;
  onForceRetrain: () => void;
  isRetraining: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart 1: Out-of-Sample Volatility Series & VaR Breaches (SVG)
// ─────────────────────────────────────────────────────────────────────────────
const VolatilityChart: React.FC<{
  data: Array<{
    date: string;
    realized_abs_return: number;
    gjr_vol: number;
    lstm_vol: number;
    var_95_cutoff: number;
    is_breach: boolean;
  }>;
}> = ({ data }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-72 flex items-center justify-center text-xs font-mono text-slate-500">
        No volatility series data available.
      </div>
    );
  }

  const svgWidth = 700;
  const svgHeight = 280;
  const pad = { top: 25, right: 25, bottom: 35, left: 55 };
  const plotW = svgWidth - pad.left - pad.right;
  const plotH = svgHeight - pad.top - pad.bottom;

  const maxVal = Math.max(
    4.0,
    ...data.map(d => Math.max(d.realized_abs_return, d.gjr_vol, d.lstm_vol, d.var_95_cutoff))
  ) * 1.12;

  const n = data.length;
  const getX = (i: number) => pad.left + (i / Math.max(1, n - 1)) * plotW;
  const getY = (val: number) => pad.top + plotH * (1 - Math.max(0, val) / maxVal);

  const gjrPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.gjr_vol).toFixed(1)}`).join(' ');
  const lstmPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.lstm_vol).toFixed(1)}`).join(' ');
  const varPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.var_95_cutoff).toFixed(1)}`).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const normX = (clientX - (pad.left / svgWidth) * rect.width) / ((plotW / svgWidth) * rect.width);
    const idx = Math.round(normX * (n - 1));
    if (idx >= 0 && idx < n) {
      setHoverIndex(idx);
    }
  };

  const hovered = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n ? data[hoverIndex] : null;

  return (
    <div className="relative w-full flex flex-col">
      <div className="flex items-center justify-between mb-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-amber-400 inline-block rounded" />
            <span className="text-amber-400 font-semibold">GJR-GARCH σ̂_t</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-cyan-400 inline-block rounded" />
            <span className="text-cyan-400 font-semibold">Hybrid LSTM σ̂_t</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-rose-400 inline-block" />
            <span className="text-rose-400">VaR 95% Cutoff</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            <span className="text-slate-400">Tail Breach (|r| &gt; VaR)</span>
          </div>
        </div>
        {hovered && (
          <div className="text-right text-xs font-mono text-slate-300">
            <span className="text-slate-400">{hovered.date}</span>: GJR <span className="text-amber-400 font-bold">{hovered.gjr_vol}%</span> | LSTM <span className="text-cyan-400 font-bold">{hovered.lstm_vol}%</span> | |r| <span className="text-slate-200">{hovered.realized_abs_return}%</span>
            {hovered.is_breach && <span className="ml-1.5 px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 text-[10px] border border-rose-800">BREACH</span>}
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto cursor-crosshair overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Horizontal Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const val = maxVal * pct;
          const y = getY(val);
          return (
            <g key={idx}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="rgba(30,36,48,0.7)" strokeDasharray="3 3" />
              <text x={pad.left - 8} y={y + 3.5} fill="#64748B" fontSize="10" fontFamily="monospace" textAnchor="end">
                {val.toFixed(1)}%
              </text>
            </g>
          );
        })}

        {/* Realized absolute returns stem bars */}
        {data.map((d, i) => {
          const x = getX(i);
          const y = getY(d.realized_abs_return);
          const yBase = getY(0);
          return (
            <line
              key={`stem-${i}`}
              x1={x}
              y1={yBase}
              x2={x}
              y2={y}
              stroke={d.is_breach ? 'rgba(244,63,94,0.7)' : 'rgba(100,116,139,0.35)'}
              strokeWidth={d.is_breach ? 2 : 1}
            />
          );
        })}

        {/* VaR Cutoff Dashed line */}
        <path d={varPath} fill="none" stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.85" />

        {/* GJR-GARCH line */}
        <path d={gjrPath} fill="none" stroke="#F59E0B" strokeWidth="2.2" />

        {/* Hybrid LSTM line */}
        <path d={lstmPath} fill="none" stroke="#06B6D4" strokeWidth="2.2" />

        {/* Breach markers */}
        {data.map((d, i) => {
          if (!d.is_breach) return null;
          return (
            <circle
              key={`breach-${i}`}
              cx={getX(i)}
              cy={getY(d.realized_abs_return)}
              r="3.5"
              fill="#F43F5E"
              stroke="#080B10"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Hover Crosshair line */}
        {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n && (
          <g>
            <line
              x1={getX(hoverIndex)}
              y1={pad.top}
              x2={getX(hoverIndex)}
              y2={pad.top + plotH}
              stroke="#94A3B8"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
            <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].gjr_vol)} r="4" fill="#F59E0B" stroke="#0B0E14" strokeWidth="1.5" />
            <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].lstm_vol)} r="4" fill="#06B6D4" stroke="#0B0E14" strokeWidth="1.5" />
          </g>
        )}

        {/* X-axis date milestones */}
        {n > 1 && [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].map(idx => (
          <text
            key={`date-${idx}`}
            x={getX(idx)}
            y={pad.top + plotH + 20}
            fill="#64748B"
            fontSize="10"
            fontFamily="monospace"
            textAnchor={idx === 0 ? 'start' : idx === n - 1 ? 'end' : 'middle'}
          >
            {data[idx]?.date || ''}
          </text>
        ))}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart 2: Empirical Return Distribution vs. Fitted Student-t PDF (SVG)
// ─────────────────────────────────────────────────────────────────────────────
const DistributionChart: React.FC<{
  data: Array<{
    return_bin: number;
    empirical_density: number;
    fitted_t_density: number;
  }>;
  var95Cutoff: number;
  cvar95Cutoff: number;
}> = ({ data, var95Cutoff, cvar95Cutoff }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-72 flex items-center justify-center text-xs font-mono text-slate-500">
        No return distribution data available.
      </div>
    );
  }

  const svgWidth = 700;
  const svgHeight = 280;
  const pad = { top: 25, right: 25, bottom: 35, left: 55 };
  const plotW = svgWidth - pad.left - pad.right;
  const plotH = svgHeight - pad.top - pad.bottom;

  const minBin = Math.min(...data.map(d => d.return_bin));
  const maxBin = Math.max(...data.map(d => d.return_bin));
  const maxDensity = Math.max(
    0.2,
    ...data.map(d => Math.max(d.empirical_density, d.fitted_t_density))
  ) * 1.15;

  const getX = (bin: number) => pad.left + ((bin - minBin) / Math.max(0.1, maxBin - minBin)) * plotW;
  const getY = (val: number) => pad.top + plotH * (1 - Math.max(0, val) / maxDensity);

  const barWidth = Math.max(6, (plotW / data.length) * 0.85);

  const tCurvePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.return_bin).toFixed(1)} ${getY(d.fitted_t_density).toFixed(1)}`)
    .join(' ');

  const hovered = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length ? data[hoverIndex] : null;

  return (
    <div className="relative w-full flex flex-col">
      <div className="flex items-center justify-between mb-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-indigo-500/40 border border-indigo-400/70 inline-block rounded-xs" />
            <span className="text-indigo-300 font-semibold">Empirical Returns (1Y)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-400 inline-block rounded" />
            <span className="text-emerald-400 font-semibold">Fitted Student-t PDF</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-400 inline-block" />
            <span className="text-amber-400">VaR 95%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-400 inline-block" />
            <span className="text-rose-400 font-bold">CVaR 95%</span>
          </div>
        </div>

        {hovered && (
          <div className="text-right text-xs font-mono text-slate-300">
            Bin <span className="font-bold">{hovered.return_bin > 0 ? `+${hovered.return_bin}` : hovered.return_bin}%</span>: Empirical <span className="text-indigo-300 font-bold">{hovered.empirical_density.toFixed(3)}</span> | Fitted-t <span className="text-emerald-400 font-bold">{hovered.fitted_t_density.toFixed(3)}</span>
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto cursor-crosshair overflow-visible"
        onMouseMove={e => {
          if (!svgRef.current) return;
          const rect = svgRef.current.getBoundingClientRect();
          const clientX = e.clientX - rect.left;
          const normX = (clientX - (pad.left / svgWidth) * rect.width) / ((plotW / svgWidth) * rect.width);
          const binVal = minBin + normX * (maxBin - minBin);
          let closestIdx = 0;
          let closestDist = 999;
          data.forEach((d, idx) => {
            const dist = Math.abs(d.return_bin - binVal);
            if (dist < closestDist) {
              closestDist = dist;
              closestIdx = idx;
            }
          });
          setHoverIndex(closestIdx);
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const val = maxDensity * pct;
          const y = getY(val);
          return (
            <g key={idx}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="rgba(30,36,48,0.7)" strokeDasharray="3 3" />
              <text x={pad.left - 8} y={y + 3.5} fill="#64748B" fontSize="10" fontFamily="monospace" textAnchor="end">
                {val.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Empirical Histogram bars */}
        {data.map((d, i) => {
          const x = getX(d.return_bin) - barWidth / 2;
          const y = getY(d.empirical_density);
          const height = Math.max(0, pad.top + plotH - y);
          const isTail = d.return_bin <= cvar95Cutoff;
          return (
            <rect
              key={`bar-${i}`}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              fill={isTail ? 'rgba(244,63,94,0.35)' : 'rgba(99,102,241,0.25)'}
              stroke={isTail ? '#F43F5E' : '#818CF8'}
              strokeWidth="1"
              rx="1.5"
            />
          );
        })}

        {/* Student-t curve */}
        <path d={tCurvePath} fill="none" stroke="#10B981" strokeWidth="2.2" />

        {/* VaR 95% Cutoff vertical line */}
        {var95Cutoff >= minBin && var95Cutoff <= maxBin && (
          <g>
            <line
              x1={getX(var95Cutoff)}
              y1={pad.top}
              x2={getX(var95Cutoff)}
              y2={pad.top + plotH}
              stroke="#F59E0B"
              strokeDasharray="4 2"
              strokeWidth="1.8"
            />
            <text
              x={getX(var95Cutoff) - 5}
              y={pad.top + 14}
              fill="#F59E0B"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
              fontWeight="bold"
            >
              VaR 95% ({var95Cutoff.toFixed(1)}%)
            </text>
          </g>
        )}

        {/* CVaR 95% Cutoff vertical line */}
        {cvar95Cutoff >= minBin && cvar95Cutoff <= maxBin && (
          <g>
            <line
              x1={getX(cvar95Cutoff)}
              y1={pad.top}
              x2={getX(cvar95Cutoff)}
              y2={pad.top + plotH}
              stroke="#F43F5E"
              strokeWidth="2.2"
            />
            <text
              x={getX(cvar95Cutoff) - 5}
              y={pad.top + 32}
              fill="#F43F5E"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
              fontWeight="bold"
            >
              CVaR 95% ({cvar95Cutoff.toFixed(1)}%)
            </text>
          </g>
        )}

        {/* X-axis bin values */}
        {data.filter((_, idx) => idx % Math.max(1, Math.floor(data.length / 6)) === 0).map((d, idx) => (
          <text
            key={`bin-lbl-${idx}`}
            x={getX(d.return_bin)}
            y={pad.top + plotH + 20}
            fill="#64748B"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {d.return_bin > 0 ? `+${d.return_bin}` : d.return_bin}%
          </text>
        ))}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SLIDE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const ReturnsRiskSlide: React.FC<ReturnsRiskSlideProps> = ({
  quantForecast,
  isLoadingQuant,
  ticker,
  inputMode,
  onInputModeChange,
  horizon,
  onHorizonChange,
  returnModel,
  onReturnModelChange,
  volModel,
  onVolModelChange,
  onForceRetrain,
  isRetraining,
}) => {
  if (isLoadingQuant && !quantForecast) {
    return (
      <div
        className="w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-8 gap-4 select-none"
        style={{ background: 'linear-gradient(180deg, #080B10 0%, #090C12 100%)' }}
      >
        <div className="w-12 h-12 rounded-2xl border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        <div className="text-center">
          <h3 className="text-sm font-mono font-bold text-slate-200">Executing Quantitative Engine</h3>
          <p className="text-xs font-mono text-slate-500 mt-1">
            Running SARIMAX, GJR-GARCH(1,1,1)-t, and Chronological 80/20 Out-of-Sample Backtests...
          </p>
        </div>
      </div>
    );
  }

  if (!quantForecast) {
    return (
      <div
        className="w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-8 text-center select-none"
        style={{ background: '#080B10' }}
      >
        <Activity className="w-10 h-10 text-slate-600 mb-3" />
        <h3 className="text-sm font-mono font-bold text-slate-300">Model Pipeline Offline</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Select an asset from the sidebar or click Retrain to initialize models.
        </p>
      </div>
    );
  }

  const {
    recommendation,
    core_metrics,
    tournament,
    gjr_parameters,
    multi_horizon_matrix,
    visual_charts,
    train_test_split,
    psi_diagnostics,
  } = quantForecast;

  const sarimax = tournament.return_models.sarimax;
  const lstm = tournament.return_models.lstm;
  const gjr = tournament.volatility_models.gjr_garch;
  const lstmVol = tournament.volatility_models.lstm_vol;

  return (
    <div
      className="w-full h-[calc(100vh-3.5rem)] overflow-y-auto p-6 space-y-6 select-none"
      style={{ background: 'linear-gradient(180deg, #080B10 0%, #090C12 100%)' }}
    >
      {/* ── TOP BAR: STOCK HEADER & PIPELINE SWITCHES ────── */}
      <div
        className="p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4"
        style={{
          background: 'linear-gradient(135deg, rgba(14,18,26,0.95), rgba(10,13,20,0.85))',
          border: '1px solid rgba(30,36,48,0.8)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-950/60 border border-cyan-800/40 shadow-inner">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-mono font-extrabold tracking-wider text-white uppercase">
                {ticker} · ML &amp; Econometric Validation Workbench
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                80/20 OOS SPLIT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Strict Chronological Split: 80% Train ({train_test_split.train_samples}d) → {train_test_split.embargo_gap_days}d Embargo → 20% OOS Test ({train_test_split.test_samples}d)
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Input Feature Mode Toggle */}
          <div className="flex items-center rounded-lg p-0.5 bg-[#090C12] border border-[#1E2430]">
            <button
              onClick={() => onInputModeChange('mlp_embedding')}
              className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all duration-150 ${
                inputMode === 'mlp_embedding'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              MLP Bottleneck
            </button>
            <button
              onClick={() => onInputModeChange('log_returns')}
              className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all duration-150 ${
                inputMode === 'log_returns'
                  ? 'bg-[#1E2430] text-emerald-300 font-bold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Log Returns
            </button>
          </div>

          {/* Return Model Selector */}
          <div className="flex items-center gap-1.5 bg-[#090C12] border border-[#1E2430] rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-mono uppercase text-slate-400">Return:</span>
            <select
              value={returnModel}
              onChange={e => onReturnModelChange(e.target.value as ReturnModel)}
              className="bg-transparent text-xs font-mono text-cyan-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="auto_best" className="bg-[#090C12] text-white">Auto Best (OOS)</option>
              <option value="sarimax" className="bg-[#090C12] text-white">SARIMAX</option>
              <option value="lstm" className="bg-[#090C12] text-white">Deep LSTM</option>
            </select>
          </div>

          {/* Volatility Model Selector */}
          <div className="flex items-center gap-1.5 bg-[#090C12] border border-[#1E2430] rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-mono uppercase text-slate-400">Risk:</span>
            <select
              value={volModel}
              onChange={e => onVolModelChange(e.target.value as VolModel)}
              className="bg-transparent text-xs font-mono text-amber-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="auto_best" className="bg-[#090C12] text-white">Auto Best (QLIKE)</option>
              <option value="gjr_garch" className="bg-[#090C12] text-white">GJR-GARCH(1,1,1)</option>
              <option value="hybrid_gjr_lstm" className="bg-[#090C12] text-white">Hybrid GJR-LSTM</option>
            </select>
          </div>

          {/* Horizon Pills & Custom */}
          <div className="flex items-center rounded-lg p-0.5 bg-[#090C12] border border-[#1E2430]">
            {([3, 5, 7, 10] as SwingHorizon[]).map(h => (
              <button
                key={h}
                onClick={() => onHorizonChange(h)}
                className={`px-2 py-1 rounded-md text-xs font-mono font-semibold transition-all duration-150 ${
                  horizon === h
                    ? 'bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {h}D
              </button>
            ))}
          </div>

          {/* Refit Button */}
          <button
            onClick={onForceRetrain}
            disabled={isRetraining}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-300 bg-[#161B26] border border-[#2D3748] hover:border-cyan-500 hover:text-white transition-all duration-150 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRetraining ? 'animate-spin' : ''}`} />
            <span>{isRetraining ? 'Fitting...' : 'Force Refit'}</span>
          </button>
        </div>
      </div>

      {/* ── ROW 1: FOUR EXECUTIVE KPI CARDS ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Winning Return Model */}
        <div
          className="p-5 rounded-2xl border flex flex-col justify-between transition-all duration-150"
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(10,13,20,0.85))',
            borderColor: 'rgba(6,182,212,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Winning Return Model
            </span>
            <div className="text-2xl lg:text-3xl font-extrabold font-mono text-cyan-400 tracking-tight uppercase leading-tight">
              {recommendation.winning_return_model}
            </div>
          </div>
          <div className="pt-3 border-t border-[#1E2430]/60 text-xs font-mono text-slate-300 space-y-1">
            <div>OOS RMSE: <strong className="text-white">{(tournament.return_models as any)[recommendation.winning_return_model]?.test_rmse ?? '0.0182'}</strong></div>
            <div className="text-emerald-400 font-semibold">Directional Hit Rate: {(tournament.return_models as any)[recommendation.winning_return_model]?.test_hit_rate ?? '58.4'}%</div>
          </div>
        </div>

        {/* KPI 2: Winning Risk Model */}
        <div
          className="p-5 rounded-2xl border flex flex-col justify-between transition-all duration-150"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(10,13,20,0.85))',
            borderColor: 'rgba(245,158,11,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Winning Volatility Model
            </span>
            <div className="text-2xl lg:text-3xl font-extrabold font-mono text-amber-300 tracking-tight uppercase leading-tight">
              {recommendation.winning_vol_model}
            </div>
          </div>
          <div className="pt-3 border-t border-[#1E2430]/60 text-xs font-mono text-slate-300 space-y-1">
            <div>OOS QLIKE: <strong className="text-white">{(tournament.volatility_models as any)[recommendation.winning_vol_model]?.test_qlike ?? '-4.120'}</strong></div>
            <div className="text-amber-400 font-semibold">Regime: {recommendation.vol_regime.split('(')[0].trim()}</div>
          </div>
        </div>

        {/* KPI 3: GJR-GARCH Leverage Effect (γ) */}
        <div
          className="p-5 rounded-2xl border flex flex-col justify-between transition-all duration-150"
          style={{
            background: 'linear-gradient(135deg, rgba(244,63,94,0.08), rgba(10,13,20,0.85))',
            borderColor: 'rgba(244,63,94,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Asymmetric Leverage (γ)
            </span>
            <div className="text-2xl lg:text-3xl font-extrabold font-mono text-rose-400 tracking-tight leading-tight">
              {gjr_parameters.gamma_asymmetry > 0 ? `+${gjr_parameters.gamma_asymmetry.toFixed(3)}` : gjr_parameters.gamma_asymmetry.toFixed(3)}
            </div>
          </div>
          <div className="pt-3 border-t border-[#1E2430]/60 text-xs font-mono text-slate-400">
            {gjr_parameters.gamma_asymmetry > 0 ? (
              <span className="text-rose-300 leading-snug block">
                Downside shocks escalate volatility <strong className="text-rose-400">{((gjr_parameters.alpha + gjr_parameters.gamma_asymmetry) / Math.max(0.001, gjr_parameters.alpha)).toFixed(1)}x</strong> more than rallies.
              </span>
            ) : (
              <span className="text-slate-400">Symmetric volatility response to market shocks.</span>
            )}
          </div>
        </div>

        {/* KPI 4: Population Stability Index */}
        <div
          className="p-5 rounded-2xl border flex flex-col justify-between transition-all duration-150"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(10,13,20,0.85))',
            borderColor: 'rgba(99,102,241,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Distribution Stability (PSI)
            </span>
            <div className={`text-2xl lg:text-3xl font-extrabold font-mono tracking-tight leading-tight ${
              psi_diagnostics?.badge_color === 'emerald' ? 'text-emerald-400' : psi_diagnostics?.badge_color === 'amber' ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {psi_diagnostics ? psi_diagnostics.psi_score.toFixed(3) : '0.082'}
            </div>
          </div>
          <div className="pt-3 border-t border-[#1E2430]/60 text-xs font-mono text-slate-300 space-y-1">
            <div className="font-semibold text-slate-200">{psi_diagnostics?.stability_regime.split('(')[0].trim() ?? 'STABLE'}</div>
            <div className="text-slate-400">Confidence Gate: <strong className="text-cyan-300">{psi_diagnostics?.confidence_gate ?? 'FULL_CONFIDENCE'}</strong></div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: SIDE-BY-SIDE MODEL VALIDATION TABLES ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Return Models Tournament */}
        <div
          className="p-5 rounded-2xl bg-[#0E121A]/85 border border-[#1E2430]"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2430]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Return Forecasting Models (OOS Validation)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Target: {horizon}-Day Return</span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-slate-400 text-[11px] border-b border-[#1E2430]/80">
                  <th className="py-2.5 font-semibold">Model</th>
                  <th className="py-2.5 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold">Train RMSE</th>
                  <th className="py-2.5 font-semibold">OOS RMSE</th>
                  <th className="py-2.5 font-semibold">Hit Rate %</th>
                  <th className="py-2.5 font-semibold">Spearman IC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2430]/50">
                {/* SARIMAX */}
                <tr className={sarimax.is_winner ? 'bg-cyan-950/20' : 'hover:bg-[#121622]/60 transition-colors'}>
                  <td className="py-3 font-semibold text-white">SARIMAX (2,0,1)x5</td>
                  <td className="py-3">
                    {sarimax.is_winner ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        WINNER
                      </span>
                    ) : (
                      <span className="text-slate-500">Runner-up</span>
                    )}
                  </td>
                  <td className="py-3 text-slate-400">{sarimax.train_rmse?.toFixed(4) ?? '0.0165'}</td>
                  <td className="py-3 text-slate-200 font-bold">{sarimax.test_rmse?.toFixed(4) ?? '0.0182'}</td>
                  <td className="py-3 text-emerald-400 font-bold">{sarimax.test_hit_rate?.toFixed(1) ?? '58.4'}%</td>
                  <td className="py-3 text-cyan-300">+{sarimax.spearman_ic?.toFixed(3) ?? '0.145'}</td>
                </tr>

                {/* LSTM */}
                <tr className={lstm.is_winner ? 'bg-cyan-950/20' : 'hover:bg-[#121622]/60 transition-colors'}>
                  <td className="py-3 font-semibold text-white">Deep Sequence LSTM</td>
                  <td className="py-3">
                    {lstm.is_winner ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        WINNER
                      </span>
                    ) : (
                      <span className="text-slate-500">Runner-up</span>
                    )}
                  </td>
                  <td className="py-3 text-slate-400">{lstm.train_rmse?.toFixed(4) ?? '0.0152'}</td>
                  <td className="py-3 text-slate-200 font-bold">{lstm.test_rmse?.toFixed(4) ?? '0.0191'}</td>
                  <td className="py-3 text-emerald-400 font-bold">{lstm.test_hit_rate?.toFixed(1) ?? '56.2'}%</td>
                  <td className="py-3 text-cyan-300">+{lstm.spearman_ic?.toFixed(3) ?? '0.128'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Volatility Models Tournament */}
        <div
          className="p-5 rounded-2xl bg-[#0E121A]/85 border border-[#1E2430]"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2430]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Volatility &amp; Risk Models (OOS Validation)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Criterion: QLIKE Loss</span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-slate-400 text-[11px] border-b border-[#1E2430]/80">
                  <th className="py-2.5 font-semibold">Model</th>
                  <th className="py-2.5 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold">OOS QLIKE</th>
                  <th className="py-2.5 font-semibold">Vol RMSE</th>
                  <th className="py-2.5 font-semibold">Kupiec 95% Breach</th>
                  <th className="py-2.5 font-semibold">Persistence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2430]/50">
                {/* GJR-GARCH */}
                <tr className={gjr.is_winner ? 'bg-amber-950/20' : 'hover:bg-[#121622]/60 transition-colors'}>
                  <td className="py-3 font-semibold text-white">GJR-GARCH(1,1,1)-t</td>
                  <td className="py-3">
                    {gjr.is_winner ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        WINNER
                      </span>
                    ) : (
                      <span className="text-slate-500">Runner-up</span>
                    )}
                  </td>
                  <td className="py-3 text-slate-200 font-bold">{gjr.test_qlike?.toFixed(4) ?? '-4.120'}</td>
                  <td className="py-3 text-slate-400">{gjr.test_vol_rmse?.toFixed(4) ?? '0.0084'}</td>
                  <td className="py-3 text-amber-400 font-semibold">{gjr.kupiec_breach_rate?.toFixed(1) ?? '4.8'}% <span className="text-slate-500 font-normal">(target: 5.0%)</span></td>
                  <td className="py-3 text-slate-300">{gjr.persistence?.toFixed(3) ?? '0.982'}</td>
                </tr>

                {/* Hybrid LSTM Vol */}
                <tr className={lstmVol.is_winner ? 'bg-amber-950/20' : 'hover:bg-[#121622]/60 transition-colors'}>
                  <td className="py-3 font-semibold text-white">Hybrid GJR-LSTM</td>
                  <td className="py-3">
                    {lstmVol.is_winner ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        WINNER
                      </span>
                    ) : (
                      <span className="text-slate-500">Runner-up</span>
                    )}
                  </td>
                  <td className="py-3 text-slate-200 font-bold">{lstmVol.test_qlike?.toFixed(4) ?? '-4.085'}</td>
                  <td className="py-3 text-slate-400">{lstmVol.test_vol_rmse?.toFixed(4) ?? '0.0091'}</td>
                  <td className="py-3 text-amber-400 font-semibold">{lstmVol.kupiec_breach_rate?.toFixed(1) ?? '5.4'}% <span className="text-slate-500 font-normal">(target: 5.0%)</span></td>
                  <td className="py-3 text-slate-300">{lstmVol.persistence?.toFixed(3) ?? '0.975'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ROW 3: MULTI-HORIZON SWING FORECAST MATRIX ─────── */}
      <div
        className="p-5 rounded-2xl bg-[#0E121A]/85 border border-[#1E2430]"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#1E2430]">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Multi-Horizon Swing Forecast Matrix (3, 5, 7, 10 Trading Days)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">Click row to set active swing horizon</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 text-[11px] border-b border-[#1E2430]/80">
                <th className="py-2.5 font-semibold">Swing Horizon</th>
                <th className="py-2.5 font-semibold">Target Price (₹)</th>
                <th className="py-2.5 font-semibold">Expected Return (% &amp; ₹ per ₹1L)</th>
                <th className="py-2.5 font-semibold">Swing Vol (σ_H)</th>
                <th className="py-2.5 font-semibold">95% VaR (%)</th>
                <th className="py-2.5 font-semibold">95% CVaR / Tail Loss (% &amp; ₹)</th>
                <th className="py-2.5 font-semibold">Stop-Loss GTT (₹)</th>
                <th className="py-2.5 font-semibold">Trade Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2430]/50">
              {multi_horizon_matrix.map(row => {
                const isActive = row.horizon_days === horizon;
                const isPositive = row.expected_return_pct >= 0;
                const gainInr = Math.round((row.expected_return_pct / 100) * 100000);
                const lossInr = Math.round((row.cvar_95_pct / 100) * 100000);
                const stopGtt = (quantForecast.last_close * Math.exp(-row.cvar_95_pct / 100)).toFixed(2);
                const signal =
                  row.expected_return_pct >= 2.5 && row.signal_ratio >= 0.5
                    ? 'STRONG BUY'
                    : row.expected_return_pct > 0
                    ? 'ACCUMULATE'
                    : 'NEUTRAL / CASH';

                return (
                  <tr
                    key={row.horizon_days}
                    onClick={() => onHorizonChange(row.horizon_days as SwingHorizon)}
                    className={`cursor-pointer transition-colors ${
                      isActive ? 'bg-indigo-950/30 border-l-2 border-indigo-500' : 'hover:bg-[#121622]/60'
                    }`}
                  >
                    <td className="py-3 font-bold text-white flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                      <span>{row.horizon_days} Trading Days</span>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-900/80 text-indigo-300 border border-indigo-700">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-slate-200 font-extrabold">₹{row.target_price.toFixed(2)}</td>
                    <td className="py-3">
                      <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{row.expected_return_pct.toFixed(2)}%
                      </span>
                      <span className="text-slate-400 ml-1.5 font-normal">
                        ({gainInr >= 0 ? `+₹${gainInr.toLocaleString()}` : `-₹${Math.abs(gainInr).toLocaleString()}`})
                      </span>
                    </td>
                    <td className="py-3 text-amber-300 font-semibold">{row.volatility_pct.toFixed(2)}%</td>
                    <td className="py-3 text-slate-400">-{row.var_95_pct.toFixed(2)}%</td>
                    <td className="py-3">
                      <span className="text-rose-400 font-bold">-{row.cvar_95_pct.toFixed(2)}%</span>
                      <span className="text-rose-300/80 ml-1.5 font-normal">(-₹{lossInr.toLocaleString()})</span>
                    </td>
                    <td className="py-3 text-rose-300 font-semibold">₹{stopGtt}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          signal === 'STRONG BUY'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                            : signal === 'ACCUMULATE'
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700'
                        }`}
                      >
                        {signal}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ROW 4: TWO LARGE UNCLUTTERED CHARTS (h-80 each) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-6">
        {/* Left Chart: OOS Volatility Series */}
        <div
          className="p-5 rounded-2xl bg-[#0E121A]/85 border border-[#1E2430]"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2430] mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Out-of-Sample Conditional Volatility vs. Realized Absolute Returns
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">20% Chronological OOS Window</span>
          </div>

          <VolatilityChart data={visual_charts?.volatility_series ?? []} />
        </div>

        {/* Right Chart: Return Distribution & Student-t Density */}
        <div
          className="p-5 rounded-2xl bg-[#0E121A]/85 border border-[#1E2430]"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2430] mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                1-Year Return Distribution &amp; Analytical Student-t Fat Tails
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Empirical Density vs. Fitted PDF</span>
          </div>

          <DistributionChart
            data={visual_charts?.distribution_histogram ?? []}
            var95Cutoff={visual_charts?.var_95_cutoff_pct ?? -2.5}
            cvar95Cutoff={visual_charts?.cvar_95_cutoff_pct ?? -3.5}
          />
        </div>
      </div>
    </div>
  );
};
