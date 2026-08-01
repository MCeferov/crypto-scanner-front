import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import type { Kline } from '../services/binanceApi';
import type { IndicatorSettings, SignalIndicatorKey } from '../types/chart';
import { calculateRSI } from './rsi';
import { calculateMACD } from './macd';
import { calculateStochRSI } from './stochRsi';
import { calculateSuperTrend } from './supertrend';
import { toHeikinAshi } from './heikinAshi';

/** Bir şam üçün indikatorun istiqaməti: 1 = BUY, -1 = SELL, 0 = NEUTRAL */
type SignalDir = 1 | 0 | -1;

/**
 * Trigger-əsaslı istiqaməti latch edir: indikator bir dəfə BUY (və ya SELL)
 * verdikdə əks trigger gələnə qədər həmin vəziyyətdə qalır.
 *
 * Məsələn RSI 70-i keçib SELL verirsə, 69-a düşəndə "artıq siqnal yoxdur"
 * olmur — RSI 30-un altına düşüb BUY verənə qədər SELL saxlanılır.
 * İlk trigger-ə qədər (warm-up) 0 = NEUTRAL qalır, yəni siqnal yaranmır.
 */
function latch(triggers: SignalDir[]): SignalDir[] {
  const out: SignalDir[] = new Array(triggers.length).fill(0);
  let state: SignalDir = 0;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i] !== 0) state = triggers[i];
    out[i] = state;
  }
  return out;
}

const BUY_COLOR = '#26a69a';
const SELL_COLOR = '#ef5350';

/**
 * Hər indikator üçün kline massivi ilə eyni uzunluqda TRIGGER massivi qurulur.
 * Buradakı 0 "trigger yoxdur" deməkdir — sonra latch() onu son aktiv
 * istiqamətlə doldurur. Warm-up dövründə (indikator hələ hesablana bilmir)
 * dəyər 0 qalır və latch də 0 saxlayır, ona görə siqnal yaranmır.
 */
function rsiDirs(klines: Kline[], s: IndicatorSettings): SignalDir[] {
  const dirs: SignalDir[] = new Array(klines.length).fill(0);
  const values = calculateRSI(klines.map(k => k.close), s.rsi.period);
  const offset = klines.length - values.length;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < s.rsi.oversold) dirs[offset + i] = 1;
    else if (values[i] > s.rsi.overbought) dirs[offset + i] = -1;
  }
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

const DIR_BUILDERS: Record<SignalIndicatorKey, (klines: Kline[], s: IndicatorSettings) => SignalDir[]> = {
  rsi: rsiDirs,
  stochRsi: stochRsiDirs,
  macd: macdDirs,
  superTrend: superTrendDirs,
  heikinAshi: (klines) => heikinAshiDirs(klines),
};

function activeKeys(participation: Record<SignalIndicatorKey, boolean>): SignalIndicatorKey[] {
  return (Object.keys(participation) as SignalIndicatorKey[]).filter(k => participation[k]);
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

  const buyKeys = activeKeys(cfg.buy);
  const sellKeys = activeKeys(cfg.sell);
  if (buyKeys.length === 0 && sellKeys.length === 0) return [];

  // Yalnız iştirak edən indikatorlar hesablanır.
  // Bütün indikatorlar eyni latch qaydasına tabedir: son verilən istiqamət
  // əks trigger gələnə qədər qüvvədə qalır.
  const dirs = new Map<SignalIndicatorKey, SignalDir[]>();
  for (const key of new Set([...buyKeys, ...sellKeys])) {
    dirs.set(key, latch(DIR_BUILDERS[key](klines, settings)));
  }

  const buyAt = (i: number) =>
    buyKeys.length > 0 && buyKeys.every(k => dirs.get(k)![i] === 1);
  const sellAt = (i: number) =>
    sellKeys.length > 0 && sellKeys.every(k => dirs.get(k)![i] === -1);

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
