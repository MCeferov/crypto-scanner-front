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
  const stochOversold = input.stochRsiK !== null && input.stochRsiK < 20;
  const stochOverbought = input.stochRsiK !== null && input.stochRsiK > 80;

  if (input.rsi1h !== null) {
    if (input.rsi1h < 30) { bullishCount += 2; reasons.push('HA-RSI 1H oversold'); }
    else if (input.rsi1h < 40) { bullishCount += 1; reasons.push('HA-RSI 1H low'); }
    else if (input.rsi1h > 70) { bearishCount += 2; reasons.push('HA-RSI 1H overbought'); }
    else if (input.rsi1h > 60) { bearishCount += 1; reasons.push('HA-RSI 1H high'); }
  }
  if (input.rsi4h !== null) {
    if (input.rsi4h < 35) { bullishCount += 1; reasons.push('HA-RSI 4H oversold'); }
    else if (input.rsi4h > 65) { bearishCount += 1; reasons.push('HA-RSI 4H overbought'); }
  }
  if (input.rsi1d !== null) {
    if (input.rsi1d < 35) { bullishCount += 1; reasons.push('HA-RSI 1D oversold'); }
    else if (input.rsi1d > 65) { bearishCount += 1; reasons.push('HA-RSI 1D overbought'); }
  }

  if (macdBullish) { bullishCount += 1; reasons.push('HA-MACD bullish'); }
  if (macdBearish) { bearishCount += 1; reasons.push('HA-MACD bearish'); }

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

  if (stochOversold) { bullishCount += 1; reasons.push('HA-Stoch RSI oversold'); }
  if (stochOverbought) { bearishCount += 1; reasons.push('HA-Stoch RSI overbought'); }

  const isStrongBuy =
    input.haSignal === 'STRONG_BUY' ||
    (input.rsi1h !== null && input.rsi1h < 30 && macdBullish && haBullish && input.haConsecutive >= 2);

  const isStrongSell =
    input.haSignal === 'STRONG_SELL' ||
    (input.rsi1h !== null && input.rsi1h > 70 && macdBearish && haBearish && input.haConsecutive >= 2);

  const isStrongBuy2 =
    input.rsi1h !== null && input.rsi1h < 35 &&
    input.rsi4h !== null && input.rsi4h < 40 &&
    macdBullish && haBullish;

  const isStrongSell2 =
    input.rsi1h !== null && input.rsi1h > 65 &&
    input.rsi4h !== null && input.rsi4h > 65 &&
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
