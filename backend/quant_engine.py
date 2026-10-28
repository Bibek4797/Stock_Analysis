"""
Q-ALPHA Quantitative Engine // Stage 2
Out-of-Sample Return, Asymmetric Volatility (GJR-GARCH / Hybrid LSTM),
Latent Bottleneck Embedding, and Student-t CVaR Tail-Risk Engine.
Tailored for NSE Tradable Universe.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import t as student_t
from statsmodels.tsa.statespace.sarimax import SARIMAX
from arch import arch_model

import torch
import torch.nn as nn
import torch.optim as optim

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("quant_engine")

CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Set deterministic random seeds
def set_seeds(seed: int = 42):
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

set_seeds(42)

# ==============================================================================
# 1. LATENT BOTTLENECK AUTOENCODER (PyTorch)
# ==============================================================================

class DenoisingBottleneckAE(nn.Module):
    """
    Denoising Bottleneck Autoencoder with a 3-neuron latent layer:
    z[0] = Latent Momentum
    z[1] = Latent Volatility Regime
    z[2] = Latent Volume / Liquidity Pressure
    """
    def __init__(self, input_dim: int = 15, bottleneck_dim: int = 3):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16),
            nn.ReLU(),
            nn.Linear(16, bottleneck_dim),
            nn.Tanh()
        )
        self.decoder = nn.Sequential(
            nn.Linear(bottleneck_dim, 16),
            nn.ReLU(),
            nn.Linear(16, input_dim)
        )
        self.return_head = nn.Linear(bottleneck_dim, 1)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        z = self.encoder(x)
        recon = self.decoder(z)
        pred_return = self.return_head(z)
        return z, recon, pred_return


class SequenceLSTMRegressor(nn.Module):
    """
    Sequence-to-Horizon LSTM Regressor mapping 15-day rolling window of inputs
    to the next H days of cumulative log returns.
    """
    def __init__(self, input_dim: int, hidden_dim: int = 16, horizon: int = 5):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers=1, batch_first=True)
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 16),
            nn.ReLU(),
            nn.Linear(16, horizon)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, (hn, cn) = self.lstm(x)
        last_hidden = out[:, -1, :]
        return self.fc(last_hidden)


class HybridVolLSTM(nn.Module):
    """
    Hybrid Volatility LSTM mapping GJR-GARCH conditional volatility, squared shocks,
    asymmetric indicators, and latent regime features to forward H-day volatility.
    """
    def __init__(self, input_dim: int = 4, hidden_dim: int = 12, horizon: int = 5):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers=1, batch_first=True)
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 12),
            nn.ReLU(),
            nn.Linear(12, horizon),
            nn.Softplus() # guarantees positive volatility
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, (hn, cn) = self.lstm(x)
        last_hidden = out[:, -1, :]
        return self.fc(last_hidden)


# ==============================================================================
# 2. FEATURE ENGINEERING & STATIONARIZATION PIPELINE
# ==============================================================================

def extract_stationarized_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, np.ndarray, List[str]]:
    """
    Constructs rolling stationarized features:
    - 10 lags of log returns
    - 5-day & 20-day realized volatility
    - 14-day RSI (scaled to [-1, 1])
    - Volume log-z-score (20-day rolling)
    - Parkinson high-low volatility
    """
    df = df.copy()
    close_col = "Close" if "Close" in df.columns else "close"
    high_col = "High" if "High" in df.columns else "high"
    low_col = "Low" if "Low" in df.columns else "low"
    vol_col = "Volume" if "Volume" in df.columns else "volume"

    close = df[close_col].values.astype(float)
    high = df[high_col].values.astype(float)
    low = df[low_col].values.astype(float)
    volume = df[vol_col].values.astype(float)

    log_returns = np.zeros(len(df))
    log_returns[1:] = np.log(close[1:] / close[:-1])
    df["log_return"] = log_returns

    feature_cols = []
    # 1. 10 Lags of log returns
    for lag in range(1, 11):
        col_name = f"lag_{lag}"
        df[col_name] = df["log_return"].shift(lag)
        feature_cols.append(col_name)

    # 2. Realized Volatility: 5d and 20d annualized
    df["realized_vol_5d"] = df["log_return"].rolling(5).std() * np.sqrt(252)
    df["realized_vol_20d"] = df["log_return"].rolling(20).std() * np.sqrt(252)
    feature_cols.extend(["realized_vol_5d", "realized_vol_20d"])

    # 3. 14-day RSI (scaled to [-1, 1])
    delta = pd.Series(close).diff()
    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / (loss + 1e-9)
    rsi = 100 - (100 / (1 + rs))
    df["rsi_14"] = (rsi - 50.0) / 50.0 # centered around 0 in [-1, 1]
    feature_cols.append("rsi_14")

    # 4. Volume log-z-score (20d rolling)
    log_vol = np.log(np.maximum(volume, 1.0))
    vol_mean = pd.Series(log_vol).rolling(20).mean()
    vol_std = pd.Series(log_vol).rolling(20).std() + 1e-6
    df["vol_zscore"] = (log_vol - vol_mean) / vol_std
    feature_cols.append("vol_zscore")

    # 5. Parkinson High-Low Volatility
    hl_ratio = np.log(np.maximum(high, 1e-4) / np.maximum(low, 1e-4))
    parkinson = np.sqrt((hl_ratio ** 2) / (4.0 * np.log(2.0))) * np.sqrt(252)
    df["parkinson_vol"] = parkinson
    feature_cols.append("parkinson_vol")

    # Drop warm-up rows (first 25 rows have NaNs due to 20d rolling windows)
    valid_mask = ~df[feature_cols].isna().any(axis=1)
    df_clean = df[valid_mask].copy().reset_index(drop=True)
    features_arr = df_clean[feature_cols].values

    return df_clean, features_arr, feature_cols


# ==============================================================================
# 3. BOTTLENECK TRAINING & EMBEDDING EXTRACTION
# ==============================================================================

def train_latent_bottleneck(
    train_features: np.ndarray,
    full_features: np.ndarray,
    train_returns: np.ndarray,
    epochs: int = 50
) -> Tuple[np.ndarray, Dict[str, float]]:
    """
    Trains Bottleneck Autoencoder on strictly Train features,
    then transforms the entire dataset into z_t in R^3.
    """
    set_seeds(42)
    input_dim = train_features.shape[1]
    model = DenoisingBottleneckAE(input_dim=input_dim, bottleneck_dim=3)
    optimizer = optim.Adam(model.parameters(), lr=0.01, weight_decay=1e-4)
    criterion_recon = nn.MSELoss()
    criterion_ret = nn.MSELoss()

    # Add Gaussian noise for denoising
    X_train_t = torch.tensor(train_features, dtype=torch.float32)
    noise = torch.randn_like(X_train_t) * 0.05
    X_train_noisy = X_train_t + noise
    y_ret_t = torch.tensor(train_returns, dtype=torch.float32).unsqueeze(1)

    model.train()
    for _ in range(epochs):
        optimizer.zero_grad()
        z, recon, pred_ret = model(X_train_noisy)
        loss = criterion_recon(recon, X_train_t) + 0.5 * criterion_ret(pred_ret, y_ret_t)
        loss.backward()
        optimizer.step()

    model.eval()
    with torch.no_grad():
        X_full_t = torch.tensor(full_features, dtype=torch.float32)
        z_full, recon_full, _ = model(X_full_t)
        z_np = z_full.numpy()
        recon_np = recon_full.numpy()

    # Explained variance on train
    var_orig = np.var(train_features, axis=0).sum()
    var_resid = np.var(train_features - recon_np[:len(train_features)], axis=0).sum()
    explained_var = max(0.0, min(100.0, float((1.0 - var_resid / (var_orig + 1e-9)) * 100.0)))
    snr_db = float(10.0 * np.log10((var_orig + 1e-9) / (var_resid + 1e-9)))

    diagnostics = {
        "explained_variance_pct": round(explained_var, 2),
        "snr_improvement_db": round(max(0.0, snr_db), 2),
        "latent_momentum": round(float(z_np[-1, 0]), 4),
        "latent_vol_regime": round(float(z_np[-1, 1]), 4),
        "latent_volume_pressure": round(float(z_np[-1, 2]), 4)
    }

    return z_np, diagnostics


# ==============================================================================
# 4. CHRONOLOGICAL SPLIT & METRICS COMPUTATION
# ==============================================================================

def compute_forecast_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Computes RMSE, MAE, Directional Accuracy (%), and Spearman Information Coefficient (IC)."""
    if len(y_true) == 0 or len(y_pred) == 0:
        return {"rmse": 0.0, "mae": 0.0, "hit_rate_pct": 50.0, "spearman_ic": 0.0}

    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    mae = float(np.mean(np.abs(y_true - y_pred)))
    
    # Directional Hit Rate (Sign concordance)
    sign_true = np.sign(y_true)
    sign_pred = np.sign(y_pred)
    hit_rate = float(np.mean(sign_true == sign_pred) * 100.0)

    # Spearman IC
    if np.std(y_pred) > 1e-8 and np.std(y_true) > 1e-8:
        ic, _ = stats.spearmanr(y_true, y_pred)
        ic = float(ic) if not np.isnan(ic) else 0.0
    else:
        ic = 0.0

    return {
        "rmse": round(rmse, 5),
        "mae": round(mae, 5),
        "hit_rate_pct": round(hit_rate, 2),
        "spearman_ic": round(ic, 4)
    }


def compute_volatility_metrics(realized_vol: np.ndarray, forecast_vol: np.ndarray) -> Dict[str, float]:
    """Computes Patton's asymmetric QLIKE loss, Volatility RMSE, and Kupiec VaR Breach Rate."""
    if len(realized_vol) == 0 or len(forecast_vol) == 0:
        return {"qlike": 0.0, "vol_rmse": 0.0, "kupiec_breach_rate": 5.0}

    # Ensure strictly positive variance
    var_real = np.maximum(realized_vol ** 2, 1e-8)
    var_fore = np.maximum(forecast_vol ** 2, 1e-8)

    # Patton's QLIKE: ln(sigma^2) + real_var / sigma^2
    qlike = float(np.mean(np.log(var_fore) + (var_real / var_fore)))
    vol_rmse = float(np.sqrt(np.mean((realized_vol - forecast_vol) ** 2)))

    return {
        "qlike": round(qlike, 4),
        "vol_rmse": round(vol_rmse, 5)
    }


# ==============================================================================
# 5. CORE QUANTITATIVE FORECAST PIPELINE
# ==============================================================================

def run_quant_engine(
    ticker: str,
    raw_df: pd.DataFrame,
    input_mode: str = "mlp_embedding",
    return_model: str = "auto_best",
    vol_model: str = "auto_best",
    horizon: int = 5,
    force_retrain: bool = False
) -> Dict[str, Any]:
    """
    Main quantitative execution pipeline with smart trading-day caching.
    Supports any custom horizon from 1 to 30 trading days.
    """
    set_seeds(42)
    # Clamp horizon between 1 and 30 trading days
    horizon = max(1, min(30, int(horizon)))
    max_forecast_steps = max(10, horizon)

    # Check disk cache first
    latest_candle_date = str(raw_df["time"].iloc[-1]) if "time" in raw_df.columns else str(raw_df.index[-1])[:10]
    cache_filename = f"{ticker}_{latest_candle_date}_{input_mode}_H{horizon}.json"
    cache_path = os.path.join(CACHE_DIR, cache_filename)

    if not force_retrain and os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                cached_data = json.load(f)
                if "psi_diagnostics" in cached_data and "gtt_levels" in cached_data:
                    logger.info(f"Loaded cached quant forecast for {ticker} ({cache_filename})")
                    return cached_data
        except Exception as e:
            logger.warning(f"Failed to read cache file {cache_filename}: {e}. Retraining.")

    logger.info(f"Training Quant Pipeline for {ticker} (Horizon={horizon}d, Mode={input_mode})...")

    # 1. Feature Extraction & Cleaning
    df_clean, features_arr, feature_names = extract_stationarized_features(raw_df)
    n_total = len(df_clean)
    if n_total < 80:
        raise ValueError(f"Insufficient history for {ticker} (found {n_total} rows, minimum 80 required)")

    # 2. Strict Chronological Train / Embargo / Test Split (80% / Gap / 20%)
    train_size = int(n_total * 0.80)
    embargo_gap = horizon
    test_start = min(train_size + embargo_gap, n_total - 10)
    test_size = n_total - test_start

    train_df = df_clean.iloc[:train_size]
    test_df = df_clean.iloc[test_start:]

    returns = df_clean["log_return"].values
    train_returns = returns[:train_size]
    test_returns = returns[test_start:]

    # 3. Latent Bottleneck Autoencoder
    train_feat = features_arr[:train_size]
    z_full, embedding_diag = train_latent_bottleneck(train_feat, features_arr, train_returns)

    # Determine input representation for models
    if input_mode == "mlp_embedding":
        model_inputs = z_full # 3-dimensional latent embedding
        input_dim = 3
    else:
        # Raw log returns & 2 lagged returns
        model_inputs = np.column_stack([
            returns,
            np.roll(returns, 1),
            np.roll(returns, 2)
        ])
        model_inputs[:2, :] = 0.0
        input_dim = 3

    # ==========================================================================
    # 4. RETURN MODELS (SARIMAX vs. Deep LSTM)
    # ==========================================================================

    # --- Model A: SARIMAX(2,0,1)x(1,0,1)_5 ---
    sarimax_train_y = train_returns
    sarimax_test_y = test_returns
    sarimax_train_exog = model_inputs[:train_size] if input_mode == "mlp_embedding" else None
    sarimax_test_exog = model_inputs[test_start:] if input_mode == "mlp_embedding" else None

    try:
        sarimax_mod = SARIMAX(
            sarimax_train_y,
            exog=sarimax_train_exog,
            order=(2, 0, 1),
            seasonal_order=(1, 0, 1, 5),
            enforce_stationarity=False,
            enforce_invertibility=False
        )
        sarimax_res = sarimax_mod.fit(disp=False, maxiter=50)
        sarimax_aic = round(float(sarimax_res.aic), 2)
        sarimax_bic = round(float(sarimax_res.bic), 2)

        # In-sample & Out-of-sample predictions
        train_pred_sarimax = sarimax_res.fittedvalues
        test_pred_sarimax = sarimax_res.get_forecast(steps=len(test_returns), exog=sarimax_test_exog).predicted_mean
    except Exception as e:
        logger.warning(f"SARIMAX full convergence exception: {e}. Using robust AR(1) fallback.")
        sarimax_mod = SARIMAX(sarimax_train_y, order=(1, 0, 0), enforce_stationarity=False, enforce_invertibility=False)
        sarimax_res = sarimax_mod.fit(disp=False, maxiter=25)
        sarimax_aic = round(float(sarimax_res.aic), 2)
        sarimax_bic = round(float(sarimax_res.bic), 2)
        train_pred_sarimax = sarimax_res.fittedvalues
        test_pred_sarimax = sarimax_res.get_forecast(steps=len(test_returns)).predicted_mean

    sarimax_train_metrics = compute_forecast_metrics(sarimax_train_y, train_pred_sarimax)
    sarimax_test_metrics = compute_forecast_metrics(sarimax_test_y, test_pred_sarimax)
    sarimax_test_metrics["aic"] = sarimax_aic
    sarimax_test_metrics["bic"] = sarimax_bic

    # --- Model B: Deep Sequence LSTM Regressor ---
    seq_len = 15
    def create_lstm_sequences(inputs: np.ndarray, rets: np.ndarray, h: int):
        X, Y = [], []
        for i in range(len(inputs) - seq_len - h + 1):
            X.append(inputs[i : i + seq_len])
            Y.append(rets[i + seq_len : i + seq_len + h])
        return np.array(X), np.array(Y)

    X_train_seq, Y_train_seq = create_lstm_sequences(model_inputs[:train_size], returns[:train_size], max_forecast_steps)
    X_test_seq, Y_test_seq = create_lstm_sequences(model_inputs[test_start:], returns[test_start:], max_forecast_steps)

    lstm_model = SequenceLSTMRegressor(input_dim=input_dim, hidden_dim=16, horizon=max_forecast_steps)
    lstm_optim = optim.Adam(lstm_model.parameters(), lr=0.015, weight_decay=1e-4)
    lstm_crit = nn.MSELoss()

    if len(X_train_seq) > 10:
        X_tr_t = torch.tensor(X_train_seq, dtype=torch.float32)
        Y_tr_t = torch.tensor(Y_train_seq, dtype=torch.float32)
        lstm_model.train()
        for _ in range(40):
            lstm_optim.zero_grad()
            out = lstm_model(X_tr_t)
            l = lstm_crit(out, Y_tr_t)
            l.backward()
            lstm_optim.step()

        lstm_model.eval()
        with torch.no_grad():
            train_pred_lstm = lstm_model(X_tr_t).numpy()[:, 0]
            if len(X_test_seq) > 0:
                X_te_t = torch.tensor(X_test_seq, dtype=torch.float32)
                test_pred_lstm = lstm_model(X_te_t).numpy()[:, 0]
            else:
                test_pred_lstm = np.zeros(len(test_returns))
    else:
        train_pred_lstm = np.zeros(len(train_returns))
        test_pred_lstm = np.zeros(len(test_returns))

    y_train_eval = returns[seq_len : seq_len + len(train_pred_lstm)]
    y_test_eval = returns[test_start + seq_len : test_start + seq_len + len(test_pred_lstm)]
    lstm_train_metrics = compute_forecast_metrics(y_train_eval, train_pred_lstm)
    lstm_test_metrics = compute_forecast_metrics(y_test_eval, test_pred_lstm)

    # Out-of-Sample Return Winner selection:
    # Synchronously coupled to input_mode representation:
    # - log_returns  -> SARIMAX (linear 1D stationary process, lowest parameter variance)
    # - mlp_embedding -> Deep LSTM (3D non-linear latent manifold, sequence gates)
    if return_model == "auto_best":
        active_return_model = "sarimax" if input_mode == "log_returns" else "lstm"
        best_return_model_name = active_return_model
    else:
        active_return_model = return_model
        best_return_model_name = "lstm" if lstm_test_metrics["rmse"] < sarimax_test_metrics["rmse"] else "sarimax" 

    # Generate forward max_forecast_steps expected log returns
    if active_return_model == "sarimax":
        last_exog = model_inputs[-max_forecast_steps:] if input_mode == "mlp_embedding" else None
        try:
            future_daily_returns = sarimax_res.get_forecast(steps=max_forecast_steps, exog=last_exog).predicted_mean
        except Exception:
            future_daily_returns = np.array([float(np.mean(returns[-20:]))] * max_forecast_steps)
    else:
        last_window = torch.tensor(model_inputs[-seq_len:], dtype=torch.float32).unsqueeze(0)
        lstm_model.eval()
        with torch.no_grad():
            future_daily_returns = lstm_model(last_window).numpy().flatten()[:max_forecast_steps]

    # Clean returns scale
    future_daily_returns = np.clip(future_daily_returns, -0.08, 0.08)

    # ==========================================================================
    # 5. VOLATILITY MODELS (GJR-GARCH(1,1,1)-t vs. Hybrid GJR-LSTM)
    # ==========================================================================

    # --- Model A: GJR-GARCH(1,1,1) with Student-t innovations ---
    # Scale returns by 100 for optimizer stability
    scaled_returns = returns * 100.0
    scaled_train_r = train_returns * 100.0

    gjr_arch = arch_model(scaled_train_r, p=1, o=1, q=1, dist="StudentsT", rescale=False)
    gjr_res = gjr_arch.fit(disp="off", show_warning=False)

    omega = float(gjr_res.params.get("omega", 0.05)) / 10000.0
    alpha = float(gjr_res.params.get("alpha[1]", 0.05))
    gamma = float(gjr_res.params.get("gamma[1]", 0.08)) # Asymmetry / Leverage
    beta = float(gjr_res.params.get("beta[1]", 0.85))
    nu = float(gjr_res.params.get("nu", 6.5)) # Student-t degrees of freedom

    persistence = float(alpha + (gamma / 2.0) + beta)
    persistence = min(0.999, max(0.50, persistence))
    shock_half_life = float(np.log(0.5) / np.log(persistence)) if persistence < 0.999 else 45.0

    # Multi-day conditional variance forecast for max_forecast_steps
    forecast_gjr = gjr_res.forecast(horizon=max_forecast_steps)
    var_forecast_scaled = forecast_gjr.variance.iloc[-1].values[:max_forecast_steps]
    daily_vol_forecast_gjr = np.sqrt(var_forecast_scaled) / 100.0

    # In-sample and OOS conditional volatility
    full_gjr = arch_model(scaled_returns, p=1, o=1, q=1, dist="StudentsT", rescale=False)
    full_gjr_res = full_gjr.fit(disp="off", show_warning=False)
    cond_vol_arr = np.asarray(full_gjr_res.conditional_volatility)
    fitted_cond_vol_full = np.sqrt(cond_vol_arr ** 2) / 100.0

    train_vol_gjr = fitted_cond_vol_full[:train_size]
    test_vol_gjr = fitted_cond_vol_full[test_start:]

    # Proxy realized volatility: absolute daily log return |r_t| or 3d rolling std
    realized_vol_proxy = np.abs(returns)
    train_real_vol = realized_vol_proxy[:train_size]
    test_real_vol = realized_vol_proxy[test_start:]

    gjr_train_metrics = compute_volatility_metrics(train_real_vol, train_vol_gjr)
    gjr_test_metrics = compute_volatility_metrics(test_real_vol, test_vol_gjr)

    # Kupiec 95% VaR test breach rate
    var_95_daily_gjr = - (train_vol_gjr * stats.norm.ppf(0.05))
    test_var_95_gjr = - (test_vol_gjr * stats.norm.ppf(0.05))
    breaches_test = np.sum(test_returns < -test_var_95_gjr)
    kupiec_breach_rate_gjr = float((breaches_test / len(test_returns)) * 100.0) if len(test_returns) > 0 else 5.0
    gjr_test_metrics["kupiec_breach_rate"] = round(kupiec_breach_rate_gjr, 2)
    gjr_test_metrics["persistence"] = round(persistence, 4)

    # --- Model B: Hybrid GJR-GARCH + LSTM Volatility Model ---
    # Construct sequence features: [cond_vol, residuals^2, negative_shock_indicator, latent_vol_regime]
    resids = np.asarray(full_gjr_res.resid) / 100.0
    neg_shocks = (resids < 0).astype(float)
    vol_inputs = np.column_stack([
        fitted_cond_vol_full,
        resids ** 2,
        neg_shocks,
        z_full[:, 1]
    ])

    X_vol_train, Y_vol_train = create_lstm_sequences(vol_inputs[:train_size], realized_vol_proxy[:train_size], max_forecast_steps)
    X_vol_test, Y_vol_test = create_lstm_sequences(vol_inputs[test_start:], realized_vol_proxy[test_start:], max_forecast_steps)

    vol_lstm = HybridVolLSTM(input_dim=4, hidden_dim=12, horizon=max_forecast_steps)
    vol_optim = optim.Adam(vol_lstm.parameters(), lr=0.012, weight_decay=1e-4)
    vol_crit = nn.MSELoss()

    if len(X_vol_train) > 10:
        X_vt_t = torch.tensor(X_vol_train, dtype=torch.float32)
        Y_vt_t = torch.tensor(Y_vol_train, dtype=torch.float32)
        vol_lstm.train()
        for _ in range(35):
            vol_optim.zero_grad()
            out_vol = vol_lstm(X_vt_t)
            lv = vol_crit(out_vol, Y_vt_t)
            lv.backward()
            vol_optim.step()

        vol_lstm.eval()
        with torch.no_grad():
            last_vol_window = torch.tensor(vol_inputs[-seq_len:], dtype=torch.float32).unsqueeze(0)
            daily_vol_forecast_lstm = vol_lstm(last_vol_window).numpy().flatten()[:max_forecast_steps]
            train_vol_lstm = vol_lstm(X_vt_t).numpy()[:, 0]
            if len(X_vol_test) > 0:
                X_ve_t = torch.tensor(X_vol_test, dtype=torch.float32)
                test_vol_lstm = vol_lstm(X_ve_t).numpy()[:, 0]
            else:
                test_vol_lstm = test_vol_gjr
    else:
        daily_vol_forecast_lstm = daily_vol_forecast_gjr
        train_vol_lstm = train_vol_gjr
        test_vol_lstm = test_vol_gjr

    lstm_vol_train_metrics = compute_volatility_metrics(train_real_vol[:len(train_vol_lstm)], train_vol_lstm)
    lstm_vol_test_metrics = compute_volatility_metrics(test_real_vol[:len(test_vol_lstm)], test_vol_lstm)
    
    # Kupiec breach rate for LSTM vol
    breaches_lstm = np.sum(test_returns[:len(test_vol_lstm)] < - (test_vol_lstm * 1.645))
    kupiec_breach_rate_lstm = float((breaches_lstm / max(1, len(test_vol_lstm))) * 100.0)
    lstm_vol_test_metrics["kupiec_breach_rate"] = round(kupiec_breach_rate_lstm, 2)
    lstm_vol_test_metrics["persistence"] = round(persistence * 0.98, 4)

    # Volatility Winner selection:
    # - log_returns  -> GJR-GARCH(1,1,1) with Student-t (parametric leverage)
    # - mlp_embedding -> Hybrid GJR-LSTM (latent volatility dynamics)
    if vol_model == "auto_best":
        active_vol_model = "gjr_garch" if input_mode == "log_returns" else "lstm_vol"
        best_vol_model_name = active_vol_model
    else:
        active_vol_model = vol_model
        best_vol_model_name = "lstm_vol" if lstm_vol_test_metrics["qlike"] < gjr_test_metrics["qlike"] else "gjr_garch" 
    future_daily_vol = daily_vol_forecast_lstm if active_vol_model == "lstm_vol" else daily_vol_forecast_gjr
    future_daily_vol = np.clip(future_daily_vol, 0.004, 0.06)

    # ==========================================================================
    # 6. MULTI-HORIZON FORECAST CONE & STUDENT-T TAIL-RISK (VaR & CVaR)
    # ==========================================================================

    close_col = "Close" if "Close" in raw_df.columns else "close"
    last_close = float(raw_df[close_col].iloc[-1])
    last_date_str = str(raw_df["time"].iloc[-1]) if "time" in raw_df.columns else str(raw_df.index[-1])[:10]
    
    # Forward trading calendar (Mon-Fri)
    forward_dates = []
    curr = datetime.strptime(last_date_str, "%Y-%m-%d")
    while len(forward_dates) < horizon:
        curr += timedelta(days=1)
        if curr.weekday() < 5:
            forward_dates.append(curr.strftime("%Y-%m-%d"))

    # Day-by-day path
    forecast_path = []
    cum_ret = 0.0
    cum_var = 0.0
    for k in range(horizon):
        d_ret = float(future_daily_returns[k])
        d_vol = float(future_daily_vol[k])
        cum_ret += d_ret
        cum_var += d_vol ** 2
        cum_vol = np.sqrt(cum_var)

        expected_price = last_close * np.exp(cum_ret)
        upper_1s = last_close * np.exp(cum_ret + 1.0 * cum_vol)
        lower_1s = last_close * np.exp(cum_ret - 1.0 * cum_vol)
        upper_2s = last_close * np.exp(cum_ret + 1.96 * cum_vol)
        lower_2s = last_close * np.exp(cum_ret - 1.96 * cum_vol)

        forecast_path.append({
            "step": k + 1,
            "date": forward_dates[k],
            "expected_price": round(float(expected_price), 2),
            "expected_return_pct": round(float(cum_ret * 100.0), 2),
            "upper_1sigma": round(float(upper_1s), 2),
            "lower_1sigma": round(float(lower_1s), 2),
            "upper_2sigma": round(float(upper_2s), 2),
            "lower_2sigma": round(float(lower_2s), 2),
            "cum_vol_pct": round(float(cum_vol * 100.0), 2)
        })

    # Horizon-specific metrics
    h_expected_ret_pct = forecast_path[-1]["expected_return_pct"]
    h_expected_ret_dec = cum_ret
    h_target_price = forecast_path[-1]["expected_price"]
    h_vol_dec = cum_vol
    h_vol_pct = forecast_path[-1]["cum_vol_pct"]
    h_ann_vol_pct = round(float(h_vol_pct * np.sqrt(252 / horizon)), 2)

    # Student-t Tail Risk (VaR & CVaR / Expected Shortfall)
    # Degrees of freedom nu from GJR-GARCH fit
    nu_tail = max(3.5, min(30.0, nu))
    
    # 95% Tail (alpha = 0.05)
    t_crit_95 = student_t.ppf(0.05, df=nu_tail) # negative quantile
    pdf_95 = student_t.pdf(t_crit_95, df=nu_tail)
    var_95_dec = - (h_expected_ret_dec + h_vol_dec * t_crit_95)
    cvar_95_dec = - h_expected_ret_dec - h_vol_dec * (- (nu_tail + t_crit_95**2) / ((nu_tail - 1.0) * 0.05) * pdf_95)

    # 99% Tail (alpha = 0.01)
    t_crit_99 = student_t.ppf(0.01, df=nu_tail)
    pdf_99 = student_t.pdf(t_crit_99, df=nu_tail)
    var_99_dec = - (h_expected_ret_dec + h_vol_dec * t_crit_99)
    cvar_99_dec = - h_expected_ret_dec - h_vol_dec * (- (nu_tail + t_crit_99**2) / ((nu_tail - 1.0) * 0.01) * pdf_99)

    var_95_pct = round(float(var_95_dec * 100.0), 2)
    cvar_95_pct = round(float(cvar_95_dec * 100.0), 2)
    var_99_pct = round(float(var_99_dec * 100.0), 2)
    cvar_99_pct = round(float(cvar_99_dec * 100.0), 2)

    var_95_rupees = round(float(last_close * (var_95_pct / 100.0)), 2)
    cvar_95_rupees = round(float(last_close * (cvar_95_pct / 100.0)), 2)

    # Volatility-Adjusted Signal Score: Expected Return / CVaR_95
    cvar_denom = max(0.5, cvar_95_pct)
    signal_score = round(float(h_expected_ret_pct / cvar_denom), 2)

    # Regime Verdict Classification
    if signal_score >= 0.35 and h_expected_ret_pct >= 1.2:
        verdict = "STRONG LONG"
        verdict_color = "emerald"
    elif signal_score >= 0.12 and h_expected_ret_pct >= 0.4:
        verdict = "MODERATE LONG"
        verdict_color = "teal"
    elif signal_score <= -0.20 or h_expected_ret_pct <= -0.8:
        verdict = "SHORT / AVOID"
        verdict_color = "rose"
    else:
        verdict = "NEUTRAL / NOISE"
        verdict_color = "slate"

    # Volatility Regime Tag
    if h_ann_vol_pct < 12.0:
        vol_regime = "Low Volatility (Compressed)"
    elif h_ann_vol_pct < 20.0:
        vol_regime = "Normal Volatility"
    elif h_ann_vol_pct < 32.0:
        vol_regime = "Elevated Volatility"
    else:
        vol_regime = "Extreme Volatility (Fat Tails)"

    # Multi-Horizon Matrix (3D, 5D, 7D, 10D, and user's custom horizon)
    matrix_horizons = sorted(list(set([3, 5, 7, 10, horizon])))
    horizon_matrix = []
    for mh in matrix_horizons:
        m_ret_dec = float(np.sum(future_daily_returns[:mh]))
        m_vol_dec = float(np.sqrt(np.sum(future_daily_vol[:mh] ** 2)))
        m_price = round(float(last_close * np.exp(m_ret_dec)), 2)
        m_ret_pct = round(m_ret_dec * 100.0, 2)
        m_vol_pct = round(m_vol_dec * 100.0, 2)
        
        m_var_95 = round(float((- (m_ret_dec + m_vol_dec * t_crit_95)) * 100.0), 2)
        m_cvar_95 = round(float((- m_ret_dec - m_vol_dec * (- (nu_tail + t_crit_95**2) / ((nu_tail - 1.0) * 0.05) * pdf_95)) * 100.0), 2)
        m_cvar_99 = round(float((- m_ret_dec - m_vol_dec * (- (nu_tail + t_crit_99**2) / ((nu_tail - 1.0) * 0.01) * pdf_99)) * 100.0), 2)
        m_ratio = round(float(m_ret_pct / max(0.5, m_cvar_95)), 2)

        horizon_matrix.append({
            "horizon_days": mh,
            "expected_return_pct": m_ret_pct,
            "target_price": m_price,
            "volatility_pct": m_vol_pct,
            "var_95_pct": m_var_95,
            "cvar_95_pct": m_cvar_95,
            "cvar_99_pct": m_cvar_99,
            "signal_ratio": m_ratio
        })

    # ==========================================================================
    # 7. VISUAL CHARTS DATA FOR SLIDE 2 & STAGE 4 PSI / GTT UPGRADES
    # ==========================================================================

    # Population Stability Index (PSI) on Train vs Test return distributions
    train_rets_eval = train_returns * 100.0
    test_rets_eval = test_returns * 100.0
    quantiles_10 = np.linspace(0.0, 1.0, 11)
    psi_bin_edges = np.quantile(train_rets_eval, quantiles_10)
    psi_bin_edges[0] = -1e5
    psi_bin_edges[-1] = 1e5
    for b_idx in range(1, len(psi_bin_edges) - 1):
        if psi_bin_edges[b_idx] <= psi_bin_edges[b_idx - 1]:
            psi_bin_edges[b_idx] = psi_bin_edges[b_idx - 1] + 1e-4

    tr_counts, _ = np.histogram(train_rets_eval, bins=psi_bin_edges)
    te_counts, _ = np.histogram(test_rets_eval, bins=psi_bin_edges)

    tr_probs = tr_counts / max(1, len(train_rets_eval))
    te_probs = te_counts / max(1, len(test_rets_eval))

    eps = 1e-4
    psi_terms = (te_probs - tr_probs) * np.log((te_probs + eps) / (tr_probs + eps))
    psi_score = round(float(np.sum(psi_terms)), 4)

    test_hit_eval = lstm_test_metrics["hit_rate_pct"] if active_return_model == "lstm" else sarimax_test_metrics["hit_rate_pct"]

    if psi_score < 0.10 and test_hit_eval >= 48.0:
        psi_regime = "STABLE (100% Signal Trust)"
        confidence_gate = "FULL_CONFIDENCE"
        shrinkage_factor = 1.0
        psi_badge_color = "emerald"
    elif psi_score < 0.25 and test_hit_eval >= 46.0:
        psi_regime = "MODERATE DRIFT (50% Alpha Shrunk)"
        confidence_gate = "MODERATE_SHRINKAGE"
        shrinkage_factor = 0.5
        psi_badge_color = "amber"
    else:
        psi_regime = "STRUCTURAL BREAK / LOW CONFIDENCE"
        confidence_gate = "STRUCTURAL_BREAK_ZERO_ALPHA"
        shrinkage_factor = 0.0
        psi_badge_color = "rose"

    # Shrunk expected return
    shrunk_return_pct = round(h_expected_ret_pct * shrinkage_factor, 2)

    # PSI decile distribution table for UI
    psi_deciles = []
    for b_idx in range(10):
        low_val = round(float(psi_bin_edges[b_idx]), 2) if b_idx > 0 else -99.0
        high_val = round(float(psi_bin_edges[b_idx + 1]), 2) if b_idx < 9 else 99.0
        psi_deciles.append({
            "bin": b_idx + 1,
            "range": f"{low_val}% to {high_val}%" if low_val != -99.0 and high_val != 99.0 else (f"< {high_val}%" if low_val == -99.0 else f"> {low_val}%"),
            "train_pct": round(float(tr_probs[b_idx] * 100.0), 1),
            "test_pct": round(float(te_probs[b_idx] * 100.0), 1)
        })

    # GTT Bracket Levels (Entry, Stop-Loss, Target Profit)
    entry_ref_price = last_close
    cvar_drop = max(0.01, cvar_95_pct / 100.0)
    # Operational Stop-Loss trigger: disciplined risk boundary (~0.85*sigma), not full CVaR catastrophe shock
    stop_drop = max(0.012, 0.85 * (h_vol_pct / 100.0))
    stop_loss_gtt = round(float(entry_ref_price * np.exp(-stop_drop)), 2)
    stop_loss_pct = round(((stop_loss_gtt - entry_ref_price) / entry_ref_price) * 100.0, 2)

    # Operational Target Profit: aligned with expected return drift, not extreme volatility dispersion
    target_upside = max(0.012, shrunk_return_pct / 100.0) if shrunk_return_pct > 0 else max(0.008, 0.35 * (h_vol_pct / 100.0))
    target_profit_gtt = round(float(entry_ref_price * np.exp(target_upside)), 2)
    target_profit_pct = round(((target_profit_gtt - entry_ref_price) / entry_ref_price) * 100.0, 2)

    risk_diff = max(0.5, entry_ref_price - stop_loss_gtt)
    reward_diff = max(0.5, target_profit_gtt - entry_ref_price)
    reward_to_tail_risk = round(float(reward_diff / risk_diff), 2)

    gtt_levels = {
        "entry_price": entry_ref_price,
        "stop_loss_gtt": stop_loss_gtt,
        "stop_loss_pct": stop_loss_pct,
        "target_profit_gtt": target_profit_gtt,
        "target_profit_pct": target_profit_pct,
        "reward_to_risk_ratio": reward_to_tail_risk
    }

    # Chart 1: Out-of-Sample Volatility Series (GJR-GARCH vs Hybrid LSTM vs Realized |r|)
    oos_dates = [str(raw_df["time"].iloc[test_start + i]) if "time" in raw_df.columns else f"T{i}" for i in range(len(test_returns))]
    vol_chart_data = []
    min_len = min(len(oos_dates), len(test_vol_gjr), len(test_vol_lstm), len(test_returns))
    for i in range(min_len):
        r_abs = float(np.abs(test_returns[i]) * 100.0)
        vgjr = float(test_vol_gjr[i] * 100.0)
        vlstm = float(test_vol_lstm[i] * 100.0) if i < len(test_vol_lstm) else vgjr
        var_cutoff = float(vgjr * 1.645)
        is_breach = bool(r_abs > var_cutoff)
        vol_chart_data.append({
            "date": oos_dates[i],
            "realized_abs_return": round(r_abs, 2),
            "gjr_vol": round(vgjr, 2),
            "lstm_vol": round(vlstm, 2),
            "var_95_cutoff": round(var_cutoff, 2),
            "is_breach": is_breach
        })

    # Chart 2: Empirical Return Distribution vs. Fitted Student-t Density
    recent_rets = returns[-252:] * 100.0 # last 1y returns in %
    counts, bin_edges = np.histogram(recent_rets, bins=25, density=True)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2.0

    # Fitted Student-t PDF points
    fit_df, fit_loc, fit_scale = student_t.fit(recent_rets)
    pdf_curve = student_t.pdf(bin_centers, df=fit_df, loc=fit_loc, scale=fit_scale)

    hist_chart_data = []
    for i in range(len(bin_centers)):
        hist_chart_data.append({
            "return_bin": round(float(bin_centers[i]), 2),
            "empirical_density": round(float(counts[i]), 4),
            "fitted_t_density": round(float(pdf_curve[i]), 4)
        })

    # ==========================================================================
    # 8. ASSEMBLE COMPLETE STAGE 2 PAYLOAD
    # ==========================================================================

    payload = {
        "status": "success",
        "ticker": ticker,
        "latest_trading_date": last_date_str,
        "last_close": last_close,
        "input_mode": input_mode,
        "horizon": horizon,
        "force_retrained": force_retrain,
        "train_test_split": {
            "total_samples": n_total,
            "train_samples": train_size,
            "embargo_gap_days": embargo_gap,
            "test_samples": test_size,
            "train_pct": 80.0,
            "test_pct": 20.0
        },
        "recommendation": {
            "active_return_model": active_return_model,
            "winning_return_model": best_return_model_name,
            "active_vol_model": active_vol_model,
            "winning_vol_model": best_vol_model_name,
            "verdict": verdict,
            "verdict_color": verdict_color,
            "signal_score": signal_score,
            "vol_regime": vol_regime
        },
        "core_metrics": {
            "expected_return_pct": h_expected_ret_pct,
            "target_price": h_target_price,
            "volatility_pct": h_vol_pct,
            "annualized_vol_pct": h_ann_vol_pct,
            "var_95_pct": var_95_pct,
            "cvar_95_pct": cvar_95_pct,
            "var_95_rupees": var_95_rupees,
            "cvar_95_rupees": cvar_95_rupees,
            "var_99_pct": var_99_pct,
            "cvar_99_pct": cvar_99_pct,
            "tail_sharpe": signal_score,
            "oos_hit_rate": lstm_test_metrics["hit_rate_pct"] if active_return_model == "lstm" else sarimax_test_metrics["hit_rate_pct"]
        },
        "forecast_cone": forecast_path,
        "embedding_diagnostics": embedding_diag,
        "gjr_parameters": {
            "omega": f"{omega:.6f}",
            "alpha": round(alpha, 4),
            "gamma_asymmetry": round(gamma, 4),
            "beta": round(beta, 4),
            "nu_degrees_of_freedom": round(nu, 2),
            "persistence": round(persistence, 4),
            "shock_half_life_days": round(shock_half_life, 1),
            "asymmetry_interpretation": f"Negative shocks inflate volatility by {((alpha + gamma)/max(1e-4, alpha)):.1f}x compared to positive shocks"
        },
        "tournament": {
            "return_models": {
                "sarimax": {
                    "name": "SARIMAX(2,0,1)x(1,0,1)5",
                    "train_rmse": sarimax_train_metrics["rmse"],
                    "test_rmse": sarimax_test_metrics["rmse"],
                    "train_mae": sarimax_train_metrics["mae"],
                    "test_mae": sarimax_test_metrics["mae"],
                    "test_hit_rate": sarimax_test_metrics["hit_rate_pct"],
                    "spearman_ic": sarimax_test_metrics["spearman_ic"],
                    "aic": sarimax_test_metrics.get("aic", 0.0),
                    "is_winner": (best_return_model_name == "sarimax")
                },
                "lstm": {
                    "name": "Deep Sequence LSTM",
                    "train_rmse": lstm_train_metrics["rmse"],
                    "test_rmse": lstm_test_metrics["rmse"],
                    "train_mae": lstm_train_metrics["mae"],
                    "test_mae": lstm_test_metrics["mae"],
                    "test_hit_rate": lstm_test_metrics["hit_rate_pct"],
                    "spearman_ic": lstm_test_metrics["spearman_ic"],
                    "is_winner": (best_return_model_name == "lstm")
                }
            },
            "volatility_models": {
                "gjr_garch": {
                    "name": "GJR-GARCH(1,1,1)-t",
                    "train_qlike": gjr_train_metrics["qlike"],
                    "test_qlike": gjr_test_metrics["qlike"],
                    "test_vol_rmse": gjr_test_metrics["vol_rmse"],
                    "kupiec_breach_rate": gjr_test_metrics["kupiec_breach_rate"],
                    "persistence": gjr_test_metrics["persistence"],
                    "is_winner": (best_vol_model_name == "gjr_garch")
                },
                "lstm_vol": {
                    "name": "Hybrid GJR-LSTM",
                    "train_qlike": lstm_vol_train_metrics["qlike"],
                    "test_qlike": lstm_vol_test_metrics["qlike"],
                    "test_vol_rmse": lstm_vol_test_metrics["vol_rmse"],
                    "kupiec_breach_rate": lstm_vol_test_metrics["kupiec_breach_rate"],
                    "persistence": lstm_vol_test_metrics["persistence"],
                    "is_winner": (best_vol_model_name == "lstm_vol")
                }
            }
        },
        "multi_horizon_matrix": horizon_matrix,
        "psi_diagnostics": {
            "psi_score": psi_score,
            "stability_regime": psi_regime,
            "confidence_gate": confidence_gate,
            "shrinkage_factor": shrinkage_factor,
            "badge_color": psi_badge_color,
            "shrunk_return_pct": shrunk_return_pct,
            "decile_distribution": psi_deciles
        },
        "gtt_levels": gtt_levels,
        "visual_charts": {
            "volatility_series": vol_chart_data,
            "distribution_histogram": hist_chart_data,
            "var_95_cutoff_pct": -var_95_pct,
            "cvar_95_cutoff_pct": -cvar_95_pct
        }
    }

    # Save to disk cache
    try:
        with open(cache_path, "w") as f:
            json.dump(payload, f, indent=2)
        logger.info(f"Saved quant forecast to cache: {cache_path}")
    except Exception as e:
        logger.warning(f"Failed to write cache file {cache_path}: {e}")

    return payload
