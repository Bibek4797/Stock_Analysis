import React from 'react';
import {
  OhlcvResponse,
  PortfolioResponse,
  PortfolioStrategyMode,
  CvarQuantile,
} from '../types';
import {
  Briefcase,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface Props {
  data: OhlcvResponse | null;
  portfolio: PortfolioResponse | null;
  isLoadingPortfolio: boolean;
  strategyMode: PortfolioStrategyMode;
  onStrategyModeChange: (mode: PortfolioStrategyMode) => void;
  cvarQuantile: CvarQuantile;
  onCvarQuantileChange: (q: CvarQuantile) => void;
  onOpenPortfolioSlide: () => void;
}

const PALETTE = [
  '#06B6D4', '#10B981', '#F59E0B', '#818CF8', '#EC4899', '#3B82F6', '#14B8A6', '#A855F7'
];

export const PortfolioBlotter: React.FC<Props> = ({
  data,
  portfolio,
  isLoadingPortfolio,
  onOpenPortfolioSlide,
}) => {
  const currentTicker = data?.ticker || '—';
  const isTradable = data?.is_tradable ?? true;

  if (isLoadingPortfolio && !portfolio) {
    return (
      <div
        className="w-full h-full flex flex-col justify-between p-4 select-none"
        style={{ background: 'linear-gradient(180deg, #080B10 0%, #090C12 100%)' }}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#1E2430]">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recommended Allocation
          </span>
          <span className="text-xs font-mono text-indigo-400 animate-pulse">Balancing Weights...</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
          <div className="w-7 h-7 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" />
          <span className="text-xs font-mono text-slate-400">Optimizing Capital Allocation...</span>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center p-4 text-center select-none"
        style={{ background: '#080B10' }}
      >
        <Briefcase className="w-8 h-8 text-slate-600 mb-2" />
        <span className="text-xs font-mono text-slate-400">Portfolio Engine Standby</span>
      </div>
    );
  }

  const { regime, zerodha_blotter, blotter_summary, tournament_metrics, screening, risk_scaling } = portfolio;
  const activeMetrics = tournament_metrics[portfolio.resolved_strategy] || tournament_metrics['rockafellar_cvar'] || tournament_metrics['mpt'];

  // Check if current selected stock is in active portfolio basket
  const spotlightItem = zerodha_blotter.find(b => b.ticker === currentTicker);
  const scorecardItem = screening.scorecard.find(s => s.ticker === currentTicker);
  const isInPortfolio = Boolean(spotlightItem && spotlightItem.whole_shares > 0);

  // Spotlight asset calculations
  const spotlightExpRetPct = scorecardItem?.expected_return_pct ?? 2.0;
  const spotlightAmount = spotlightItem?.actual_invested ?? 0;
  const spotlightExpGainInr = Math.round(spotlightAmount * (spotlightExpRetPct / 100));

  // Overall portfolio values for Capital Base
  const capBase = blotter_summary.investable_capital;
  const cashShieldPct = risk_scaling?.is_scaled ? risk_scaling.cash_shield_pct : 0;
  const equityPct = 100 - cashShieldPct;
  const equityInr = Math.round(capBase * (equityPct / 100));
  const cashShieldInr = Math.round(capBase * (cashShieldPct / 100));

  // Portfolio H-day return & risk in INR
  const hDays = portfolio.horizon || 5;
  const portExpRetPct = activeMetrics?.annualized_return_pct
    ? ((1 + activeMetrics.annualized_return_pct / 100) ** (hDays / 252) - 1) * 100
    : 1.5;
  const portExpGainInr = Math.round(capBase * (portExpRetPct / 100));
  const portCvarPct = activeMetrics?.portfolio_cvar_pct ?? 2.5;
  const portCvarLossInr = Math.round(capBase * (portCvarPct / 100));

  // Determine market mode label & styling (Jargon-free)
  const getMarketMode = () => {
    if (regime?.badge_color === 'rose' || (risk_scaling?.is_scaled && cashShieldPct > 25)) {
      return {
        label: 'Defensive Crash-Protected Mode',
        bg: 'rgba(244,63,94,0.15)',
        border: 'rgba(244,63,94,0.4)',
        text: '#F43F5E',
      };
    }
    if (regime?.badge_color === 'amber' || cashShieldPct > 0) {
      return {
        label: 'Balanced Risk Mode',
        bg: 'rgba(245,158,11,0.15)',
        border: 'rgba(245,158,11,0.4)',
        text: '#F59E0B',
      };
    }
    return {
      label: 'Bullish Growth Mode',
      bg: 'rgba(16,185,129,0.15)',
      border: 'rgba(16,185,129,0.4)',
      text: '#10B981',
    };
  };

  const marketMode = getMarketMode();

  return (
    <div
      className="w-full h-full flex flex-col p-4 select-none overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #080B10 0%, #090C12 100%)' }}
    >
      {/* ── 1. Clean Top Header Strip ────────────────────── */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1E2430] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-indigo-950/60 border border-indigo-800/40 flex-shrink-0">
            <Zap className="w-3 h-3 text-indigo-400" />
          </div>
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider truncate">
            Recommended Allocation
          </span>
        </div>

        {/* Clean Market Mode Pill */}
        <div
          className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border transition-all duration-150 flex-shrink-0 ml-2"
          style={{
            background: marketMode.bg,
            borderColor: marketMode.border,
            color: marketMode.text,
          }}
        >
          {marketMode.label}
        </div>
      </div>

      {/* ── 2. Hero Two-Column Layout ────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0 py-2">
        {/* Left Box: Allocation for Selected Stock */}
        <div
          className="min-h-0 p-3.5 rounded-xl flex flex-col justify-between transition-all duration-150"
          style={{
            background: 'linear-gradient(145deg, rgba(14,18,26,0.95), rgba(11,15,22,0.9))',
            border: isInPortfolio ? '1px solid rgba(16,185,129,0.35)' : '1px solid #1E2430',
          }}
        >
          <div className="flex-shrink-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-slate-400 truncate mr-1">
                Allocation for {currentTicker.replace('.NS', '')}
              </span>
              {isInPortfolio ? (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex-shrink-0">
                  IN TOP BASKET
                </span>
              ) : (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex-shrink-0">
                  NOT IN TOP BASKET
                </span>
              )}
            </div>

            {isInPortfolio && spotlightItem ? (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl lg:text-3xl font-extrabold font-mono text-emerald-400 tracking-tight leading-tight">
                  ₹{spotlightItem.actual_invested.toLocaleString()}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  ({spotlightItem.active_weight_pct}% weight)
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-500 tracking-tight leading-tight">
                  ₹0
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  (0% allocation)
                </span>
              </div>
            )}
          </div>

          <div className="space-y-0.5 pt-1.5 border-t border-[#1E2430]/60 flex-shrink-0">
            {isInPortfolio && spotlightItem ? (
              <>
                <div className="text-[11px] font-mono font-semibold text-cyan-300 truncate">
                  Buy {spotlightItem.whole_shares} Shares @ ₹{spotlightItem.latest_ltp.toFixed(2)}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-emerald-400 font-bold truncate">
                    +{spotlightExpGainInr >= 0 ? `₹${spotlightExpGainInr.toLocaleString()}` : `₹0`} Expected Gain
                  </span>
                  <span className="text-rose-400 font-bold truncate">
                    Stop: ₹{spotlightItem.stop_loss_gtt?.toFixed(2) ?? '—'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  Action: <strong className="text-slate-200">{spotlightItem.rebalance_action ?? 'BUY'}</strong> · Target: <strong className="text-emerald-300">₹{spotlightItem.target_profit_gtt?.toFixed(2) ?? '—'}</strong>
                </div>
              </>
            ) : (
              <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
                <div className="text-amber-400 font-semibold line-clamp-1">
                  Filtered out by risk-reward optimization criteria.
                </div>
                <div className="text-slate-500 truncate">
                  Suggested baseline if included: ~{(100 / Math.max(1, zerodha_blotter.length + 1)).toFixed(1)}% of capital.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Box: Total Portfolio Summary */}
        <div
          className="min-h-0 p-3.5 rounded-xl flex flex-col justify-between transition-all duration-150"
          style={{
            background: 'linear-gradient(145deg, rgba(14,18,26,0.95), rgba(11,15,22,0.9))',
            border: '1px solid #1E2430',
          }}
        >
          <div className="flex-shrink-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-slate-400 truncate mr-1">
                Total Portfolio Summary
              </span>
              <span className="text-[9px] font-mono text-cyan-400 font-bold flex-shrink-0">
                {zerodha_blotter.length} ASSETS
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-3xl font-extrabold font-mono text-cyan-400 tracking-tight leading-tight">
                ₹{equityInr.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                ({equityPct.toFixed(0)}% deployed)
              </span>
            </div>
          </div>

          <div className="space-y-0.5 pt-1.5 border-t border-[#1E2430]/60 flex-shrink-0">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-emerald-400 font-bold truncate">
                +{portExpRetPct.toFixed(2)}% (+₹{portExpGainInr.toLocaleString()}) <span className="text-slate-500 font-normal">exp profit</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-rose-400 font-bold truncate">
                -{portCvarPct.toFixed(2)}% (-₹{portCvarLossInr.toLocaleString()}) <span className="text-slate-500 font-normal">max tail risk</span>
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate">
              {cashShieldPct > 0 ? (
                <span className="text-amber-300 font-medium">₹{cashShieldInr.toLocaleString()} Safe Cash Reserve ({cashShieldPct.toFixed(1)}%)</span>
              ) : (
                <span className="text-slate-400">100% Capital Fully Deployed in Equities</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Mini Basket Diversity & Workbench Link ─────── */}
      <div
        className="flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-mono flex-shrink-0"
        style={{ background: 'rgba(14,18,26,0.7)', border: '1px solid #1E2430' }}
      >
        <div className="flex items-center gap-2 max-w-[70%] overflow-hidden">
          <span className="text-slate-500 text-[10px] uppercase whitespace-nowrap">Basket:</span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {zerodha_blotter.slice(0, 6).map((item, idx) => (
              <span
                key={item.ticker}
                className="text-[11px] text-slate-300 font-mono flex items-center gap-1 whitespace-nowrap"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PALETTE[idx % PALETTE.length] }} />
                {item.display_symbol} <strong className="text-white">{item.active_weight_pct}%</strong>
              </span>
            ))}
            {zerodha_blotter.length > 6 && (
              <span className="text-[10px] text-slate-500">+{zerodha_blotter.length - 6} more</span>
            )}
          </div>
        </div>

        <button
          onClick={onOpenPortfolioSlide}
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold whitespace-nowrap transition-all duration-150"
        >
          <span>Open Portfolio Lab</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
