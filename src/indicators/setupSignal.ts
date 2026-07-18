import type { CoinData } from '../context/MarketContext';
import type { ResearchSignal } from './marketResearch';
import type { SignalSyncResult } from './signalSync';
import { leaderWeightMultiplier } from './signalSync';
import {
  MIN_BUY_VOTES,
  MIN_SELL_VOTES,
  BUY_CONVICTION,
  STRONG_BUY_CONVICTION,
  SELL_CONVICTION,
  STRONG_SELL_CONVICTION,
  MIN_RR_ACCEPT,
  RSI_STRONG_OS,
  RSI_STRONG_OB,
  RSI_MILD_OS,
  RSI_MILD_OB,
} from './signalConfig';
import type { VolumeGate } from './volumeConfirmation';
import type { RsiBias } from './rsiAnalysis';
import { sentimentBlocksSide } from './marketSentiment';

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
  if (rsi < RSI_STRONG_OS) return 4.6;
  if (rsi < RSI_MILD_OS) return 3.8;
  if (rsi > RSI_STRONG_OB) return 1.4;
  if (rsi > RSI_MILD_OB) return 2.2;
  return 3;
}

function toSetup(conviction: number, bullVotes: number, bearVotes: number): SetupSignal {
  if (conviction >= STRONG_BUY_CONVICTION && bullVotes >= MIN_BUY_VOTES) return 'STRONG_BUY';
  if (conviction >= BUY_CONVICTION && bullVotes >= MIN_BUY_VOTES) return 'BUY';
  if (conviction <= STRONG_SELL_CONVICTION && bearVotes >= MIN_SELL_VOTES) return 'STRONG_SELL';
  if (conviction <= SELL_CONVICTION && bearVotes >= MIN_SELL_VOTES) return 'SELL';
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
export function computeUnifiedSetup(
  coin: CoinData,
  sync?: SignalSyncResult,
  opts?: {
    volumeGate?: VolumeGate | null;
    rsiBias?: RsiBias | null;
    sentimentScore?: number | null;
  },
): SetupResult {
  const votes: Vote[] = [];

  // ── Qrafik analizi (timeframe-lər) ──
  const mtfVotes: Vote[] = [
    { score: tfScore(coin.mtf1m),  weight: 0.7, label: '1m chart',  reasons: [`1m: ${coin.mtf1m}`] },
    { score: tfScore(coin.mtf5m),  weight: 0.9, label: '5m chart',  reasons: [`5m: ${coin.mtf5m}`] },
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
    const stochPts = coin.stochRsiK < 15 ? 4.2 : coin.stochRsiK > 85 ? 1.8 : 3;
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
    const score = opts?.rsiBias === 'blocked' ? 3 : rsiScore(rsi);
    votes.push({
      score,
      weight: tf === '1H' ? 1.2 : 0.8,
      label: `RSI ${tf}`,
      reasons: [`RSI ${tf} ${rsi!.toFixed(0)}`],
    });
  }

  const vg = opts?.volumeGate ?? (coin as CoinData & { volumeGate?: VolumeGate }).volumeGate;
  if (vg === 'confirm') {
    votes.push({ score: 4.2, weight: 2.5, label: 'Volume', reasons: ['Volume təsdiqləyir'] });
  } else if (vg === 'weak') {
    votes.push({ score: 2.8, weight: 2, label: 'Volume', reasons: ['Volume zəif'] });
  } else if (vg === 'diverge') {
    votes.push({ score: 2, weight: 3, label: 'Volume', reasons: ['Volume divergence — veto'] });
  }

  if (votes.length === 0) {
    return { setupSignal: 'NEUTRAL', setupLabel: '—', setupReasons: [], setupConviction: 0 };
  }

  const totalWeight = votes.reduce((s, v) => s + v.weight, 0);
  let conviction = votes.reduce((s, v) => {
    const w = sync ? v.weight * leaderWeightMultiplier(v.label, sync) : v.weight;
    return s + v.score * w;
  }, 0) / (sync
    ? votes.reduce((s, v) => s + v.weight * leaderWeightMultiplier(v.label, sync), 0)
    : totalWeight);

  const bullVotes = votes.filter(v => v.score >= 3.6).length;
  const bearVotes = votes.filter(v => v.score <= 2.4).length;

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

  const mtfBull = [coin.mtf1m, coin.mtf5m, coin.mtf15m, coin.mtf30m, coin.mtf1h, coin.mtf4h].filter(s => s === 'BUY').length;
  const mtfBear = [coin.mtf1m, coin.mtf5m, coin.mtf15m, coin.mtf30m, coin.mtf1h, coin.mtf4h].filter(s => s === 'SELL').length;
  if (mtfBull >= 4) conviction += 0.3;
  if (mtfBear >= 4) conviction -= 0.3;

  if (coin.trendScore >= 70 && coin.riskReward !== null && coin.riskReward >= MIN_RR_ACCEPT) conviction += 0.15;
  if (coin.trendScore <= 30) conviction -= 0.15;

  if (sync) conviction += sync.convictionAdjust;

  conviction = Math.round(conviction * 100) / 100;

  let setupSignal = toSetup(conviction, bullVotes, bearVotes);
  const andReasons: string[] = [];
  const wantBuy = setupSignal === 'BUY' || setupSignal === 'STRONG_BUY';
  const wantSell = setupSignal === 'SELL' || setupSignal === 'STRONG_SELL';

  if (wantBuy || wantSell) {
    const side = wantBuy ? 'buy' as const : 'sell' as const;
    let ok = true;

    if (opts?.rsiBias === 'blocked') {
      ok = false;
      andReasons.push('AND fail: RSI trend-gate blocked');
    }
    // Yalnız divergence hard veto — nodata/weak yumşaq cəza
    if (vg === 'diverge') {
      ok = false;
      andReasons.push('AND fail: volume divergence');
    }
    if (vg === 'weak' && (setupSignal === 'STRONG_BUY' || setupSignal === 'STRONG_SELL')) {
      setupSignal = wantBuy ? 'BUY' : 'SELL';
      andReasons.push('Volume zəif — STRONG endirildi');
    }

    const trendOk = wantBuy
      ? (coin.superTrend === 1 || coin.mtf1h === 'BUY' || coin.mtf4h === 'BUY' || coin.chartSignal === 'BUY')
      : (coin.superTrend === -1 || coin.mtf1h === 'SELL' || coin.mtf4h === 'SELL' || coin.chartSignal === 'SELL');
    if (!trendOk) {
      ok = false;
      andReasons.push('AND fail: trend/TF uyğun deyil');
    }

    // Zone: yalnız STRONG üçün məcburi
    const zoneOk = wantBuy
      ? (coin.zonePosition === 'at_demand' || coin.zonePosition === 'near_demand' || breakLong)
      : (coin.zonePosition === 'at_supply' || coin.zonePosition === 'near_supply' || breakShort);
    if (!zoneOk && (setupSignal === 'STRONG_BUY' || setupSignal === 'STRONG_SELL')) {
      setupSignal = wantBuy ? 'BUY' : 'SELL';
      andReasons.push('Zone uzaq — STRONG endirildi');
    }

    const sentScore = opts?.sentimentScore
      ?? (coin as CoinData & { sentimentScore?: number }).sentimentScore
      ?? 0;
    if (sentimentBlocksSide(side, sentScore)) {
      ok = false;
      andReasons.push('AND fail: extreme opposite sentiment');
    }

    if (sync?.syncStatus === 'MISMATCH') {
      if (setupSignal === 'STRONG_BUY' || setupSignal === 'STRONG_SELL') {
        setupSignal = wantBuy ? 'BUY' : 'SELL';
        andReasons.push('Sync MISMATCH — STRONG endirildi');
      }
    }

    if (!ok) setupSignal = 'NEUTRAL';
  }

  const setupLabel = setupLabelFromSignal(setupSignal);

  const setupReasonsPrep: string[] = [...andReasons];
  if (sync?.syncReasons.length) {
    setupReasonsPrep.push(...sync.syncReasons.slice(0, 3));
  }
  if (sync?.syncLeader && sync.syncLeader !== '—') {
    setupReasonsPrep.unshift(`Lider: ${sync.syncLeader} (${sync.syncLeaderCandles} şam)`);
  }

  const setupReasons = [
    ...setupReasonsPrep,
    ...votes
      .filter(v => v.score >= 4 || v.score <= 2)
      .sort((a, b) => Math.abs(b.score - 3) - Math.abs(a.score - 3))
      .flatMap(v => v.reasons.filter(Boolean))
      .filter((r, i, arr) => arr.indexOf(r) === i)
      .slice(0, 8),
  ];

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
