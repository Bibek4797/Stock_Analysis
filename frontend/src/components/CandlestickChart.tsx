import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData } from 'lightweight-charts';
import { OhlcvResponse, TimeframePeriod, QuantForecastConePoint } from '../types';
import { TrendingUp, TrendingDown, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Props {
  data: OhlcvResponse | null;
  selectedPeriod: TimeframePeriod;
  onPeriodChange: (p: TimeframePeriod) => void;
  isLoading: boolean;
  forecastCone?: QuantForecastConePoint[];
  showForecastCone?: boolean;
  onToggleForecastCone?: (show: boolean) => void;
  gttLevels?: {
    entry_price: number;
    stop_loss_gtt: number;
    stop_loss_pct: number;
    target_profit_gtt: number;
    target_profit_pct: number;
    reward_to_risk_ratio: number;
  };
}

export const CandlestickChart: React.FC<Props> = ({
  data,
  selectedPeriod,
  onPeriodChange,
  isLoading,
  forecastCone,
  showForecastCone = true,
  onToggleForecastCone,
  gttLevels,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef        = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma200Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef    = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMidRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef    = useRef<ISeriesApi<'Line'> | null>(null);

  // Stage 2 Forecast Cone Series
  const forecastPathRef = useRef<ISeriesApi<'Line'> | null>(null);
  const upper1sRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const lower1sRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const upper2sRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const lower2sRef      = useRef<ISeriesApi<'Line'> | null>(null);

  // Stage 4 GTT Execution Reference Lines
  const gttTargetRef    = useRef<ISeriesApi<'Line'> | null>(null);
  const gttStopRef      = useRef<ISeriesApi<'Line'> | null>(null);

  const [showBB,  setShowBB]  = useState(true);
  const [showSMA, setShowSMA] = useState(true);

  const [hovered, setHovered] = useState<{
    time: string; open: number; high: number; low: number; close: number;
    volume: number; change_pct: number; log_return: number;
    sma_200?: number | null; bb_upper?: number | null;
    bb_mid?: number | null; bb_lower?: number | null;
  } | null>(null);

  const TF: TimeframePeriod[] = ['3M', '6M', '1Y', '2Y', '5Y'];

  // ── Init chart once ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#64748B',
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(30,36,48,0.5)' },
        horzLines: { color: 'rgba(30,36,48,0.5)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(16,185,129,0.5)', width: 1, style: 3, labelBackgroundColor: '#0F1923' },
        horzLine: { color: 'rgba(16,185,129,0.5)', width: 1, style: 3, labelBackgroundColor: '#0F1923' },
      },
      rightPriceScale: {
        borderColor: 'rgba(30,36,48,0.5)',
        scaleMargins: { top: 0.07, bottom: 0.22 },
      },
      timeScale: { borderColor: 'rgba(30,36,48,0.5)', timeVisible: true, secondsVisible: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    });

    // 1. Candlestick
    const cs = chart.addCandlestickSeries({
      upColor: '#10B981', downColor: '#F43F5E',
      borderVisible: false,
      wickUpColor: '#10B981', wickDownColor: '#F43F5E',
    });

    // 2. Volume
    const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.83, bottom: 0 } });

    // 3. Technical Indicators: SMA 200 & Bollinger Bands
    const sma = chart.addLineSeries({ color: '#F59E0B', lineWidth: 2, priceLineVisible: false, crosshairMarkerVisible: true, title: 'SMA 200' });
    const bbu = chart.addLineSeries({ color: 'rgba(56,189,248,0.6)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, crosshairMarkerVisible: false, title: '' });
    const bbm = chart.addLineSeries({ color: 'rgba(14,165,233,0.8)',  lineWidth: 1, lineStyle: 0, priceLineVisible: false, crosshairMarkerVisible: false, title: '' });
    const bbl = chart.addLineSeries({ color: 'rgba(56,189,248,0.6)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, crosshairMarkerVisible: false, title: '' });

    // 4. Forecast Cone Overlay Series
    const fcPath = chart.addLineSeries({
      color: '#06B6D4',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      title: 'Forecast μ',
    });
    const u1s = chart.addLineSeries({
      color: 'rgba(245, 158, 11, 0.75)',
      lineWidth: 1,
      lineStyle: 1, // Dotted
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: '+1σ',
    });
    const l1s = chart.addLineSeries({
      color: 'rgba(245, 158, 11, 0.75)',
      lineWidth: 1,
      lineStyle: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: '-1σ',
    });
    const u2s = chart.addLineSeries({
      color: 'rgba(244, 63, 94, 0.75)',
      lineWidth: 1,
      lineStyle: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: '+2σ',
    });
    const l2s = chart.addLineSeries({
      color: 'rgba(244, 63, 94, 0.75)',
      lineWidth: 1,
      lineStyle: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: '-2σ',
    });

    // Stage 4 GTT Horizontal Reference Series
    const gttTarget = chart.addLineSeries({
      color: '#10B981',
      lineWidth: 1,
      lineStyle: 1,
      crosshairMarkerVisible: true,
      title: 'Target GTT',
      priceLineVisible: true,
      lastValueVisible: true,
    });
    const gttStop = chart.addLineSeries({
      color: '#F43F5E',
      lineWidth: 1,
      lineStyle: 1,
      crosshairMarkerVisible: true,
      title: 'Stop GTT',
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current       = chart;
    candleRef.current      = cs;
    volRef.current         = vol;
    sma200Ref.current      = sma;
    bbUpperRef.current     = bbu;
    bbMidRef.current       = bbm;
    bbLowerRef.current     = bbl;
    forecastPathRef.current= fcPath;
    upper1sRef.current     = u1s;
    lower1sRef.current     = l1s;
    upper2sRef.current     = u2s;
    lower2sRef.current     = l2s;
    gttTargetRef.current   = gttTarget;
    gttStopRef.current     = gttStop;

    // Crosshair
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) { setHovered(null); return; }
      const c = param.seriesData.get(cs) as CandlestickData | undefined;
      if (c && data?.candles) {
        let t = '';
        if (typeof param.time === 'string') t = param.time;
        else if (typeof param.time === 'object' && 'year' in (param.time as any)) {
          const x = param.time as any;
          t = `${x.year}-${String(x.month).padStart(2,'0')}-${String(x.day).padStart(2,'0')}`;
        } else t = String(param.time);
        const m = data.candles.find(x => x.time === t);
        setHovered({ time: t, open: c.open, high: c.high, low: c.low, close: c.close,
          volume: m?.volume ?? 0, change_pct: m?.simple_return_pct ?? 0,
          log_return: m?.log_return ?? 0,
          sma_200: m?.sma_200, bb_upper: m?.bb_upper, bb_mid: m?.bb_mid, bb_lower: m?.bb_lower });
      }
    });

    const ro = new ResizeObserver(entries => {
      if (entries[0]) { const { width, height } = entries[0].contentRect; chart.applyOptions({ width, height }); }
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, []);

  // ── Visibility toggles ──────────────────────────────────────
  useEffect(() => { sma200Ref.current?.applyOptions({ visible: showSMA }); }, [showSMA]);
  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: showBB });
    bbMidRef.current?.applyOptions({ visible: showBB });
    bbLowerRef.current?.applyOptions({ visible: showBB });
  }, [showBB]);

  useEffect(() => {
    forecastPathRef.current?.applyOptions({ visible: showForecastCone });
    upper1sRef.current?.applyOptions({ visible: showForecastCone });
    lower1sRef.current?.applyOptions({ visible: showForecastCone });
    upper2sRef.current?.applyOptions({ visible: showForecastCone });
    lower2sRef.current?.applyOptions({ visible: showForecastCone });
    gttTargetRef.current?.applyOptions({ visible: showForecastCone });
    gttStopRef.current?.applyOptions({ visible: showForecastCone });
  }, [showForecastCone]);

  // ── Feed candle and indicator data ──────────────────────────
  useEffect(() => {
    if (!data || !candleRef.current || !volRef.current) return;

    candleRef.current.setData(data.candles.map(c => ({
      time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
    })));

    volRef.current.setData(data.candles.map(c => ({
      time: c.time as any, value: c.volume,
      color: c.close >= c.open ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)',
    })));

    const mapLine = (key: 'sma_200' | 'bb_upper' | 'bb_mid' | 'bb_lower'): LineData[] =>
      data.candles
        .filter(c => c[key] != null && !isNaN(c[key] as number))
        .map(c => ({ time: c.time as any, value: c[key] as number }));

    sma200Ref.current?.setData(mapLine('sma_200'));
    bbUpperRef.current?.setData(mapLine('bb_upper'));
    bbMidRef.current?.setData(mapLine('bb_mid'));
    bbLowerRef.current?.setData(mapLine('bb_lower'));

    // Feed Forecast Cone if available
    if (forecastCone && forecastCone.length > 0 && data.candles.length > 0) {
      const lastCandle = data.candles[data.candles.length - 1];
      const coneAnchor: LineData = { time: lastCandle.time as any, value: lastCandle.close };

      const fcPathData: LineData[] = [coneAnchor, ...forecastCone.map(p => ({ time: p.date as any, value: p.expected_price }))];
      const u1sData: LineData[]     = [coneAnchor, ...forecastCone.map(p => ({ time: p.date as any, value: p.upper_1sigma }))];
      const l1sData: LineData[]     = [coneAnchor, ...forecastCone.map(p => ({ time: p.date as any, value: p.lower_1sigma }))];
      const u2sData: LineData[]     = [coneAnchor, ...forecastCone.map(p => ({ time: p.date as any, value: p.upper_2sigma }))];
      const l2sData: LineData[]     = [coneAnchor, ...forecastCone.map(p => ({ time: p.date as any, value: p.lower_2sigma }))];

      forecastPathRef.current?.setData(fcPathData);
      upper1sRef.current?.setData(u1sData);
      lower1sRef.current?.setData(l1sData);
      upper2sRef.current?.setData(u2sData);
      lower2sRef.current?.setData(l2sData);

      if (gttLevels) {
        const gttDates = [lastCandle.time, ...forecastCone.map(p => p.date)];
        gttTargetRef.current?.setData(gttDates.map(d => ({ time: d as any, value: gttLevels.target_profit_gtt })));
        gttStopRef.current?.setData(gttDates.map(d => ({ time: d as any, value: gttLevels.stop_loss_gtt })));
      } else {
        gttTargetRef.current?.setData([]);
        gttStopRef.current?.setData([]);
      }
    } else {
      forecastPathRef.current?.setData([]);
      upper1sRef.current?.setData([]);
      lower1sRef.current?.setData([]);
      upper2sRef.current?.setData([]);
      lower2sRef.current?.setData([]);
      gttTargetRef.current?.setData([]);
      gttStopRef.current?.setData([]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, forecastCone, gttLevels]);

  const m    = data?.metrics;
  const ind  = m?.indicators;
  const isUp = (m?.change ?? 0) >= 0;

  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#080B10' }}>

      {/* ── HUD Header ────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-wrap items-center justify-between gap-y-2 px-4 py-2.5"
        style={{
          background: 'linear-gradient(180deg, rgba(14,18,26,0.95) 0%, rgba(10,13,20,0.85) 100%)',
          borderBottom: '1px solid rgba(30,36,48,0.7)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* Left Side: Ticker info + Price */}
        <div className="flex items-center gap-4">
          {/* Ticker + Name + Badges */}
          <div className="flex items-center gap-2.5">
            <span className="text-base font-mono font-extrabold text-white tracking-tight">
              {data?.display_symbol || '···'}
            </span>
            <span className="text-[11px] text-slate-500 font-sans hidden sm:block truncate max-w-[160px]">
              {data?.name}
            </span>

            {/* Category */}
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              data?.category === 'INDEX' ? 'badge-idx' :
              data?.category === 'ETF'   ? 'badge-etf' : 'badge-eq'
            }`}>
              {data?.category}
            </span>

            {/* Tradability */}
            {data && (
              data.is_tradable ? (
                <span className="hidden lg:inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34D399' }}>
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  NSE TRADABLE
                </span>
              ) : (
                <span className="hidden lg:inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#FBB724' }}>
                  <ShieldAlert className="w-2.5 h-2.5" />
                  BENCHMARK ONLY
                </span>
              )
            )}
          </div>

          {/* Price + Change Separator */}
          {m && (
            <div className="flex items-center gap-3 pl-3" style={{ borderLeft: '1px solid rgba(30,36,48,0.7)' }}>
              {/* Price */}
              <div className="flex flex-col leading-none">
                <span className="text-xl font-mono font-extrabold text-white tracking-tight">
                  ₹{m.latest_close.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Change */}
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold`}
                style={isUp ? {
                  background: 'rgba(16,185,129,0.10)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  color: '#10B981',
                } : {
                  background: 'rgba(244,63,94,0.10)',
                  border: '1px solid rgba(244,63,94,0.2)',
                  color: '#F43F5E',
                }}
              >
                {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isUp ? '+' : ''}{m.change.toFixed(2)}
                <span className="opacity-80">({isUp ? '+' : ''}{m.change_pct.toFixed(2)}%)</span>
              </div>

              {/* Log Return */}
              <div className="hidden xl:flex flex-col leading-none text-right">
                <span className="text-[9px] text-slate-500 font-mono">log r(t)</span>
                <span className={`text-[11px] font-mono font-semibold ${m.daily_log_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {m.daily_log_return >= 0 ? '+' : ''}{m.daily_log_return.toFixed(5)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Indicators + Stats + Timeframe */}
        <div className="flex items-center gap-3">
          {/* Day Stats */}
          {m && (
            <div className="hidden xl:flex items-center gap-3 pr-3 text-[11px] font-mono" style={{ borderRight: '1px solid rgba(30,36,48,0.7)' }}>
              {[
                { label: 'H', val: `₹${m.day_high.toLocaleString('en-IN')}`, color: '#10B981' },
                { label: 'L', val: `₹${m.day_low.toLocaleString('en-IN')}`, color: '#F43F5E' },
                { label: 'Vol', val: `${(m.day_volume/100000).toFixed(1)}L`, color: '#94A3B8' },
                { label: 'σ Ann', val: `${m.annualized_volatility}%`, color: '#38BDF8' },
              ].map(stat => (
                <div key={stat.label} className="flex flex-col leading-none items-center">
                  <span className="text-[9px] text-slate-600">{stat.label}</span>
                  <span style={{ color: stat.color }}>{stat.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Indicator & Forecast Toggles */}
          <div
            className="flex items-center gap-1 p-0.5 rounded-lg"
            style={{ background: 'rgba(14,18,26,0.8)', border: '1px solid rgba(30,36,48,0.7)' }}
          >
            <button
              onClick={() => setShowBB(!showBB)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all duration-150"
              style={showBB ? {
                background: 'rgba(56,189,248,0.10)',
                border: '1px solid rgba(56,189,248,0.25)',
                color: '#38BDF8',
              } : {
                border: '1px solid transparent',
                color: '#475569',
              }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showBB ? 'bg-cyan-400' : 'bg-slate-700'}`} />
              BB (20,2)
            </button>
            <button
              onClick={() => setShowSMA(!showSMA)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all duration-150"
              style={showSMA ? {
                background: 'rgba(245,158,11,0.10)',
                border: '1px solid rgba(245,158,11,0.25)',
                color: '#F59E0B',
              } : {
                border: '1px solid transparent',
                color: '#475569',
              }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showSMA ? 'bg-amber-400' : 'bg-slate-700'}`} />
              SMA 200
            </button>
            {onToggleForecastCone && (
              <button
                onClick={() => onToggleForecastCone(!showForecastCone)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all duration-150"
                style={showForecastCone ? {
                  background: 'rgba(6,182,212,0.15)',
                  border: '1px solid rgba(6,182,212,0.35)',
                  color: '#22D3EE',
                } : {
                  border: '1px solid transparent',
                  color: '#475569',
                }}
                title="Toggle Stage 2 Multi-Day Forecast Cone"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${showForecastCone ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'}`} />
                Fan Cone
              </button>
            )}
          </div>

          {/* Timeframe Selector */}
          <div
            className="flex items-center p-0.5 rounded-lg"
            style={{ background: 'rgba(14,18,26,0.8)', border: '1px solid rgba(30,36,48,0.7)' }}
          >
            {TF.map(tf => (
              <button
                key={tf}
                onClick={() => onPeriodChange(tf)}
                className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold transition-all duration-150"
                style={selectedPeriod === tf ? {
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.08))',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#10B981',
                } : {
                  border: '1px solid transparent',
                  color: '#475569',
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Crosshair Data Ribbon ─────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 text-[10px] font-mono overflow-x-auto"
        style={{
          height: '26px',
          background: 'rgba(8,11,16,0.8)',
          borderBottom: '1px solid rgba(30,36,48,0.4)',
          color: '#475569',
        }}
      >
        {hovered ? (
          <div className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-slate-300 font-bold">{hovered.time}</span>
            {[
              { k: 'O', v: hovered.open.toFixed(2) },
              { k: 'H', v: hovered.high.toFixed(2), color: '#10B981' },
              { k: 'L', v: hovered.low.toFixed(2), color: '#F43F5E' },
              { k: 'C', v: hovered.close.toFixed(2) },
            ].map(x => (
              <span key={x.k}>
                <span className="text-slate-600">{x.k}: </span>
                <span style={{ color: x.color || '#CBD5E1' }}>₹{x.v}</span>
              </span>
            ))}
            <span><span className="text-slate-600">Vol: </span><span className="text-slate-300">{(hovered.volume/1e5).toFixed(2)}L</span></span>
            <span style={{ color: hovered.change_pct >= 0 ? '#10B981' : '#F43F5E' }}>
              {hovered.change_pct >= 0 ? '+' : ''}{hovered.change_pct.toFixed(2)}%
            </span>
            {showSMA && hovered.sma_200 && (
              <span className="pl-2" style={{ borderLeft: '1px solid rgba(30,36,48,0.6)', color: '#F59E0B' }}>
                SMA200: ₹{hovered.sma_200.toFixed(2)}
              </span>
            )}
            {showBB && hovered.bb_upper && (
              <span className="pl-2" style={{ borderLeft: '1px solid rgba(30,36,48,0.6)', color: '#38BDF8' }}>
                BB [₹{hovered.bb_lower?.toFixed(2)} · ₹{hovered.bb_mid?.toFixed(2)} · ₹{hovered.bb_upper.toFixed(2)}]
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4 whitespace-nowrap">
            <span>Hover over candlestick for OHLCV detail</span>
            {showSMA && ind?.sma_200 && (
              <span className="pl-2" style={{ borderLeft: '1px solid rgba(30,36,48,0.6)', color: '#F59E0B' }}>
                SMA 200: ₹{ind.sma_200.toFixed(2)}
              </span>
            )}
            {showBB && ind?.bb_upper && (
              <span className="pl-2" style={{ borderLeft: '1px solid rgba(30,36,48,0.6)', color: '#38BDF8' }}>
                BB(20,2): [₹{ind.bb_lower?.toFixed(2)} — ₹{ind.bb_mid?.toFixed(2)} — ₹{ind.bb_upper.toFixed(2)}]
              </span>
            )}
            {forecastCone && forecastCone.length > 0 && showForecastCone && (
              <span className="pl-2" style={{ borderLeft: '1px solid rgba(30,36,48,0.6)', color: '#22D3EE' }}>
                Forecast Target: ₹{forecastCone[forecastCone.length - 1].expected_price.toFixed(2)} ({forecastCone[forecastCone.length - 1].expected_return_pct >= 0 ? '+' : ''}{forecastCone[forecastCone.length - 1].expected_return_pct}%)
              </span>
            )}
          </div>
        )}
        {data?.is_synthetic && (
          <span className="ml-auto flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#FBB724' }}>
            SYNTHETIC FALLBACK
          </span>
        )}
      </div>

      {/* ── Chart Canvas ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="w-full h-full" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'rgba(8,11,16,0.75)', backdropFilter: 'blur(2px)' }}>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1 bg-emerald-500 rounded-full"
                    style={{ height: '16px', animation: `chart-load 0.6s ease-in-out ${i*0.15}s infinite alternate` }} />
                ))}
              </div>
              <span className="text-xs font-mono text-emerald-400">Loading market data…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
