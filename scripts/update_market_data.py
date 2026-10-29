import yfinance as yf
import json
import os
from datetime import datetime, timezone, timedelta

# Indian Standard Time (IST: UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

TICKERS_MAP = {
    # 1. Banking & Finance
    "HDFCBANK": "HDFCBANK.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "SBIN": "SBIN.NS",
    "KOTAKBANK": "KOTAKBANK.NS",
    "AXISBANK": "AXISBANK.NS",
    "BAJFINANCE": "BAJFINANCE.NS",
    "BAJAJFINSV": "BAJAJFINSV.NS",
    "INDUSINDBK": "INDUSINDBK.NS",

    # 2. IT & Technology
    "TCS": "TCS.NS",
    "INFY": "INFY.NS",
    "HCLTECH": "HCLTECH.NS",
    "WIPRO": "WIPRO.NS",
    "TECHM": "TECHM.NS",
    "PERSISTENT": "PERSISTENT.NS",

    # 3. Energy, Oil & Power
    "RELIANCE": "RELIANCE.NS",
    "ONGC": "ONGC.NS",
    "NTPC": "NTPC.NS",
    "POWERGRID": "POWERGRID.NS",
    "COALINDIA": "COALINDIA.NS",
    "TATAPOWER": "TATAPOWER.NS",

    # 4. Auto & EV
    "HEROMOTOCO": "HEROMOTOCO.NS",
    "M&M": "M&M.NS",
    "MARUTI": "MARUTI.NS",
    "BAJAJ-AUTO": "BAJAJ-AUTO.NS",
    "EICHERMOT": "EICHERMOT.NS",

    # 5. Pharma & Healthcare
    "SUNPHARMA": "SUNPHARMA.NS",
    "DRREDDY": "DRREDDY.NS",
    "CIPLA": "CIPLA.NS",
    "APOLLOHOSP": "APOLLOHOSP.NS",

    # 6. FMCG & Consumer
    "ITC": "ITC.NS",
    "HINDUNILVR": "HINDUNILVR.NS",
    "TITAN": "TITAN.NS",
    "NESTLEIND": "NESTLEIND.NS",
    "ASIANPAINT": "ASIANPAINT.NS",

    # 7. Metals, Infra & Telecom
    "LT": "LT.NS",
    "BHARTIARTL": "BHARTIARTL.NS",
    "TATASTEEL": "TATASTEEL.NS",
    "HINDALCO": "HINDALCO.NS",
    "ULTRACEMCO": "ULTRACEMCO.NS",

    # 8. ETFs & Safe Hedge
    "NIFTYBEES": "NIFTYBEES.NS",
    "BANKBEES": "BANKBEES.NS",
    "ITBEES": "ITBEES.NS",
    "JUNIORBEES": "JUNIORBEES.NS",
    "GOLDBEES": "GOLDBEES.NS",
    "LIQUIDBEES": "LIQUIDBEES.NS"
}

RAW_DEFS = [
    ("HDFCBANK", "HDFC Bank Ltd", "Bank", "Banking & Finance", 0.198, 0.0042),
    ("ICICIBANK", "ICICI Bank Ltd", "Bank", "Banking & Finance", 0.214, 0.0061),
    ("SBIN", "State Bank of India", "Bank", "Banking & Finance", 0.238, 0.0034),
    ("KOTAKBANK", "Kotak Mahindra Bank Ltd", "Bank", "Banking & Finance", 0.221, 0.0014),
    ("AXISBANK", "Axis Bank Ltd", "Bank", "Banking & Finance", 0.241, 0.0033),
    ("BAJFINANCE", "Bajaj Finance Ltd", "Bank", "Banking & Finance", 0.285, 0.0068),
    ("BAJAJFINSV", "Bajaj Finserv Ltd", "Bank", "Banking & Finance", 0.272, 0.0042),
    ("INDUSINDBK", "IndusInd Bank Ltd", "Bank", "Banking & Finance", 0.334, -0.0015),
    ("TCS", "Tata Consultancy Services Ltd", "IT", "IT & Technology", 0.186, 0.0044),
    ("INFY", "Infosys Ltd", "IT", "IT & Technology", 0.214, 0.0039),
    ("HCLTECH", "HCL Technologies Ltd", "IT", "IT & Technology", 0.204, 0.0043),
    ("WIPRO", "Wipro Ltd", "IT", "IT & Technology", 0.236, 0.0016),
    ("TECHM", "Tech Mahindra Ltd", "IT", "IT & Technology", 0.262, -0.0008),
    ("PERSISTENT", "Persistent Systems Ltd", "IT", "IT & Technology", 0.258, 0.0037),
    ("RELIANCE", "Reliance Industries Ltd", "Energy", "Energy, Oil & Power", 0.242, 0.0057),
    ("ONGC", "Oil & Natural Gas Corporation Ltd", "Energy", "Energy, Oil & Power", 0.284, 0.0009),
    ("NTPC", "NTPC Ltd", "Energy", "Energy, Oil & Power", 0.226, 0.0031),
    ("POWERGRID", "Power Grid Corporation of India", "Energy", "Energy, Oil & Power", 0.198, 0.0026),
    ("COALINDIA", "Coal India Ltd", "Energy", "Energy, Oil & Power", 0.254, 0.0011),
    ("TATAPOWER", "Tata Power Company Ltd", "Energy", "Energy, Oil & Power", 0.318, 0.0028),
    ("HEROMOTOCO", "Hero MotoCorp Ltd", "Auto", "Auto & EV", 0.232, 0.0032),
    ("M&M", "Mahindra & Mahindra Ltd", "Auto", "Auto & EV", 0.256, 0.0048),
    ("MARUTI", "Maruti Suzuki India Ltd", "Auto", "Auto & EV", 0.218, 0.0046),
    ("BAJAJ-AUTO", "Bajaj Auto Ltd", "Auto", "Auto & EV", 0.232, 0.0031),
    ("EICHERMOT", "Eicher Motors Ltd", "Auto", "Auto & EV", 0.244, 0.0038),
    ("SUNPHARMA", "Sun Pharmaceutical Industries Ltd", "Pharma", "Pharma & Healthcare", 0.192, 0.0044),
    ("DRREDDY", "Dr. Reddy's Laboratories Ltd", "Pharma", "Pharma & Healthcare", 0.206, 0.0013),
    ("CIPLA", "Cipla Ltd", "Pharma", "Pharma & Healthcare", 0.198, 0.0034),
    ("APOLLOHOSP", "Apollo Hospitals Enterprise Ltd", "Pharma", "Pharma & Healthcare", 0.228, 0.0029),
    ("ITC", "ITC Ltd", "FMCG", "FMCG & Consumer", 0.176, 0.0022),
    ("HINDUNILVR", "Hindustan Unilever Ltd", "FMCG", "FMCG & Consumer", 0.168, 0.0008),
    ("TITAN", "Titan Company Ltd", "FMCG", "FMCG & Consumer", 0.235, 0.0045),
    ("NESTLEIND", "Nestle India Ltd", "FMCG", "FMCG & Consumer", 0.172, -0.0006),
    ("ASIANPAINT", "Asian Paints Ltd", "FMCG", "FMCG & Consumer", 0.224, 0.0012),
    ("LT", "Larsen & Toubro Ltd", "Metals", "Metals, Infra & Telecom", 0.228, 0.0041),
    ("BHARTIARTL", "Bharti Airtel Ltd", "Metals", "Metals, Infra & Telecom", 0.215, 0.0055),
    ("TATASTEEL", "Tata Steel Ltd", "Metals", "Metals, Infra & Telecom", 0.326, -0.0016),
    ("HINDALCO", "Hindalco Industries Ltd", "Metals", "Metals, Infra & Telecom", 0.302, 0.0039),
    ("ULTRACEMCO", "UltraTech Cement Ltd", "Metals", "Metals, Infra & Telecom", 0.212, 0.0028),
    ("NIFTYBEES", "Nippon India ETF Nifty 50 BeES", "ETF", "ETFs & Hedge", 0.142, 0.0021),
    ("BANKBEES", "Nippon India ETF Nifty Bank BeES", "ETF", "ETFs & Hedge", 0.178, 0.0026),
    ("ITBEES", "Nippon India ETF Nifty IT", "ETF", "ETFs & Hedge", 0.196, 0.0031),
    ("JUNIORBEES", "Nippon India ETF Nifty Next 50", "ETF", "ETFs & Hedge", 0.185, 0.0028),
    ("GOLDBEES", "Nippon India ETF Gold BeES", "ETF", "ETFs & Hedge", 0.124, 0.0012),
    ("LIQUIDBEES", "Nippon India ETF Liquid BeES", "ETF", "ETFs & Hedge", 0.004, 0.00025)
]

def run_update():
    output_history = {}
    today_settled_prices = {}

    print(f"Scraping exact settled closing prices for {len(TICKERS_MAP)} symbols...")

    for sym, yf_sym in TICKERS_MAP.items():
        try:
            t = yf.Ticker(yf_sym)
            df = t.history(period="1y", auto_adjust=True)
            if df.empty:
                continue

            bars = []
            for idx, row in df.iterrows():
                ts = int(idx.timestamp() * 1000)
                bars.append({
                    "t": ts,
                    "o": round(float(row["Open"]), 2),
                    "h": round(float(row["High"]), 2),
                    "l": round(float(row["Low"]), 2),
                    "c": round(float(row["Close"]), 2),
                    "v": int(row["Volume"]) if "Volume" in row and not row["Volume"] != row["Volume"] else 100000
                })

            output_history[sym] = bars
            output_history[yf_sym] = bars

            last_bar = bars[-1]
            prev_bar = bars[-2] if len(bars) > 1 else last_bar
            chg_pct = round(((last_bar["c"] / prev_bar["c"]) - 1) * 100, 2)
            date_str = datetime.fromtimestamp(last_bar["t"] / 1000, tz=IST).strftime("%Y-%m-%d")

            today_settled_prices[sym] = {
                "price": last_bar["c"],
                "close": last_bar["c"],
                "prev_close": prev_bar["c"],
                "open": last_bar["o"],
                "high": last_bar["h"],
                "low": last_bar["l"],
                "change_pct": chg_pct,
                "date": date_str
            }
            print(f"[OK] {sym} ({date_str}): Close INR {last_bar['c']} (Prev: INR {prev_bar['c']}, Chg: {chg_pct}%)")
        except Exception as e:
            print(f"Error for {sym}: {e}")

    # 1. Write real_history.json
    history_path = "frontend/src/data/real_history.json"
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(output_history, f)
    print(f"Saved authentic history to {history_path}")

    # 1b. Write live_quotes.json for runtime dynamic client fetch
    now_str = datetime.now(tz=IST).strftime("%Y-%m-%dT%H:%M:%S")
    sample_sym = next(iter(today_settled_prices.keys())) if today_settled_prices else None
    market_date_val = today_settled_prices[sample_sym]["date"] if sample_sym else datetime.now(tz=IST).strftime("%Y-%m-%d")
    quotes_payload = {
        "updated_at": now_str,
        "market_date": market_date_val,
        "quotes": today_settled_prices
    }
    for q_path in ["frontend/public/live_quotes.json", "frontend/src/data/live_quotes.json"]:
        os.makedirs(os.path.dirname(q_path), exist_ok=True)
        with open(q_path, "w", encoding="utf-8") as f:
            json.dump(quotes_payload, f, indent=2)
    print("Saved live_quotes.json to public/ and src/data/ successfully!")

    # 2. Write market.ts RAW
    raw_lines = ["const RAW: Raw[] = ["]
    current_sector = None

    for item in RAW_DEFS:
        sym, name, sec, secl, vol, drift = item
        if sec != current_sector:
            current_sector = sec
            raw_lines.append(f"\n  // {secl}")

        price = today_settled_prices.get(sym, {}).get("close", 1000.0)
        chg = today_settled_prices.get(sym, {}).get("change_pct", 0.0)
        drift_str = f", {drift}" if drift is not None else ""
        escaped_name = name.replace("'", "\\'")
        raw_lines.append(f"  ['{sym}', '{escaped_name}', '{sec}', '{secl}', {price:.2f}, {chg:.2f}, {vol}{drift_str}],")

    raw_lines.append("]")
    raw_block = "\n".join(raw_lines)

    market_path = "frontend/src/data/market.ts"
    with open(market_path, "r", encoding="utf-8") as f:
        text = f.read()

    start = text.find("const RAW: Raw[] = [")
    end = text.find("export const STOCKS: Stock[] = RAW.map(")

    new_text = text[:start] + raw_block + "\n\n" + text[end:]

    with open(market_path, "w", encoding="utf-8") as f:
        f.write(new_text)

    print(f"Updated {market_path} successfully!")

    # 3. Write backend/main.py UNIVERSE_CONFIG
    main_py_path = "backend/main.py"
    if os.path.exists(main_py_path):
        with open(main_py_path, "r", encoding="utf-8") as f:
            m_lines = f.readlines()

        new_m_lines = []
        for line in m_lines:
            m = re.search(r'"display_symbol":\s*"([^"]+)"', line)
            if not m:
                m = re.search(r'"symbol":\s*"([^"]+)"', line)
            if m:
                s_name = m.group(1).replace(".NS", "")
                if s_name in today_settled_prices:
                    p = today_settled_prices[s_name]["close"]
                    c = today_settled_prices[s_name]["change_pct"]
                    line = re.sub(r'"base_price":\s*[\d\.]+', f'"base_price": {p}', line)
                    line = re.sub(r'"change_pct":\s*[-]?[\d\.]+', f'"change_pct": {c}', line)
            new_m_lines.append(line)

        with open(main_py_path, "w", encoding="utf-8", newline="\r\n") as f:
            f.writelines(new_m_lines)
        print(f"Updated {main_py_path} UNIVERSE_CONFIG successfully!")

if __name__ == "__main__":
    import re
    run_update()
