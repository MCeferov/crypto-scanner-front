/**
 * RSI-nin vəziyyət (latch) modeli.
 *
 * Problem: RSI səviyyə indikatorudur — 30-un altına düşəndə AL, 70-in üstünə
 * çıxanda SAT deyir, amma xəttdən geri qayıdan kimi "aktivliyini itirir".
 * MACD isə histoqram işarəsini dəyişənə qədər eyni siqnalda qalır, ona görə
 * ikisi birlikdə istifadə olunanda RSI həmişə tez sönürdü.
 *
 * Həlli: RSI-yə də MACD məntiqi verilir — 30 kəsiləndə BUY latch olunur və
 * 70 kəsilib SAT verilənə qədər BUY qüvvədə qalır (və əksinə). Bu modul
 * bütün digər modulların (chart markerləri, cədvəl, setup, sync, yaş sayğacı)
 * istifadə etdiyi vahid mənbədir.
 */

import { calculateRSI } from './rsi';
import { latchAge, latchDirs, type SignalDir } from './signalLatch';
import { RSI_LATCH_OB, RSI_LATCH_OS, RSI_PERIOD } from './signalConfig';

export type RsiDir = SignalDir;

/** Cədvəldə RSI sütunu olan timeframe-lər */
export type RsiTfKey = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type RsiLatchMap = Record<RsiTfKey, RsiDir>;

export const EMPTY_RSI_LATCH_MAP: RsiLatchMap = {
  '1m': 0, '5m': 0, '15m': 0, '1h': 0, '4h': 0, '1d': 0,
};

export interface RsiLatchOptions {
  period?: number;
  oversold?: number;
  overbought?: number;
  /** Yaş sayğacı üçün maksimum geriyə baxış */
  maxLookback?: number;
}

export interface RsiLatchState {
  /** Qüvvədə olan istiqamət — əks xətt kəsilənə qədər dəyişmir */
  dir: RsiDir;
  /** Son flip-dən bəri şam sayı (dir !== 0 olduqda ≥ 1) */
  candles: number;
  /** Cari RSI dəyəri */
  rsi: number | null;
  /** Siqnalı doğuran şamdakı RSI (trigger anı) */
  triggerRsi: number | null;
  /** Siqnal ən son şamda dəyişdimi (təzə flip) */
  justFlipped: boolean;
}

export const NEUTRAL_RSI_LATCH: RsiLatchState = {
  dir: 0, candles: 0, rsi: null, triggerRsi: null, justFlipped: false,
};

/** BUY / SELL / NEUTRAL mətn qarşılığı */
export function rsiDirToSignal(dir: RsiDir): 'BUY' | 'SELL' | 'NEUTRAL' {
  return dir === 1 ? 'BUY' : dir === -1 ? 'SELL' : 'NEUTRAL';
}

/**
 * Trigger massivi: RSI oversold xəttinin altında olan şamlar BUY,
 * overbought xəttinin üstündə olanlar SELL trigger-i sayılır; qalanları 0.
 */
export function rsiTriggerDirs(
  values: readonly number[],
  oversold = RSI_LATCH_OS,
  overbought = RSI_LATCH_OB,
): RsiDir[] {
  const out: RsiDir[] = new Array(values.length).fill(0);
  for (let i = 0; i < values.length; i++) {
    if (values[i] < oversold) out[i] = 1;
    else if (values[i] > overbought) out[i] = -1;
  }
  return out;
}

/** Hazır RSI seriyasından latched istiqamət massivi */
export function latchedRsiDirsFromValues(
  values: readonly number[],
  oversold = RSI_LATCH_OS,
  overbought = RSI_LATCH_OB,
): RsiDir[] {
  return latchDirs(rsiTriggerDirs(values, oversold, overbought));
}

/** Hazır RSI seriyasından cari latch vəziyyəti */
export function rsiLatchFromValues(
  values: readonly number[],
  opts: RsiLatchOptions = {},
): RsiLatchState {
  if (values.length === 0) return NEUTRAL_RSI_LATCH;

  const oversold = opts.oversold ?? RSI_LATCH_OS;
  const overbought = opts.overbought ?? RSI_LATCH_OB;
  const dirs = latchedRsiDirsFromValues(values, oversold, overbought);
  const dir = dirs[dirs.length - 1];
  const rsi = values[values.length - 1];

  if (dir === 0) {
    return { ...NEUTRAL_RSI_LATCH, rsi };
  }

  const maxLookback = opts.maxLookback ?? Infinity;
  const candles = latchAge(dirs, maxLookback);
  // Flip anındakı indeks — latchAge şam sayını verir, ondan geri hesablanır.
  // Sayğac lookback limitinə dirənibsə flip daha geridədir: trigger naməlum.
  const flipIdx = dirs.length - candles;
  const capped = candles >= maxLookback;

  return {
    dir,
    candles,
    rsi,
    triggerRsi: capped ? null : (values[flipIdx] ?? null),
    justFlipped: candles === 1,
  };
}

/** Bağlanış qiymətlərindən birbaşa latch vəziyyəti */
export function computeRsiLatch(
  closes: number[],
  opts: RsiLatchOptions = {},
): RsiLatchState {
  return rsiLatchFromValues(calculateRSI(closes, opts.period ?? RSI_PERIOD), opts);
}
