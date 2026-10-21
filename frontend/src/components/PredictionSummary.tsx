import React from 'react';
import { OhlcvResponse, QuantForecastResponse } from '../types';
import { TrendingUp, TrendingDown, ShieldAlert, Award, ArrowRight } from 'lucide-react';

interface Props {
  data: OhlcvResponse | null;
  quantForecast: QuantForecastResponse | null;
  isLoadingQuant: boolean;
  onOpenReturnsRiskTab?: () => void;
}

export const PredictionSummary: React.FC<Props> = ({
  data,
  quantForecast,
  isLoadingQuant,
  onOpenReturnsRiskTab,
}) => {
  const ticker = data?.ticker || '—';

  if (isLoadingQuant) {
    return (
      <div
        className="w-full h-full flex flex-col justify-between p-4 select-none"
        style={{ background: 'linear-gradient(180deg, #080B10 0%, #090C12 100%)' }}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#1E2430]">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Return &amp; Risk Outlook
          </span>
          <span className="text-xs font-mono text-cyan-400 animate-pulse">Analyzing Forecasts...</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
          <div className="w-7 h-7 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <span className="text-xs font-mono text-slate-400">Computing Multi-Model Projections...</span>
        </div>
      </div>
    );
  }

  if (!quantForecast) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center p-4 text-center select-none"
        style={{ background: '#080B10' }}
      >
        <Award className="w-8 h-8 text-slate-600 mb-2" />
        <span className="text-xs font-mono text-slate-400">Terminal Ready · Select a Stock</span>
      </div>
    );
  }

  const { recommendation, core_metrics, horizon, gtt_levels } = quantForecast;
  const isUp = core_metrics.expected_return_pct >= 0;

  // Clean signal pill classification (No math jargon)
  const getSignalBadge = (verdict: string) => {
    const v = (verdict || '').toUpperCase();
    if (v.includes('STRONG') || v.includes('LONG') && !v.includes('MODERATE')) {
      return {
        label: 'Strong Buy',
        bg: 'rgba(16,185,129,0.15)',
        border: 'rgba(16,185,129,0.4)',
        text: '#10B981',
        icon: <TrendingUp className="w-3.5 h-3.5" />
      };
    }
    if (v.includes('MODERATE')) {
      return {
        label: 'Moderate Buy',
        bg: 'rgba(20,184,166,0.15)',
        border: 'rgba(20,184,166,0.4)',
        text: '#2DD4BF',
        icon: <TrendingUp className="w-3.5 h-3.5" />
      };
    }
    if (v.includes('SHORT') || v.includes('AVOID')) {
      return {
        label: 'Avoid',
        bg: 'rgba(244,63,94,0.15)',
        border: 'rgba(244,63,94,0.4)',
        text: '#F43F5E',
        icon: <TrendingDown className="w-3.5 h-3.5" />
      };
    }
    return {
      label: 'Hold / Neutral',
      bg: 'rgba(148,163,184,0.15)',
      border: 'rgba(148,163,184,0.3)',
      text: '#94A3B8',
      icon: <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
    };
  };

  const signal = getSignalBadge(recommendation?.verdict || '');

  // Stake-based rupee metrics (per ₹1 Lakh stake for consumer-grade intuition)
  const expProfitPer1L = Math.round((core_metrics.expected_return_pct / 100) * 100000);
  const cvarLossPer1L = Math.round((core_metrics.cvar_95_pct / 100) * 100000);

  // Normal ±1σ swing range in rupees
  const lowerRangePrice = Math.round(quantForecast.last_close * (1 - core_metrics.volatility_pct / 100));
  const upperRangePrice = Math.round(quantForecast.last_close * (1 + core_metrics.volatility_pct / 100));

  return (
    <div
      className="w-full h-full flex flex-col p-4 select-none overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #080B10 0%, #090C12 100%)' }}
    >
      {/* ── 1. Clean Header Strip ────────────────────────── */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1E2430] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-cyan-950/60 border border-cyan-800/40 flex-shrink-0">
            <Award className="w-3 h-3 text-cyan-400" />
          </div>
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider truncate">
            {horizon}-Day Outlook for {ticker.replace('.NS', '')}
          </span>
        </div>

        {/* Clean Signal Pill */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-extrabold flex-shrink-0"
          style={{
            background: signal.bg,
            border: `1px solid ${signal.border}`,
            color: signal.text,
          }}
        >
          {signal.icon}
          <span>{signal.label}</span>
        </div>
      </div>

      {/* ── 2. Three Large Executive Metric Blocks ────────── */}
      <div className="grid grid-cols-3 gap-2.5 flex-1 min-h-0 py-2">
        {/* Block 1: Expected Return */}
        <div
          className="min-h-0 p-3.5 rounded-xl flex flex-col justify-between transition-all duration-150 hover:border-slate-600"
          style={{
            background: 'linear-gradient(145deg, rgba(14,18,26,0.95), rgba(11,15,22,0.9))',
            border: '1px solid #1E2430',
          }}
        >
          <div className="flex-shrink-0">
            <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
              Expected {horizon}D Return
            </span>
            <div className={`text-2xl lg:text-3xl font-extrabold font-mono tracking-tight leading-tight ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isUp ? '+' : ''}{core_metrics.expected_return_pct.toFixed(2)}%
            </div>
          </div>

          <div className="space-y-0.5 pt-1.5 border-t border-[#1E2430]/60 flex-shrink-0">
            <div className="text-[11px] font-mono font-semibold text-slate-200 truncate">
              Target: <span className="text-white font-bold">₹{core_metrics.target_price.toFixed(2)}</span>
            </div>
            <div className="text-[10px] font-mono text-emerald-400 font-semibold truncate">
              {expProfitPer1L >= 0 ? `+₹${expProfitPer1L.toLocaleString()}` : `-₹${Math.abs(expProfitPer1L).toLocaleString()}`} <span className="text-slate-500 font-normal">/ ₹1L stake</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate">
              Confidence: <span className="text-cyan-300 font-semibold">{core_metrics.oos_hit_rate.toFixed(0)}% Directional Accuracy</span>
            </div>
          </div>
        </div>

        {/* Block 2: Price Range & Volatility */}
        <div
          className="min-h-0 p-3.5 rounded-xl flex flex-col justify-between transition-all duration-150 hover:border-slate-600"
          style={{
            background: 'linear-gradient(145deg, rgba(14,18,26,0.95), rgba(11,15,22,0.9))',
            border: '1px solid #1E2430',
          }}
        >
          <div className="flex-shrink-0">
            <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
              Expected Price Range
            </span>
            <div className="text-xl lg:text-2xl font-extrabold font-mono tracking-tight leading-tight text-amber-300 truncate">
              ₹{lowerRangePrice} – ₹{upperRangePrice}
            </div>
          </div>

          <div className="space-y-0.5 pt-1.5 border-t border-[#1E2430]/60 flex-shrink-0">
            <div className="text-[11px] font-mono text-slate-200 truncate">
              Swing Volatility: <span className="text-amber-300 font-semibold">±{core_metrics.volatility_pct.toFixed(2)}%</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate">
              Annualized: <span className="text-slate-300 font-medium">{core_metrics.annualized_vol_pct.toFixed(1)}%</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate">
              Reward / Risk: <span className="text-amber-300 font-bold">{core_metrics.tail_sharpe.toFixed(2)}x</span>
            </div>
          </div>
        </div>

        {/* Block 3: Downside Tail Risk */}
        <div
          className="min-h-0 p-3.5 rounded-xl flex flex-col justify-between transition-all duration-150 hover:border-rose-800/60"
          style={{
            background: 'linear-gradient(145deg, rgba(26,14,18,0.4), rgba(14,18,26,0.9))',
            border: '1px solid rgba(244,63,94,0.25)',
          }}
        >
          <div className="flex-shrink-0">
            <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-rose-400 block mb-0.5 flex items-center justify-between">
              <span>Downside Tail Risk</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </span>
            <div className="text-2xl lg:text-3xl font-extrabold font-mono tracking-tight leading-tight text-rose-400">
              -{core_metrics.cvar_95_pct.toFixed(2)}%
            </div>
          </div>

          <div className="space-y-0.5 pt-1.5 border-t border-rose-900/30 flex-shrink-0">
            <div className="text-[11px] font-mono font-semibold text-rose-300 truncate">
              -₹{cvarLossPer1L.toLocaleString()} <span className="text-slate-400 font-normal">/ ₹1L stake</span>
            </div>
            <div className="text-[10px] font-mono text-slate-300 truncate">
              Stop-Loss: <span className="text-rose-400 font-bold">₹{gtt_levels?.stop_loss_gtt ? gtt_levels.stop_loss_gtt.toFixed(2) : '—'}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate">
              Risk Level: <span className="text-slate-300 font-medium">95% Confidence Tail Loss</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Jargon-Free Footer Link Strip ─────────────── */}
      <div
        className="flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-mono flex-shrink-0"
        style={{ background: 'rgba(14,18,26,0.7)', border: '1px solid #1E2430' }}
      >
        <span className="text-slate-400 text-[11px] truncate mr-2">
          Tap to inspect underlying econometric validation models →
        </span>

        {onOpenReturnsRiskTab && (
          <button
            onClick={onOpenReturnsRiskTab}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold whitespace-nowrap transition-all duration-150"
          >
            <span>Full ML Validation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
