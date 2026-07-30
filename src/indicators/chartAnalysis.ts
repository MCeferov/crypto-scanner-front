import type { Kline } from '../services/binanceApi';
import { getLatestRSI } from './rsi';
import { getLatestMACD } from './macd';
import { getLatestSuperTrend } from './supertrend';
import { analyzeHeikinAshi } from './heikinAshi';
import {
  RSI_STRONG_OS,
  RSI_STRONG_OB,
  RSI_MILD_OS,
  RSI_MILD_OB,
  CHART_TF_BUY_SCORE,
  CHART_TF_STRONG_SCORE,
} from './signalConfig';

export type TfDir = 'BUY' | 'SELL' | 'NEUTRAL';
export type ChartSignal = 'BUY' | 'SELL' | 'NEUTRAL';

export const MTF_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h'] as const;
export type MtfTf = (typeof MTF_TIMEFRAMES)[number];

const TF_WEIGHTS: Record<MtfTf, number> = {
  '1m': 0.6,
  '5m': 0.8,
  '15m': 1,
  '30m': 1.5,
  '1h': 2,
  '4h': 2.5,
};

const TF_LABELS: Record<MtfTf, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1H',
  '4h': '4H',
};

export interface TfAnalysis {
  tf: MtfTf;
  signal: TfDir;
  score: number;
  reasons: string[];
}

export function analyzeTimeframe(klines: Kline[], tf: MtfTf): TfAnalysis {
  const empty: TfAnalysis = { tf, signal: 'NEUTRAL', score: 0, reasons: [] };
  // MACD needs 35 closes and StochRSI ~34 — below that the only contributor
  // left is SuperTrend, whose seeded bullish start manufactured BUY signals
  // on 15–34-candle series (newly listed assets, thin non-crypto feeds).
  if (klines.length < 35) return empty;

  // Raw closes — cədvəl RSI / digər indikatorlarla eyni bazis (HA yalnız ayrı filtr)
  const closes = klines.map(k => k.close);
  const rsi = getLatestRSI(closes, 14);
  const macdHist = getLatestMACD(closes)?.histogram ?? null;
  const st = getLatestSuperTrend(klines);
  const ha = analyzeHeikinAshi(klines);

  let score = 0;
  const reasons: string[] = [];

  // HA: tək töhfə (trend VƏ signal double-count yox)
  if (ha.signal === 'STRONG_BUY' || (ha.trend === 1 && ha.consecutive >= 2)) {
    const pts = ha.signal === 'STRONG_BUY' || ha.consecutive >= 3 ? 2.5 : 1.5;
    score += pts;
    reasons.push(`HA ▲${ha.consecutive}`);
  } else if (ha.signal === 'STRONG_SELL' || (ha.trend === -1 && ha.consecutive >= 2)) {
    const pts = ha.signal === 'STRONG_SELL' || ha.consecutive >= 3 ? 2.5 : 1.5;
    score -= pts;
    reasons.push(`HA ▼${ha.consecutive}`);
  }

  if (st?.trend === 1) { score += 2; reasons.push('SuperTrend bull'); }
  else if (st?.trend === -1) { score -= 2; reasons.push('SuperTrend bear'); }

  if (macdHist !== null) {
    if (macdHist > 0) { score += 1.5; reasons.push('MACD+'); }
    else { score -= 1.5; reasons.push('MACD-'); }
  }

  if (rsi !== null) {
    if (rsi < RSI_STRONG_OS) { score += 1.5; reasons.push(`RSI ${rsi.toFixed(0)} OS`); }
    else if (rsi < RSI_MILD_OS) { score += 0.5; }
    else if (rsi > RSI_STRONG_OB) { score -= 1.5; reasons.push(`RSI ${rsi.toFixed(0)} OB`); }
    else if (rsi > RSI_MILD_OB) { score -= 0.5; }
  }

  let signal: TfDir = 'NEUTRAL';
  if (score >= CHART_TF_STRONG_SCORE) signal = 'BUY';
  else if (score <= -CHART_TF_STRONG_SCORE) signal = 'SELL';
  else if (score >= CHART_TF_BUY_SCORE) signal = 'BUY';
  else if (score <= -CHART_TF_BUY_SCORE) signal = 'SELL';

  return { tf, signal, score, reasons };
}

export interface MtfAnalysisResult {
  mtf1m: TfDir;
  mtf5m: TfDir;
  mtf15m: TfDir;
  mtf30m: TfDir;
  mtf1h: TfDir;
  mtf4h: TfDir;
  chartSignal: ChartSignal;
  chartSignalReasons: string[];
}

export function getPrimaryAnalysisTf(activeTfs: MtfTf[]): MtfTf {
  const order: MtfTf[] = ['4h', '1h', '30m', '15m', '5m', '1m'];
  for (const tf of order) {
    if (activeTfs.includes(tf)) return tf;
  }
  return '1h';
}

export function computeMultiTimeframeAnalysis(
  klineMap: Record<string, Kline[]>,
  activeTfs: MtfTf[] = [...MTF_TIMEFRAMES],
): MtfAnalysisResult {
  const tfs = MTF_TIMEFRAMES.filter(tf => activeTfs.includes(tf));
  const analyses = MTF_TIMEFRAMES.map(tf => {
    if (!activeTfs.includes(tf)) {
      return { tf, signal: 'NEUTRAL' as TfDir, score: 0, reasons: [] };
    }
    return analyzeTimeframe(klineMap[tf] || [], tf);
  });

  let weightedBull = 0;
  let weightedBear = 0;
  let weightedScore = 0;
  const chartSignalReasons: string[] = [];

  for (const a of analyses) {
    if (!activeTfs.includes(a.tf)) continue;
    const w = TF_WEIGHTS[a.tf];
    weightedScore += a.score * w;
    if (a.signal === 'BUY') weightedBull += w;
    else if (a.signal === 'SELL') weightedBear += w;
    const label = TF_LABELS[a.tf];
    const detail = a.reasons.length > 0 ? ` — ${a.reasons.slice(0, 2).join(', ')}` : '';
    chartSignalReasons.push(`${label}: ${a.signal}${detail}`);
  }

  const activeAnalyses = analyses.filter(a => activeTfs.includes(a.tf));
  const buyCount = activeAnalyses.filter(a => a.signal === 'BUY').length;
  const sellCount = activeAnalyses.filter(a => a.signal === 'SELL').length;
  const activeCount = activeAnalyses.length;

  let chartSignal: ChartSignal = 'NEUTRAL';

  if (activeCount === 0) {
    chartSignalReasons.push('Heç bir TF seçilməyib');
  } else if (weightedScore >= 4 || (buyCount >= Math.ceil(activeCount * 0.75) && weightedBull > weightedBear)) {
    chartSignal = 'BUY';
  } else if (weightedScore <= -4 || (sellCount >= Math.ceil(activeCount * 0.75) && weightedBear > weightedBull)) {
    chartSignal = 'SELL';
  } else if (weightedBull >= weightedBear + 1.5 && buyCount >= 2) {
    chartSignal = 'BUY';
  } else if (weightedBear >= weightedBull + 1.5 && sellCount >= 2) {
    chartSignal = 'SELL';
  } else if (buyCount > sellCount && weightedScore > 0) {
    chartSignal = 'BUY';
  } else if (sellCount > buyCount && weightedScore < 0) {
    chartSignal = 'SELL';
  }

  chartSignalReasons.push(
    `Yekun (${activeTfs.join(', ')}): ${chartSignal} (${buyCount} BUY / ${sellCount} SELL)`,
  );

  return {
    mtf1m: analyses[0].signal,
    mtf5m: analyses[1].signal,
    mtf15m: analyses[2].signal,
    mtf30m: analyses[3].signal,
    mtf1h: analyses[4].signal,
    mtf4h: analyses[5].signal,
    chartSignal,
    chartSignalReasons,
  };
}
