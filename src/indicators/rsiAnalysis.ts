import { calculateRSI, getLatestRSI } from './rsi';
import { rsiLatchFromValues, type RsiDir, type RsiLatchState } from './rsiState';
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
  /** Qüvvədə olan RSI siqnalı — əks xətt kəsilənə qədər dəyişmir */
  latchDir: RsiDir;
  /** Həmin siqnalın yaşı (şam) */
  latchCandles: number;
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
 * RSI interpretasiya: LATCH + səviyyə + momentum (slope/turning) + trend gate.
 *
 * İstiqamət latch-dən gəlir: RSI 30-u aşağı kəsdikdə AL siqnalı yaranır və
 * RSI xəttin üstünə qayıtsa belə siqnal itmir — 70 kəsilib SAT verilənə qədər
 * AL qüvvədə qalır (MACD histoqramı ilə eyni məntiq). Cari səviyyə (OS/OB
 * bantları) və momentum yalnız siqnalın KEYFİYYƏTİNİ təyin edir, onu söndürmür.
 *
 * Trend gate saxlanılır: güclü downtrend-də RSI hələ də oversold bantındadırsa
 * erkən AL bloklanır (falling knife), güclü uptrend-də erkən SAT bloklanır.
 */
export function analyzeRsi(input: RsiAnalysisInput): RsiAnalysisResult {
  const reasons: string[] = [];
  const values = calculateRSI(input.closes, RSI_PERIOD);
  const rsi = values.length ? values[values.length - 1] : null;
  const latch: RsiLatchState = rsiLatchFromValues(values);

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
      latchDir: 0, latchCandles: 0,
    };
  }

  reasons.push(`RSI ${rsi.toFixed(1)}`);
  if (slope !== null) reasons.push(`RSI slope ${slope >= 0 ? '+' : ''}${slope.toFixed(1)}`);
  if (turningUp) reasons.push('RSI turning ▲');
  if (turningDown) reasons.push('RSI turning ▼');

  const strongOs = rsi < RSI_STRONG_OS;
  const mildOs = rsi < RSI_MILD_OS;
  const strongOb = rsi > RSI_STRONG_OB;
  const mildOb = rsi > RSI_MILD_OB;

  // Latch qüvvədə olan siqnalı verir. Latch hələ yaranmayıbsa (heç bir xətt
  // kəsilməyib) mild bant fallback kimi işləyir ki, warm-up-da da nəticə olsun.
  const bull = latch.dir === 1 || (latch.dir === 0 && mildOs);
  const bear = latch.dir === -1 || (latch.dir === 0 && mildOb);

  if (latch.dir !== 0) {
    reasons.push(
      `RSI siqnalı: ${latch.dir === 1 ? 'AL' : 'SAT'} — ${latch.candles} şam ` +
      `(əks xətt kəsilənə qədər qüvvədə)`,
    );
  }

  // Keyfiyyət: latch istiqaməti + cari zona/momentum onu gücləndirir
  const bullQuality = strongOs && turningUp ? 85
    : strongOs || (mildOs && turningUp) ? 72
    : mildOs ? 62
    : turningUp ? 55
    : 48;
  const bearQuality = strongOb && turningDown ? 85
    : strongOb || (mildOb && turningDown) ? 72
    : mildOb ? 62
    : turningDown ? 55
    : 48;

  const done = (bias: RsiBias, quality: number, note?: string): RsiAnalysisResult => {
    if (note) reasons.push(note);
    return {
      rsi, slope, turningUp, turningDown, regime, bias, quality, reasons,
      latchDir: latch.dir, latchCandles: latch.candles,
    };
  };

  // Range: latch saxlanılır, amma yatay bazarda keyfiyyət aşağı salınır
  if (regime === 'range') {
    if (bull) {
      return done('bullish', Math.min(bullQuality, strongOs && turningUp ? 60 : 45),
        'Yatay bazar — RSI AL siqnalı qüvvədə, keyfiyyət aşağı');
    }
    if (bear) {
      return done('bearish', Math.min(bearQuality, strongOb && turningDown ? 60 : 45),
        'Yatay bazar — RSI SAT siqnalı qüvvədə, keyfiyyət aşağı');
    }
    return done('neutral', 25, 'Yatay bazar — RSI siqnalı yoxdur');
  }

  // Güclü downtrend: RSI hələ oversold bantındadırsa erkən AL blok
  if (regime === 'downtrend') {
    if (bear) return done('bearish', bearQuality, 'Downtrend + RSI SAT — uyğun');
    if (bull && (mildOs || strongOs)) {
      return done('blocked', 15, 'Downtrend — oversold AL bloklandı (falling knife)');
    }
    if (bull) return done('bullish', Math.min(bullQuality, 45), 'Downtrend — RSI AL trendə zidd, zəif');
    return done('bearish', 45, 'Downtrend — neytral/ayı təzyiqi');
  }

  // Güclü uptrend: RSI hələ overbought bantındadırsa erkən SAT blok
  if (regime === 'uptrend') {
    if (bull) return done('bullish', bullQuality, 'Uptrend + RSI AL — uyğun');
    if (bear && (mildOb || strongOb)) {
      return done('blocked', 15, 'Uptrend — overbought SAT bloklandı (early short)');
    }
    if (bear) return done('bearish', Math.min(bearQuality, 45), 'Uptrend — RSI SAT trendə zidd, zəif');
    return done('bullish', 45, 'Uptrend — neytral/öküz təzyiqi');
  }

  return done(bull ? 'bullish' : bear ? 'bearish' : 'neutral', bull || bear ? 45 : 40);
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
