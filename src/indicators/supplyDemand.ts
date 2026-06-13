import type { Kline } from '../services/binanceApi';

export type ZoneType = 'supply' | 'demand';

export interface SupplyDemandZone {
  type: ZoneType;
  top: number;
  bottom: number;
  strength: number;
  touches: number;
}

export type ZoneSignal =
  | 'ZONE_STRONG_BUY'
  | 'ZONE_BUY'
  | 'ZONE_NEUTRAL'
  | 'ZONE_SELL'
  | 'ZONE_STRONG_SELL';

export type ZonePosition = 'at_demand' | 'at_supply' | 'near_demand' | 'near_supply' | 'between' | null;

export interface ZoneAnalysisInput {
  klines: Kline[];
  price: number;
  atr: number | null;
  rsi15m: number | null;
  rsi1h: number | null;
  macdHistogram: number | null;
  superTrend: 1 | -1 | null;
  stochRsiK: number | null;
  stochRsiD: number | null;
  haTrend?: 1 | -1 | 0;
  haConsecutive?: number;
}

export type ZoneBreakoutSignal =
  | 'STRONG_LONG'
  | 'LONG'
  | 'NEUTRAL'
  | 'SHORT'
  | 'STRONG_SHORT';

export interface ZoneAnalysisResult {
  nearestDemand: SupplyDemandZone | null;
  nearestSupply: SupplyDemandZone | null;
  zonePosition: ZonePosition;
  zoneSignal: ZoneSignal;
  zoneBreakoutSignal: ZoneBreakoutSignal;
  zoneBreakoutReasons: string[];
  zoneSignalReasons: string[];
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
}

const SWING_LOOKBACK = 3;
const ZONE_MERGE_ATR_MULT = 0.8;
const SL_ATR_BUFFER = 0.5;
const NEAR_ZONE_ATR_MULT = 1.2;

function findSwingHighs(klines: Kline[], lookback = SWING_LOOKBACK): number[] {
  const swings: number[] = [];
  for (let i = lookback; i < klines.length - lookback; i++) {
    let isSwing = true;
    for (let j = 1; j <= lookback; j++) {
      if (klines[i].high <= klines[i - j].high || klines[i].high <= klines[i + j].high) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push(i);
  }
  return swings;
}

function findSwingLows(klines: Kline[], lookback = SWING_LOOKBACK): number[] {
  const swings: number[] = [];
  for (let i = lookback; i < klines.length - lookback; i++) {
    let isSwing = true;
    for (let j = 1; j <= lookback; j++) {
      if (klines[i].low >= klines[i - j].low || klines[i].low >= klines[i + j].low) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push(i);
  }
  return swings;
}

function buildZoneFromCluster(
  prices: number[],
  type: ZoneType,
  atr: number | null,
): SupplyDemandZone {
  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
  const padding = atr && atr > 0 ? atr * 0.25 : avg * 0.003;

  return {
    type,
    top: Math.max(...prices) + padding,
    bottom: Math.min(...prices) - padding,
    strength: prices.length,
    touches: prices.length,
  };
}

function clusterPivots(
  prices: number[],
  mergeDistance: number,
  type: ZoneType,
  atr: number | null,
): SupplyDemandZone[] {
  if (prices.length === 0) return [];

  const sorted = [...prices].sort((a, b) => a - b);
  const zones: SupplyDemandZone[] = [];
  let cluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - cluster[cluster.length - 1] <= mergeDistance) {
      cluster.push(sorted[i]);
    } else {
      zones.push(buildZoneFromCluster(cluster, type, atr));
      cluster = [sorted[i]];
    }
  }
  zones.push(buildZoneFromCluster(cluster, type, atr));

  return zones;
}

/** Fallback: structural high/low from recent range when pivots are sparse */
function fallbackZones(klines: Kline[], atr: number | null): SupplyDemandZone[] {
  const slice = klines.slice(-80);
  if (slice.length < 20) return [];

  const highs = slice.map(k => k.high);
  const lows = slice.map(k => k.low);
  const avg = slice[slice.length - 1].close;
  const pad = atr && atr > 0 ? atr * 0.3 : avg * 0.004;

  const rangeHigh = Math.max(...highs);
  const rangeLow = Math.min(...lows);
  const mid = (rangeHigh + rangeLow) / 2;

  return [
    {
      type: 'supply',
      top: rangeHigh + pad * 0.2,
      bottom: mid + pad,
      strength: 1,
      touches: 1,
    },
    {
      type: 'demand',
      top: mid - pad,
      bottom: rangeLow - pad * 0.2,
      strength: 1,
      touches: 1,
    },
  ];
}

function detectZones(klines: Kline[], atr: number | null): SupplyDemandZone[] {
  if (klines.length < 20) return [];

  const price = klines[klines.length - 1].close;
  const mergeDistance = atr && atr > 0 ? atr * ZONE_MERGE_ATR_MULT : price * 0.012;

  const swingHighPrices = findSwingHighs(klines).map(i => klines[i].high);
  const swingLowPrices = findSwingLows(klines).map(i => klines[i].low);

  let supplyZones = clusterPivots(swingHighPrices, mergeDistance, 'supply', atr);
  let demandZones = clusterPivots(swingLowPrices, mergeDistance, 'demand', atr);

  if (supplyZones.length === 0 && demandZones.length === 0) {
    return fallbackZones(klines, atr);
  }

  if (supplyZones.length === 0 || demandZones.length === 0) {
    const fallback = fallbackZones(klines, atr);
    if (supplyZones.length === 0) supplyZones = fallback.filter(z => z.type === 'supply');
    if (demandZones.length === 0) demandZones = fallback.filter(z => z.type === 'demand');
  }

  return [...demandZones, ...supplyZones];
}

function nearestDemand(zones: SupplyDemandZone[], price: number): SupplyDemandZone | null {
  const demands = zones
    .filter(z => z.type === 'demand' && z.bottom < price)
    .sort((a, b) => b.top - a.top);
  return demands[0] ?? null;
}

function nearestSupply(zones: SupplyDemandZone[], price: number): SupplyDemandZone | null {
  const supplies = zones
    .filter(z => z.type === 'supply' && z.top > price)
    .sort((a, b) => a.bottom - b.bottom);
  return supplies[0] ?? null;
}

function priceInZone(price: number, zone: SupplyDemandZone): boolean {
  return price >= zone.bottom && price <= zone.top;
}

function nearZone(price: number, zone: SupplyDemandZone, atr: number | null): boolean {
  const threshold = atr && atr > 0 ? atr * NEAR_ZONE_ATR_MULT : price * 0.01;
  if (zone.type === 'demand') {
    return price >= zone.bottom - threshold && price <= zone.top + threshold;
  }
  return price >= zone.bottom - threshold && price <= zone.top + threshold;
}

function resolveZonePosition(
  price: number,
  demand: SupplyDemandZone | null,
  supply: SupplyDemandZone | null,
  atr: number | null,
): ZonePosition {
  if (demand && priceInZone(price, demand)) return 'at_demand';
  if (supply && priceInZone(price, supply)) return 'at_supply';

  const distDemand = demand ? price - demand.top : Infinity;
  const distSupply = supply ? supply.bottom - price : Infinity;

  if (demand && supply) {
    if (distDemand < distSupply && nearZone(price, demand, atr)) return 'near_demand';
    if (distSupply < distDemand && nearZone(price, supply, atr)) return 'near_supply';
    return 'between';
  }
  if (demand && nearZone(price, demand, atr)) return 'near_demand';
  if (supply && nearZone(price, supply, atr)) return 'near_supply';
  if (demand || supply) return 'between';
  return null;
}

function inferDirection(
  zonePosition: ZonePosition,
  demand: SupplyDemandZone | null,
  supply: SupplyDemandZone | null,
  price: number,
  superTrend: 1 | -1 | null,
): 'buy' | 'sell' {
  if (zonePosition === 'at_demand' || zonePosition === 'near_demand') return 'buy';
  if (zonePosition === 'at_supply' || zonePosition === 'near_supply') return 'sell';

  if (demand && supply) {
    const distDemand = price - demand.top;
    const distSupply = supply.bottom - price;
    if (distDemand !== distSupply) return distDemand < distSupply ? 'buy' : 'sell';
  }
  if (superTrend === -1) return 'sell';
  return 'buy';
}

function avgVolume(klines: Kline[], period = 20): number {
  const slice = klines.slice(-period);
  if (slice.length === 0) return 0;
  return slice.reduce((s, k) => s + k.volume, 0) / slice.length;
}

function detectBreakout(
  klines: Kline[],
  demand: SupplyDemandZone | null,
  supply: SupplyDemandZone | null,
): 'bullish' | 'bearish' | null {
  if (klines.length < 3) return null;
  const last = klines[klines.length - 1];
  const prev = klines[klines.length - 2];

  if (supply && prev.close <= supply.top && last.close > supply.top) return 'bullish';
  if (demand && prev.close >= demand.bottom && last.close < demand.bottom) return 'bearish';
  if (demand && priceInZone(prev.close, demand) && last.close > demand.top) return 'bullish';
  if (supply && priceInZone(prev.close, supply) && last.close < supply.bottom) return 'bearish';

  return null;
}

function computeSlTp(
  direction: 'buy' | 'sell',
  price: number,
  demand: SupplyDemandZone | null,
  supply: SupplyDemandZone | null,
  atr: number | null,
): { stopLoss: number; takeProfit: number; riskReward: number } {
  const buffer = atr && atr > 0 ? atr * SL_ATR_BUFFER : price * 0.008;

  if (direction === 'buy') {
    const stopLoss = demand
      ? Math.max(demand.bottom - buffer, price * 0.9)
      : price - buffer * 2;
    const risk = Math.max(price - stopLoss, buffer);
    const takeProfit = supply
      ? Math.max(supply.bottom, price + risk * 2)
      : price + risk * 2;
    const reward = takeProfit - price;
    return { stopLoss, takeProfit, riskReward: reward / risk };
  }

  const stopLoss = supply
    ? supply.top + buffer
    : price + buffer * 2;
  const risk = Math.max(stopLoss - price, buffer);
  const takeProfit = demand
    ? Math.min(demand.top, price - risk * 2)
    : price - risk * 2;
  const reward = price - takeProfit;
  return { stopLoss, takeProfit, riskReward: reward / risk };
}

function countConfirmations(
  input: ZoneAnalysisInput,
  direction: 'buy' | 'sell',
  klines: Kline[],
): { count: number; reasons: string[] } {
  const reasons: string[] = [];
  let count = 0;
  const volAvg = avgVolume(klines);
  const lastVol = klines[klines.length - 1]?.volume ?? 0;
  const volSpike = volAvg > 0 && lastVol > volAvg * 1.1;

  if (direction === 'buy') {
    if (input.macdHistogram !== null && input.macdHistogram > 0) { count++; reasons.push('MACD bullish'); }
    if (input.superTrend === 1) { count++; reasons.push('SuperTrend bullish'); }
    if (input.rsi15m !== null && input.rsi15m >= 35 && input.rsi15m <= 75) { count++; reasons.push('RSI 15m OK'); }
    if (input.rsi1h !== null && input.rsi1h < 72) { count++; reasons.push('RSI 1H OK'); }
    if (input.stochRsiK !== null && input.stochRsiD !== null && input.stochRsiK >= input.stochRsiD) {
      count++; reasons.push('Stoch RSI K≥D');
    }
    if (volSpike) { count++; reasons.push('Volume spike'); }
    if (input.haTrend === 1) { count++; reasons.push('HA bullish'); }
    if ((input.haConsecutive ?? 0) >= 2) { count++; reasons.push('HA trend confirmed'); }
  } else {
    if (input.macdHistogram !== null && input.macdHistogram < 0) { count++; reasons.push('MACD bearish'); }
    if (input.superTrend === -1) { count++; reasons.push('SuperTrend bearish'); }
    if (input.rsi15m !== null && input.rsi15m >= 25 && input.rsi15m <= 65) { count++; reasons.push('RSI 15m weak'); }
    if (input.rsi1h !== null && input.rsi1h > 50) { count++; reasons.push('RSI 1H elevated'); }
    if (input.stochRsiK !== null && input.stochRsiD !== null && input.stochRsiK <= input.stochRsiD) {
      count++; reasons.push('Stoch RSI K≤D');
    }
    if (volSpike) { count++; reasons.push('Volume spike'); }
    if (input.haTrend === -1) { count++; reasons.push('HA bearish'); }
    if ((input.haConsecutive ?? 0) >= 2) { count++; reasons.push('HA trend confirmed'); }
  }

  return { count, reasons };
}

export function analyzeSupplyDemand(input: ZoneAnalysisInput): ZoneAnalysisResult {
  const empty: ZoneAnalysisResult = {
    nearestDemand: null,
    nearestSupply: null,
    zonePosition: null,
    zoneSignal: 'ZONE_NEUTRAL',
    zoneBreakoutSignal: 'NEUTRAL',
    zoneBreakoutReasons: [],
    zoneSignalReasons: [],
    stopLoss: null,
    takeProfit: null,
    riskReward: null,
  };

  if (input.klines.length < 20) return empty;

  const zones = detectZones(input.klines, input.atr);
  const demand = nearestDemand(zones, input.price);
  const supply = nearestSupply(zones, input.price);

  const zonePosition = resolveZonePosition(input.price, demand, supply, input.atr);
  const tradeDirection = inferDirection(zonePosition, demand, supply, input.price, input.superTrend);
  const baseline = computeSlTp(tradeDirection, input.price, demand, supply, input.atr);

  const reasons: string[] = [];
  if (demand) reasons.push(`Demand $${demand.bottom.toFixed(4)}–$${demand.top.toFixed(4)}`);
  if (supply) reasons.push(`Supply $${supply.bottom.toFixed(4)}–$${supply.top.toFixed(4)}`);

  const breakout = detectBreakout(input.klines, demand, supply);
  let zoneSignal: ZoneSignal = 'ZONE_NEUTRAL';
  let zoneBreakoutSignal: ZoneBreakoutSignal = 'NEUTRAL';
  const zoneBreakoutReasons: string[] = [];

  if (breakout === 'bullish') {
    zoneBreakoutReasons.push('Supply (S) zone qırıldı → yuxarı');
    const { count, reasons: conf } = countConfirmations(input, 'buy', input.klines);
    zoneBreakoutSignal = count >= 3 ? 'STRONG_LONG' : 'LONG';
    zoneBreakoutReasons.push(...conf);
    reasons.push('Supply breakout');
    reasons.push(...conf);
    if (count >= 4) zoneSignal = 'ZONE_STRONG_BUY';
    else if (count >= 2) zoneSignal = 'ZONE_BUY';
  } else if (breakout === 'bearish') {
    zoneBreakoutReasons.push('Demand (D) zone qırıldı → aşağı');
    const { count, reasons: conf } = countConfirmations(input, 'sell', input.klines);
    zoneBreakoutSignal = count >= 3 ? 'STRONG_SHORT' : 'SHORT';
    zoneBreakoutReasons.push(...conf);
    reasons.push('Demand breakdown');
    reasons.push(...conf);
    if (count >= 4) zoneSignal = 'ZONE_STRONG_SELL';
    else if (count >= 2) zoneSignal = 'ZONE_SELL';
  } else if (zonePosition === 'at_demand' || zonePosition === 'near_demand') {
    const { count, reasons: conf } = countConfirmations(input, 'buy', input.klines);
    const bouncing = input.klines.length >= 2 &&
      input.klines[input.klines.length - 1].close >= input.klines[input.klines.length - 2].close;
    if (bouncing && count >= 2) {
      zoneSignal = count >= 4 ? 'ZONE_STRONG_BUY' : 'ZONE_BUY';
      reasons.push('Demand zone reaction');
      reasons.push(...conf);
    }
  } else if (zonePosition === 'at_supply' || zonePosition === 'near_supply') {
    const { count, reasons: conf } = countConfirmations(input, 'sell', input.klines);
    const rejecting = input.klines.length >= 2 &&
      input.klines[input.klines.length - 1].close <= input.klines[input.klines.length - 2].close;
    if (rejecting && count >= 2) {
      zoneSignal = count >= 4 ? 'ZONE_STRONG_SELL' : 'ZONE_SELL';
      reasons.push('Supply zone rejection');
      reasons.push(...conf);
    }
  }

  return {
    nearestDemand: demand,
    nearestSupply: supply,
    zonePosition,
    zoneSignal,
    zoneBreakoutSignal,
    zoneBreakoutReasons,
    zoneSignalReasons: reasons,
    stopLoss: baseline.stopLoss,
    takeProfit: baseline.takeProfit,
    riskReward: baseline.riskReward,
  };
}
