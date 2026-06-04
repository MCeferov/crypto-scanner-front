import type { Kline } from '../services/binanceApi';

export interface SuperTrendResult {
  trend: 1 | -1;
  value: number;
}

export function calculateSuperTrend(
  klines: Kline[],
  period = 10,
  multiplier = 3
): SuperTrendResult[] {
  if (klines.length < period + 1) return [];

  // Wilder's ATR
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const { high, low } = klines[i];
    const pc = klines[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - pc), Math.abs(low - pc)));
  }

  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const atrs: number[] = [atr];
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    atrs.push(atr);
  }

  const results: SuperTrendResult[] = [];
  let st = 0;
  let trend: 1 | -1 = 1;

  for (let i = period; i < klines.length; i++) {
    const a = atrs[i - period];
    const hl2 = (klines[i].high + klines[i].low) / 2;
    const upper = hl2 + multiplier * a;
    const lower = hl2 - multiplier * a;

    if (st === 0) {
      st = lower;
      trend = 1;
    } else if (trend === 1) {
      st = Math.max(lower, st);
      if (klines[i].close < st) { trend = -1; st = upper; }
    } else {
      st = Math.min(upper, st);
      if (klines[i].close > st) { trend = 1; st = lower; }
    }

    results.push({ trend, value: st });
  }

  return results;
}

export function getLatestSuperTrend(klines: Kline[]): SuperTrendResult | null {
  const r = calculateSuperTrend(klines);
  return r.length > 0 ? r[r.length - 1] : null;
}
