import type { CoinData } from '../context/MarketContext';
import type { ResearchSignal } from './marketResearch';

export type SetupSignal =
  | 'STRONG_BUY'
  | 'BUY'
  | 'NEUTRAL'
  | 'SELL'
  | 'STRONG_SELL';

export interface SetupResult {
  setupSignal: SetupSignal;
  setupLabel: string;
  setupReasons: string[];
  setupConviction: number;
}

const SCORE: Record<string, number> = {
  STRONG_BUY: 5, BUY: 4, NEUTRAL: 3, SELL: 2, STRONG_SELL: 1,
  STRONG_LONG: 5, LONG: 4, SHORT: 2, STRONG_SHORT: 1,
  ZONE_STRONG_BUY: 5, ZONE_BUY: 4, ZONE_NEUTRAL: 3, ZONE_SELL: 2, ZONE_STRONG_SELL: 1,
};

interface Vote {
  score: number;
  weight: number;
  label: string;
  reasons: string[];
}

function tfScore(dir: string): number {
  if (dir === 'BUY') return 4.2;
  if (dir === 'SELL') return 1.8;
  return 3;
}

function researchScore(sig: ResearchSignal, label: string): number {
  if (sig === 'BUY') return 4.3;
  if (sig === 'SELL') return 1.7;
  if (sig === 'HOLD') return label.includes('↑') ? 3.4 : 2.6;
  return 3;
}

function trendToScore(trendScore: number): number {
  return 1 + (trendScore / 100) * 4;
}

function zonePositionScore(pos: string | null): number {
  switch (pos) {
    case 'at_demand': return 4.5;
    case 'near_demand': return 3.8;
    case 'at_supply': return 1.5;
    case 'near_supply': return 2.2;
    case 'between': return 3;
    default: return 3;
  }
}

function riskScore(rr: number | null, bullish: boolean): number {
  if (rr === null) return 3;
  if (rr >= 2.5) return bullish ? 4.5 : 2;
  if (rr >= 2) return bullish ? 4.2 : 2.2;
  if (rr >= 1.5) return 3.5;
  if (rr < 1) return bullish ? 2 : 3.8;
  return 3;
}

function rsiScore(rsi: number | null): number {
  if (rsi === null) return 3;
  if (rsi < 30) return 4.5;
  if (rsi < 40) return 3.8;
  if (rsi > 70) return 1.5;
  if (rsi > 60) return 2.2;
  return 3;
}

function toSetup(conviction: number, bullVotes: number, bearVotes: number): SetupSignal {
  if (conviction >= 4.55 && bullVotes >= 4) return 'STRONG_BUY';
  if (conviction >= 3.65 && bullVotes >= 2) return 'BUY';
  if (conviction <= 1.45 && bearVotes >= 4) return 'STRONG_SELL';
  if (conviction <= 2.35 && bearVotes >= 2) return 'SELL';
  return 'NEUTRAL';
}

export function setupLabelFromSignal(sig: SetupSignal): string {
  switch (sig) {
    case 'STRONG_BUY': return 'S BUY';
    case 'BUY': return 'BUY';
    case 'SELL': return 'SELL';
    case 'STRONG_SELL': return 'S SELL';
    default: return '—';
  }
}

/** Bütün indikator, qrafik, bazar, zone, risk və HA siqnallarını birləşdirir */
export function computeUnifiedSetup(coin: CoinData): SetupResult {
  const votes: Vote[] = [];

  // ── Qrafik analizi (4 timeframe) ──
  const mtfVotes: Vote[] = [
    { score: tfScore(coin.mtf15m), weight: 1.2, label: '15m chart', reasons: [`15m: ${coin.mtf15m}`] },
    { score: tfScore(coin.mtf30m), weight: 1.4, label: '30m chart', reasons: [`30m: ${coin.mtf30m}`] },
    { score: tfScore(coin.mtf1h),  weight: 1.8, label: '1H chart',  reasons: [`1H: ${coin.mtf1h}`] },
    { score: tfScore(coin.mtf4h),  weight: 2.2, label: '4H chart',  reasons: [`4H: ${coin.mtf4h}`] },
  ];
  votes.push(...mtfVotes);

  if (coin.chartSignal !== 'NEUTRAL') {
    votes.push({
      score: coin.chartSignal === 'BUY' ? 4.5 : 1.5,
      weight: 3,
      label: 'Chart signal',
      reasons: coin.chartSignalReasons.slice(0, 2),
    });
  }

  // ── Bazar araşdırması ──
  if (coin.researchSignal !== 'NEUTRAL') {
    votes.push({
      score: researchScore(coin.researchSignal, coin.researchLabel),
      weight: 3,
      label: 'Bazar araşdırması',
      reasons: coin.researchReasons.slice(0, 2),
    });
  }

  // ── Supply / Demand (likvidlik zonaları) ──
  if (coin.zonePosition) {
    votes.push({
      score: zonePositionScore(coin.zonePosition),
      weight: 2.5,
      label: 'S/D zone',
      reasons: [`Zone: ${coin.zonePosition.replace('_', ' ')}`, ...coin.zoneSignalReasons.slice(0, 1)],
    });
  }

  if (coin.zoneSignal !== 'ZONE_NEUTRAL') {
    votes.push({
      score: SCORE[coin.zoneSignal] ?? 3,
      weight: 2.5,
      label: 'Zone signal',
      reasons: coin.zoneSignalReasons.slice(0, 2),
    });
  }

  if (coin.zoneBreakoutSignal !== 'NEUTRAL') {
    votes.push({
      score: SCORE[coin.zoneBreakoutSignal] ?? 3,
      weight: 4,
      label: 'Zone breakout',
      reasons: coin.zoneBreakoutReasons.slice(0, 2),
    });
  }

  // ── Heikin Ashi ──
  if (coin.haSignal !== 'NEUTRAL') {
    votes.push({
      score: SCORE[coin.haSignal] ?? 3,
      weight: 3,
      label: 'Heikin Ashi',
      reasons: coin.haReasons.slice(0, 2),
    });
  } else if (coin.haTrend !== 0) {
    const haPts = coin.haTrend === 1
      ? (coin.haConsecutive >= 3 ? 4.3 : 3.6)
      : (coin.haConsecutive >= 3 ? 1.7 : 2.4);
    votes.push({
      score: haPts,
      weight: 2,
      label: 'HA trend',
      reasons: [`HA ${coin.haTrend === 1 ? '▲' : '▼'}${coin.haConsecutive}`],
    });
  }

  // ── AI / ümumi indikator siqnalı ──
  if (coin.signal !== 'NEUTRAL') {
    votes.push({
      score: SCORE[coin.signal] ?? 3,
      weight: 2.5,
      label: 'AI indikator',
      reasons: coin.signalReasons.slice(0, 2),
    });
  }

  // ── Trend score ──
  votes.push({
    score: trendToScore(coin.trendScore),
    weight: 2.5,
    label: 'Trend score',
    reasons: [`Trend ${coin.trendScore}/100`],
  });

  // ── Risk (R:R, SL/TP) ──
  const prelimBull = votes.filter(v => v.score >= 3.5).length;
  votes.push({
    score: riskScore(coin.riskReward, prelimBull >= 3),
    weight: 2,
    label: 'Risk/R:R',
    reasons: coin.riskReward !== null
      ? [`R:R ${coin.riskReward.toFixed(1)}`, coin.stopLoss ? `SL $${coin.stopLoss.toFixed(2)}` : '']
      : [],
  });

  // ── Texniki indikatorlar ──
  if (coin.superTrend !== null) {
    votes.push({
      score: coin.superTrend === 1 ? 4.2 : 1.8,
      weight: 1.5,
      label: 'SuperTrend',
      reasons: [coin.superTrend === 1 ? 'ST bullish' : 'ST bearish'],
    });
  }

  if (coin.macdHistogram !== null) {
    votes.push({
      score: coin.macdHistogram > 0 ? 3.8 : 2.2,
      weight: 1.2,
      label: 'MACD',
      reasons: [coin.macdHistogram > 0 ? 'MACD+' : 'MACD-'],
    });
  }

  if (coin.stochRsiK !== null) {
    const stochPts = coin.stochRsiK < 20 ? 4.2 : coin.stochRsiK > 80 ? 1.8 : 3;
    votes.push({
      score: stochPts,
      weight: 1,
      label: 'Stoch RSI',
      reasons: [`Stoch K ${coin.stochRsiK.toFixed(0)}`],
    });
  }

  const rsiVotes = [
    { rsi: coin.rsi15m, tf: '15m' },
    { rsi: coin.rsi1h, tf: '1H' },
    { rsi: coin.rsi4h, tf: '4H' },
  ].filter(r => r.rsi !== null);

  for (const { rsi, tf } of rsiVotes) {
    votes.push({
      score: rsiScore(rsi),
      weight: tf === '1H' ? 1.2 : 0.8,
      label: `RSI ${tf}`,
      reasons: [`RSI ${tf} ${rsi!.toFixed(0)}`],
    });
  }

  if (coin.bbPercent !== null) {
    const bbPts = coin.bbPercent < 0.2 ? 3.8 : coin.bbPercent > 0.8 ? 2.2 : 3;
    votes.push({
      score: bbPts,
      weight: 0.8,
      label: 'Bollinger',
      reasons: [`BB %B ${(coin.bbPercent * 100).toFixed(0)}%`],
    });
  }

  if (votes.length === 0) {
    return { setupSignal: 'NEUTRAL', setupLabel: '—', setupReasons: [], setupConviction: 0 };
  }

  const totalWeight = votes.reduce((s, v) => s + v.weight, 0);
  let conviction = votes.reduce((s, v) => s + v.score * v.weight, 0) / totalWeight;

  const bullVotes = votes.filter(v => v.score >= 3.6).length;
  const bearVotes = votes.filter(v => v.score <= 2.4).length;

  // Uyğunluq bonusları
  const chartBull = coin.chartSignal === 'BUY';
  const chartBear = coin.chartSignal === 'SELL';
  const researchBull = coin.researchSignal === 'BUY';
  const researchBear = coin.researchSignal === 'SELL';
  const breakLong = coin.zoneBreakoutSignal === 'LONG' || coin.zoneBreakoutSignal === 'STRONG_LONG';
  const breakShort = coin.zoneBreakoutSignal === 'SHORT' || coin.zoneBreakoutSignal === 'STRONG_SHORT';
  const haBull = coin.haSignal === 'STRONG_BUY' || coin.haSignal === 'BUY' || (coin.haTrend === 1 && coin.haConsecutive >= 2);
  const haBear = coin.haSignal === 'STRONG_SELL' || coin.haSignal === 'SELL' || (coin.haTrend === -1 && coin.haConsecutive >= 2);

  if (chartBull && researchBull) conviction += 0.25;
  if (chartBear && researchBear) conviction -= 0.25;
  if (haBull && breakLong) conviction += 0.35;
  if (haBear && breakShort) conviction -= 0.35;
  if (haBull && (coin.zonePosition === 'at_demand' || coin.zonePosition === 'near_demand')) conviction += 0.2;
  if (haBear && (coin.zonePosition === 'at_supply' || coin.zonePosition === 'near_supply')) conviction -= 0.2;

  const mtfBull = [coin.mtf15m, coin.mtf30m, coin.mtf1h, coin.mtf4h].filter(s => s === 'BUY').length;
  const mtfBear = [coin.mtf15m, coin.mtf30m, coin.mtf1h, coin.mtf4h].filter(s => s === 'SELL').length;
  if (mtfBull >= 3) conviction += 0.3;
  if (mtfBear >= 3) conviction -= 0.3;

  if (coin.trendScore >= 70 && coin.riskReward !== null && coin.riskReward >= 2) conviction += 0.15;
  if (coin.trendScore <= 30) conviction -= 0.15;

  conviction = Math.round(conviction * 100) / 100;

  const setupSignal = toSetup(conviction, bullVotes, bearVotes);
  const setupLabel = setupLabelFromSignal(setupSignal);

  const setupReasons = votes
    .filter(v => v.score >= 4 || v.score <= 2)
    .sort((a, b) => Math.abs(b.score - 3) - Math.abs(a.score - 3))
    .flatMap(v => v.reasons.filter(Boolean))
    .filter((r, i, arr) => arr.indexOf(r) === i)
    .slice(0, 8);

  if (setupSignal !== 'NEUTRAL') {
    setupReasons.unshift(
      `Yekun: ${setupLabel} (conviction ${conviction}, ${bullVotes} müsbət / ${bearVotes} mənfi)`,
    );
  }

  return {
    setupSignal,
    setupLabel,
    setupReasons,
    setupConviction: conviction,
  };
}

/** @deprecated use computeUnifiedSetup */
export function computeSetup(): SetupResult {
  return { setupSignal: 'NEUTRAL', setupLabel: '—', setupReasons: [], setupConviction: 0 };
}
