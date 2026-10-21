import React, { useState, useRef, useMemo } from 'react';
import {
  PortfolioResponse,
  PortfolioStrategyMode,
  PortfolioSelectionMode,
  CvarQuantile,
  SwingHorizon,
} from '../types';
import {
  Briefcase,
  PieChart,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Zap,
  Activity,
  Award,
  Layers,
  RefreshCw,
  Info,
  CheckCircle2,
  XCircle,
  Scale,
  DollarSign,
  ArrowUpRight,
  Download,
  Crosshair,
  ShieldCheck,
  Search,
  X,
  Check,
  Filter,
} from 'lucide-react';

interface TradableTickerItem {
  symbol: string;
  display_symbol: string;
  name: string;
  sector?: string;
  category: string;
  base_price?: number;
}

interface Props {
  portfolio: PortfolioResponse | null;
  isLoadingPortfolio: boolean;
  capital: number;
  onCapitalChange: (cap: number) => void;
  horizon: SwingHorizon;
  onHorizonChange: (h: SwingHorizon) => void;
  strategyMode: PortfolioStrategyMode;
  onStrategyModeChange: (m: PortfolioStrategyMode) => void;
  cvarQuantile: CvarQuantile;
  onCvarQuantileChange: (q: CvarQuantile) => void;
  selectionMode: PortfolioSelectionMode;
  onSelectionModeChange: (m: PortfolioSelectionMode) => void;
  selectedTickers: string[];
  onToggleTicker: (ticker: string) => void;
  onSetSelectedTickers?: (tickers: string[]) => void;
  onForceRefresh: () => void;
  allTradableTickers: TradableTickerItem[];
  maxPortfolioCvar: number;
  onMaxPortfolioCvarChange: (cvar: number) => void;
  noTradeBuffer: number;
  onNoTradeBufferChange: (buf: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart 1: Out-of-Sample Walk-Forward Wealth / Drawdown Curve (SVG)
// ─────────────────────────────────────────────────────────────────────────────
const EquityCurveChart: React.FC<{
  data: Array<{
    date: string;
    mpt: number;
    dalio_trc: number;
    rockafellar_cvar: number;
    equal_weight: number;
    nifty_50: number;
    mpt_dd: number;
    dalio_dd: number;
    ru_dd: number;
    nifty_dd: number;
  }>;
}> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'wealth' | 'drawdown'>('wealth');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-72 flex items-center justify-center text-xs font-mono text-slate-500">
        No walk-forward backtest curve data available.
      </div>
    );
  }

  const svgW = 680;
  const svgH = 280;
  const pad = { top: 24, right: 24, bottom: 32, left: 60 };
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;
  const n = data.length;

  // Scales
  let minY: number, maxY: number;
  if (viewMode === 'wealth') {
    const allVals = data.flatMap(d => [d.mpt, d.dalio_trc, d.rockafellar_cvar, d.equal_weight, d.nifty_50]);
    minY = Math.min(...allVals) * 0.98;
    maxY = Math.max(...allVals) * 1.02;
  } else {
    const allDds = data.flatMap(d => [d.mpt_dd, d.dalio_dd, d.ru_dd, d.nifty_dd]);
    minY = Math.min(-2.0, ...allDds) * 1.15;
    maxY = 0.5;
  }

  const getX = (i: number) => pad.left + (i / Math.max(1, n - 1)) * plotW;
  const getY = (v: number) => pad.top + plotH * (1 - (v - minY) / Math.max(0.01, maxY - minY));

  const makePath = (key: 'mpt' | 'dalio_trc' | 'rockafellar_cvar' | 'equal_weight' | 'nifty_50' | 'mpt_dd' | 'dalio_dd' | 'ru_dd' | 'nifty_dd') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d[key]).toFixed(1)}`).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const normX = (clientX - (pad.left / svgW) * rect.width) / ((plotW / svgW) * rect.width);
    const idx = Math.round(normX * (n - 1));
    if (idx >= 0 && idx < n) setHoverIndex(idx);
  };

  const hovered = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n ? data[hoverIndex] : null;

  return (
    <div className="relative w-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs font-mono">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-cyan-400 inline-block rounded-full shadow-sm shadow-cyan-500/50" />
            <span className="text-cyan-400 font-semibold text-[11px]">R-U CVaR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-amber-400 inline-block rounded-full shadow-sm shadow-amber-500/50" />
            <span className="text-amber-400 font-semibold text-[11px]">Dalio TRC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-indigo-400 inline-block rounded-full shadow-sm shadow-indigo-500/50" />
            <span className="text-indigo-400 font-semibold text-[11px]">Markowitz MPT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-400 inline-block rounded-full border border-dashed border-emerald-300" />
            <span className="text-emerald-400 font-semibold text-[11px]">NIFTY 50 Benchmark</span>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center rounded-lg bg-[#090C12] border border-[#1E2430] p-0.5">
          <button
            onClick={() => setViewMode('wealth')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'wealth' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Wealth Growth (₹)
          </button>
          <button
            onClick={() => setViewMode('drawdown')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'drawdown' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Drawdown (%)
          </button>
        </div>
      </div>

      {hovered && (
        <div className="text-xs font-mono text-slate-300 pb-2 flex flex-wrap gap-3 justify-end items-center bg-[#090C12]/60 px-3 py-1.5 rounded-lg border border-[#1E2430]/70 mb-2">
          <span className="text-slate-400 font-semibold">{hovered.date}:</span>
          {viewMode === 'wealth' ? (
            <>
              <span>R-U: <strong className="text-cyan-300">₹{hovered.rockafellar_cvar.toLocaleString()}</strong></span>
              <span className="text-slate-600">|</span>
              <span>Dalio: <strong className="text-amber-300">₹{hovered.dalio_trc.toLocaleString()}</strong></span>
              <span className="text-slate-600">|</span>
              <span>MPT: <strong className="text-indigo-300">₹{hovered.mpt.toLocaleString()}</strong></span>
              <span className="text-slate-600">|</span>
              <span>NIFTY: <strong className="text-emerald-300">₹{hovered.nifty_50.toLocaleString()}</strong></span>
            </>
          ) : (
            <>
              <span>R-U: <strong className="text-cyan-300">{hovered.ru_dd.toFixed(2)}%</strong></span>
              <span className="text-slate-600">|</span>
              <span>Dalio: <strong className="text-amber-300">{hovered.dalio_dd.toFixed(2)}%</strong></span>
              <span className="text-slate-600">|</span>
              <span>MPT: <strong className="text-indigo-300">{hovered.mpt_dd.toFixed(2)}%</strong></span>
              <span className="text-slate-600">|</span>
              <span>NIFTY: <strong className="text-emerald-300">{hovered.nifty_dd.toFixed(2)}%</strong></span>
            </>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-auto cursor-crosshair overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const val = minY + (maxY - minY) * pct;
          const y = getY(val);
          return (
            <g key={idx}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="rgba(30,36,48,0.7)" strokeDasharray="3 3" />
              <text x={pad.left - 8} y={y + 3} fill="#64748B" fontSize="10" fontFamily="monospace" textAnchor="end">
                {viewMode === 'wealth' ? `₹${(val / 1000).toFixed(0)}k` : `${val.toFixed(1)}%`}
              </text>
            </g>
          );
        })}

        {/* Zero line for drawdown */}
        {viewMode === 'drawdown' && (
          <line x1={pad.left} y1={getY(0)} x2={pad.left + plotW} y2={getY(0)} stroke="rgba(148,163,184,0.5)" strokeWidth="1" />
        )}

        {/* Curves */}
        {viewMode === 'wealth' ? (
          <>
            <path d={makePath('nifty_50')} fill="none" stroke="#10B981" strokeWidth="1.8" strokeDasharray="5 3" opacity="0.85" />
            <path d={makePath('equal_weight')} fill="none" stroke="#64748B" strokeWidth="1.3" strokeDasharray="3 3" opacity="0.6" />
            <path d={makePath('mpt')} fill="none" stroke="#818CF8" strokeWidth="1.8" />
            <path d={makePath('dalio_trc')} fill="none" stroke="#F59E0B" strokeWidth="2.0" />
            <path d={makePath('rockafellar_cvar')} fill="none" stroke="#06B6D4" strokeWidth="2.3" />
          </>
        ) : (
          <>
            <path d={makePath('nifty_dd')} fill="none" stroke="#10B981" strokeWidth="1.6" strokeDasharray="5 3" opacity="0.85" />
            <path d={makePath('mpt_dd')} fill="none" stroke="#818CF8" strokeWidth="1.8" />
            <path d={makePath('dalio_dd')} fill="none" stroke="#F59E0B" strokeWidth="2.0" />
            <path d={makePath('ru_dd')} fill="none" stroke="#06B6D4" strokeWidth="2.2" />
          </>
        )}

        {/* Hover vertical crosshair */}
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
            {viewMode === 'wealth' ? (
              <>
                <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].rockafellar_cvar)} r="4" fill="#06B6D4" stroke="#080B10" strokeWidth="2" />
                <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].dalio_trc)} r="4" fill="#F59E0B" stroke="#080B10" strokeWidth="2" />
                <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].mpt)} r="4" fill="#818CF8" stroke="#080B10" strokeWidth="2" />
              </>
            ) : (
              <>
                <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].ru_dd)} r="4" fill="#06B6D4" stroke="#080B10" strokeWidth="2" />
                <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].dalio_dd)} r="4" fill="#F59E0B" stroke="#080B10" strokeWidth="2" />
              </>
            )}
          </g>
        )}

        {/* X-axis date milestones */}
        {n > 1 && [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].map(idx => (
          <text
            key={`dt-${idx}`}
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
// Chart 2: Capital Weight vs. Total Risk Contribution (PRC) Breakdown (SVG)
// ─────────────────────────────────────────────────────────────────────────────
const WeightRiskContributionChart: React.FC<{
  data: Array<{
    ticker: string;
    display_symbol: string;
    mpt_weight: number;
    dalio_weight: number;
    ru_weight: number;
    active_weight: number;
    active_prc: number;
  }>;
}> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-72 flex items-center justify-center text-xs font-mono text-slate-500">
        No asset weight data available.
      </div>
    );
  }

  const svgW = 680;
  const svgH = 280;
  const pad = { top: 24, right: 24, bottom: 36, left: 50 };
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;
  const n = data.length;

  const maxVal = Math.max(35.0, ...data.map(d => Math.max(d.active_weight, d.active_prc))) * 1.15;
  const groupW = plotW / n;
  const barW = Math.max(6, Math.min(22, groupW * 0.36));

  const getY = (val: number) => pad.top + plotH * (1 - Math.max(0, val) / maxVal);
  const equalRiskLineVal = 100.0 / n;

  return (
    <div className="relative w-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 bg-cyan-500 inline-block rounded-xs" />
            <span className="text-cyan-400 font-semibold text-[11px]">Capital Weight (w_i %)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 bg-amber-500 inline-block rounded-xs" />
            <span className="text-amber-400 font-semibold text-[11px]">Risk Contribution (PRC_i %)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-slate-500 inline-block" />
            <span className="text-slate-500 text-[11px]">1/N Target ({(100 / n).toFixed(1)}%)</span>
          </div>
        </div>

        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="text-xs font-mono text-slate-200 bg-[#090C12]/60 px-3 py-1 rounded-lg border border-[#1E2430]">
            <strong className="text-white">{data[hoveredIdx].display_symbol}</strong>: Weight <span className="text-cyan-400 font-bold">{data[hoveredIdx].active_weight}%</span> | Risk <span className="text-amber-400 font-bold">{data[hoveredIdx].active_prc}%</span>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto overflow-visible cursor-pointer">
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const val = maxVal * pct;
          const y = getY(val);
          return (
            <g key={idx}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="rgba(30,36,48,0.7)" strokeDasharray="3 3" />
              <text x={pad.left - 8} y={y + 3} fill="#64748B" fontSize="10" fontFamily="monospace" textAnchor="end">
                {val.toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* 1/N Equal Risk Target Guideline */}
        {equalRiskLineVal <= maxVal && (
          <g>
            <line
              x1={pad.left}
              y1={getY(equalRiskLineVal)}
              x2={pad.left + plotW}
              y2={getY(equalRiskLineVal)}
              stroke="rgba(148,163,184,0.4)"
              strokeDasharray="4 3"
              strokeWidth="1"
            />
            <text x={pad.left + plotW - 4} y={getY(equalRiskLineVal) - 5} fill="#64748B" fontSize="9" fontFamily="monospace" textAnchor="end">
              1/N Target
            </text>
          </g>
        )}

        {/* Grouped Bars */}
        {data.map((d, i) => {
          const groupX = pad.left + i * groupW + (groupW - barW * 2 - 4) / 2;
          const h1 = plotH * (d.active_weight / maxVal);
          const y1 = pad.top + plotH - h1;
          const h2 = plotH * (d.active_prc / maxVal);
          const y2 = pad.top + plotH - h2;

          return (
            <g
              key={d.ticker}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="transition-opacity hover:opacity-90"
            >
              {/* Bar 1: Capital Weight */}
              <rect
                x={groupX}
                y={y1}
                width={barW}
                height={Math.max(1, h1)}
                fill="rgba(6,182,212,0.85)"
                rx="2"
              />
              {/* Bar 2: Risk Contribution */}
              <rect
                x={groupX + barW + 3}
                y={y2}
                width={barW}
                height={Math.max(1, h2)}
                fill="rgba(245,158,11,0.85)"
                rx="2"
              />

              {/* Ticker label */}
              <text
                x={groupX + barW + 1.5}
                y={pad.top + plotH + 18}
                fill={hoveredIdx === i ? '#FFFFFF' : '#94A3B8'}
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
                fontWeight={hoveredIdx === i ? 'bold' : 'normal'}
              >
                {d.display_symbol}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Custom Stock / Asset Universe Selector Modal
// ─────────────────────────────────────────────────────────────────────────────
const UniverseSelectorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  allTradableTickers: TradableTickerItem[];
  selectedTickers: string[];
  onToggleTicker: (ticker: string) => void;
  onSetSelectedTickers?: (tickers: string[]) => void;
  onConfirm: () => void;
}> = ({
  isOpen,
  onClose,
  allTradableTickers,
  selectedTickers,
  onToggleTicker,
  onSetSelectedTickers,
  onConfirm,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');

  if (!isOpen) return null;

  const sectors = [
    { id: 'all', label: 'All Sectors' },
    { id: 'Finance', label: 'Bank & Finance' },
    { id: 'Technology', label: 'IT & Tech' },
    { id: 'Energy', label: 'Energy & Power' },
    { id: 'Auto', label: 'Auto & EV' },
    { id: 'Pharma', label: 'Pharma' },
    { id: 'FMCG', label: 'FMCG' },
    { id: 'Metals', label: 'Metals & Infra' },
    { id: 'ETF', label: 'ETFs & Cash' },
  ];

  const filteredTickers = allTradableTickers.filter(item => {
    const matchesSearch =
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.display_symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedSector === 'all') return true;
    if (selectedSector === 'ETF') return item.category === 'ETF' || item.category === 'CASH_ETF';

    return (item.sector || '').toLowerCase().includes(selectedSector.toLowerCase());
  });

  const handleSelectAllFiltered = () => {
    if (onSetSelectedTickers) {
      const combined = Array.from(new Set([...selectedTickers, ...filteredTickers.map(t => t.symbol)]));
      onSetSelectedTickers(combined);
    } else {
      filteredTickers.forEach(t => {
        if (!selectedTickers.includes(t.symbol)) onToggleTicker(t.symbol);
      });
    }
  };

  const handleClearFiltered = () => {
    if (onSetSelectedTickers) {
      const filteredSymbols = new Set(filteredTickers.map(t => t.symbol));
      const remaining = selectedTickers.filter(s => !filteredSymbols.has(s));
      onSetSelectedTickers(remaining.length >= 2 ? remaining : selectedTickers);
    }
  };

  const handlePresetTop8 = () => {
    const top8 = [
      'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS',
      'INFY.NS', 'LT.NS', 'NIFTYBEES.NS', 'GOLDBEES.NS'
    ];
    if (onSetSelectedTickers) {
      onSetSelectedTickers(top8);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-4xl max-h-[88vh] rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0E121A 0%, #090C12 100%)',
          border: '1px solid rgba(45, 55, 72, 0.8)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1E2430] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Institutional Universe Basket Selection
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Selected: <span className="text-indigo-400 font-bold">{selectedTickers.length}</span> of {allTradableTickers.length} Tradable Assets (Min 2 required for diversification)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#161B26] border border-[#2D3748] flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Sector Toolbar */}
        <div className="p-4 border-b border-[#1E2430] space-y-3 bg-[#080B10]/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[240px] flex items-center gap-2 px-3 py-2 rounded-xl bg-[#090C12] border border-[#1E2430] focus-within:border-indigo-500 transition-all">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search stock ticker, name, or sector..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePresetTop8}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800 hover:bg-indigo-900 transition-all"
              >
                Top 8 Liquid Preset
              </button>
              <button
                onClick={handleSelectAllFiltered}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-[#161B26] text-slate-300 border border-[#2D3748] hover:border-slate-500 transition-all"
              >
                Select Filtered
              </button>
              <button
                onClick={handleClearFiltered}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-[#161B26] text-slate-400 border border-[#2D3748] hover:text-rose-400 transition-all"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Sector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {sectors.map(sec => (
              <button
                key={sec.id}
                onClick={() => setSelectedSector(sec.id)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all ${
                  selectedSector === sec.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-[#121622] text-slate-400 hover:text-slate-200 border border-[#1E2430]'
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ticker Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredTickers.map(item => {
            const isSelected = selectedTickers.includes(item.symbol);
            return (
              <div
                key={item.symbol}
                onClick={() => onToggleTicker(item.symbol)}
                className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-950/30'
                    : 'bg-[#0E121A]/80 border-[#1E2430] hover:border-slate-600 hover:bg-[#121622]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-[#2D3748] bg-[#090C12]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sm text-white">{item.display_symbol}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold ${
                          item.category === 'ETF'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            : 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
                        }`}
                      >
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{item.name}</p>
                  </div>
                </div>

                {item.base_price && (
                  <span className="text-xs font-mono text-slate-300 font-semibold ml-2">
                    ₹{item.base_price.toLocaleString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1E2430] bg-[#080B10] flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">
            {selectedTickers.length < 2 ? (
              <span className="text-rose-400">⚠ Please select at least 2 assets to optimize covariance</span>
            ) : (
              <span>✓ {selectedTickers.length} assets ready for covariance shrinkage</span>
            )}
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono font-semibold text-slate-300 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              disabled={selectedTickers.length < 2}
              className="px-5 py-2 rounded-xl text-xs font-mono font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-950/50 disabled:opacity-50"
            >
              Apply Basket &amp; Re-optimize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT: PortfolioManagerSlide
// ─────────────────────────────────────────────────────────────────────────────
export const PortfolioManagerSlide: React.FC<Props> = ({
  portfolio,
  isLoadingPortfolio,
  capital,
  onCapitalChange,
  horizon,
  onHorizonChange,
  strategyMode,
  onStrategyModeChange,
  cvarQuantile,
  onCvarQuantileChange,
  selectionMode,
  onSelectionModeChange,
  selectedTickers,
  onToggleTicker,
  onSetSelectedTickers,
  onForceRefresh,
  allTradableTickers,
  maxPortfolioCvar,
  onMaxPortfolioCvarChange,
  noTradeBuffer,
  onNoTradeBufferChange,
}) => {
  const [capitalInput, setCapitalInput] = useState<string>(String(capital));
  const [isUniverseModalOpen, setIsUniverseModalOpen] = useState(false);

  const handleCapitalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(capitalInput.replace(/,/g, ''));
    if (!isNaN(val) && val >= 10000) {
      onCapitalChange(val);
    }
  };

  const handleExportBasketCSV = () => {
    if (!portfolio?.zerodha_blotter) return;
    const headers = [
      'Ticker',
      'Category',
      'Qty',
      'Entry_Reference_INR',
      'Stop_Loss_GTT_INR',
      'Target_Profit_GTT_INR',
      'Weight_Pct',
      'Rebalance_Action',
      'Est_Regulatory_Fees_INR',
    ];
    const rows = portfolio.zerodha_blotter.map(b => [
      b.ticker,
      b.category,
      b.whole_shares,
      b.latest_ltp.toFixed(2),
      b.stop_loss_gtt?.toFixed(2) ?? '',
      b.target_profit_gtt?.toFixed(2) ?? '',
      b.active_weight_pct.toFixed(2),
      b.rebalance_action ?? 'BUY',
      b.est_zerodha_fees.toFixed(2),
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NSE_Portfolio_Basket_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoadingPortfolio && !portfolio) {
    return (
      <div
        className="w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-8 gap-4"
        style={{ background: 'linear-gradient(180deg, #080B10 0%, #090C12 100%)' }}
      >
        <div className="w-12 h-12 rounded-2xl border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" />
        <div className="text-center">
          <h3 className="text-base font-mono font-bold text-slate-200">Solving Institutional Optimizers &amp; OOS Backtest</h3>
          <p className="text-xs font-mono text-slate-500 mt-1">
            Running Markowitz MPT, Ray Dalio Risk Parity, and Rockafellar-Uryasev CVaR...
          </p>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div
        className="w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-8 text-center"
        style={{ background: '#080B10' }}
      >
        <Briefcase className="w-12 h-12 text-slate-600 mb-3" />
        <h3 className="text-base font-mono font-bold text-slate-300">Portfolio Engine Offline</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Awaiting initialization. Click Force Re-optimize to calculate.
        </p>
      </div>
    );
  }

  const { regime, screening, tournament_metrics, visual_charts, zerodha_blotter, blotter_summary } = portfolio;
  const strategiesList = ['rockafellar_cvar', 'dalio_trc', 'mpt', 'equal_weight', 'nifty_50'];

  const getStratTitle = (k: string) => {
    if (k === 'mpt') return 'Markowitz MPT (Shrinkage Max Sharpe)';
    if (k === 'dalio_trc') return 'Ray Dalio Equal TRC (Risk Parity)';
    if (k === 'rockafellar_cvar') return `Rockafellar-Uryasev Min-CVaR (q=${(cvarQuantile * 100).toFixed(1)}%)`;
    if (k === 'equal_weight') return 'Equal Weight (1/N Benchmark)';
    return 'NIFTY 50 Spot Benchmark (^NSEI)';
  };

  const activeMetric = tournament_metrics[portfolio.resolved_strategy] || tournament_metrics['rockafellar_cvar'] || Object.values(tournament_metrics)[0];
  const expReturnInr = (capital * (activeMetric?.annualized_return_pct || 0) * (horizon / 252)) / 100;
  const cvarRiskInr = (capital * (activeMetric?.portfolio_cvar_pct || 0)) / 100;
  const activeEquityPct = portfolio.risk_scaling?.is_scaled
    ? (portfolio.risk_scaling.multiplier_kappa * 100)
    : 100.0;
  const cashShieldPct = portfolio.risk_scaling?.is_scaled
    ? portfolio.risk_scaling.cash_shield_pct
    : 0.0;

  return (
    <div
      className="w-full h-[calc(100vh-3.5rem)] flex flex-col overflow-y-auto p-6 space-y-6 select-none"
      style={{ background: 'linear-gradient(180deg, #080B10 0%, #090C12 100%)' }}
    >
      {/* ── TOP CONTROL & REGIME COMMAND BAR ───────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-col gap-4 p-5 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(14,18,26,0.95), rgba(10,13,20,0.85))',
          border: '1px solid rgba(30,36,48,0.8)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}
      >
        {/* Row 1: App Title, Regime Badge & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner"
              style={{
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.35)',
              }}
            >
              <PieChart className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-sm font-mono font-extrabold tracking-wider text-white uppercase">
                  Institutional Portfolio Optimization &amp; Order Execution Engine
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                  NSE CASH
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Ledoit-Wolf Shrinkage · Ray Dalio Risk Parity · Rockafellar-Uryasev CVaR · Walk-forward test (0.11% regulatory drag)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Regime Badge */}
            <div
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-extrabold shadow-sm"
              style={{
                background: regime.badge_color === 'rose' ? 'rgba(244,63,94,0.15)' : regime.badge_color === 'amber' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                border: `1px solid ${regime.badge_color === 'rose' ? 'rgba(244,63,94,0.4)' : regime.badge_color === 'amber' ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                color: regime.badge_color === 'rose' ? '#F43F5E' : regime.badge_color === 'amber' ? '#F59E0B' : '#10B981',
              }}
              title={regime.rationale}
            >
              <Activity className="w-4 h-4" />
              <span>{regime.regime}</span>
              <span className="text-[11px] text-slate-400 font-normal ml-1">
                (→ {regime.active_strategy_name.split('(')[0]})
              </span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onForceRefresh}
              disabled={isLoadingPortfolio}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold text-slate-200 bg-[#161B26] border border-[#2D3748] hover:border-indigo-500 hover:text-white transition-all disabled:opacity-50 shadow-sm"
              title="Re-estimate covariance and re-optimize portfolio"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoadingPortfolio ? 'animate-spin' : ''}`} />
              <span>{isLoadingPortfolio ? 'Optimizing...' : 'Force Re-optimize'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Clean Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3.5 border-t border-[#1E2430]/80">
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            {/* Capital Input */}
            <form onSubmit={handleCapitalSubmit} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-semibold">Capital:</span>
              <div className="flex items-center rounded-lg bg-[#090C12] border border-[#1E2430] px-2.5 py-1">
                <span className="text-slate-500 text-xs mr-1">₹</span>
                <input
                  type="text"
                  value={capitalInput}
                  onChange={e => setCapitalInput(e.target.value)}
                  onBlur={handleCapitalSubmit}
                  className="w-24 bg-transparent text-white font-mono text-xs focus:outline-none"
                />
              </div>
              {/* Quick Capital Pills */}
              <div className="flex items-center gap-1">
                {[500000, 1000000, 2500000, 5000000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setCapitalInput(String(val));
                      onCapitalChange(val);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                      capital === val ? 'bg-indigo-950 text-indigo-300 border-indigo-700 font-bold' : 'bg-[#090C12] text-slate-500 border-[#1E2430] hover:text-slate-300'
                    }`}
                  >
                    ₹{val / 100000}L
                  </button>
                ))}
              </div>
            </form>

            {/* Swing Horizon Pills */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-semibold">Horizon:</span>
              <div className="flex items-center rounded-lg p-0.5 bg-[#090C12] border border-[#1E2430]">
                {([3, 5, 7, 10] as SwingHorizon[]).map(h => (
                  <button
                    key={h}
                    onClick={() => onHorizonChange(h)}
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all ${
                      horizon === h ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {h}D
                  </button>
                ))}
              </div>
            </div>

            {/* Strategy Mode Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-semibold">Strategy:</span>
              <select
                value={strategyMode}
                onChange={e => onStrategyModeChange(e.target.value as PortfolioStrategyMode)}
                className="bg-[#090C12] border border-[#1E2430] text-slate-300 text-xs rounded-lg px-2.5 py-1 font-mono focus:border-indigo-500 focus:outline-none"
              >
                <option value="auto_regime">Auto Regime Switcher</option>
                <option value="rockafellar_cvar">Rockafellar-Uryasev CVaR</option>
                <option value="dalio_trc">Ray Dalio Equal TRC</option>
                <option value="mpt">Markowitz MPT (Shrinkage)</option>
              </select>
            </div>

            {/* CVaR Quantile Pills */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-semibold">R-U Tail Quantile:</span>
              <div className="flex items-center rounded-lg p-0.5 bg-[#090C12] border border-[#1E2430]">
                {([0.01, 0.025, 0.05, 0.10] as CvarQuantile[]).map(q => (
                  <button
                    key={q}
                    onClick={() => onCvarQuantileChange(q)}
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all ${
                      cvarQuantile === q ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {q === 0.05 ? '5% (95% CVaR)' : `${q * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Max CVaR Budget Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-semibold">CVaR Budget:</span>
              <select
                value={maxPortfolioCvar}
                onChange={e => onMaxPortfolioCvarChange(Number(e.target.value))}
                className="bg-[#090C12] border border-[#1E2430] text-slate-300 text-xs rounded-lg px-2.5 py-1 font-mono focus:border-indigo-500 focus:outline-none"
                title="Max portfolio Expected Shortfall before triggering LIQUIDBEES Cash Sweep"
              >
                <option value={0.02}>2.0% (Tight Risk Limit)</option>
                <option value={0.035}>3.5% (Default Balanced)</option>
                <option value={0.05}>5.0% (Aggressive)</option>
                <option value={0.20}>Uncapped (No Cash Drag)</option>
              </select>
            </div>

            {/* No-Trade Buffer Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-semibold">Buffer:</span>
              <select
                value={noTradeBuffer}
                onChange={e => onNoTradeBufferChange(Number(e.target.value))}
                className="bg-[#090C12] border border-[#1E2430] text-slate-300 text-xs rounded-lg px-2.5 py-1 font-mono focus:border-indigo-500 focus:outline-none"
                title="Rebalance deadband zone to suppress turnover friction"
              >
                <option value={0.015}>1.5% Deadband</option>
                <option value={0.025}>2.5% Default</option>
                <option value={0.035}>3.5% Low Turnover</option>
              </select>
            </div>
          </div>

          {/* Universe Picker Action Button */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center rounded-lg p-0.5 bg-[#090C12] border border-[#1E2430]">
              <button
                onClick={() => onSelectionModeChange('auto_quant_screen')}
                className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
                  selectionMode === 'auto_quant_screen' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Auto Screen
              </button>
              <button
                onClick={() => {
                  onSelectionModeChange('manual');
                  setIsUniverseModalOpen(true);
                }}
                className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  selectionMode === 'manual' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Manual Basket</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700">
                  {selectedTickers.length}
                </span>
              </button>
            </div>

            <button
              onClick={() => setIsUniverseModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-slate-300 bg-[#161B26] border border-[#2D3748] hover:border-slate-500 hover:text-white transition-all shadow-sm"
            >
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Select Stocks (46)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 1: 4 EXECUTIVE KPI SUMMARY CARDS ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Expected Return */}
        <div
          className="p-5 rounded-2xl border transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(10,13,20,0.85))',
            borderColor: 'rgba(16,185,129,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="uppercase tracking-wider font-semibold">Expected {horizon}D Return</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-400">
              +{((activeMetric?.annualized_return_pct || 0) * (horizon / 252)).toFixed(2)}%
            </span>
            <span className="text-sm font-mono font-bold text-emerald-300/80">
              (+₹{Math.round(expReturnInr).toLocaleString()})
            </span>
          </div>
          <div className="mt-2 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Ann. Return: <strong className="text-emerald-400">+{activeMetric?.annualized_return_pct?.toFixed(1)}%</strong></span>
            <span>Vol: <strong className="text-cyan-400">{activeMetric?.annualized_vol_pct?.toFixed(1)}%</strong></span>
          </div>
        </div>

        {/* Card 2: 95% CVaR Tail Risk */}
        <div
          className="p-5 rounded-2xl border transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(244,63,94,0.08), rgba(10,13,20,0.85))',
            borderColor: 'rgba(244,63,94,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="uppercase tracking-wider font-semibold">{(cvarQuantile * 100).toFixed(0)}% Tail Risk (CVaR)</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-rose-400">
              -{activeMetric?.portfolio_cvar_pct?.toFixed(2)}%
            </span>
            <span className="text-sm font-mono font-bold text-rose-300/80">
              (-₹{Math.round(cvarRiskInr).toLocaleString()})
            </span>
          </div>
          <div className="mt-2 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>VaR 95: <strong className="text-rose-400">-{activeMetric?.portfolio_var_pct?.toFixed(2)}%</strong></span>
            <span>Max DD: <strong className="text-rose-400">-{activeMetric?.max_drawdown_pct?.toFixed(1)}%</strong></span>
          </div>
        </div>

        {/* Card 3: Out-of-Sample Performance */}
        <div
          className="p-5 rounded-2xl border transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(10,13,20,0.85))',
            borderColor: 'rgba(99,102,241,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="uppercase tracking-wider font-semibold">OOS Walk-Forward Sharpe</span>
            <Award className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-indigo-400">
              {activeMetric?.test_sharpe?.toFixed(2) || '—'}
            </span>
            {activeMetric?.probabilistic_sharpe_ratio_pct !== undefined && (
              <span className="text-sm font-mono font-bold text-indigo-300/80">
                ({activeMetric.probabilistic_sharpe_ratio_pct.toFixed(0)}% PSR)
              </span>
            )}
          </div>
          <div className="mt-2 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Sortino: <strong className="text-slate-200">{activeMetric?.sortino_ratio?.toFixed(2)}</strong></span>
            <span>Calmar: <strong className="text-slate-200">{activeMetric?.calmar_ratio?.toFixed(2)}</strong></span>
          </div>
        </div>

        {/* Card 4: Capital Allocation & Cash Shield */}
        <div
          className="p-5 rounded-2xl border transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(10,13,20,0.85))',
            borderColor: 'rgba(6,182,212,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="uppercase tracking-wider font-semibold">Active vs. Cash Shield</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-cyan-400">
              {activeEquityPct.toFixed(0)}%
            </span>
            <span className="text-sm font-mono font-bold text-amber-400">
              {cashShieldPct > 0 ? `+${cashShieldPct.toFixed(0)}% CASH` : '100% Active'}
            </span>
          </div>
          <div className="mt-2 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Friction Saved: <strong className="text-emerald-400">+{portfolio.no_trade_buffer_summary?.total_cost_saved_bps || 0} bps</strong></span>
            <span>Bets: <strong className="text-slate-200">{activeMetric?.effective_number_of_bets?.toFixed(1) || '—'}</strong></span>
          </div>
        </div>
      </div>

      {/* ── STAGE 4 LIVE-RISK STATUS: DYNAMIC CASH SWEEP & NO-TRADE BUFFER ── */}
      {(portfolio.risk_scaling || portfolio.no_trade_buffer_summary) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dynamic Cash Sweep Card */}
          {portfolio.risk_scaling && (
            <div
              className="p-4 rounded-2xl border flex items-center justify-between transition-all duration-150"
              style={{
                background: portfolio.risk_scaling.is_scaled ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(10,13,20,0.85))' : 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(10,13,20,0.85))',
                borderColor: portfolio.risk_scaling.is_scaled ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.25)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: portfolio.risk_scaling.is_scaled ? 'rgba(245,158,11,0.18)' : 'rgba(16,185,129,0.15)',
                    border: `1px solid ${portfolio.risk_scaling.is_scaled ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.3)'}`,
                  }}
                >
                  <ShieldAlert className={`w-4 h-4 ${portfolio.risk_scaling.is_scaled ? 'text-amber-400' : 'text-emerald-400'}`} />
                </div>
                <div>
                  <span className="text-xs font-mono font-bold text-white block">
                    Dynamic Cash Sweep (LIQUIDBEES)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    CVaR Budget: {portfolio.risk_scaling.max_portfolio_cvar_pct.toFixed(1)}% · Unscaled Risk: {portfolio.risk_scaling.unscaled_cvar_pct.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="text-right font-mono flex-shrink-0 ml-3">
                <span className={`text-xs font-extrabold block ${portfolio.risk_scaling.is_scaled ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {portfolio.risk_scaling.is_scaled
                    ? `${portfolio.risk_scaling.cash_shield_pct.toFixed(1)}% LIQUIDBEES Cash Shield`
                    : '0% Cash Drag (100% Active)'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {portfolio.risk_scaling.is_scaled
                    ? `Active Equity scaled by ${(portfolio.risk_scaling.multiplier_kappa * 100).toFixed(0)}%`
                    : 'Portfolio tail risk inside user budget'}
                </span>
              </div>
            </div>
          )}

          {/* No-Trade Buffer Card */}
          {portfolio.no_trade_buffer_summary && (
            <div
              className="p-4 rounded-2xl border flex items-center justify-between transition-all duration-150"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(10,13,20,0.85))',
                borderColor: 'rgba(6,182,212,0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-cyan-950/60 border border-cyan-800/40 flex-shrink-0">
                  <Scale className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <span className="text-xs font-mono font-bold text-white block">
                    No-Trade Buffer Zone ({(portfolio.no_trade_buffer_summary.buffer_pct * 100).toFixed(1)}% Deadband)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {portfolio.no_trade_buffer_summary.actions_held_count} Assets in Hold Deadband
                  </span>
                </div>
              </div>

              <div className="text-right font-mono flex-shrink-0 ml-3">
                <span className="text-xs font-extrabold text-cyan-300 block">
                  Saved ₹{portfolio.no_trade_buffer_summary.total_cost_saved_rupees.toFixed(0)}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  +{portfolio.no_trade_buffer_summary.total_cost_saved_bps.toFixed(0)} bps Turnover Friction Saved
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ROW 2: STRATEGY TOURNAMENT COMPARISON TABLE ─────────────── */}
      <div
        className="p-5 rounded-2xl bg-[#0E121A]/85 border border-[#1E2430]"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
      >
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#1E2430] gap-2">
          <div className="flex items-center gap-2.5">
            <Award className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              Institutional Strategy Tournament (Train vs. Out-of-Sample Walk-Forward Test)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Rolling {horizon}-Day Rebalancing · 0.11% Exchange &amp; Regulatory Friction Drag
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 text-[11px] border-b border-[#1E2430]/80">
                <th className="py-2.5 font-semibold">Strategy</th>
                <th className="py-2.5 font-semibold">Status</th>
                <th className="py-2.5 font-semibold">Train Sharpe</th>
                <th className="py-2.5 font-semibold">OOS Sharpe</th>
                <th className="py-2.5 font-semibold">PSR %</th>
                <th className="py-2.5 font-semibold">Sortino</th>
                <th className="py-2.5 font-semibold">Calmar</th>
                <th className="py-2.5 font-semibold">Ann. Return %</th>
                <th className="py-2.5 font-semibold">Ann. Vol %</th>
                <th className="py-2.5 font-semibold">Max Drawdown</th>
                <th className="py-2.5 font-semibold">OOS CVaR_q</th>
                <th className="py-2.5 font-semibold">Friction Saved</th>
                <th className="py-2.5 font-semibold">ENB (Bets)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2430]/50">
              {strategiesList.map(stratKey => {
                const m = tournament_metrics[stratKey];
                if (!m) return null;
                const isWinner = (stratKey === portfolio.resolved_strategy);
                const isBenchmark = (stratKey === 'nifty_50');

                return (
                  <tr
                    key={stratKey}
                    className={`transition-colors ${
                      isWinner
                        ? 'bg-indigo-950/30 border-l-2 border-indigo-500'
                        : isBenchmark
                        ? 'bg-slate-900/40 text-slate-400'
                        : 'hover:bg-[#121622]/60'
                    }`}
                  >
                    <td className="py-3 font-bold text-white flex flex-col">
                      <span>{getStratTitle(stratKey)}</span>
                      {isBenchmark && <span className="text-[10px] text-slate-500 font-normal">Non-tradable buy &amp; hold benchmark</span>}
                    </td>
                    <td className="py-3">
                      {isWinner ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-cyan-950 text-cyan-300 border border-cyan-800">
                          ACTIVE REGIME CHOICE
                        </span>
                      ) : isBenchmark ? (
                        <span className="text-[10px] text-slate-500">Benchmark</span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Alternative</span>
                      )}
                    </td>
                    <td className="py-3 text-slate-400">{m.train_sharpe?.toFixed(2) ?? '—'}</td>
                    <td className="py-3">
                      <span className={`font-extrabold ${m.test_sharpe >= 1.0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {m.test_sharpe?.toFixed(2) ?? '—'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`font-bold ${m.probabilistic_sharpe_ratio_pct !== undefined && m.probabilistic_sharpe_ratio_pct >= 90 ? 'text-indigo-400' : 'text-slate-300'}`}>
                        {m.probabilistic_sharpe_ratio_pct !== undefined ? `${m.probabilistic_sharpe_ratio_pct.toFixed(0)}%` : '—'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">{m.sortino_ratio?.toFixed(2) ?? '—'}</td>
                    <td className="py-3 text-slate-300">{m.calmar_ratio?.toFixed(2) ?? '—'}</td>
                    <td className="py-3 font-bold text-emerald-400">+{m.annualized_return_pct?.toFixed(2)}%</td>
                    <td className="py-3 text-cyan-400 font-semibold">{m.annualized_vol_pct?.toFixed(2)}%</td>
                    <td className="py-3 text-rose-400 font-semibold">{m.max_drawdown_pct?.toFixed(2)}%</td>
                    <td className="py-3 text-rose-400 font-bold">-{m.portfolio_cvar_pct?.toFixed(2)}%</td>
                    <td className="py-3 text-cyan-400">
                      {m.turnover_cost_saved_bps ? `+${m.turnover_cost_saved_bps.toFixed(0)} bps` : '—'}
                    </td>
                    <td className="py-3 text-amber-300 font-bold">{m.effective_number_of_bets?.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ROW 3: TWO LARGE VISUAL CHARTS (h-80) ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Chart: OOS Equity Growth */}
        <div
          className="p-5 rounded-2xl bg-[#0E121A]/85 border border-[#1E2430] flex flex-col justify-between"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2430] mb-3">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                Out-of-Sample Walk-Forward Wealth Growth (Net of Regulatory Fees)
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">20% Chronological OOS Test</span>
          </div>

          <EquityCurveChart data={visual_charts.equity_curves} />
        </div>

        {/* Right Chart: Capital Weight vs Risk Contribution (PRC) */}
        <div
          className="p-5 rounded-2xl bg-[#0E121A]/85 border border-[#1E2430] flex flex-col justify-between"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2430] mb-3">
            <div className="flex items-center gap-2.5">
              <Scale className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                Capital Weight vs. Risk Contribution Breakdown
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Ray Dalio ERC Verification</span>
          </div>

          <WeightRiskContributionChart data={visual_charts.weights_breakdown} />
        </div>
      </div>

      {/* ── ROW 4: ORDER EXECUTION & ALLOCATION BASKET ─────────── */}
      <div
        className="p-5 rounded-2xl bg-[#0E121A]/85 border border-[#1E2430] flex flex-col"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
      >
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#1E2430] gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/50 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                Investment &amp; Order Execution Table (Investable Capital: ₹{capital.toLocaleString()})
              </h2>
              <p className="text-[11px] font-mono text-emerald-400 font-semibold mt-0.5">
                Zero Brokerage on Delivery · ₹{blotter_summary.total_est_zerodha_charges} Est. Regulatory &amp; Exchange Fees
              </p>
            </div>
          </div>

          <button
            onClick={handleExportBasketCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-950/40"
            title="Download execution basket file formatted for CSV import"
          >
            <Download className="w-4 h-4" />
            <span>Export Investment Basket / CSV</span>
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 text-[11px] border-b border-[#1E2430]/80">
                <th className="py-2.5 font-semibold">Asset</th>
                <th className="py-2.5 font-semibold">Action</th>
                <th className="py-2.5 font-semibold">Quant Verdict</th>
                <th className="py-2.5 font-semibold">Active Wt %</th>
                <th className="py-2.5 font-semibold">PRC (Risk %)</th>
                <th className="py-2.5 font-semibold">LTP (₹)</th>
                <th className="py-2.5 font-semibold">Shares (Qty)</th>
                <th className="py-2.5 font-semibold">Actual Invested (₹)</th>
                <th className="py-2.5 font-semibold">Stop-Loss GTT (₹)</th>
                <th className="py-2.5 font-semibold">Target GTT (₹)</th>
                <th className="py-2.5 font-semibold">Buffer Saved</th>
                <th className="py-2.5 font-semibold">Est. Charges</th>
                <th className="py-2.5 font-semibold">MPT / Dalio / RU Wts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2430]/50">
              {zerodha_blotter.map(b => (
                <tr key={b.ticker} className="hover:bg-[#121622]/60 transition-colors">
                  <td className="py-3 font-bold text-white flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        b.category === 'ETF' || b.category === 'CASH_ETF'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      }`}
                    >
                      {b.category}
                    </span>
                    <span>{b.display_symbol}</span>
                  </td>
                  <td className="py-3">
                    {b.rebalance_action && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          b.rebalance_action === 'BUY'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                            : b.rebalance_action === 'TRIM'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                            : 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                        }`}
                      >
                        {b.rebalance_action === 'HOLD' ? 'HOLD (DEADBAND)' : b.rebalance_action}
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    <span className="text-xs text-slate-300">{b.quant_reason}</span>
                  </td>
                  <td className="py-3 font-extrabold text-emerald-400">{b.active_weight_pct}%</td>
                  <td className="py-3 font-semibold text-amber-300">{b.prc_pct}%</td>
                  <td className="py-3 text-slate-200">₹{b.latest_ltp.toFixed(2)}</td>
                  <td className="py-3 font-extrabold text-cyan-300">{b.whole_shares} shares</td>
                  <td className="py-3 font-bold text-white">₹{b.actual_invested.toLocaleString()}</td>
                  <td className="py-3 text-rose-400 font-semibold">
                    {b.stop_loss_gtt !== undefined ? `₹${b.stop_loss_gtt.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 text-emerald-400 font-semibold">
                    {b.target_profit_gtt !== undefined ? `₹${b.target_profit_gtt.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 text-cyan-400">
                    {b.cost_saved_rupees ? `₹${b.cost_saved_rupees.toFixed(0)}` : '—'}
                  </td>
                  <td className="py-3 text-slate-400">₹{b.est_zerodha_fees.toFixed(2)}</td>
                  <td className="py-3 text-slate-400 text-[11px]">
                    {b.mpt_weight_pct}% / {b.dalio_weight_pct}% / {b.ru_weight_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Execution Summary Strip */}
        <div className="mt-4 p-4 rounded-xl bg-[#090C12] border border-[#1E2430] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-500 block text-[11px]">Total Invested:</span>
              <span className="font-extrabold text-emerald-400 text-sm">₹{blotter_summary.total_invested.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Residual Cash:</span>
              <span className="font-bold text-slate-300 text-sm">₹{blotter_summary.total_residual_cash.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Total Est. Regulatory Fees:</span>
              <span className="font-bold text-amber-400 text-sm">₹{blotter_summary.total_est_zerodha_charges.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 text-right">
            <div>{blotter_summary.brokerage_rate}</div>
            <div className="text-slate-500 text-[11px]">{blotter_summary.stt_regulatory_rate}</div>
          </div>
        </div>
      </div>

      {/* ── MODAL: CUSTOM UNIVERSE PICKER ───────────────────────────── */}
      <UniverseSelectorModal
        isOpen={isUniverseModalOpen}
        onClose={() => setIsUniverseModalOpen(false)}
        allTradableTickers={allTradableTickers}
        selectedTickers={selectedTickers}
        onToggleTicker={onToggleTicker}
        onSetSelectedTickers={onSetSelectedTickers}
        onConfirm={onForceRefresh}
      />
    </div>
  );
};
