import type { Kline } from '../services/binanceApi';

export interface HeikinAshiCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export type HaSignal = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface HaAnalysis {
  trend: 1 | -1 | 0;
  consecutive: number;
  signal: HaSignal;
  reasons: string[];
}

export function toHeikinAshi(klines: Kline[]): HeikinAshiCandle[] {
  const ha: HeikinAshiCandle[] = [];
  for (let i = 0; i < klines.length; i++) {
    const k = klines[i];
    const haClose = (k.open + k.high + k.low + k.close) / 4;
    const haOpen = i === 0 ? (k.open + k.close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
    ha.push({
      open: haOpen,
      high: Math.max(k.high, haOpen, haClose),
      low: Math.min(k.low, haOpen, haClose),
      close: haClose,
    });
  }
  return ha;
}

function isBullish(c: HeikinAshiCandle): boolean {
  return c.close > c.open;
}

function wickRatio(c: HeikinAshiCandle): { lower: number; upper: number } {
  const range = c.high - c.low;
  if (range <= 0) return { lower: 0, upper: 0 };
  const bodyBottom = Math.min(c.open, c.close);
  const bodyTop = Math.max(c.open, c.close);
  return {
    lower: (bodyBottom - c.low) / range,
    upper: (c.high - bodyTop) / range,
  };
}

/** Strong HA: bullish with tiny lower wick, or bearish with tiny upper wick */
function isStrongBullish(c: HeikinAshiCandle): boolean {
  if (!isBullish(c)) return false;
  return wickRatio(c).lower < 0.15;
}

function isStrongBearish(c: HeikinAshiCandle): boolean {
  if (isBullish(c)) return false;
  return wickRatio(c).upper < 0.15;
}

function countConsecutive(ha: HeikinAshiCandle[], bullish: boolean): number {
  let n = 0;
  for (let i = ha.length - 1; i >= 0; i--) {
    if (isBullish(ha[i]) === bullish) n++;
    else break;
  }
  return n;
}

export function analyzeHeikinAshi(klines: Kline[]): HaAnalysis {
  const empty: HaAnalysis = { trend: 0, consecutive: 0, signal: 'NEUTRAL', reasons: [] };
  if (klines.length < 5) return empty;

  const ha = toHeikinAshi(klines);
  const last = ha[ha.length - 1];
  const prev = ha[ha.length - 2];
  const bullish = isBullish(last);
  const consecutive = countConsecutive(ha, bullish);
  const trend: 1 | -1 | 0 = bullish ? 1 : -1;

  const reasons: string[] = [];
  const reversalUp = !isBullish(prev) && bullish;
  const reversalDown = isBullish(prev) && !bullish;

  if (reversalUp) reasons.push('HA bullish reversal');
  if (reversalDown) reasons.push('HA bearish reversal');
  if (consecutive >= 2) {
    reasons.push(`${consecutive} consecutive HA ${bullish ? 'green' : 'red'} candles`);
  }

  let signal: HaSignal = 'NEUTRAL';

  if (isStrongBullish(last) && consecutive >= 3) {
    signal = 'STRONG_BUY';
    reasons.push('Strong HA uptrend (no lower wick)');
  } else if (reversalUp && isStrongBullish(last)) {
    signal = 'STRONG_BUY';
  } else if (bullish && consecutive >= 2) {
    signal = 'BUY';
  } else if (isStrongBearish(last) && consecutive >= 3) {
    signal = 'STRONG_SELL';
    reasons.push('Strong HA downtrend (no upper wick)');
  } else if (reversalDown && isStrongBearish(last)) {
    signal = 'STRONG_SELL';
  } else if (!bullish && consecutive >= 2) {
    signal = 'SELL';
  }

  return { trend, consecutive, signal, reasons };
}

/** Convert real klines → synthetic klines with HA OHLC (volume unchanged) */
export function heikinAshiToKlines(klines: Kline[]): Kline[] {
  const ha = toHeikinAshi(klines);
  return klines.map((k, i) => ({
    ...k,
    open: ha[i].open,
    high: ha[i].high,
    low: ha[i].low,
    close: ha[i].close,
  }));
}
