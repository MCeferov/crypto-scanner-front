/**
 * Single semantic palette (TradingView greens/reds) — the app previously
 * mixed a second Binance palette (#0ecb81/#f6465d) for the same "up/down"
 * meaning in the same viewport. Neutrals use theme tokens so they stay
 * readable in light mode.
 */
const UP = '#26a69a';
const UP_SOFT = '#4db6ac';
const DOWN = '#ef5350';
const WARN = '#f3a52f';
const WARN_SOFT = '#f6855d';
const NEUTRAL = 'var(--dim)';

export function getRSIColor(rsi: number | null): string {
  if (rsi === null) return NEUTRAL;
  if (rsi < 30) return UP;
  if (rsi < 40) return UP_SOFT;
  if (rsi < 60) return 'var(--muted)';
  if (rsi < 70) return WARN;
  return DOWN;
}

export function getRSIBg(rsi: number | null): string {
  if (rsi === null) return 'rgba(100,116,139,0.10)';
  if (rsi < 30) return 'rgba(38,166,154,0.18)';
  if (rsi < 40) return 'rgba(77,182,172,0.14)';
  if (rsi < 60) return 'rgba(100,116,139,0.12)';
  if (rsi < 70) return 'rgba(243,165,47,0.16)';
  return 'rgba(239,83,80,0.18)';
}

export function getChangeColor(value: number): string {
  if (value > 0) return UP;
  if (value < 0) return DOWN;
  return NEUTRAL;
}

export function getTrendScoreColor(score: number): string {
  if (score >= 75) return UP;
  if (score >= 60) return UP_SOFT;
  if (score >= 45) return WARN;
  if (score >= 30) return WARN_SOFT;
  return DOWN;
}

export function getSignalColor(signal: string): string {
  switch (signal) {
    case 'STRONG_BUY': return UP;
    case 'BUY': return UP_SOFT;
    case 'SELL': return WARN;
    case 'STRONG_SELL': return DOWN;
    default: return NEUTRAL;
  }
}

export function getEMAPositionColor(price: number, ema: number | null): string {
  if (ema === null) return NEUTRAL;
  return price > ema ? UP : DOWN;
}
