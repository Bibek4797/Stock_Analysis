import React, { useState, useEffect } from 'react';
import { ViewTab } from '../types';
import { Zap, LayoutDashboard, LineChart, PieChart, Clock } from 'lucide-react';

interface NavbarProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
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
                letterSpacing: '0.18em',
                textShadow: '0 0 16px rgba(16,185,129,0.12)',
              }}
            >
              Q-ALPHA
            </span>
            <span className="text-slate-700 text-[10px] font-mono select-none">//</span>
            <span className="text-[10px] font-medium tracking-[0.14em] text-slate-500 uppercase">
              NSE Quant Terminal
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="text-[9.5px] font-mono text-emerald-500/80 tracking-[0.08em]">
              NSE EQUITY &amp; PORTFOLIO TERMINAL
            </span>
          </div>
        </div>
      </div>

      {/* ── CENTER: Slide Tab Switcher ────────────────── */}
      <nav
        className="flex items-center p-1 rounded-xl gap-1"
        style={{
          background: 'rgba(10,14,22,0.95)',
          border: '1px solid rgba(30,36,48,0.6)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={[
                'flex items-center gap-2 px-5 py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-250 ease-out cursor-pointer',
                isActive
                  ? 'text-emerald-300'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
                isActive ? 'tab-active-indicator' : '',
              ].join(' ')}
              style={isActive ? {
                background: 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(6,182,212,0.07))',
                border: '1px solid rgba(16,185,129,0.25)',
                boxShadow: '0 0 14px rgba(16,185,129,0.1), 0 1px 2px rgba(0,0,0,0.2)',
              } : {
                border: '1px solid transparent',
              }}
            >
              <span className={`transition-colors duration-200 ${isActive ? 'text-emerald-400' : 'text-slate-600'}`}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── RIGHT: Clock + Status ─────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Clock Block */}
        <div
          className="hidden md:flex flex-col items-end gap-0.5"
          style={{ minWidth: '110px' }}
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
          <span className="text-[10px] font-mono text-slate-500 tracking-wide">{date || '20 Oct 2026'} IST</span>
        </div>

        {/* Separator */}
        <div className="hidden md:block w-px h-6 bg-slate-800" />

        {/* Live Feed Pill */}
        <div
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full transition-all duration-300 hover:shadow-[0_0_12px_rgba(16,185,129,0.15)]"
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
