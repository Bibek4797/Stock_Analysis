import React, { useState, useEffect } from 'react';
import { ViewTab } from '../types';
import { Zap, LayoutDashboard, LineChart, PieChart, Clock, RefreshCw } from 'lucide-react';

interface NavbarProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  marketDataDate?: string;
  isSyncingPrices?: boolean;
  onSyncPrices?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  marketDataDate,
  isSyncingPrices,
  onSyncPrices,
}) => {
  const [istTime, setIstTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setIstTime(now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const tabs: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
    { id: 'terminal',          label: 'Terminal',          icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'returns_risk',      label: 'Returns & Risk',    icon: <LineChart className="w-3.5 h-3.5" /> },
    { id: 'portfolio_manager', label: 'Portfolio Manager', icon: <PieChart className="w-3.5 h-3.5" /> },
  ];

  return (
    <header
      className="h-14 flex-shrink-0 flex items-center justify-between px-5 select-none z-50"
      style={{
        background: 'linear-gradient(180deg, #0D1119 0%, #080B10 100%)',
        borderBottom: '1px solid rgba(30,36,48,0.7)',
        boxShadow: '0 2px 24px rgba(0,0,0,0.55), 0 0 1px rgba(16,185,129,0.05)',
      }}
    >
      {/* ── LEFT: Brand ──────────────────────────────── */}
      <div className="flex items-center gap-3.5">
        {/* Logo Glyph */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(6,182,212,0.08))',
            border: '1px solid rgba(16,185,129,0.3)',
            boxShadow: '0 0 20px rgba(16,185,129,0.1), inset 0 0 8px rgba(16,185,129,0.04)',
          }}
        >
          <Zap className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_4px_rgba(16,185,129,0.4)]" />
        </div>

        {/* Word-mark */}
        <div className="flex flex-col leading-none gap-1">
          <div className="flex items-center gap-2.5">
            <span
              className="text-[13px] font-extrabold text-white"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.08em',
              }}
            >
              Q-ALPHA
            </span>
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded tracking-widest uppercase"
              style={{
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#34D399',
              }}
            >
              NSE
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono tracking-wider hidden sm:block">
            Institutional Quantitative Terminal
          </span>
        </div>
      </div>

      {/* ── CENTER: Navigation Tabs ───────────────────── */}
      <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-[#090C12]/90 border border-[#1E2430]/70 backdrop-blur-sm">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 text-white border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <span className={`transition-colors duration-200 ${isActive ? 'text-emerald-400' : 'text-slate-600'}`}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── RIGHT: Clock + Data Sync + Status ─────────── */}
      <div className="flex items-center gap-3">
        {/* Dynamic Quote Sync Button */}
        {onSyncPrices && (
          <button
            onClick={onSyncPrices}
            disabled={isSyncingPrices}
            title="Refresh with latest live NSE market quotes"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all duration-200 hover:border-emerald-500/40 hover:bg-emerald-950/20 active:scale-95 disabled:opacity-60 whitespace-nowrap"
            style={{
              background: 'rgba(14,18,26,0.85)',
              borderColor: 'rgba(30,36,48,0.85)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingPrices ? 'animate-spin' : ''}`} />
            <span className="text-[11px] text-slate-300 font-medium">
              {isSyncingPrices ? 'Syncing...' : 'Sync Market'}
            </span>
          </button>
        )}

        {/* Clock Block */}
        <div
          className="hidden md:flex flex-col items-end gap-0.5"
          style={{ minWidth: '100px' }}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-500" />
            <span
              className="text-xs font-mono font-bold text-slate-200 tracking-wider"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {istTime || '09:15:00'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 tracking-wide">{date || '28 Oct 2026'} IST</span>
        </div>

        {/* Separator */}
        <div className="hidden md:block w-px h-6 bg-slate-800" />

        {/* Live Feed Pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 hover:shadow-[0_0_12px_rgba(16,185,129,0.15)]"
          style={{
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-mono font-semibold text-emerald-400 tracking-wider hidden sm:inline">
            NSE LIVE
          </span>
        </div>
      </div>
    </header>
  );
};
