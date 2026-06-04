export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  percentB: number;
}

export function calculateBollingerBands(
  closes: number[],
  period = 20,
  stdDev = 2
): BollingerBands[] {
  if (closes.length < period) return [];
  const results: BollingerBands[] = [];

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    const upper = mean + stdDev * std;
    const lower = mean - stdDev * std;
    const bandwidth = (upper - lower) / mean;
    const percentB = upper !== lower ? (closes[i] - lower) / (upper - lower) : 0.5;
    results.push({ upper, middle: mean, lower, bandwidth, percentB });
  }
  return results;
}

export function getLatestBB(closes: number[]): BollingerBands | null {
  const results = calculateBollingerBands(closes);
  if (results.length === 0) return null;
  return results[results.length - 1];
}
