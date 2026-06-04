export function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];

  // Seed with simple average of first 'period' values
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  seed /= period;
  ema.push(seed);

  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

export function getLatestEMA(values: number[], period: number): number | null {
  const ema = calculateEMA(values, period);
  if (ema.length === 0) return null;
  return ema[ema.length - 1];
}

export function getEMAArray(values: number[], period: number): number[] {
  return calculateEMA(values, period);
}
