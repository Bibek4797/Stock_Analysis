# Q-ALPHA // NSE Institutional Equity & Portfolio Terminal

An institutional-grade quantitative equity research, algorithmic forecasting, and multi-asset portfolio risk optimization terminal built for the Indian National Stock Exchange (NSE).

Designed with a high-density, low-latency dark-fintech interface inspired by modern professional trading workstations.

---

## Key Highlights

- **Predictive Econometric & Deep Learning Architecture:**
  - Multi-Horizon Expected Return Forecasting (SARIMAX with Fourier Seasonality & Bidirectional Deep LSTM).
  - Volatility & Tail Risk Modeling (GJR-GARCH with Glosten-Jagannathan-Runkle asymmetric leverage & Hybrid LSTM).
  - Latent Representation Learning (MLP Feature Embeddings vs. Raw Log Returns).
  - Automated Out-of-Sample Model Selection via tournament validation (RMSE, IC, and QLIKE loss scoring).

- **Multi-Strategy Portfolio Optimization:**
  - **Modern Portfolio Theory (Markowitz MPT):** Maximum Sharpe ratio tangent allocation.
  - **Equal Risk Contribution (Ray Dalio Risk Parity):** Total Risk Contribution (TRC) equilibrium.
  - **Rockafellar-Uryasev Convex Optimization:** Minimizes 95% Conditional Value at Risk (Expected Shortfall).
  - **Dynamic Regime Detection:** Automatically switches between Bullish Growth, Balanced Risk, and Defensive Crash-Protected modes based on NSE benchmark volatility.

- **Interactive Execution & Analytics Terminal:**
  - **Terminal:** Candlestick charts with forecast confidence cones, expected returns, 95% downside tail risk, and specific share allocation.
  - **Returns & Risk:** Rigorous model validation scorecards, parameter estimation, multi-horizon forecast tables, and distribution charts.
  - **Portfolio Manager:** Allocation lab, strategy comparison matrix, interactive stock selector popover, and historical equity curve backtests.
  - **Admin Control System:** Role-based access control (Admin & Trader), user directory management, credential updates, and local persistent session management.

---

## Architecture

```
Stock_Analysis/
├── backend/                  # FastAPI & Quantitative Analysis Engine
│   ├── main.py               # REST API endpoints & CORS middleware
│   ├── quant_engine.py       # Econometric forecasting & GJR-GARCH / LSTM models
│   ├── portfolio_engine.py   # MPT, Risk Parity & Rockafellar-Uryasev solvers
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React 18, Vite, TypeScript, TailwindCSS
│   ├── src/
│   │   ├── components/       # Reusable UI primitives, Navbars, Popovers
│   │   ├── screens/          # Terminal, Risk, Portfolio, Admin, Login screens
│   │   ├── data/             # Client-side quantitative solvers & market models
│   │   └── lib/              # Auth, formatters, and IST clock hooks
│   ├── vite.config.ts        # Vite configuration (with relative base for hosting)
│   └── package.json
└── .gitignore                # Security policy preventing credential leakage
```

---

## Quickstart

### 1. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Terminal interface will be live at `http://localhost:5173`.

### 2. Backend Setup (Optional for API Mode)
```bash
python -m venv venv
source venv/bin/activate  # Or `.\venv\Scripts\Activate.ps1` on Windows
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Authentication & Default Roles

The terminal includes built-in role-based access control:
- **Administrator:** User ID `1234` | Password `1234`
  - Access to all trading screens + Admin User Management screen to add, edit, or delete accounts.
- **Institutional Trader:** User ID `trader1` | Password `user123`
  - Access to Terminal, Returns & Risk, and Portfolio Manager.

---

## License
Proprietary & Confidential. Institutional research use only.
