export type Signal = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface SignalInput {
  rsi15m: number | null;
  rsi1h: number | null;
  rsi4h: number | null;
  rsi1d: number | null;
  macdHistogram: number | null;
  price: number;
  ema50: number | null;
  ema200: number | null;
  stochRsiK: number | null;
  priceChange24h: number;
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
  const aboveEMA50 = input.ema50 !== null && input.price > input.ema50;
  const belowEMA50 = input.ema50 !== null && input.price < input.ema50;
  const aboveEMA200 = input.ema200 !== null && input.price > input.ema200;
  const belowEMA200 = input.ema200 !== null && input.price < input.ema200;
  const stochOversold = input.stochRsiK !== null && input.stochRsiK < 20;
  const stochOverbought = input.stochRsiK !== null && input.stochRsiK > 80;

  // RSI signals
  if (input.rsi1h !== null) {
    if (input.rsi1h < 30) { bullishCount += 2; reasons.push('RSI 1H oversold (<30)'); }
    else if (input.rsi1h < 40) { bullishCount += 1; reasons.push('RSI 1H low (<40)'); }
    else if (input.rsi1h > 70) { bearishCount += 2; reasons.push('RSI 1H overbought (>70)'); }
    else if (input.rsi1h > 60) { bearishCount += 1; reasons.push('RSI 1H high (>60)'); }
  }
  if (input.rsi4h !== null) {
    if (input.rsi4h < 35) { bullishCount += 1; reasons.push('RSI 4H oversold'); }
    else if (input.rsi4h > 65) { bearishCount += 1; reasons.push('RSI 4H overbought'); }
  }
  if (input.rsi1d !== null) {
    if (input.rsi1d < 35) { bullishCount += 1; reasons.push('RSI 1D oversold'); }
    else if (input.rsi1d > 65) { bearishCount += 1; reasons.push('RSI 1D overbought'); }
  }

  // MACD signals
  if (macdBullish) { bullishCount += 1; reasons.push('MACD bullish crossover'); }
  if (macdBearish) { bearishCount += 1; reasons.push('MACD bearish crossover'); }

  // EMA signals
  if (aboveEMA200) { bullishCount += 2; reasons.push('Price above EMA200'); }
  if (belowEMA200) { bearishCount += 2; reasons.push('Price below EMA200'); }
  if (aboveEMA50) { bullishCount += 1; reasons.push('Price above EMA50'); }
  if (belowEMA50) { bearishCount += 1; reasons.push('Price below EMA50'); }

  // Stochastic RSI signals
  if (stochOversold) { bullishCount += 1; reasons.push('Stoch RSI oversold'); }
  if (stochOverbought) { bearishCount += 1; reasons.push('Stoch RSI overbought'); }

  // STRONG BUY: RSI < 30 + MACD bullish + above EMA200
  const isStrongBuy =
    input.rsi1h !== null && input.rsi1h < 30 &&
    macdBullish && aboveEMA200;

  // STRONG SELL: RSI > 70 + MACD bearish + below EMA200
  const isStrongSell =
    input.rsi1h !== null && input.rsi1h > 70 &&
    macdBearish && belowEMA200;

  // STRONG BUY alternate: RSI 1H <35 + RSI 4H <40 + MACD bullish
  const isStrongBuy2 =
    input.rsi1h !== null && input.rsi1h < 35 &&
    input.rsi4h !== null && input.rsi4h < 40 &&
    macdBullish;

  // STRONG SELL alternate: RSI 1H >65 + RSI 4H >65 + MACD bearish
  const isStrongSell2 =
    input.rsi1h !== null && input.rsi1h > 65 &&
    input.rsi4h !== null && input.rsi4h > 65 &&
    macdBearish;

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
