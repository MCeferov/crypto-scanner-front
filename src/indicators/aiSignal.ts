export type Signal = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface SignalInput {
  rsi15m: number | null;
  rsi1h: number | null;
  rsi4h: number | null;
  rsi1d: number | null;
  macdHistogram: number | null;
  stochRsiK: number | null;
  priceChange24h: number;
  haTrend: 1 | -1 | 0;
  haConsecutive: number;
  haSignal: import('./heikinAshi').HaSignal;
}

export interface SignalResult {
  signal: Signal;
  reasons: string[];
  bullishCount: number;
  bearishCount: number;
}

export function computeSignal(input: SignalInput): SignalResult {
  const reasons: string[] = [];
  let bullishCount = 0;
  let bearishCount = 0;

  const macdBullish = input.macdHistogram !== null && input.macdHistogram > 0;
  const macdBearish = input.macdHistogram !== null && input.macdHistogram < 0;
  const haBullish = input.haTrend === 1;
  const haBearish = input.haTrend === -1;
  // Daha seçici stoch həddi: 15/85 (əvvəl 20/80) — az saxta cross
  const stochOversold = input.stochRsiK !== null && input.stochRsiK < 15;
  const stochOverbought = input.stochRsiK !== null && input.stochRsiK > 85;

  if (input.rsi1h !== null) {
    if (input.rsi1h < 25) { bullishCount += 2; reasons.push('RSI 1H güclü oversold (<25)'); }
    else if (input.rsi1h < 38) { bullishCount += 1; reasons.push('RSI 1H low'); }
    else if (input.rsi1h > 75) { bearishCount += 2; reasons.push('RSI 1H güclü overbought (>75)'); }
    else if (input.rsi1h > 62) { bearishCount += 1; reasons.push('RSI 1H high'); }
  }
  if (input.rsi4h !== null) {
    if (input.rsi4h < 32) { bullishCount += 1; reasons.push('RSI 4H oversold'); }
    else if (input.rsi4h > 68) { bearishCount += 1; reasons.push('RSI 4H overbought'); }
  }
  if (input.rsi1d !== null) {
    if (input.rsi1d < 32) { bullishCount += 1; reasons.push('RSI 1D oversold'); }
    else if (input.rsi1d > 68) { bearishCount += 1; reasons.push('RSI 1D overbought'); }
  }

  if (macdBullish) { bullishCount += 1; reasons.push('MACD bullish'); }
  if (macdBearish) { bearishCount += 1; reasons.push('MACD bearish'); }

  if (haBullish && input.haConsecutive >= 2) {
    bullishCount += 2;
    reasons.push(`HA trend ▲${input.haConsecutive}`);
  } else if (haBearish && input.haConsecutive >= 2) {
    bearishCount += 2;
    reasons.push(`HA trend ▼${input.haConsecutive}`);
  }

  if (input.haSignal === 'STRONG_BUY' || input.haSignal === 'BUY') {
    bullishCount += input.haSignal === 'STRONG_BUY' ? 2 : 1;
    reasons.push(`HA signal ${input.haSignal.replace('_', ' ')}`);
  }
  if (input.haSignal === 'STRONG_SELL' || input.haSignal === 'SELL') {
    bearishCount += input.haSignal === 'STRONG_SELL' ? 2 : 1;
    reasons.push(`HA signal ${input.haSignal.replace('_', ' ')}`);
  }

  if (stochOversold) { bullishCount += 1; reasons.push('Stoch RSI oversold (<15)'); }
  if (stochOverbought) { bearishCount += 1; reasons.push('Stoch RSI overbought (>85)'); }

  const isStrongBuy =
    input.haSignal === 'STRONG_BUY' ||
    (input.rsi1h !== null && input.rsi1h < 28 && macdBullish && haBullish && input.haConsecutive >= 2);

  const isStrongSell =
    input.haSignal === 'STRONG_SELL' ||
    (input.rsi1h !== null && input.rsi1h > 72 && macdBearish && haBearish && input.haConsecutive >= 2);

  const isStrongBuy2 =
    input.rsi1h !== null && input.rsi1h < 32 &&
    input.rsi4h !== null && input.rsi4h < 42 &&
    macdBullish && haBullish;

  const isStrongSell2 =
    input.rsi1h !== null && input.rsi1h > 68 &&
    input.rsi4h !== null && input.rsi4h > 62 &&
    macdBearish && haBearish;

  let signal: Signal;
  if (isStrongBuy || isStrongBuy2) {
    signal = 'STRONG_BUY';
  } else if (isStrongSell || isStrongSell2) {
    signal = 'STRONG_SELL';
  } else if (bullishCount >= 3 && bullishCount > bearishCount + 1) {
    signal = 'BUY';
  } else if (bearishCount >= 3 && bearishCount > bullishCount + 1) {
    signal = 'SELL';
  } else {
    signal = 'NEUTRAL';
  }

  return { signal, reasons, bullishCount, bearishCount };
}
