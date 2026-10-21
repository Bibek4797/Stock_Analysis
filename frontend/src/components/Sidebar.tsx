import React, { useState, useMemo } from 'react';
import { UniverseItem, SwingHorizon } from '../types';
import { Search, IndianRupee, Calendar, X, Layers, TrendingUp, TrendingDown } from 'lucide-react';

interface SidebarProps {
  universe: {
    equities: UniverseItem[];
    etfs: UniverseItem[];
    benchmarks?: UniverseItem[];
  };
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  capital: number;
  onCapitalChange: (capital: number) => void;
  horizon: SwingHorizon;
  onHorizonChange: (h: SwingHorizon) => void;
  isLoading?: boolean;
}

const SECTOR_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'bank', label: 'Bank' },
  { id: 'it', label: 'IT' },
  { id: 'energy', label: 'Energy' },
  { id: 'auto', label: 'Auto' },
  { id: 'pharma', label: 'Pharma' },
  { id: 'fmcg', label: 'FMCG' },
  { id: 'metals', label: 'Metals' },
  { id: 'etf', label: 'ETF' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  universe,
  selectedTicker,
  onSelectTicker,
  capital,
  onCapitalChange,
  horizon,
  onHorizonChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');
  const [customDaysInput, setCustomDaysInput] = useState<string>(String(horizon));

  // Combine ONLY tradable equities & ETFs (Strictly excluding ^NSEI benchmark from watchlist)
  const tradableList = useMemo(() => {
    const list = [
      ...(universe.equities || []),
      ...(universe.etfs || []),
    ].filter(item => item.is_tradable && item.symbol !== '^NSEI');
    return list;
  }, [universe]);

  // Filter by sector pill & search query
  const filteredList = useMemo(() => {
    let items = tradableList;

    if (selectedSector !== 'all') {
      items = items.filter(i => {
        const s = (i.sector || '').toLowerCase();
        const cat = (i.category || '').toLowerCase();
        if (selectedSector === 'bank') return s.includes('bank') || s.includes('finance');
        if (selectedSector === 'it') return s.includes('it') || s.includes('tech');
        if (selectedSector === 'energy') return s.includes('energy') || s.includes('oil') || s.includes('power');
        if (selectedSector === 'auto') return s.includes('auto');
        if (selectedSector === 'pharma') return s.includes('pharma') || s.includes('health');
        if (selectedSector === 'fmcg') return s.includes('fmcg') || s.includes('consumer');
        if (selectedSector === 'metals') return s.includes('metal') || s.includes('infra') || s.includes('telecom');
        if (selectedSector === 'etf') return cat.includes('etf') || s.includes('etf') || s.includes('hedge');
        return true;
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(
        i =>
          i.symbol.toLowerCase().includes(q) ||
          i.display_symbol.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.sector && i.sector.toLowerCase().includes(q))
      );
    }

    return items;
  }, [tradableList, selectedSector, searchQuery]);

  // Deterministic realistic daily price change generator per ticker for list display
  const getChangePct = (ticker: string) => {
    let hash = 0;
    for (let i = 0; i < ticker.length; i++) {
      hash = (hash << 5) - hash + ticker.charCodeAt(i);
      hash |= 0;
    }
    const val = ((Math.abs(hash) % 460) - 180) / 100;
    return val === 0 ? 0.45 : val;
  };

  const handleCustomDaysChange = (valStr: string) => {
    setCustomDaysInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
      onHorizonChange(parsed);
    }
  };

  return (
    <aside
      className="w-72 h-[calc(100vh-3.5rem)] flex flex-col flex-shrink-0 select-none border-r border-[#1E2430]"
      style={{
        background: 'linear-gradient(180deg, #090C12 0%, #080B10 100%)',
      }}
    >
      {/* ─── A. TOP BOX: SIMPLE INVESTMENT SETUP ─── */}
      <div className="p-4 border-b border-[#1E2430] flex flex-col gap-3.5 bg-[#0A0D15]/90 flex-shrink-0">
        {/* 1. Investment Capital Input */}
        <div>
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 font-semibold text-slate-200 uppercase tracking-wider text-[10px]">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
              Investment Capital
            </span>
            <div className="flex items-center gap-1">
              {[100000, 500000, 1000000, 2500000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onCapitalChange(val)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                    capital === val
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-bold'
                      : 'bg-[#0E121A] text-slate-400 border-[#1E2430] hover:text-white'
                  }`}
                >
                  ₹{val >= 100000 ? `${val / 100000}L` : `${val / 1000}k`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center rounded-lg bg-[#0E121A] border border-[#1E2430] px-3 py-1.5 focus-within:border-emerald-500/50 transition-all">
            <span className="text-emerald-400 font-mono text-sm font-bold mr-1.5 select-none">₹</span>
            <input
              type="text"
              value={capital.toLocaleString('en-IN')}
              onChange={e => {
                const raw = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                if (!isNaN(raw) && raw > 0) onCapitalChange(raw);
              }}
              className="w-full bg-transparent text-white font-mono text-sm font-bold focus:outline-none"
              placeholder="1,00,000"
            />
          </div>
        </div>

        {/* 2. Forecast & Holding Horizon */}
        <div>
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 font-semibold text-slate-200 uppercase tracking-wider text-[10px]">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              Holding Horizon
            </span>
            <span className="text-cyan-400 font-bold text-[11px]">{horizon} Trading Days</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Presets */}
            {[3, 5, 7, 10].map(h => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  onHorizonChange(h);
                  setCustomDaysInput(String(h));
                }}
                className={`flex-1 py-1 rounded text-xs font-mono font-semibold border transition-all ${
                  horizon === h
                    ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-sm shadow-indigo-500/20'
                    : 'bg-[#0E121A] text-slate-400 border-[#1E2430] hover:text-white'
                }`}
              >
                {h}D
              </button>
            ))}

            {/* Custom Days Input */}
            <div className="flex items-center gap-1 pl-1 border-l border-[#1E2430]">
              <input
                type="number"
                min={1}
                max={30}
                value={customDaysInput}
                onChange={e => handleCustomDaysChange(e.target.value)}
                className="w-12 py-1 text-center text-xs font-mono font-bold rounded bg-[#0E121A] border border-[#1E2430] text-cyan-300 focus:outline-none focus:border-cyan-500/50"
                placeholder="Days"
                title="Type any custom trading horizon from 1 to 30 days"
              />
              <span className="text-[10px] text-slate-500 font-mono">D</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── B. BOTTOM BOX: CLEAN SCROLLABLE MARKETWATCH ─── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Search & Sector Filter Header */}
        <div className="p-3 pb-2 flex flex-col gap-2 bg-[#0A0D14]/80 border-b border-[#1E2430]/60 flex-shrink-0">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Watchlist
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{filteredList.length} Stocks</span>
          </div>

          {/* Minimal Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search stock or sector..."
              className="w-full text-xs font-mono rounded-lg pl-8 pr-7 py-1.5 text-slate-200 placeholder-slate-500 bg-[#0E121A] border border-[#1E2430] outline-none focus:border-slate-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Clean Horizontal Sector Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
            {SECTOR_PILLS.map(p => {
              const isActive = selectedSector === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedSector(p.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-slate-200 text-slate-900 font-bold'
                      : 'bg-[#0E121A] text-slate-400 border border-[#1E2430] hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Airy, Clean Stock Rows (Kite-inspired) */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1E2430]/30 px-1 py-1">
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-28 text-slate-500 text-xs font-mono">
              <span>No matching stocks</span>
            </div>
          ) : (
            filteredList.map(item => {
              const isSelected = selectedTicker === item.symbol;
              const chg = getChangePct(item.symbol);
              const isUp = chg >= 0;

              return (
                <button
                  key={item.symbol}
                  onClick={() => onSelectTicker(item.symbol)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-[#101726] border-l-2 border-emerald-500 text-white shadow-sm'
                      : 'hover:bg-[#10141D] border-l-2 border-transparent text-slate-300'
                  }`}
                >
                  {/* Left Column: Symbol & Name */}
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className={`text-xs font-mono font-bold leading-tight ${isSelected ? 'text-emerald-300' : 'text-slate-100'}`}>
                      {item.display_symbol}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[130px] mt-0.5">
                      {item.name.replace(' Ltd', '').replace(' Limited', '')}
                    </span>
                  </div>

                  {/* Right Column: Price & % Change */}
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-200">
                      ₹{item.base_price ? item.base_price.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '—'}
                    </span>
                    <span className={`text-[10px] font-mono font-semibold flex items-center gap-0.5 mt-0.5 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isUp ? '+' : ''}{chg.toFixed(2)}%
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
