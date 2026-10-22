export interface UniverseItem {
  symbol: string;
  display_symbol: string;
  name: string;
  sector: string;
  category: 'EQ' | 'ETF' | 'INDEX';
  is_tradable: boolean;
  group?: 'equities' | 'etfs' | 'benchmarks';
  base_price?: number;
  change_pct?: number;
  exchange?: string;
  currency?: string;
}

export interface UniverseResponse {
  status: string;
  market: string;
  broker_target: string;
  universe: {
    equities: UniverseItem[];
    etfs: UniverseItem[];
    benchmarks: UniverseItem[];
  };
  total_assets: number;
  tradable_count: number;
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  simple_return_pct: number;
  log_return: number;
  sma_200?: number | null;
  bb_upper?: number | null;
  bb_mid?: number | null;
  bb_lower?: number | null;
}

export interface OhlcvMetrics {
  latest_close: number;
  prev_close: number;
  change: number;
  change_pct: number;
  daily_log_return: number;
  day_high: number;
  day_low: number;
  day_volume: number;
  annualized_volatility: number;
  data_points: number;
  indicators?: {
    sma_200?: number | null;
    bb_upper?: number | null;
    bb_mid?: number | null;
    bb_lower?: number | null;
  };
}

export interface OhlcvResponse {
  ticker: string;
  display_symbol: string;
  name: string;
  category: 'EQ' | 'ETF' | 'INDEX';
  is_tradable: boolean;
  currency: string;
  exchange: string;
  period: string;
  interval: string;
  is_synthetic: boolean;
  metrics: OhlcvMetrics;
  candles: CandleData[];
}

export type ViewTab = 'terminal' | 'returns_risk' | 'portfolio_manager';
export type TimeframePeriod = '3M' | '6M' | '1Y' | '2Y' | '5Y';

export type InputMode = 'log_returns' | 'mlp_embedding';
export type ReturnModel = 'auto_best' | 'sarimax' | 'lstm';
export type VolModel = 'auto_best' | 'gjr_garch' | 'lstm_vol';
export type SwingHorizon = number;

export interface QuantForecastConePoint {
  step: number;
  date: string;
  expected_price: number;
  expected_return_pct: number;
  upper_1sigma: number;
  lower_1sigma: number;
  upper_2sigma: number;
  lower_2sigma: number;
  cum_vol_pct: number;
}

export interface QuantTournamentModel {
  name: string;
  train_rmse?: number;
  test_rmse?: number;
  train_mae?: number;
  test_mae?: number;
  test_hit_rate?: number;
  spearman_ic?: number;
  aic?: number;
  bic?: number;
  train_qlike?: number;
  test_qlike?: number;
  test_vol_rmse?: number;
  kupiec_breach_rate?: number;
  persistence?: number;
  is_winner: boolean;
}

export interface MultiHorizonMatrixRow {
  horizon_days: number;
  expected_return_pct: number;
  target_price: number;
  volatility_pct: number;
  var_95_pct: number;
  cvar_95_pct: number;
  cvar_99_pct: number;
  signal_ratio: number;
}

export interface QuantForecastResponse {
  status: string;
  ticker: string;
  latest_trading_date: string;
  last_close: number;
  input_mode: InputMode;
  horizon: number;
  force_retrained: boolean;
  train_test_split: {
    total_samples: number;
    train_samples: number;
    embargo_gap_days: number;
    test_samples: number;
    train_pct: number;
    test_pct: number;
  };
  recommendation: {
    active_return_model: string;
    winning_return_model: string;
    active_vol_model: string;
    winning_vol_model: string;
    verdict: string;
    verdict_color: string;
    signal_score: number;
    vol_regime: string;
  };
  core_metrics: {
    expected_return_pct: number;
    target_price: number;
    volatility_pct: number;
    annualized_vol_pct: number;
    var_95_pct: number;
    cvar_95_pct: number;
    var_95_rupees: number;
    cvar_95_rupees: number;
    var_99_pct: number;
    cvar_99_pct: number;
    tail_sharpe: number;
    oos_hit_rate: number;
  };
  forecast_cone: QuantForecastConePoint[];
  embedding_diagnostics: {
    explained_variance_pct: number;
    snr_improvement_db: number;
    latent_momentum: number;
    latent_vol_regime: number;
    latent_volume_pressure: number;
  };
  gjr_parameters: {
    omega: string;
    alpha: number;
    gamma_asymmetry: number;
    beta: number;
    nu_degrees_of_freedom: number;
    persistence: number;
    shock_half_life_days: number;
    asymmetry_interpretation: string;
  };
  tournament: {
    return_models: {
      sarimax: QuantTournamentModel;
      lstm: QuantTournamentModel;
    };
    volatility_models: {
      gjr_garch: QuantTournamentModel;
      lstm_vol: QuantTournamentModel;
    };
  };
  multi_horizon_matrix: MultiHorizonMatrixRow[];
  visual_charts: {
    volatility_series: Array<{
      date: string;
      realized_abs_return: number;
      gjr_vol: number;
      lstm_vol: number;
      var_95_cutoff: number;
      is_breach: boolean;
    }>;
    distribution_histogram: Array<{
      return_bin: number;
      empirical_density: number;
      fitted_t_density: number;
    }>;
    var_95_cutoff_pct: number;
    cvar_95_cutoff_pct: number;
  };
  psi_diagnostics?: {
    psi_score: number;
    stability_regime: string;
    confidence_gate: string;
    shrinkage_factor: number;
    badge_color: string;
    shrunk_return_pct: number;
    decile_distribution: Array<{
      bin: number;
      range: string;
      train_pct: number;
      test_pct: number;
    }>;
  };
  gtt_levels?: {
    entry_price: number;
    stop_loss_gtt: number;
    stop_loss_pct: number;
    target_profit_gtt: number;
    target_profit_pct: number;
    reward_to_risk_ratio: number;
    horizon_days?: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 Portfolio Optimization Types
// ─────────────────────────────────────────────────────────────────────────────

export type PortfolioStrategyMode = 'auto_regime' | 'mpt' | 'dalio_trc' | 'rockafellar_cvar';
export type PortfolioSelectionMode = 'auto_quant_screen' | 'manual';
export type CvarQuantile = 0.01 | 0.025 | 0.05 | 0.10;

export interface PortfolioScorecardItem {
  ticker: string;
  display_symbol: string;
  is_etf: boolean;
  expected_return_pct: number;
  volatility_pct: number;
  cvar_95_pct: number;
  return_to_cvar_ratio: number;
  status: 'SELECTED' | 'FILTERED_OUT';
  reason: string;
}

export interface PortfolioRegimeInfo {
  regime: string;
  badge_color: string;
  active_strategy: string;
  active_strategy_name: string;
  rationale: string;
  metrics: {
    nifty_latest: number;
    nifty_sma_200: number;
    diff_from_sma_200_pct: number;
    return_20d_pct: number;
    max_drawdown_60d_pct: number;
    volatility_percentile: number;
    annualized_vol_pct: number;
  };
}

export interface PortfolioTournamentMetric {
  strategy: string;
  train_sharpe: number;
  test_sharpe: number;
  sortino_ratio: number;
  calmar_ratio: number;
  probabilistic_sharpe_ratio_pct?: number;
  turnover_cost_saved_bps?: number;
  skewness?: number;
  kurtosis?: number;
  annualized_return_pct: number;
  annualized_vol_pct: number;
  max_drawdown_pct: number;
  portfolio_var_pct: number;
  portfolio_cvar_pct: number;
  effective_number_of_bets: number;
  herfindahl_concentration: number;
}

export interface PortfolioBlotterItem {
  ticker: string;
  display_symbol: string;
  name: string;
  category: 'EQ' | 'ETF' | 'CASH_ETF';
  active_weight_pct: number;
  mpt_weight_pct: number;
  dalio_weight_pct: number;
  ru_weight_pct: number;
  prc_pct: number;
  latest_ltp: number;
  target_amount: number;
  whole_shares: number;
  actual_invested: number;
  residual_cash: number;
  est_zerodha_fees: number;
  quant_verdict: string;
  quant_reason: string;
  rebalance_action?: string;
  cost_saved_bps?: number;
  cost_saved_rupees?: number;
  stop_loss_gtt?: number;
  target_profit_gtt?: number;
  reward_to_risk_ratio?: number;
}

export interface PortfolioRiskScaling {
  multiplier_kappa: number;
  max_portfolio_cvar_pct: number;
  unscaled_cvar_pct: number;
  scaled_cvar_pct: number;
  cash_shield_pct: number;
  is_scaled: boolean;
  cash_asset: string;
}

export interface PortfolioNoTradeBufferSummary {
  buffer_pct: number;
  actions_held_count: number;
  total_cost_saved_rupees: number;
  total_cost_saved_bps: number;
}

export interface PortfolioBlotterSummary {
  investable_capital: number;
  total_invested: number;
  total_residual_cash: number;
  total_est_zerodha_charges: number;
  brokerage_rate: string;
  stt_regulatory_rate: string;
  num_orders: number;
}

export interface PortfolioEquityCurvePoint {
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
}

export interface PortfolioWeightBreakdownItem {
  ticker: string;
  display_symbol: string;
  mpt_weight: number;
  dalio_weight: number;
  ru_weight: number;
  active_weight: number;
  active_prc: number;
}

export interface PortfolioResponse {
  status: string;
  timestamp: string;
  horizon: number;
  capital: number;
  cvar_quantile: number;
  max_portfolio_cvar?: number;
  no_trade_buffer?: number;
  strategy_mode: PortfolioStrategyMode;
  resolved_strategy: string;
  selection_mode: PortfolioSelectionMode;
  max_weight: number;
  regime: PortfolioRegimeInfo;
  risk_scaling?: PortfolioRiskScaling;
  no_trade_buffer_summary?: PortfolioNoTradeBufferSummary;
  screening: {
    selected_basket: string[];
    selected_count: number;
    total_screened: number;
    scorecard: PortfolioScorecardItem[];
  };
  tournament_metrics: Record<string, PortfolioTournamentMetric>;
  visual_charts: {
    equity_curves: PortfolioEquityCurvePoint[];
    weights_breakdown: PortfolioWeightBreakdownItem[];
  };
  zerodha_blotter: PortfolioBlotterItem[];
  blotter_summary: PortfolioBlotterSummary;
  train_test_split: {
    total_days: number;
    train_days: number;
    test_days: number;
    train_pct: number;
    test_pct: number;
  };
}
