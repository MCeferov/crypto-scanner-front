import { calculateEMA } from './ema';

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult[] {
  if (closes.length < slowPeriod + signalPeriod) return [];

  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);

  // Align arrays: emaFast has (closes.length - fastPeriod + 1) elements
  // emaSlow has (closes.length - slowPeriod + 1) elements
  // The difference in starting offset is (slowPeriod - fastPeriod)
  const offset = slowPeriod - fastPeriod;
  const alignedFast = emaFast.slice(offset);
  const macdLine: number[] = alignedFast.map((v, i) => v - emaSlow[i]);

  if (macdLine.length < signalPeriod) return [];

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const signalOffset = signalPeriod - 1;
  const alignedMacd = macdLine.slice(signalOffset);

  return alignedMacd.map((m, i) => ({
    macd: m,
    signal: signalLine[i],
    histogram: m - signalLine[i],
  }));
}

export function getLatestMACD(closes: number[]): MACDResult | null {
  const results = calculateMACD(closes);
  if (results.length === 0) return null;
  return results[results.length - 1];
}
