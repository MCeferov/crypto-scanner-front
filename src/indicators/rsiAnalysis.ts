import { calculateRSI, getLatestRSI } from './rsi';
import {
  RSI_PERIOD,
  RSI_STRONG_OS,
  RSI_STRONG_OB,
  RSI_MILD_OS,
  RSI_MILD_OB,
} from './signalConfig';

export type RsiBias = 'bullish' | 'bearish' | 'neutral' | 'blocked';
export type MarketRegime = 'uptrend' | 'downtrend' | 'range';

export interface RsiAnalysisInput {
  closes: number[];
  /** Higher-TF closes for trend gate (4H preferred, else 1H) */
  trendCloses?: number[];
  /** SuperTrend on higher TF: 1 bull, -1 bear */
  higherTfTrend?: 1 | -1 | null;
  atrPercent?: number | null;
}

export interface RsiAnalysisResult {
  rsi: number | null;
  slope: number | null;
  turningUp: boolean;
  turningDown: boolean;
  regime: MarketRegime;
  bias: RsiBias;
  quality: number;
  reasons: string[];
}

function emaSlope(closes: number[], period = 20): number | null {
  if (closes.length < period + 3) return null;
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const k = 2 / (period + 1);
  const series: number[] = [ema];
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    series.push(ema);
  }
  const n = series.length;
  if (n < 4) return null;
  return series[n - 1] - series[n - 4];
}

function detectRegime(
  trendCloses: number[] | undefined,
  higherTfTrend: 1 | -1 | null | undefined,
  atrPercent: number | null | undefined,
): MarketRegime {
  if (higherTfTrend === 1) return 'uptrend';
  if (higherTfTrend === -1) return 'downtrend';

  const slope = trendCloses ? emaSlope(trendCloses, 20) : null;
  if (slope !== null) {
    const mid = trendCloses![trendCloses!.length - 1];
    const rel = mid > 0 ? (slope / mid) * 100 : 0;
    if (rel > 0.15) return 'uptrend';
    if (rel < -0.15) return 'downtrend';
  }

  if (atrPercent != null && atrPercent < 0.8) return 'range';
  return 'range';
}

/**
 * RSI interpretasiya: səviyyə + momentum (slope/turning) + higher-TF trend gate.
 * Güclü downtrend-də erkən AL, güclü uptrend-də erkən SAT bloklanır.
 */
export function analyzeRsi(input: RsiAnalysisInput): RsiAnalysisResult {
  const reasons: string[] = [];
  const values = calculateRSI(input.closes, RSI_PERIOD);
  const rsi = values.length ? values[values.length - 1] : null;

  let slope: number | null = null;
  let turningUp = false;
  let turningDown = false;

  if (values.length >= 4) {
    const a = values[values.length - 1];
    const b = values[values.length - 2];
    const c = values[values.length - 3];
    const d = values[values.length - 4];
    slope = a - d;
    turningUp = b <= c && a > b && slope > 0;
    turningDown = b >= c && a < b && slope < 0;
  }

  const regime = detectRegime(input.trendCloses, input.higherTfTrend, input.atrPercent);
  reasons.push(`Rejim: ${regime}`);

  if (rsi === null) {
    return {
      rsi: null, slope, turningUp, turningDown, regime,
      bias: 'neutral', quality: 0, reasons: ['RSI məlumatı yoxdur'],
    };
  }

  reasons.push(`RSI ${rsi.toFixed(1)}`);
  if (slope !== null) reasons.push(`RSI slope ${slope >= 0 ? '+' : ''}${slope.toFixed(1)}`);
  if (turningUp) reasons.push('RSI turning ▲');
  if (turningDown) reasons.push('RSI turning ▼');

  let bias: RsiBias = 'neutral';
  let quality = 40;

  const strongOs = rsi < RSI_STRONG_OS;
  const mildOs = rsi < RSI_MILD_OS;
  const strongOb = rsi > RSI_STRONG_OB;
  const mildOb = rsi > RSI_MILD_OB;

  // Range: səviyyə siqnallarını zəiflətmək
  if (regime === 'range') {
    if (strongOs && turningUp) {
      bias = 'bullish';
      quality = 55;
      reasons.push('Range + güclü OS + turning — ehtiyatlı AL');
    } else if (strongOb && turningDown) {
      bias = 'bearish';
      quality = 55;
      reasons.push('Range + güclü OB + turning — ehtiyatlı SAT');
    } else {
      bias = 'neutral';
      quality = 25;
      reasons.push('Yatay bazar — RSI səviyyə siqnalı söndürülüb');
    }
    return { rsi, slope, turningUp, turningDown, regime, bias, quality, reasons };
  }

  // Güclü downtrend: erkən AL blok
  if (regime === 'downtrend') {
    if (mildOb || strongOb) {
      if (turningDown || strongOb) {
        bias = 'bearish';
        quality = strongOb && turningDown ? 85 : 70;
        reasons.push('Downtrend + RSI yüksək — SAT uyğun');
      }
    } else if (mildOs || strongOs) {
      bias = 'blocked';
      quality = 15;
      reasons.push('Downtrend — oversold AL bloklandı (falling knife)');
    } else {
      bias = 'bearish';
      quality = 45;
      reasons.push('Downtrend — neytral/ayı təzyiqi');
    }
    return { rsi, slope, turningUp, turningDown, regime, bias, quality, reasons };
  }

  // Güclü uptrend: erkən SAT blok
  if (regime === 'uptrend') {
    if (mildOs || strongOs) {
      if (turningUp || strongOs) {
        bias = 'bullish';
        quality = strongOs && turningUp ? 85 : 70;
        reasons.push('Uptrend + RSI aşağı — AL uyğun');
      }
    } else if (mildOb || strongOb) {
      bias = 'blocked';
      quality = 15;
      reasons.push('Uptrend — overbought SAT bloklandı (early short)');
    } else {
      bias = 'bullish';
      quality = 45;
      reasons.push('Uptrend — neytral/öküz təzyiqi');
    }
    return { rsi, slope, turningUp, turningDown, regime, bias, quality, reasons };
  }

  return { rsi, slope, turningUp, turningDown, regime, bias, quality, reasons };
}

/** Setup/AI üçün skor: 1–5 (3 = neytral) */
export function rsiAnalysisToScore(result: RsiAnalysisResult): number {
  if (result.bias === 'blocked') return 3;
  if (result.bias === 'bullish') {
    if (result.quality >= 80) return 4.6;
    if (result.quality >= 60) return 4.1;
    return 3.7;
  }
  if (result.bias === 'bearish') {
    if (result.quality >= 80) return 1.4;
    if (result.quality >= 60) return 1.9;
    return 2.3;
  }
  return 3;
}

export function getRsiSnapshot(closes: number[]): number | null {
  return getLatestRSI(closes, RSI_PERIOD);
}
