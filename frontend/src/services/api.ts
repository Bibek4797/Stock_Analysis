import {
  UniverseResponse,
  OhlcvResponse,
  QuantForecastResponse,
  InputMode,
  ReturnModel,
  VolModel,
  SwingHorizon,
  PortfolioResponse,
  PortfolioStrategyMode,
  PortfolioSelectionMode,
  CvarQuantile,
} from '../types';

const API_BASE = '/api';

export async function fetchUniverse(): Promise<UniverseResponse> {
  const res = await fetch(`${API_BASE}/universe`);
  if (!res.ok) {
    throw new Error(`Failed to fetch universe: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchOhlcv(
  ticker: string,
  period: string = '1y',
  interval: string = '1d'
): Promise<OhlcvResponse> {
  const res = await fetch(`${API_BASE}/ohlcv/${encodeURIComponent(ticker)}?period=${period}&interval=${interval}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch OHLCV for ${ticker}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchQuantForecast(
  ticker: string,
  inputMode: InputMode = 'mlp_embedding',
  returnModel: ReturnModel = 'auto_best',
  volModel: VolModel = 'auto_best',
  horizon: SwingHorizon = 5,
  forceRetrain: boolean = false
): Promise<QuantForecastResponse> {
  const params = new URLSearchParams({
    input_mode: inputMode,
    return_model: returnModel,
    vol_model: volModel,
    horizon: String(horizon),
    force_retrain: String(forceRetrain)
  });
  const res = await fetch(`${API_BASE}/quant/forecast/${encodeURIComponent(ticker)}?${params.toString()}`);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch quant forecast for ${ticker}: ${errorText || res.statusText}`);
  }
  return res.json();
}

export async function fetchPortfolioOptimize(params: {
  capital?: number;
  horizon?: SwingHorizon;
  cvar_quantile?: CvarQuantile | number;
  max_portfolio_cvar?: number;
  no_trade_buffer?: number;
  strategy_mode?: PortfolioStrategyMode;
  selection_mode?: PortfolioSelectionMode;
  selected_tickers?: string[];
  max_weight?: number;
  force_refresh?: boolean;
}): Promise<PortfolioResponse> {
  const res = await fetch(`${API_BASE}/portfolio/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capital: params.capital ?? 1000000.0,
      horizon: params.horizon ?? 5,
      cvar_quantile: params.cvar_quantile ?? 0.05,
      max_portfolio_cvar: params.max_portfolio_cvar ?? 0.035,
      no_trade_buffer: params.no_trade_buffer ?? 0.025,
      strategy_mode: params.strategy_mode ?? 'auto_regime',
      selection_mode: params.selection_mode ?? 'auto_quant_screen',
      selected_tickers: params.selected_tickers ?? null,
      max_weight: params.max_weight ?? 0.35,
      force_refresh: params.force_refresh ?? false,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to optimize portfolio: ${errorText || res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Centralized Authentication API
// ---------------------------------------------------------------------------

export async function fetchApiUsers(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/auth/users`);
  if (!res.ok) throw new Error('Failed to fetch users from server');
  const data = await res.json();
  return data.users || [];
}

export async function apiLogin(userId: string, password: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  return data.user;
}

export async function apiCreateUser(user: { userId: string; password: string; name: string; role: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create user');
  }
  return res.json();
}

export async function apiUpdateUser(userId: string, updates: { userId?: string; password?: string; name?: string; role?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update user');
  }
  return res.json();
}

export async function apiDeleteUser(userId: string, currentAdminId?: string): Promise<any> {
  const q = currentAdminId ? `?current_admin_id=${encodeURIComponent(currentAdminId)}` : '';
  const res = await fetch(`${API_BASE}/auth/users/${encodeURIComponent(userId)}${q}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to delete user');
  }
  return res.json();
}
