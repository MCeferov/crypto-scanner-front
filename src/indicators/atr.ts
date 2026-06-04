import type { Kline } from '../services/binanceApi';

export function calculateATR(klines: Kline[], period = 14): number[] {
  if (klines.length < period + 1) return [];
  const trueRanges: number[] = [];

  for (let i = 1; i < klines.length; i++) {
    const { high, low } = klines[i];
    const prevClose = klines[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return [];

  // Initial ATR = simple average
  let atr = trueRanges.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const results: number[] = [atr];

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    results.push(atr);
  }
  return results;
}

export function getLatestATR(klines: Kline[], period = 14): number | null {
  const results = calculateATR(klines, period);
  if (results.length === 0) return null;
  return results[results.length - 1];
}

// ATR as percentage of price
export function getATRPercent(klines: Kline[], period = 14): number | null {
  const atr = getLatestATR(klines, period);
  if (atr === null || klines.length === 0) return null;
  const price = klines[klines.length - 1].close;
  return (atr / price) * 100;
}
