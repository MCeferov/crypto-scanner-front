import type { Kline } from '../services/binanceApi';
import { calculateMACD } from './macd';
import { calculateSuperTrend } from './supertrend';
import { analyzeHeikinAshi, heikinAshiToKlines } from './heikinAshi';
import { analyzeTimeframe, type MtfTf, type TfDir } from './chartAnalysis';
import type { Signal } from './aiSignal';
import type { ChartSignal } from './chartAnalysis';
import type { SetupSignal } from './setupSignal';
import type { ZonePosition, ZoneBreakoutSignal } from './supplyDemand';
import { getLatestStochRSI } from './stochRsi';
import { getLatestRSI } from './rsi';

const MAX_LOOKBACK = 24;

export interface SignalAges {
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
  for (let back = 0; back < MAX_LOOKBACK && klines.length - back >= 15; back++) {
    const slice = klines.slice(0, klines.length - back);
    if (analyzeTimeframe(slice, tf).signal === current.signal) count++;
    else break;
  }
  return count;
}

function countMacdPersistence(klinesHa: Kline[]): number {
  const closes = klinesHa.map(k => k.close);
  const series = calculateMACD(closes);
  if (series.length < 1) return 0;
  const lastSign = series[series.length - 1].histogram > 0 ? 1 : series[series.length - 1].histogram < 0 ? -1 : 0;
  if (lastSign === 0) return 0;
  let count = 0;
  for (let i = series.length - 1; i >= 0 && count < MAX_LOOKBACK; i--) {
    const s = series[i].histogram > 0 ? 1 : series[i].histogram < 0 ? -1 : 0;
    if (s === lastSign) count++;
    else break;
  }
  return count;
}

function countStPersistence(klinesHa: Kline[]): number {
  const series = calculateSuperTrend(klinesHa);
  if (series.length < 1) return 0;
  const last = series[series.length - 1].trend;
  let count = 0;
  for (let i = series.length - 1; i >= 0 && count < MAX_LOOKBACK; i--) {
    if (series[i].trend === last) count++;
    else break;
  }
  return count;
}

function stochBias(k: number, d: number): string {
  if (k < 20) return 'low';
  if (k > 80) return 'high';
  return k >= d ? 'bull' : 'bear';
}

function countRsiPersistence(closes: number[]): number {
  if (closes.length < 20) return 0;
  const last = getLatestRSI(closes, 14);
  if (last === null) return 0;
  const bull = last < 50;

  let count = 0;
  for (let back = 0; back < MAX_LOOKBACK && closes.length - back >= 20; back++) {
    const rsi = getLatestRSI(closes.slice(0, closes.length - back), 14);
    if (rsi === null) break;
    const matches = bull ? rsi < 52 : rsi > 48;
    if (matches) count++;
    else break;
  }
  return count;
}

function countStochPersistence(closes: number[]): number {
  if (closes.length < 20) return 0;
  const last = getLatestStochRSI(closes);
  if (!last) return 0;
  const lastBias = stochBias(last.k, last.d);

  let count = 0;
  for (let back = 0; back < MAX_LOOKBACK && closes.length - back >= 20; back++) {
    const s = getLatestStochRSI(closes.slice(0, closes.length - back));
    if (!s) break;
    if (stochBias(s.k, s.d) === lastBias) count++;
    else break;
  }
  return count;
}

function countChartPersistence(
  klineMap: Record<string, Kline[]>,
  chartSignal: ChartSignal,
  activeTfs: MtfTf[],
): number {
  if (chartSignal === 'NEUTRAL' || activeTfs.length === 0) return 0;
  const ages = activeTfs.map(tf => countMtfPersistence(klineMap[tf] || [], tf));
  return Math.min(...ages);
}

function countAiPersistence(klinesHa: Kline[], signal: Signal): number {
  if (signal === 'NEUTRAL') return 0;
  const bull = signal === 'BUY' || signal === 'STRONG_BUY';
  const macdAge = countMacdPersistence(klinesHa);
  const stAge = countStPersistence(klinesHa);
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
  mtf15m: TfDir;
  mtf30m: TfDir;
  mtf1h: TfDir;
  mtf4h: TfDir;
  activeTfs: MtfTf[];
}): SignalAges {
  const haResult = analyzeHeikinAshi(input.haKlines);

  const mtf15mCandles = input.activeTfs.includes('15m')
    ? countMtfPersistence(input.klineMap['15m'] || [], '15m') : 0;
  const mtf30mCandles = input.activeTfs.includes('30m')
    ? countMtfPersistence(input.klineMap['30m'] || [], '30m') : 0;
  const mtf1hCandles = input.activeTfs.includes('1h')
    ? countMtfPersistence(input.klineMap['1h'] || [], '1h') : 0;
  const mtf4hCandles = input.activeTfs.includes('4h')
    ? countMtfPersistence(input.klineMap['4h'] || [], '4h') : 0;

  // MACD / SuperTrend / Stoch / RSI yaşı XAM klines üzərində (qrafik və displayed RSI ilə eyni)
  const macdCandles = countMacdPersistence(input.primaryKlines);
  const stCandles = countStPersistence(input.primaryKlines);
  const stochCandles = countStochPersistence(input.primaryKlines.map(k => k.close));
  const haCandles = haResult.consecutive;
  const chartCandles = countChartPersistence(input.klineMap, input.chartSignal, input.activeTfs);
  const aiCandles = countAiPersistence(input.primaryKlines, input.aiSignal);
  const zoneCandles = countZonePersistence(
    input.zonePosition, input.zoneBreakoutSignal, haCandles,
  );

  const rsiCandles = countRsiPersistence(input.primaryKlines.map(k => k.close));

  const partial: Partial<SignalAges> = {
    mtf15mCandles, mtf30mCandles, mtf1hCandles, mtf4hCandles,
    macdCandles, stCandles, stochCandles, haCandles, chartCandles, aiCandles, zoneCandles,
    rsiCandles,
  };

  const setupCandles = countSetupPersistence(
    input.setupSignal,
    partial,
    { '15m': input.mtf15m, '30m': input.mtf30m, '1h': input.mtf1h, '4h': input.mtf4h },
    input.activeTfs,
  );

  return { ...partial, setupCandles } as SignalAges;
}

export function isFreshSignal(candles: number): boolean {
  return candles > 0 && candles <= 2;
}
