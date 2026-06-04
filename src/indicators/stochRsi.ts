import { calculateRSI } from './rsi';
import { calculateEMA } from './ema';

export interface StochRSI {
  k: number;
  d: number;
}

export function calculateStochRSI(
  closes: number[],
  rsiPeriod = 14,
  stochPeriod = 14,
  kSmooth = 3,
  dSmooth = 3
): StochRSI[] {
  const rsiValues = calculateRSI(closes, rsiPeriod);
  if (rsiValues.length < stochPeriod) return [];

  const stochValues: number[] = [];
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const slice = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const minRSI = Math.min(...slice);
    const maxRSI = Math.max(...slice);
    const range = maxRSI - minRSI;
    const stoch = range === 0 ? 50 : ((rsiValues[i] - minRSI) / range) * 100;
    stochValues.push(stoch);
  }

  if (stochValues.length < kSmooth) return [];

  const kValues = calculateEMA(stochValues, kSmooth);
  if (kValues.length < dSmooth) return [];

  const dValues = calculateEMA(kValues, dSmooth);
  const offset = kValues.length - dValues.length;

  return dValues.map((d, i) => ({
    k: kValues[i + offset],
    d,
  }));
}

export function getLatestStochRSI(closes: number[]): StochRSI | null {
  const results = calculateStochRSI(closes);
  if (results.length === 0) return null;
  return results[results.length - 1];
}
