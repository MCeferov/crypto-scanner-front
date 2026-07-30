import type { Kline } from '../services/binanceApi';
import { calculateMACD } from './macd';
import { calculateSuperTrend } from './supertrend';
import { analyzeHeikinAshi } from './heikinAshi';
import { analyzeTimeframe, type MtfTf, type TfDir } from './chartAnalysis';
import type { Signal } from './aiSignal';
import type { ChartSignal } from './chartAnalysis';
import type { SetupSignal } from './setupSignal';
import type { ZonePosition, ZoneBreakoutSignal } from './supplyDemand';
import { calculateStochRSI } from './stochRsi';
import { calculateRSI } from './rsi';

/** Qısa TF-lərdə MACD uzun müddət eyni işarədə qala bilər — 48 cap detail ilə uyğunsuzluq yaradırdı */
const MAX_LOOKBACK = 1000;
/**
 * MTF persistence re-runs the full analyzeTimeframe per step (inherently
 * O(n) each), so its lookback is capped separately — beyond ~120 candles the
 * exact age carries no extra signal but froze the UI on recomputes.
 */
const MTF_MAX_LOOKBACK = 120;

export interface SignalAges {
  mtf1mCandles: number;
  mtf5mCandles: number;
  mtf15mCandles: number;
  mtf30mCandles: number;
  mtf1hCandles: number;
  mtf4hCandles: number;
  macdCandles: number;
  stCandles: number;
  stochCandles: number;
  haCandles: number;
  chartCandles: number;
  aiCandles: number;
  zoneCandles: number;
  setupCandles: number;
  rsiCandles: number;
}

function countMtfPersistence(klines: Kline[], tf: MtfTf): number {
  if (klines.length < 15) return 0;
  const current = analyzeTimeframe(klines, tf);
  if (current.signal === 'NEUTRAL') return 0;

  let count = 0;
  for (let back = 0; back < MTF_MAX_LOOKBACK && klines.length - back >= 15; back++) {
    const slice = klines.slice(0, klines.length - back);
    if (analyzeTimeframe(slice, tf).signal === current.signal) count++;
    else break;
  }
  return count;
}

/** Son SuperTrend qırılmasından (trend flip) indiyə qədər şam sayı — dəyib-qayıtma sayılmır */
function countStPersistence(klines: Kline[]): number {
  const series = calculateSuperTrend(klines);
  if (series.length < 1) return 0;
  const last = series[series.length - 1].trend;
  let count = 0;
  for (let i = series.length - 1; i >= 0 && count < MAX_LOOKBACK; i--) {
    if (series[i].trend === last) count++;
    else break; // ilk əks trend = son qırılma
  }
  return count;
}

function countMacdPersistence(klines: Kline[]): number {
  const closes = klines.map(k => k.close);
  const series = calculateMACD(closes);
  if (series.length < 1) return 0;
  // Chart ilə eyni: histogram >= 0 bullish (yaşıl), < 0 bearish
  const lastSign = series[series.length - 1].histogram >= 0 ? 1 : -1;
  let count = 0;
  for (let i = series.length - 1; i >= 0 && count < MAX_LOOKBACK; i--) {
    const s = series[i].histogram >= 0 ? 1 : -1;
    if (s === lastSign) count++;
    else break; // histogram rəng dəyişməsi = son qırılma
  }
  return count;
}

function stochBias(k: number, d: number): string {
  if (k < 20) return 'low';
  if (k > 80) return 'high';
  return k >= d ? 'bull' : 'bear';
}

/**
 * RSI/StochRSI are forward-recursive, so the value at prefix length L equals
 * series[L - offset] of one full computation — walking the precomputed series
 * backwards is identical to the old slice-and-recompute loop, but O(n)
 * instead of O(n²).
 */
function countRsiPersistence(closes: number[]): number {
  if (closes.length < 20) return 0;
  const series = calculateRSI(closes, 14);
  if (series.length === 0) return 0;
  const last = series[series.length - 1];
  const bull = last < 50;

  let count = 0;
  for (let i = series.length - 1; i >= 0 && count < MAX_LOOKBACK; i--) {
    const matches = bull ? series[i] < 52 : series[i] > 48;
    if (matches) count++;
    else break;
  }
  return count;
}

function countStochPersistence(closes: number[]): number {
  if (closes.length < 20) return 0;
  const series = calculateStochRSI(closes);
  if (series.length === 0) return 0;
  const last = series[series.length - 1];
  const lastBias = stochBias(last.k, last.d);

  let count = 0;
  for (let i = series.length - 1; i >= 0 && count < MAX_LOOKBACK; i--) {
    if (stochBias(series[i].k, series[i].d) === lastBias) count++;
    else break;
  }
  return count;
}

/** Reuses the per-TF ages already computed in computeSignalAges. */
function countChartPersistence(
  mtfAges: number[],
  chartSignal: ChartSignal,
): number {
  if (chartSignal === 'NEUTRAL' || mtfAges.length === 0) return 0;
  return Math.min(...mtfAges);
}

/** Reuses macd/st ages already computed in computeSignalAges. */
function countAiPersistence(
  klinesHa: Kline[],
  signal: Signal,
  macdAge: number,
  stAge: number,
): number {
  if (signal === 'NEUTRAL') return 0;
  const bull = signal === 'BUY' || signal === 'STRONG_BUY';
  const ha = analyzeHeikinAshi(klinesHa);
  const haOk = bull ? ha.trend === 1 : ha.trend === -1;
  const ages = [macdAge, stAge, haOk ? ha.consecutive : 0].filter(a => a > 0);
  return ages.length > 0 ? Math.min(...ages) : 0;
}

function countZonePersistence(
  zonePosition: ZonePosition,
  breakout: ZoneBreakoutSignal,
  haCandles: number,
): number {
  if (breakout !== 'NEUTRAL') return Math.max(1, Math.min(haCandles, 6));
  if (!zonePosition || zonePosition === 'between') return 0;
  return Math.max(1, Math.min(haCandles, 12));
}

function countSetupPersistence(
  setupSignal: SetupSignal,
  partial: Partial<SignalAges>,
  mtfDirs: Record<MtfTf, TfDir>,
  activeTfs: MtfTf[],
): number {
  if (setupSignal === 'NEUTRAL') return 0;
  const bull = setupSignal === 'BUY' || setupSignal === 'STRONG_BUY';
  const aligned: number[] = [];

  if (partial.macdCandles) aligned.push(partial.macdCandles);
  if (partial.stCandles) aligned.push(partial.stCandles);
  if (partial.haCandles) aligned.push(partial.haCandles);
  if (partial.chartCandles) aligned.push(partial.chartCandles);
  if (partial.aiCandles) aligned.push(partial.aiCandles);

  for (const tf of activeTfs) {
    const dir = mtfDirs[tf];
    const ageMap: Record<MtfTf, number | undefined> = {
      '1m': partial.mtf1mCandles,
      '5m': partial.mtf5mCandles,
      '15m': partial.mtf15mCandles,
      '30m': partial.mtf30mCandles,
      '1h': partial.mtf1hCandles,
      '4h': partial.mtf4hCandles,
    };
    const age = ageMap[tf];
    if (age && ((bull && dir === 'BUY') || (!bull && dir === 'SELL'))) {
      aligned.push(age);
    }
  }

  return aligned.length > 0 ? Math.min(...aligned) : 0;
}

export function computeSignalAges(input: {
  klineMap: Record<string, Kline[]>;
  /** XAM (raw) primary klines — MACD/ST/Stoch/RSI/HA yaşı bunun üzərində (qrafiklə eyni bazis) */
  primaryKlines: Kline[];
  haKlines: Kline[];
  chartSignal: ChartSignal;
  aiSignal: Signal;
  setupSignal: SetupSignal;
  zonePosition: ZonePosition;
  zoneBreakoutSignal: ZoneBreakoutSignal;
  mtf1m: TfDir;
  mtf5m: TfDir;
  mtf15m: TfDir;
  mtf30m: TfDir;
  mtf1h: TfDir;
  mtf4h: TfDir;
  activeTfs: MtfTf[];
}): SignalAges {
  const haResult = analyzeHeikinAshi(input.haKlines);

  const mtf1mCandles = input.activeTfs.includes('1m')
    ? countMtfPersistence(input.klineMap['1m'] || [], '1m') : 0;
  const mtf5mCandles = input.activeTfs.includes('5m')
    ? countMtfPersistence(input.klineMap['5m'] || [], '5m') : 0;
  const mtf15mCandles = input.activeTfs.includes('15m')
    ? countMtfPersistence(input.klineMap['15m'] || [], '15m') : 0;
  const mtf30mCandles = input.activeTfs.includes('30m')
    ? countMtfPersistence(input.klineMap['30m'] || [], '30m') : 0;
  const mtf1hCandles = input.activeTfs.includes('1h')
    ? countMtfPersistence(input.klineMap['1h'] || [], '1h') : 0;
  const mtf4hCandles = input.activeTfs.includes('4h')
    ? countMtfPersistence(input.klineMap['4h'] || [], '4h') : 0;

  const macdCandles = countMacdPersistence(input.primaryKlines);
  const stCandles = countStPersistence(input.primaryKlines);
  const stochCandles = countStochPersistence(input.primaryKlines.map(k => k.close));
  const haCandles = haResult.consecutive;
  const activeMtfAges = input.activeTfs.map(tf => {
    const byTf: Record<MtfTf, number> = {
      '1m': mtf1mCandles, '5m': mtf5mCandles, '15m': mtf15mCandles,
      '30m': mtf30mCandles, '1h': mtf1hCandles, '4h': mtf4hCandles,
    };
    return byTf[tf];
  });
  const chartCandles = countChartPersistence(activeMtfAges, input.chartSignal);
  const aiCandles = countAiPersistence(input.primaryKlines, input.aiSignal, macdCandles, stCandles);
  const zoneCandles = countZonePersistence(
    input.zonePosition, input.zoneBreakoutSignal, haCandles,
  );

  const rsiCandles = countRsiPersistence(input.primaryKlines.map(k => k.close));

  const partial: Partial<SignalAges> = {
    mtf1mCandles, mtf5mCandles, mtf15mCandles, mtf30mCandles, mtf1hCandles, mtf4hCandles,
    macdCandles, stCandles, stochCandles, haCandles, chartCandles, aiCandles, zoneCandles,
    rsiCandles,
  };

  const setupCandles = countSetupPersistence(
    input.setupSignal,
    partial,
    {
      '1m': input.mtf1m, '5m': input.mtf5m,
      '15m': input.mtf15m, '30m': input.mtf30m, '1h': input.mtf1h, '4h': input.mtf4h,
    },
    input.activeTfs,
  );

  return { ...partial, setupCandles } as SignalAges;
}

/**
 * Recompute only the setup age against a different setup signal, reusing an
 * existing SignalAges result — the other 14 fields do not depend on the setup
 * signal, so re-running the whole computeSignalAges pass was pure waste.
 */
export function recomputeSetupAge(
  ages: SignalAges,
  setupSignal: SetupSignal,
  mtfDirs: Record<MtfTf, TfDir>,
  activeTfs: MtfTf[],
): SignalAges {
  const setupCandles = countSetupPersistence(setupSignal, ages, mtfDirs, activeTfs);
  return { ...ages, setupCandles };
}

export function isFreshSignal(candles: number): boolean {
  return candles > 0 && candles <= 2;
}
