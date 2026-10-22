"""
Q-ALPHA // Production-Grade Quantitative Market Terminal Backend
Tailored for the Indian Market (NSE / Zerodha Tradable Universe)
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Any
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import hashlib
import time
import os
import json

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("qalpha-backend")

app = FastAPI(
    title="Q-Alpha Quantitative Terminal API",
    description="Institutional-grade Quantitative Market Analysis & Portfolio Management for NSE",
    version="1.0.0"
)

# Enable CORS for frontend Vite dev server & production builds
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# 1. CURATED NSE / ZERODHA UNIVERSE DEFINITION
# ==============================================================================

UNIVERSE_CONFIG = {
    "equities": [
        # 1. Banking & Finance (8)
        {"symbol": "HDFCBANK.NS", "display_symbol": "HDFCBANK", "name": "HDFC Bank Ltd", "sector": "Banking & Finance", "category": "EQ", "is_tradable": True, "base_price": 693.15, "change_pct": -1.95},
        {"symbol": "ICICIBANK.NS", "display_symbol": "ICICIBANK", "name": "ICICI Bank Ltd", "sector": "Banking & Finance", "category": "EQ", "is_tradable": True, "base_price": 1393.0, "change_pct": 0.58},
        {"symbol": "SBIN.NS", "display_symbol": "SBIN", "name": "State Bank of India", "sector": "Banking & Finance", "category": "EQ", "is_tradable": True, "base_price": 966.0, "change_pct": 0.31},
        {"symbol": "KOTAKBANK.NS", "display_symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Ltd", "sector": "Banking & Finance", "category": "EQ", "is_tradable": True, "base_price": 437.1, "change_pct": -0.16},
        {"symbol": "AXISBANK.NS", "display_symbol": "AXISBANK", "name": "Axis Bank Ltd", "sector": "Banking & Finance", "category": "EQ", "is_tradable": True, "base_price": 1205.6, "change_pct": -0.36},
        {"symbol": "BAJFINANCE.NS", "display_symbol": "BAJFINANCE", "name": "Bajaj Finance Ltd", "sector": "Banking & Finance", "category": "EQ", "is_tradable": True, "base_price": 932.6, "change_pct": 0.71},
        {"symbol": "BAJAJFINSV.NS", "display_symbol": "BAJAJFINSV", "name": "Bajaj Finserv Ltd", "sector": "Banking & Finance", "category": "EQ", "is_tradable": True, "base_price": 1674.0, "change_pct": -0.95},
        {"symbol": "INDUSINDBK.NS", "display_symbol": "INDUSINDBK", "name": "IndusInd Bank Ltd", "sector": "Banking & Finance", "category": "EQ", "is_tradable": True, "base_price": 846.65, "change_pct": -0.34},

        # 2. IT & Technology (6)
        {"symbol": "TCS.NS", "display_symbol": "TCS", "name": "Tata Consultancy Services Ltd", "sector": "IT & Technology", "category": "EQ", "is_tradable": True, "base_price": 2504.7, "change_pct": -0.96},
        {"symbol": "INFY.NS", "display_symbol": "INFY", "name": "Infosys Ltd", "sector": "IT & Technology", "category": "EQ", "is_tradable": True, "base_price": 1149.95, "change_pct": -1.55},
        {"symbol": "HCLTECH.NS", "display_symbol": "HCLTECH", "name": "HCL Technologies Ltd", "sector": "IT & Technology", "category": "EQ", "is_tradable": True, "base_price": 1409.6, "change_pct": -1.03},
        {"symbol": "WIPRO.NS", "display_symbol": "WIPRO", "name": "Wipro Ltd", "sector": "IT & Technology", "category": "EQ", "is_tradable": True, "base_price": 189.81, "change_pct": 0.34},
        {"symbol": "TECHM.NS", "display_symbol": "TECHM", "name": "Tech Mahindra Ltd", "sector": "IT & Technology", "category": "EQ", "is_tradable": True, "base_price": 1794.9, "change_pct": -2.17},
        {"symbol": "PERSISTENT.NS", "display_symbol": "PERSISTENT", "name": "Persistent Systems Ltd", "sector": "IT & Technology", "category": "EQ", "is_tradable": True, "base_price": 5741.0, "change_pct": -2.01},

        # 3. Energy, Oil & Power (6)
        {"symbol": "RELIANCE.NS", "display_symbol": "RELIANCE", "name": "Reliance Industries Ltd", "sector": "Energy, Oil & Power", "category": "EQ", "is_tradable": True, "base_price": 1187.7, "change_pct": -1.76},
        {"symbol": "ONGC.NS", "display_symbol": "ONGC", "name": "Oil & Natural Gas Corporation Ltd", "sector": "Energy, Oil & Power", "category": "EQ", "is_tradable": True, "base_price": 225.35, "change_pct": -0.12},
        {"symbol": "NTPC.NS", "display_symbol": "NTPC", "name": "NTPC Ltd", "sector": "Energy, Oil & Power", "category": "EQ", "is_tradable": True, "base_price": 300.7, "change_pct": -0.76},
        {"symbol": "POWERGRID.NS", "display_symbol": "POWERGRID", "name": "Power Grid Corporation of India", "sector": "Energy, Oil & Power", "category": "EQ", "is_tradable": True, "base_price": 247.05, "change_pct": -2.02},
        {"symbol": "COALINDIA.NS", "display_symbol": "COALINDIA", "name": "Coal India Ltd", "sector": "Energy, Oil & Power", "category": "EQ", "is_tradable": True, "base_price": 399.2, "change_pct": -2.04},
        {"symbol": "TATAPOWER.NS", "display_symbol": "TATAPOWER", "name": "Tata Power Company Ltd", "sector": "Energy, Oil & Power", "category": "EQ", "is_tradable": True, "base_price": 351.2, "change_pct": -0.23},

        # 4. Auto & EV (5)
        {"symbol": "HEROMOTOCO.NS", "display_symbol": "HEROMOTOCO", "name": "Hero MotoCorp Ltd", "sector": "Auto & EV", "category": "EQ", "is_tradable": True, "base_price": 5133.0, "change_pct": -0.40},
        {"symbol": "M&M.NS", "display_symbol": "M&M", "name": "Mahindra & Mahindra Ltd", "sector": "Auto & EV", "category": "EQ", "is_tradable": True, "base_price": 2851.0, "change_pct": -1.32},
        {"symbol": "MARUTI.NS", "display_symbol": "MARUTI", "name": "Maruti Suzuki India Ltd", "sector": "Auto & EV", "category": "EQ", "is_tradable": True, "base_price": 11118.0, "change_pct": -0.73},
        {"symbol": "BAJAJ-AUTO.NS", "display_symbol": "BAJAJ-AUTO", "name": "Bajaj Auto Ltd", "sector": "Auto & EV", "category": "EQ", "is_tradable": True, "base_price": 10129.0, "change_pct": 0.57},
        {"symbol": "EICHERMOT.NS", "display_symbol": "EICHERMOT", "name": "Eicher Motors Ltd", "sector": "Auto & EV", "category": "EQ", "is_tradable": True, "base_price": 7049.0, "change_pct": -1.69},

        # 5. Pharma & Healthcare (4)
        {"symbol": "SUNPHARMA.NS", "display_symbol": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd", "sector": "Pharma & Healthcare", "category": "EQ", "is_tradable": True, "base_price": 1745.8, "change_pct": 0.04},
        {"symbol": "DRREDDY.NS", "display_symbol": "DRREDDY", "name": "Dr. Reddy's Laboratories Ltd", "sector": "Pharma & Healthcare", "category": "EQ", "is_tradable": True, "base_price": 1233.7, "change_pct": -0.87},
        {"symbol": "CIPLA.NS", "display_symbol": "CIPLA", "name": "Cipla Ltd", "sector": "Pharma & Healthcare", "category": "EQ", "is_tradable": True, "base_price": 1322.5, "change_pct": 0.65},
        {"symbol": "APOLLOHOSP.NS", "display_symbol": "APOLLOHOSP", "name": "Apollo Hospitals Enterprise Ltd", "sector": "Pharma & Healthcare", "category": "EQ", "is_tradable": True, "base_price": 7598.0, "change_pct": -0.03},

        # 6. FMCG & Consumer (5)
        {"symbol": "ITC.NS", "display_symbol": "ITC", "name": "ITC Ltd", "sector": "FMCG & Consumer", "category": "EQ", "is_tradable": True, "base_price": 257.55, "change_pct": -1.7},
        {"symbol": "HINDUNILVR.NS", "display_symbol": "HINDUNILVR", "name": "Hindustan Unilever Ltd", "sector": "FMCG & Consumer", "category": "EQ", "is_tradable": True, "base_price": 1817.2, "change_pct": -1.78},
        {"symbol": "TITAN.NS", "display_symbol": "TITAN", "name": "Titan Company Ltd", "sector": "FMCG & Consumer", "category": "EQ", "is_tradable": True, "base_price": 4305.6, "change_pct": -1.72},
        {"symbol": "NESTLEIND.NS", "display_symbol": "NESTLEIND", "name": "Nestle India Ltd", "sector": "FMCG & Consumer", "category": "EQ", "is_tradable": True, "base_price": 1187.1, "change_pct": -3.01},
        {"symbol": "ASIANPAINT.NS", "display_symbol": "ASIANPAINT", "name": "Asian Paints Ltd", "sector": "FMCG & Consumer", "category": "EQ", "is_tradable": True, "base_price": 2297.2, "change_pct": -0.96},

        # 7. Metals, Infra & Telecom (5)
        {"symbol": "LT.NS", "display_symbol": "LT", "name": "Larsen & Toubro Ltd", "sector": "Metals, Infra & Telecom", "category": "EQ", "is_tradable": True, "base_price": 3649.4, "change_pct": 0.37},
        {"symbol": "BHARTIARTL.NS", "display_symbol": "BHARTIARTL", "name": "Bharti Airtel Ltd", "sector": "Metals, Infra & Telecom", "category": "EQ", "is_tradable": True, "base_price": 1903.3, "change_pct": 0.61},
        {"symbol": "TATASTEEL.NS", "display_symbol": "TATASTEEL", "name": "Tata Steel Ltd", "sector": "Metals, Infra & Telecom", "category": "EQ", "is_tradable": True, "base_price": 170.81, "change_pct": -0.95},
        {"symbol": "HINDALCO.NS", "display_symbol": "HINDALCO", "name": "Hindalco Industries Ltd", "sector": "Metals, Infra & Telecom", "category": "EQ", "is_tradable": True, "base_price": 888.75, "change_pct": -0.46},
        {"symbol": "ULTRACEMCO.NS", "display_symbol": "ULTRACEMCO", "name": "UltraTech Cement Ltd", "sector": "Metals, Infra & Telecom", "category": "EQ", "is_tradable": True, "base_price": 10918.0, "change_pct": 0.64},
    ],
    "etfs": [
        # 8. Tradable ETFs & Cash Hedge (6)
        {"symbol": "NIFTYBEES.NS", "display_symbol": "NIFTYBEES", "name": "Nippon India ETF Nifty 50 BeES", "sector": "ETFs & Hedge", "category": "ETF", "is_tradable": True, "base_price": 258.5, "change_pct": -1.03},
        {"symbol": "BANKBEES.NS", "display_symbol": "BANKBEES", "name": "Nippon India ETF Nifty Bank BeES", "sector": "ETFs & Hedge", "category": "ETF", "is_tradable": True, "base_price": 568.14, "change_pct": -1.36},
        {"symbol": "ITBEES.NS", "display_symbol": "ITBEES", "name": "Nippon India ETF Nifty IT", "sector": "ETFs & Hedge", "category": "ETF", "is_tradable": True, "base_price": 35.55, "change_pct": 1.77},
        {"symbol": "JUNIORBEES.NS", "display_symbol": "JUNIORBEES", "name": "Nippon India ETF Nifty Next 50", "sector": "ETFs & Hedge", "category": "ETF", "is_tradable": True, "base_price": 727.0, "change_pct": -2.38},
        {"symbol": "GOLDBEES.NS", "display_symbol": "GOLDBEES", "name": "Nippon India ETF Gold BeES", "sector": "ETFs & Hedge", "category": "ETF", "is_tradable": True, "base_price": 117.46, "change_pct": -1.98},
        {"symbol": "LIQUIDBEES.NS", "display_symbol": "LIQUIDBEES", "name": "Nippon India ETF Liquid BeES", "sector": "ETFs & Hedge", "category": "ETF", "is_tradable": True, "base_price": 1000.0, "change_pct": 0.0},
    ],
    "benchmarks": [
        # 9. Market Benchmark (Non-Tradable Reference)
        {"symbol": "^NSEI", "display_symbol": "NIFTY 50", "name": "NIFTY 50 Spot Index (Benchmark)", "sector": "Benchmark Index", "category": "INDEX", "is_tradable": False, "base_price": 22687.75, "change_pct": -1.01},
    ]
}

# Lookup map for fast retrieval
ALL_TICKERS_MAP: Dict[str, Dict[str, Any]] = {}
for group_name, items in UNIVERSE_CONFIG.items():
    for item in items:
        item_copy = dict(item)
        item_copy["group"] = group_name
        item_copy["exchange"] = "NSE"
        item_copy["currency"] = "INR"
        ALL_TICKERS_MAP[item["symbol"]] = item_copy

# In-memory TTL Cache: {(ticker, period, interval): (timestamp, data)}
CACHE_STORE: Dict[str, tuple[float, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

# ==============================================================================
# 2. REALISTIC DETERMINISTIC FALLBACK GENERATOR
# ==============================================================================

def generate_deterministic_synthetic_ohlcv(
    ticker: str,
    period: str = "1y",
    interval: str = "1d"
) -> Dict[str, Any]:
    """
    Deterministic geometric Brownian motion generator anchored on realistic Indian market prices.
    Seeded with ticker symbol hash so results are completely reproducible across refreshes.
    Ensures the UI NEVER fails even if yfinance rate limits, fails, or network is down.
    """
    info = ALL_TICKERS_MAP.get(ticker, {
        "symbol": ticker,
        "display_symbol": ticker.replace(".NS", ""),
        "name": ticker,
        "category": "EQ",
        "is_tradable": True,
        "base_price": 1000.0,
        "currency": "INR",
        "exchange": "NSE"
    })
    
    base_price = info.get("base_price", 1000.0)
    
    # Map periods to number of trading days
    period_days_map = {
        "3m": 63,
        "3mo": 63,
        "6m": 126,
        "6mo": 126,
        "1y": 252,
        "2y": 504,
        "5y": 1260
    }
    num_days = period_days_map.get(period.lower(), 252)
    # Generate extra buffer for 200-day SMA and 20-day BB warmup
    total_sim_days = num_days + 200
    
    # Deterministic seed from ticker name
    seed_val = int(hashlib.md5(f"{ticker}_qalpha_v1".encode()).hexdigest()[:8], 16)
    rng = np.random.RandomState(seed_val)
    
    # Calendar business days ending on today
    today = datetime.now()
    dates = []
    curr = today
    while len(dates) < total_sim_days:
        if curr.weekday() < 5:  # Mon-Fri
            dates.append(curr.strftime("%Y-%m-%d"))
        curr -= timedelta(days=1)
    dates.reverse()
    
    # Price process simulation: Geometric Brownian Motion
    daily_vol = 0.012 if info.get("category") == "INDEX" else (0.009 if "GOLD" in ticker else 0.018)
    daily_drift = 0.0004  # ~10% annual drift
    
    log_returns = rng.normal(loc=daily_drift, scale=daily_vol, size=total_sim_days)
    log_returns[0] = 0.0
    
    # Compute cumulative prices backwards so latest close is close to base_price
    cum_ret = np.cumsum(log_returns)
    prices = base_price * np.exp(cum_ret - cum_ret[-1])
    
    # Precompute moving averages and Bollinger Bands
    close_series = pd.Series(prices)
    sma_200_series = close_series.rolling(window=200, min_periods=20).mean()
    bb_mid_series = close_series.rolling(window=20, min_periods=5).mean()
    bb_std_series = close_series.rolling(window=20, min_periods=5).std(ddof=0)
    bb_upper_series = bb_mid_series + 2.0 * bb_std_series
    bb_lower_series = bb_mid_series - 2.0 * bb_std_series

    all_candles = []
    prev_close = None
    
    for i, date_str in enumerate(dates):
        c = float(prices[i])
        day_noise = rng.uniform(0.004, 0.015)
        if i == 0:
            o = c * (1 + rng.uniform(-0.005, 0.005))
        else:
            o = float(prices[i-1]) * (1 + rng.uniform(-0.004, 0.004))
            
        h = max(o, c) * (1 + day_noise * rng.uniform(0.2, 0.9))
        l = min(o, c) * (1 - day_noise * rng.uniform(0.2, 0.9))
        
        base_vol = 15000000 if info.get("category") == "EQ" else (2500000 if info.get("category") == "ETF" else 450000)
        v = int(base_vol * rng.uniform(0.6, 2.2))
        
        sim_ret_pct = 0.0
        log_ret = 0.0
        if prev_close is not None and prev_close > 0:
            sim_ret_pct = round(((c - prev_close) / prev_close) * 100, 4)
            log_ret = round(float(np.log(c / prev_close)), 6)
            
        all_candles.append({
            "time": date_str,
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": v,
            "simple_return_pct": sim_ret_pct,
            "log_return": log_ret,
            "sma_200": round(float(sma_200_series.iloc[i]), 2) if not pd.isna(sma_200_series.iloc[i]) else None,
            "bb_upper": round(float(bb_upper_series.iloc[i]), 2) if not pd.isna(bb_upper_series.iloc[i]) else None,
            "bb_mid": round(float(bb_mid_series.iloc[i]), 2) if not pd.isna(bb_mid_series.iloc[i]) else None,
            "bb_lower": round(float(bb_lower_series.iloc[i]), 2) if not pd.isna(bb_lower_series.iloc[i]) else None,
        })
        prev_close = c
        
    # Slice only the requested lookback window
    candles = all_candles[-num_days:]
    latest = candles[-1]
    second_latest = candles[-2] if len(candles) > 1 else latest
    price_change = round(latest["close"] - second_latest["close"], 2)
    price_change_pct = latest["simple_return_pct"]
    daily_log_return = latest["log_return"]
    
    all_log_rets = [c["log_return"] for c in candles[1:]]
    ann_vol = float(np.std(all_log_rets) * np.sqrt(252) * 100) if len(all_log_rets) > 1 else 15.0
    
    return {
        "ticker": ticker,
        "display_symbol": info.get("display_symbol", ticker),
        "name": info.get("name", ticker),
        "category": info.get("category", "EQ"),
        "is_tradable": info.get("is_tradable", True),
        "currency": "INR",
        "exchange": "NSE",
        "period": period,
        "interval": interval,
        "is_synthetic": True,
        "metrics": {
            "latest_close": latest["close"],
            "prev_close": second_latest["close"],
            "change": price_change,
            "change_pct": price_change_pct,
            "daily_log_return": daily_log_return,
            "day_high": latest["high"],
            "day_low": latest["low"],
            "day_volume": latest["volume"],
            "annualized_volatility": round(ann_vol, 2),
            "data_points": len(candles),
            "indicators": {
                "sma_200": latest.get("sma_200"),
                "bb_upper": latest.get("bb_upper"),
                "bb_mid": latest.get("bb_mid"),
                "bb_lower": latest.get("bb_lower"),
            }
        },
        "candles": candles
    }

# ==============================================================================
# 3. YFINANCE LIVE FETCHER WITH RESILIENT DATA CLEANING & CACHING
# ==============================================================================

def fetch_real_or_fallback_ohlcv(
    ticker: str,
    period: str = "1y",
    interval: str = "1d"
) -> Dict[str, Any]:
    # Normalize period format
    period_norm = period.lower().replace("mo", "m")
    cache_key = f"{ticker}:{period_norm}:{interval}"
    
    # Check cache
    now = time.time()
    if cache_key in CACHE_STORE:
        cached_time, cached_val = CACHE_STORE[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return cached_val
            
    # Fetch at least 2y of data to guarantee 200 SMA and 20-day BB are fully warmed up across all timeframes
    yf_fetch_period = "5y" if period_norm == "5y" else "2y"
    
    info = ALL_TICKERS_MAP.get(ticker, {
        "symbol": ticker,
        "display_symbol": ticker.replace(".NS", ""),
        "name": ticker,
        "category": "EQ",
        "is_tradable": True,
        "currency": "INR",
        "exchange": "NSE"
    })

    try:
        logger.info(f"Fetching real OHLCV from yfinance for {ticker} (fetch_period={yf_fetch_period}, target={period_norm})...")
        t = yf.Ticker(ticker)
        df: pd.DataFrame = t.history(period=yf_fetch_period, interval=interval, auto_adjust=True)
        
        if df is None or df.empty or len(df) < 5:
            logger.warning(f"yfinance returned empty or insufficient data for {ticker}. Using deterministic fallback.")
            fallback = generate_deterministic_synthetic_ohlcv(ticker, period_norm, interval)
            CACHE_STORE[cache_key] = (now, fallback)
            return fallback

        # Clean NaNs and invalid rows
        df = df.dropna(subset=["Close", "Open", "High", "Low"])
        df = df[(df["Close"] > 0) & (df["Open"] > 0)]
        
        if len(df) < 5:
            logger.warning(f"After cleaning NaNs, insufficient rows for {ticker}. Using fallback.")
            fallback = generate_deterministic_synthetic_ohlcv(ticker, period_norm, interval)
            CACHE_STORE[cache_key] = (now, fallback)
            return fallback

        # Calculate Technical Indicators on full history: 200 SMA & Bollinger Bands (20, 2.0)
        df["sma_200"] = df["Close"].rolling(window=200, min_periods=20).mean()
        df["bb_mid"] = df["Close"].rolling(window=20, min_periods=5).mean()
        df["bb_std"] = df["Close"].rolling(window=20, min_periods=5).std(ddof=0)
        df["bb_upper"] = df["bb_mid"] + 2.0 * df["bb_std"]
        df["bb_lower"] = df["bb_mid"] - 2.0 * df["bb_std"]

        # Calculate daily simple return and daily log return: ln(C_t / C_{t-1})
        df["prev_close"] = df["Close"].shift(1)
        df["simple_return_pct"] = ((df["Close"] - df["prev_close"]) / df["prev_close"]) * 100.0
        df["log_return"] = np.log(df["Close"] / df["prev_close"])
        
        # Fill first row return with 0.0
        df["simple_return_pct"] = df["simple_return_pct"].fillna(0.0)
        df["log_return"] = df["log_return"].fillna(0.0)

        # Slice to the requested lookback window
        period_slice_map = {
            "3m": 63,
            "6m": 126,
            "1y": 252,
            "2y": 504,
            "5y": 1260
        }
        slice_count = period_slice_map.get(period_norm, 252)
        if len(df) > slice_count:
            df = df.iloc[-slice_count:]

        candles = []
        for index, row in df.iterrows():
            if isinstance(index, (pd.Timestamp, datetime)):
                date_str = index.strftime("%Y-%m-%d")
            else:
                date_str = str(index)[:10]
                
            candles.append({
                "time": date_str,
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if not pd.isna(row["Volume"]) else 0,
                "simple_return_pct": round(float(row["simple_return_pct"]), 4),
                "log_return": round(float(row["log_return"]), 6),
                "sma_200": round(float(row["sma_200"]), 2) if not pd.isna(row["sma_200"]) else None,
                "bb_upper": round(float(row["bb_upper"]), 2) if not pd.isna(row["bb_upper"]) else None,
                "bb_mid": round(float(row["bb_mid"]), 2) if not pd.isna(row["bb_mid"]) else None,
                "bb_lower": round(float(row["bb_lower"]), 2) if not pd.isna(row["bb_lower"]) else None,
            })

        latest = candles[-1]
        second_latest = candles[-2] if len(candles) > 1 else latest
        price_change = round(latest["close"] - second_latest["close"], 2)
        price_change_pct = latest["simple_return_pct"]
        daily_log_return = latest["log_return"]
        
        all_log_rets = [c["log_return"] for c in candles[1:]]
        ann_vol = float(np.std(all_log_rets) * np.sqrt(252) * 100) if len(all_log_rets) > 1 else 15.0

        result = {
            "ticker": ticker,
            "display_symbol": info.get("display_symbol", ticker),
            "name": info.get("name", ticker),
            "category": info.get("category", "EQ"),
            "is_tradable": info.get("is_tradable", True),
            "currency": "INR",
            "exchange": "NSE",
            "period": period_norm,
            "interval": interval,
            "is_synthetic": False,
            "metrics": {
                "latest_close": latest["close"],
                "prev_close": second_latest["close"],
                "change": price_change,
                "change_pct": price_change_pct,
                "daily_log_return": daily_log_return,
                "day_high": latest["high"],
                "day_low": latest["low"],
                "day_volume": latest["volume"],
                "annualized_volatility": round(ann_vol, 2),
                "data_points": len(candles),
                "indicators": {
                    "sma_200": latest.get("sma_200"),
                    "bb_upper": latest.get("bb_upper"),
                    "bb_mid": latest.get("bb_mid"),
                    "bb_lower": latest.get("bb_lower"),
                }
            },
            "candles": candles
        }
        
        CACHE_STORE[cache_key] = (now, result)
        return result

    except Exception as e:
        logger.error(f"Error fetching data from yfinance for {ticker}: {e}. Activating deterministic fallback.")
        fallback = generate_deterministic_synthetic_ohlcv(ticker, period_norm, interval)
        CACHE_STORE[cache_key] = (now, fallback)
        return fallback

# ==============================================================================
# 4. API ROUTE HANDLERS
# ==============================================================================

@app.get("/api/universe")
def get_universe():
    """
    Returns curated NSE universe categorized into:
    1. Tradable NSE Equities (Top 10 Institutional Bluechips)
    2. Tradable NSE ETFs (Nifty 50, Bank Nifty, IT, Gold)
    3. Market Benchmark (NIFTY 50 Spot Index, flagged with is_tradable: false)
    """
    return {
        "status": "success",
        "market": "NSE (National Stock Exchange of India)",
        "broker_target": "NSE Equity Delivery",
        "universe": UNIVERSE_CONFIG,
        "total_assets": sum(len(items) for items in UNIVERSE_CONFIG.values()),
        "tradable_count": sum(1 for items in UNIVERSE_CONFIG.values() for x in items if x.get("is_tradable", True))
    }

@app.get("/api/ohlcv/{ticker}")
def get_ohlcv(
    ticker: str,
    period: str = "1y",
    interval: str = "1d"
):
    """
    Fetches historical OHLCV data from yfinance with automated cleaning,
    daily simple return (%) and daily log return ln(C_t / C_{t-1}).
    Includes deterministic fallback generator if yfinance rate-limits or is offline.
    """
    period_str = str(period.default if hasattr(period, 'default') else period)
    interval_str = str(interval.default if hasattr(interval, 'default') else interval)
    ticker_clean = ticker.strip().upper()
    data = fetch_real_or_fallback_ohlcv(ticker_clean, period=period_str, interval=interval_str)
    return data

@app.get("/api/quant/forecast/{ticker}")
def get_quant_forecast(
    ticker: str,
    input_mode: str = "mlp_embedding",
    return_model: str = "auto_best",
    vol_model: str = "auto_best",
    horizon: int = 5,
    force_retrain: bool = False
):
    """
    Stage 2 Quantitative Forecast & Tail-Risk Endpoint:
    - Chronological 80/20 train/test split with horizon-day embargo gap
    - Input modes: 'log_returns' or 'mlp_embedding' (Denoised 3D Latent Bottleneck)
    - Return models: 'sarimax', 'lstm', 'auto_best'
    - Volatility models: 'gjr_garch', 'lstm_vol', 'auto_best'
    - Horizon: 3, 5, 7, 10 days
    - Analytical Student-t VaR (95%, 99%) and CVaR / Expected Shortfall
    - Multi-Horizon Swing Forecast Cone and visual charts data
    """
    from backend.quant_engine import run_quant_engine

    ticker_clean = ticker.strip().upper()
    # Fetch 3y data for training
    ohlcv = fetch_real_or_fallback_ohlcv(ticker_clean, period="3y", interval="1d")
    df = pd.DataFrame(ohlcv["candles"])

    if df.empty or len(df) < 50:
        raise HTTPException(status_code=400, detail=f"Insufficient historical data for {ticker_clean}")

    try:
        res = run_quant_engine(
            ticker=ticker_clean,
            raw_df=df,
            input_mode=input_mode,
            return_model=return_model,
            vol_model=vol_model,
            horizon=int(horizon),
            force_retrain=force_retrain
        )
        return res
    except Exception as e:
        logger.error(f"Error in quant engine for {ticker_clean}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ==============================================================================
# 5. STAGE 3: PORTFOLIO OPTIMIZATION & REGIME ENGINE ENDPOINTS
# ==============================================================================

from pydantic import BaseModel, Field

class PortfolioOptimizeRequest(BaseModel):
    capital: float = Field(default=1000000.0, description="Investable capital in INR")
    horizon: int = Field(default=5, description="Swing horizon in days (3, 5, 7, 10)")
    cvar_quantile: float = Field(default=0.05, description="Tail risk quantile (e.g. 0.05 for 95% CVaR)")
    max_portfolio_cvar: float = Field(default=0.035, description="Maximum allowed portfolio CVaR budget before cash scaling")
    no_trade_buffer: float = Field(default=0.025, description="No-trade deadband buffer zone (default 2.5%)")
    strategy_mode: str = Field(default="auto_regime", description="auto_regime, mpt, dalio_trc, rockafellar_cvar")
    selection_mode: str = Field(default="auto_quant_screen", description="auto_quant_screen or manual")
    selected_tickers: Optional[List[str]] = Field(default=None, description="Tickers when selection_mode=manual")
    max_weight: float = Field(default=0.35, description="Maximum allocation weight per asset")
    force_refresh: bool = Field(default=False, description="Bypass cache and recompute")

@app.post("/api/portfolio/optimize")
def optimize_portfolio_post(req: PortfolioOptimizeRequest):
    """
    Stage 4 Institutional Portfolio Optimization & Dynamic Risk Scaling Engine (POST)
    - Dynamic Cash Sweep (LIQUIDBEES.NS) & CVaR Exposure Scaling
    - 2.5% No-Trade Buffer Zone & Annualized Cost Savings
    - Bailey & López de Prado Probabilistic Sharpe Ratio (PSR)
    - GTT Bracket Execution Levels
    """
    from backend.portfolio_engine import run_portfolio_engine

    try:
        res = run_portfolio_engine(
            capital=float(req.capital),
            horizon=int(req.horizon),
            cvar_quantile=float(req.cvar_quantile),
            max_portfolio_cvar=float(req.max_portfolio_cvar),
            no_trade_buffer=float(req.no_trade_buffer),
            strategy_mode=req.strategy_mode,
            selection_mode=req.selection_mode,
            selected_tickers=req.selected_tickers,
            max_weight=float(req.max_weight),
            fetch_ohlcv_fn=fetch_real_or_fallback_ohlcv,
            force_refresh=req.force_refresh
        )
        return res
    except Exception as e:
        logger.error(f"Error in portfolio optimizer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio/optimize")
def optimize_portfolio_get(
    capital: float = 1000000.0,
    horizon: int = 5,
    cvar_quantile: float = 0.05,
    max_portfolio_cvar: float = 0.035,
    no_trade_buffer: float = 0.025,
    strategy_mode: str = "auto_regime",
    selection_mode: str = "auto_quant_screen",
    selected_tickers: Optional[str] = None,
    max_weight: float = 0.35,
    force_refresh: bool = False
):
    """
    Stage 4 Institutional Portfolio Optimization & Dynamic Risk Scaling Engine (GET)
    """
    from backend.portfolio_engine import run_portfolio_engine

    tickers_list = [t.strip().upper() for t in selected_tickers.split(",")] if selected_tickers else None

    try:
        res = run_portfolio_engine(
            capital=float(capital),
            horizon=int(horizon),
            cvar_quantile=float(cvar_quantile),
            max_portfolio_cvar=float(max_portfolio_cvar),
            no_trade_buffer=float(no_trade_buffer),
            strategy_mode=strategy_mode,
            selection_mode=selection_mode,
            selected_tickers=tickers_list,
            max_weight=float(max_weight),
            fetch_ohlcv_fn=fetch_real_or_fallback_ohlcv,
            force_refresh=force_refresh
        )
        return res
    except Exception as e:
        logger.error(f"Error in portfolio optimizer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ==============================================================================
# 6. CENTRALIZED USER AUTHENTICATION & SESSION PERSISTENCE
# ==============================================================================

USERS_FILE = os.path.join(os.path.dirname(__file__), "data", "users.json")

def load_persisted_users() -> List[Dict[str, Any]]:
    if not os.path.exists(USERS_FILE):
        os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
        default_users = [
            {
                "id": "admin_root",
                "userId": "1234",
                "password": "1234",
                "role": "admin",
                "name": "Administrator",
                "createdAt": "2026-10-22"
            },
            {
                "id": "user_default",
                "userId": "trader1",
                "password": "user123",
                "role": "user",
                "name": "Institutional Trader",
                "createdAt": "2026-10-22"
            }
        ]
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(default_users, f, indent=2)
        return default_users
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading users: {e}")
        return []

def save_persisted_users(users: List[Dict[str, Any]]) -> None:
    try:
        os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving users: {e}")

class LoginRequest(BaseModel):
    userId: str
    password: str

class UserCreateRequest(BaseModel):
    userId: str
    password: str
    name: str
    role: str = "user"

class UserUpdateRequest(BaseModel):
    userId: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None

@app.get("/api/auth/users")
def get_users_list():
    users = load_persisted_users()
    return {"status": "success", "users": users}

@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    users = load_persisted_users()
    req_uid = req.userId.strip().lower()
    for u in users:
        if u["userId"].strip().lower() == req_uid and u["password"] == req.password:
            return {"status": "success", "user": u}
    raise HTTPException(status_code=401, detail="Invalid User ID or password. Please verify credentials.")

@app.post("/api/auth/users")
def create_user(req: UserCreateRequest):
    users = load_persisted_users()
    req_uid = req.userId.strip()
    if any(u["userId"].strip().lower() == req_uid.lower() for u in users):
        raise HTTPException(status_code=400, detail=f"User ID '{req_uid}' already exists.")
    
    new_user = {
        "id": f"usr_{int(time.time()*1000)}",
        "userId": req_uid,
        "password": req.password,
        "name": req.name.strip(),
        "role": req.role if req.role in ["admin", "user"] else "user",
        "createdAt": datetime.now().strftime("%Y-%m-%d")
    }
    users.append(new_user)
    save_persisted_users(users)
    return {"status": "success", "user": new_user, "users": users}

@app.put("/api/auth/users/{user_id}")
def update_user(user_id: str, req: UserUpdateRequest):
    users = load_persisted_users()
    found = False
    updated_user = None
    for u in users:
        if u["id"] == user_id or u["userId"].lower() == user_id.lower():
            found = True
            if req.userId:
                if any(other["userId"].lower() == req.userId.strip().lower() and other["id"] != u["id"] for other in users):
                    raise HTTPException(status_code=400, detail=f"User ID '{req.userId}' is already in use.")
                u["userId"] = req.userId.strip()
            if req.password:
                u["password"] = req.password
            if req.name:
                u["name"] = req.name.strip()
            if req.role and req.role in ["admin", "user"]:
                u["role"] = req.role
            updated_user = u
            break
            
    if not found:
        raise HTTPException(status_code=404, detail="User not found.")
        
    save_persisted_users(users)
    return {"status": "success", "user": updated_user, "users": users}

@app.delete("/api/auth/users/{user_id}")
def delete_user(user_id: str, current_admin_id: Optional[str] = Query(None)):
    users = load_persisted_users()
    target = None
    for u in users:
        if u["id"] == user_id or u["userId"].lower() == user_id.lower():
            target = u
            break
            
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
        
    if current_admin_id and target["userId"].lower() == current_admin_id.lower():
        raise HTTPException(status_code=400, detail="Cannot delete your own active administrator account.")
        
    admin_count = sum(1 for u in users if u["role"] == "admin" and u["id"] != target["id"])
    if target["role"] == "admin" and admin_count == 0:
        raise HTTPException(status_code=400, detail="Cannot delete the sole administrator account.")
        
    users = [u for u in users if u["id"] != target["id"]]
    save_persisted_users(users)
    return {"status": "success", "message": f"User {target['userId']} deleted.", "users": users}

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": "Q-Alpha Quantitative Engine",
        "timestamp": datetime.now().isoformat(),
        "market_status": "OPEN",
        "cached_queries": len(CACHE_STORE)
    }

# Mount static frontend production build if available
import os
from fastapi.staticfiles import StaticFiles

dist_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
