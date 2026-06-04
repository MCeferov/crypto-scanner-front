export function calculateRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];

  const rsiValues: number[] = [];

  // Calculate gains and losses
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Initial averages (simple mean for first period)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  const computeRSI = (ag: number, al: number) => {
    if (al === 0) return 100;
    const rs = ag / al;
    return 100 - 100 / (1 + rs);
  };

  rsiValues.push(computeRSI(avgGain, avgLoss));

  // Wilder's smoothing for subsequent values
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsiValues.push(computeRSI(avgGain, avgLoss));
  }

  return rsiValues;
}

export function getLatestRSI(closes: number[], period = 14): number | null {
  const values = calculateRSI(closes, period);
  if (values.length === 0) return null;
  return values[values.length - 1];
}
