export interface TrendScoreInput {
  rsi1h: number | null;
  rsi4h: number | null;
  rsi1d: number | null;
  macdHistogram: number | null;
  priceChange24h: number;
  stochRsiK: number | null;
  haTrend: 1 | -1 | 0;
  haConsecutive: number;
}

export function calculateTrendScore(input: TrendScoreInput): number {
  let score = 0;
  let maxScore = 0;

  if (input.rsi1h !== null) {
    maxScore += 22;
    const r = input.rsi1h;
    if (r >= 40 && r <= 65) score += 22;
    else if (r > 65 && r <= 70) score += 18;
    else if (r > 70) score += 8;
    else if (r >= 30 && r < 40) score += 12;
    else score += 4;
  }

  if (input.rsi4h !== null) {
    maxScore += 15;
    const r = input.rsi4h;
    if (r >= 45 && r <= 70) score += 15;
    else if (r > 70) score += 6;
    else if (r >= 35) score += 8;
    else score += 2;
  }

  if (input.rsi1d !== null) {
    maxScore += 10;
    const r = input.rsi1d;
    if (r >= 45 && r <= 70) score += 10;
    else if (r > 70) score += 4;
    else if (r >= 35) score += 6;
    else score += 1;
  }

  if (input.macdHistogram !== null) {
    maxScore += 18;
    if (input.macdHistogram > 0) score += 18;
  }

  // Heikin Ashi trend (replaces EMA)
  maxScore += 25;
  if (input.haTrend === 1) {
    score += 12 + Math.min(13, input.haConsecutive * 3);
  } else if (input.haTrend === -1) {
    score += Math.max(0, 8 - Math.min(8, input.haConsecutive * 2));
  } else {
    score += 12;
  }

  maxScore += 10;
  if (input.priceChange24h > 5) score += 10;
  else if (input.priceChange24h > 2) score += 8;
  else if (input.priceChange24h > 0) score += 6;
  else if (input.priceChange24h > -2) score += 3;

  if (input.stochRsiK !== null) {
    maxScore += 5;
    if (input.stochRsiK > 50 && input.stochRsiK < 90) score += 5;
    else if (input.stochRsiK >= 90) score += 2;
    else score += 1;
  }

  if (maxScore === 0) return 50;
  return Math.round((score / maxScore) * 100);
}
