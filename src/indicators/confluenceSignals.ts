import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import type { Kline } from '../services/binanceApi';
import type { IndicatorSettings, SignalIndicatorKey, SignalParticipation } from '../types/chart';
import { calculateRSI } from './rsi';
import { calculateMACD } from './macd';
import { calculateStochRSI } from './stochRsi';
import { calculateSuperTrend } from './supertrend';
import { toHeikinAshi } from './heikinAshi';
import { latchDirs, type SignalDir } from './signalLatch';
import { rsiTriggerDirs } from './rsiState';
import { STUDY_BY_KEY, computeStudySignal } from './library/studies';

const BUY_COLOR = '#26a69a';
const SELL_COLOR = '#ef5350';

/**
 * Hər indikator üçün kline massivi ilə eyni uzunluqda TRIGGER massivi qurulur.
 * Buradakı 0 "trigger yoxdur" deməkdir — sonra latchDirs() onu son aktiv
 * istiqamətlə doldurur. Warm-up dövründə (indikator hələ hesablana bilmir)
 * dəyər 0 qalır və latch də 0 saxlayır, ona görə siqnal yaranmır.
 */
function rsiDirs(klines: Kline[], s: IndicatorSettings): SignalDir[] {
  const dirs: SignalDir[] = new Array(klines.length).fill(0);
  const values = calculateRSI(klines.map(k => k.close), s.rsi.period);
  const triggers = rsiTriggerDirs(values, s.rsi.oversold, s.rsi.overbought);
  const offset = klines.length - values.length;
  for (let i = 0; i < triggers.length; i++) dirs[offset + i] = triggers[i];
  return dirs;
}

function stochRsiDirs(klines: Kline[], s: IndicatorSettings): SignalDir[] {
  const dirs: SignalDir[] = new Array(klines.length).fill(0);
  const { rsiPeriod, stochPeriod, kSmooth, dSmooth, oversold, overbought } = s.stochRsi;
  const values = calculateStochRSI(klines.map(k => k.close), rsiPeriod, stochPeriod, kSmooth, dSmooth);
  const offset = klines.length - values.length;
  for (let i = 0; i < values.length; i++) {
    if (values[i].k < oversold) dirs[offset + i] = 1;
    else if (values[i].k > overbought) dirs[offset + i] = -1;
  }
  return dirs;
}

function macdDirs(klines: Kline[], s: IndicatorSettings): SignalDir[] {
  const dirs: SignalDir[] = new Array(klines.length).fill(0);
  const values = calculateMACD(klines.map(k => k.close), s.macd.fast, s.macd.slow, s.macd.signal);
  const offset = klines.length - values.length;
  for (let i = 0; i < values.length; i++) {
    if (values[i].histogram > 0) dirs[offset + i] = 1;
    else if (values[i].histogram < 0) dirs[offset + i] = -1;
  }
  return dirs;
}

function superTrendDirs(klines: Kline[], s: IndicatorSettings): SignalDir[] {
  const dirs: SignalDir[] = new Array(klines.length).fill(0);
  const values = calculateSuperTrend(klines, s.superTrend.period, s.superTrend.multiplier);
  const offset = klines.length - values.length;
  for (let i = 0; i < values.length; i++) {
    dirs[offset + i] = values[i].trend;
  }
  return dirs;
}

function heikinAshiDirs(klines: Kline[]): SignalDir[] {
  const ha = toHeikinAshi(klines);
  return ha.map(c => (c.close > c.open ? 1 : c.close < c.open ? -1 : 0));
}

/** Qrafikə quraşdırılmış beşlik — parametrləri IndicatorSettings-dən gəlir */
const BUILTIN_DIR_BUILDERS: Record<string, (klines: Kline[], s: IndicatorSettings) => SignalDir[]> = {
  rsi: rsiDirs,
  stochRsi: stochRsiDirs,
  macd: macdDirs,
  superTrend: superTrendDirs,
  heikinAshi: (klines) => heikinAshiDirs(klines),
};

/**
 * Bir iştirakçının trigger massivini qurur.
 *
 * Əvvəlcə quraşdırılmış beşliyə baxılır, sonra kitabxana registrinə. Registr
 * indikatoru öz signal() qaydasını özü elan edir və eyni calc*() nəticəsindən
 * qidalanır ki, qrafikdə görünən rəqəmlə siqnalın rəqəmi ayrılmasın.
 *
 * DİQQƏT: iştirak indikatorun qrafikdə GÖRÜNMƏSİNDƏN asılı deyil — MACD-ni
 * panel açmadan da siqnala qata bilərsən (mövcud davranış belədir).
 */
function buildDirs(key: string, klines: Kline[], s: IndicatorSettings): SignalDir[] | null {
  const builtin = BUILTIN_DIR_BUILDERS[key];
  if (builtin) return builtin(klines, s);

  const def = STUDY_BY_KEY[key];
  if (!def?.signal) return null;
  return computeStudySignal(def, klines, s.studies?.[key]?.params ?? {});
}

/** Kline-larda real həcm varmı — Yahoo forex-də həmişə 0 olur */
function hasRealVolume(klines: Kline[]): boolean {
  return klines.some(k => (k.volume ?? 0) > 0);
}

/** Açar tanınırmı — köhnə yaddaşda qalmış naməlum açar mühərriki sındırmasın */
function isKnownKey(key: string): boolean {
  return BUILTIN_DIR_BUILDERS[key] !== undefined || typeof STUDY_BY_KEY[key]?.signal === 'function';
}

function activeKeys(
  participation: SignalParticipation,
  volumeOk: boolean,
): SignalIndicatorKey[] {
  return Object.keys(participation).filter(key => {
    if (!participation[key] || !isKnownKey(key)) return false;
    // Həcm tələb edən indikator həcmsiz aktivdə heç vaxt trigger verə bilməz
    // və AND şərtini əbədi bloklayardı — belə halda iştirakçı sayılmır.
    if (STUDY_BY_KEY[key]?.needsVolume && !volumeOk) return false;
    return true;
  });
}

/**
 * Configurable indicator confluence engine.
 *
 * Yalnız CLOSED şamlar üzərində işləyir (closeTime <= now) — forming şam
 * heç vaxt qiymətləndirilmir: no repaint, no intrabar signal, no look-ahead.
 *
 * BUY marker: BUY config-də aktiv olan BÜTÜN indikatorlar həmin bağlanmış
 * şamda BUY vəziyyətindədirsə (AND). SELL üçün tam müstəqil config.
 * Deaktiv indikatorların vəziyyəti nəticəyə təsir etmir.
 *
 * Marker yalnız confluence YENİ yarandığı şamda qoyulur (edge-trigger) —
 * trend davam etdikcə hər şamda təkrar marker yaranmır, hər təsdiq üçün 1 siqnal.
 */
export function computeConfluenceMarkers(
  klines: Kline[],
  settings: IndicatorSettings,
  nowMs: number = Date.now(),
): SeriesMarker<UTCTimestamp>[] {
  const cfg = settings.signals;
  if (!cfg?.enabled || klines.length === 0) return [];

  const volumeOk = hasRealVolume(klines);
  const buyKeys = activeKeys(cfg.buy, volumeOk);
  const sellKeys = activeKeys(cfg.sell, volumeOk);
  if (buyKeys.length === 0 && sellKeys.length === 0) return [];

  // Yalnız iştirak edən indikatorlar hesablanır.
  // Bütün indikatorlar eyni latch qaydasına tabedir: son verilən istiqamət
  // əks trigger gələnə qədər qüvvədə qalır.
  const dirs = new Map<SignalIndicatorKey, SignalDir[]>();
  for (const key of new Set([...buyKeys, ...sellKeys])) {
    const built = buildDirs(key, klines, settings);
    if (built) dirs.set(key, latchDirs(built));
  }

  const buyAt = (i: number) =>
    buyKeys.length > 0 && buyKeys.every(k => dirs.get(k)?.[i] === 1);
  const sellAt = (i: number) =>
    sellKeys.length > 0 && sellKeys.every(k => dirs.get(k)?.[i] === -1);

  const markers: SeriesMarker<UTCTimestamp>[] = [];

  for (let i = 0; i < klines.length; i++) {
    // Closed candle rule: forming şam siqnal yarada bilməz
    if (klines[i].closeTime > nowMs) continue;

    const time = Math.floor(klines[i].openTime / 1000) as UTCTimestamp;

    if (buyAt(i) && !(i > 0 && buyAt(i - 1))) {
      markers.push({
        time,
        position: 'belowBar',
        color: BUY_COLOR,
        shape: 'arrowUp',
        text: 'BUY',
      });
    }
    if (sellAt(i) && !(i > 0 && sellAt(i - 1))) {
      markers.push({
        time,
        position: 'aboveBar',
        color: SELL_COLOR,
        shape: 'arrowDown',
        text: 'SELL',
      });
    }
  }

  return markers;
}
