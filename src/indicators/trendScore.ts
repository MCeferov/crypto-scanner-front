export interface TrendScoreInput {
  rsi1h: number | null;
  rsi4h: number | null;
  rsi1d: number | null;
  macdHistogram: number | null;
  price: number;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  priceChange24h: number;
  stochRsiK: number | null;
}

export function calculateTrendScore(input: TrendScoreInput): number {
  let score = 0;
  let maxScore = 0;

  // RSI 1H component (0–22)
  if (input.rsi1h !== null) {
    maxScore += 22;
    const r = input.rsi1h;
    if (r >= 40 && r <= 65) score += 22;
    else if (r > 65 && r <= 70) score += 18;
    else if (r > 70) score += 8;
    else if (r >= 30 && r < 40) score += 12;
    else score += 4;
  }

  // RSI 4H trend confirmation (0–15)
  if (input.rsi4h !== null) {
    maxScore += 15;
    const r = input.rsi4h;
    if (r >= 45 && r <= 70) score += 15;
    else if (r > 70) score += 6;
    else if (r >= 35) score += 8;
    else score += 2;
  }

  // RSI 1D macro trend (0–10)
  if (input.rsi1d !== null) {
    maxScore += 10;
    const r = input.rsi1d;
    if (r >= 45 && r <= 70) score += 10;
    else if (r > 70) score += 4;
    else if (r >= 35) score += 6;
    else score += 1;
  }

  // MACD histogram (0–18)
  if (input.macdHistogram !== null) {
    maxScore += 18;
    if (input.macdHistogram > 0) score += 18;
    else score += 0;
  }

  // EMA position (0–25): EMA20 (8) + EMA50 (9) + EMA200 (8)
  if (input.ema20 !== null) {
    maxScore += 8;
    if (input.price > input.ema20) score += 8;
  }
  if (input.ema50 !== null) {
    maxScore += 9;
    if (input.price > input.ema50) score += 9;
  }
  if (input.ema200 !== null) {
    maxScore += 8;
    if (input.price > input.ema200) score += 8;
  }

  // 24h Price momentum (0–10)
  maxScore += 10;
  if (input.priceChange24h > 5) score += 10;
  else if (input.priceChange24h > 2) score += 8;
  else if (input.priceChange24h > 0) score += 6;
  else if (input.priceChange24h > -2) score += 3;
  else score += 0;

  // Stochastic RSI K (0–5)
  if (input.stochRsiK !== null) {
    maxScore += 5;
    if (input.stochRsiK > 50 && input.stochRsiK < 90) score += 5;
    else if (input.stochRsiK >= 90) score += 2;
    else score += 1;
  }

  if (maxScore === 0) return 50;
  return Math.round((score / maxScore) * 100);
}
