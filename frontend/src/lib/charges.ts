/**
 * Zerodha Indian Equity Delivery Charges & P&L Calculator
 * 
 * Statutory Delivery Drag on NSE (Excluding Capital Gains Tax):
 * 1. Brokerage: ₹0 (Zero brokerage on Zerodha equity delivery)
 * 2. STT (Securities Transaction Tax):
 *    - Equities: 0.1% on Buy turnover + 0.1% on Sell turnover
 *    - ETFs: 0% on Buy turnover + 0.001% on Sell turnover
 * 3. NSE Exchange Turnover Charges: 0.00297% on both Buy & Sell turnover
 * 4. SEBI Turnover Charges: ₹10 / crore (0.0001%) on both Buy & Sell turnover
 * 5. Stamp Duty: 0.015% on Buy turnover only
 * 6. GST: 18% on (Brokerage + Exchange Turnover + SEBI Turnover)
 * 7. DP (Depository Participant) Charges: ₹13.00 + 18% GST = ₹15.34 per scrip on sell/debit from Demat
 * 
 * Note: Capital Gains Tax (STCG 20% / LTCG 12.5%) is explicitly EXCLUDED.
 */

export interface TradeChargesBreakdown {
  brokerage: number
  stt: number
  exchangeTxn: number
  sebiTurnover: number
  stampDuty: number
  gst: number
  dpCharges: number
  totalCharges: number
}

export interface TradeScenario {
  price: number
  grossPnl: number
  netPnl: number
  charges: TradeChargesBreakdown
}

export interface StockPnLCalculation {
  shares: number
  invested: number
  residualCash: number
  entryPrice: number
  expectedExitPrice: number
  grossPnl: number
  grossReturnPct: number
  charges: TradeChargesBreakdown
  netPnl: number
  netReturnPct: number
  targetPnl: TradeScenario
  stopPnl: TradeScenario
}

/**
 * Computes exact round-trip Zerodha delivery charges for an equity/ETF trade.
 */
export function calculateTradeCharges(
  buyTurnover: number,
  sellTurnover: number,
  isEtf: boolean = false,
  shares: number = 1
): TradeChargesBreakdown {
  if (shares <= 0 || (buyTurnover <= 0 && sellTurnover <= 0)) {
    return {
      brokerage: 0,
      stt: 0,
      exchangeTxn: 0,
      sebiTurnover: 0,
      stampDuty: 0,
      gst: 0,
      dpCharges: 0,
      totalCharges: 0,
    }
  }

  const totalTurnover = buyTurnover + sellTurnover
  const brokerage = 0.0 // Zero brokerage on delivery

  // STT: 0.1% buy + 0.1% sell for stocks; 0.001% sell for ETFs
  const stt = isEtf
    ? sellTurnover * 0.001
    : (buyTurnover * 0.001) + (sellTurnover * 0.001)

  // NSE Exchange transaction charges: 0.00297%
  const exchangeTxn = totalTurnover * 0.0000297

  // SEBI turnover charges: 0.0001%
  const sebiTurnover = totalTurnover * 0.000001

  // Stamp duty: 0.015% on buy value only
  const stampDuty = buyTurnover * 0.00015

  // 18% GST on exchange turnover + SEBI
  const gst = 0.18 * (brokerage + exchangeTxn + sebiTurnover)

  // CDSL / Zerodha DP charge: ₹13 + 18% GST = ₹15.34 per scrip on sell
  const dpCharges = 15.34

  const totalCharges =
    brokerage + stt + exchangeTxn + sebiTurnover + stampDuty + gst + dpCharges

  return {
    brokerage: Math.round(brokerage * 100) / 100,
    stt: Math.round(stt * 100) / 100,
    exchangeTxn: Math.round(exchangeTxn * 100) / 100,
    sebiTurnover: Math.round(sebiTurnover * 100) / 100,
    stampDuty: Math.round(stampDuty * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    dpCharges: Math.round(dpCharges * 100) / 100,
    totalCharges: Math.round(totalCharges * 100) / 100,
  }
}

/**
 * Calculates discrete whole-share sizing, Gross Expected P&L,
 * and Net Expected P&L after Zerodha statutory charges for ANY stock.
 */
export function calculateStockPnL(params: {
  stockPrice: number
  capitalAllocated: number
  expRet: number // e.g. 0.024 for +2.4%
  targetPrice?: number
  stopPrice?: number
  isEtf?: boolean
  forcedShares?: number
}): StockPnLCalculation {
  const { stockPrice, capitalAllocated, expRet, targetPrice, stopPrice, isEtf } = params

  const emptyCharges: TradeChargesBreakdown = {
    brokerage: 0,
    stt: 0,
    exchangeTxn: 0,
    sebiTurnover: 0,
    stampDuty: 0,
    gst: 0,
    dpCharges: 0,
    totalCharges: 0,
  }

  if (stockPrice <= 0 || capitalAllocated <= 0) {
    return {
      shares: 0,
      invested: 0,
      residualCash: capitalAllocated,
      entryPrice: stockPrice,
      expectedExitPrice: stockPrice,
      grossPnl: 0,
      grossReturnPct: 0,
      charges: emptyCharges,
      netPnl: 0,
      netReturnPct: 0,
      targetPnl: { price: targetPrice ?? stockPrice, grossPnl: 0, netPnl: 0, charges: emptyCharges },
      stopPnl: { price: stopPrice ?? stockPrice, grossPnl: 0, netPnl: 0, charges: emptyCharges },
    }
  }

  // Calculate whole discrete shares (cannot buy fractional shares on NSE)
  const shares = params.forcedShares !== undefined
    ? Math.max(0, params.forcedShares)
    : Math.floor(capitalAllocated / stockPrice)

  const invested = shares * stockPrice
  const residualCash = Math.max(0, capitalAllocated - invested)

  if (shares <= 0) {
    return {
      shares: 0,
      invested: 0,
      residualCash: capitalAllocated,
      entryPrice: stockPrice,
      expectedExitPrice: stockPrice,
      grossPnl: 0,
      grossReturnPct: 0,
      charges: emptyCharges,
      netPnl: 0,
      netReturnPct: 0,
      targetPnl: { price: targetPrice ?? stockPrice, grossPnl: 0, netPnl: 0, charges: emptyCharges },
      stopPnl: { price: stopPrice ?? stockPrice, grossPnl: 0, netPnl: 0, charges: emptyCharges },
    }
  }

  // Expected exit price
  const expectedExitPrice = stockPrice * (1 + expRet)
  const buyTurnover = invested
  const expectedSellTurnover = shares * expectedExitPrice
  const grossPnl = expectedSellTurnover - buyTurnover
  const grossReturnPct = invested > 0 ? (grossPnl / invested) * 100 : 0

  const charges = calculateTradeCharges(buyTurnover, expectedSellTurnover, !!isEtf, shares)
  const netPnl = grossPnl - charges.totalCharges
  const netReturnPct = invested > 0 ? (netPnl / invested) * 100 : 0

  // Target scenario
  const effectiveTarget = targetPrice ?? expectedExitPrice
  const targetSellTurnover = shares * effectiveTarget
  const targetGrossPnl = targetSellTurnover - buyTurnover
  const targetCharges = calculateTradeCharges(buyTurnover, targetSellTurnover, !!isEtf, shares)
  const targetNetPnl = targetGrossPnl - targetCharges.totalCharges

  // Stop scenario
  const effectiveStop = stopPrice ?? (stockPrice * 0.98)
  const stopSellTurnover = shares * effectiveStop
  const stopGrossPnl = stopSellTurnover - buyTurnover
  const stopCharges = calculateTradeCharges(buyTurnover, stopSellTurnover, !!isEtf, shares)
  const stopNetPnl = stopGrossPnl - stopCharges.totalCharges

  return {
    shares,
    invested,
    residualCash,
    entryPrice: stockPrice,
    expectedExitPrice,
    grossPnl,
    grossReturnPct,
    charges,
    netPnl,
    netReturnPct,
    targetPnl: {
      price: effectiveTarget,
      grossPnl: targetGrossPnl,
      netPnl: targetNetPnl,
      charges: targetCharges,
    },
    stopPnl: {
      price: effectiveStop,
      grossPnl: stopGrossPnl,
      netPnl: stopNetPnl,
      charges: stopCharges,
    },
  }
}
