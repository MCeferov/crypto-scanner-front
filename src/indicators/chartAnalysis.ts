import type { Kline } from '../services/binanceApi';
import { getLatestRSI } from './rsi';
import { getLatestMACD } from './macd';
import { getLatestSuperTrend } from './supertrend';
import { analyzeHeikinAshi, heikinAshiToKlines } from './heikinAshi';

export type TfDir = 'BUY' | 'SELL' | 'NEUTRAL';
export type ChartSignal = 'BUY' | 'SELL' | 'NEUTRAL';

export const MTF_TIMEFRAMES = ['15m', '30m', '1h', '4h'] as const;
export type MtfTf = (typeof MTF_TIMEFRAMES)[number];

const TF_WEIGHTS: Record<MtfTf, number> = {
  '15m': 1,
  '30m': 1.5,
  '1h': 2,
  '4h': 2.5,
};

const TF_LABELS: Record<MtfTf, string> = {
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
  if (klines.length < 15) return empty;

  const kHa = heikinAshiToKlines(klines);
  const closes = kHa.map(k => k.close);
  const rsi = getLatestRSI(closes, 14);
  const macdHist = getLatestMACD(closes)?.histogram ?? null;
  const st = getLatestSuperTrend(kHa);
  const ha = analyzeHeikinAshi(klines);

  let score = 0;
  const reasons: string[] = [];

  if (ha.trend === 1) {
    const pts = ha.consecutive >= 3 ? 3 : ha.consecutive >= 2 ? 2 : 1;
    score += pts;
    reasons.push(`HA ▲${ha.consecutive}`);
  } else if (ha.trend === -1) {
    const pts = ha.consecutive >= 3 ? 3 : ha.consecutive >= 2 ? 2 : 1;
    score -= pts;
    reasons.push(`HA ▼${ha.consecutive}`);
  }

  if (ha.signal === 'STRONG_BUY') { score += 3; reasons.push('HA strong buy'); }
  else if (ha.signal === 'BUY') { score += 2; reasons.push('HA buy'); }
  else if (ha.signal === 'STRONG_SELL') { score -= 3; reasons.push('HA strong sell'); }
  else if (ha.signal === 'SELL') { score -= 2; reasons.push('HA sell'); }

  if (st?.trend === 1) { score += 2; reasons.push('SuperTrend bull'); }
  else if (st?.trend === -1) { score -= 2; reasons.push('SuperTrend bear'); }

  if (macdHist !== null) {
    if (macdHist > 0) { score += 1.5; reasons.push('MACD+'); }
    else { score -= 1.5; reasons.push('MACD-'); }
  }

  if (rsi !== null) {
    if (rsi < 32) { score += 1.5; reasons.push(`RSI ${rsi.toFixed(0)} oversold`); }
    else if (rsi < 42) { score += 0.5; }
    else if (rsi > 68) { score -= 1.5; reasons.push(`RSI ${rsi.toFixed(0)} overbought`); }
    else if (rsi > 58) { score -= 0.5; }
    else if (rsi >= 48 && rsi <= 62 && ha.trend === 1) { score += 0.5; }
    else if (rsi >= 38 && rsi <= 52 && ha.trend === -1) { score -= 0.5; }
  }

  let signal: TfDir = 'NEUTRAL';
  if (score >= 2.5) signal = 'BUY';
  else if (score <= -2.5) signal = 'SELL';
  else if (score >= 1.2) signal = 'BUY';
  else if (score <= -1.2) signal = 'SELL';

  return { tf, signal, score, reasons };
}

export interface MtfAnalysisResult {
  mtf15m: TfDir;
  mtf30m: TfDir;
  mtf1h: TfDir;
  mtf4h: TfDir;
  chartSignal: ChartSignal;
  chartSignalReasons: string[];
}

export function getPrimaryAnalysisTf(activeTfs: MtfTf[]): MtfTf {
  const order: MtfTf[] = ['4h', '1h', '30m', '15m'];
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
    mtf15m: analyses[0].signal,
    mtf30m: analyses[1].signal,
    mtf1h: analyses[2].signal,
    mtf4h: analyses[3].signal,
    chartSignal,
    chartSignalReasons,
  };
}
