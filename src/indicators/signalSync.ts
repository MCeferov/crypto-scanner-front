import type { CoinData } from '../context/MarketContext';
import type { SignalAges } from './signalAge';
import type { MtfTf } from './chartAnalysis';
import type { SetupSignal } from './setupSignal';

export type SyncStatus = 'STRONG' | 'GOOD' | 'WEAK' | 'MISMATCH';

/** İdeal şam fərqi: güclü sinxronizasiya üçün 2–3 şam */
export const IDEAL_GAP_MIN = 2;
export const IDEAL_GAP_MAX = 3;
const GOOD_GAP_MAX = 4;
const WEAK_GAP_MAX = 6;

export interface TrackedSignal {
  id: string;
  label: string;
  side: 'bull' | 'bear';
  candles: number;
}

export interface SignalSyncResult {
  syncStatus: SyncStatus;
  syncScore: number;
  syncLeader: string;
  syncLeaderId: string;
  syncLeaderCandles: number;
  syncReasons: string[];
  convictionAdjust: number;
  dominantSide: 'bull' | 'bear' | 'mixed';
}

function scoreGap(gap: number): number {
  if (gap >= IDEAL_GAP_MIN && gap <= IDEAL_GAP_MAX) return 1.0;
  if (gap <= 1) return 0.9;
  if (gap === GOOD_GAP_MAX) return 0.82;
  if (gap <= WEAK_GAP_MAX) return 0.55;
  return 0.22;
}

function collectSignals(coin: CoinData, ages: SignalAges, activeTfs: MtfTf[]): TrackedSignal[] {
  const out: TrackedSignal[] = [];

  if (coin.macdHistogram !== null && coin.macdHistogram !== 0 && ages.macdCandles > 0) {
    out.push({
      id: 'macd',
      label: 'MACD',
      side: coin.macdHistogram > 0 ? 'bull' : 'bear',
      candles: ages.macdCandles,
    });
  }

  if (coin.superTrend !== null && ages.stCandles > 0) {
    out.push({
      id: 'st',
      label: 'SuperTrend',
      side: coin.superTrend === 1 ? 'bull' : 'bear',
      candles: ages.stCandles,
    });
  }

  if (coin.haTrend !== 0 && ages.haCandles > 0) {
    out.push({
      id: 'ha',
      label: 'Heikin Ashi',
      side: coin.haTrend === 1 ? 'bull' : 'bear',
      candles: ages.haCandles,
    });
  }

  if (ages.rsiCandles > 0 && coin.rsi1h !== null) {
    const bull = coin.rsi1h < 50;
    out.push({
      id: 'rsi',
      label: 'RSI 1H',
      side: bull ? 'bull' : 'bear',
      candles: ages.rsiCandles,
    });
  }

  if (ages.stochCandles > 0 && coin.stochRsiK !== null) {
    const bull = coin.stochRsiK < 50 || (coin.stochRsiK < 80 && (coin.stochRsiD ?? 0) <= coin.stochRsiK);
    out.push({
      id: 'stoch',
      label: 'Stoch RSI',
      side: bull ? 'bull' : 'bear',
      candles: ages.stochCandles,
    });
  }

  const mtfMap: { tf: MtfTf; dir: typeof coin.mtf15m; candles: number; label: string }[] = [
    { tf: '15m', dir: coin.mtf15m, candles: ages.mtf15mCandles, label: '15m' },
    { tf: '30m', dir: coin.mtf30m, candles: ages.mtf30mCandles, label: '30m' },
    { tf: '1h', dir: coin.mtf1h, candles: ages.mtf1hCandles, label: '1H' },
    { tf: '4h', dir: coin.mtf4h, candles: ages.mtf4hCandles, label: '4H' },
  ];

  for (const m of mtfMap) {
    if (!activeTfs.includes(m.tf) || m.dir === 'NEUTRAL' || m.candles <= 0) continue;
    out.push({
      id: `mtf-${m.tf}`,
      label: m.label,
      side: m.dir === 'BUY' ? 'bull' : 'bear',
      candles: m.candles,
    });
  }

  if (coin.chartSignal !== 'NEUTRAL' && ages.chartCandles > 0) {
    out.push({
      id: 'chart',
      label: 'Chart',
      side: coin.chartSignal === 'BUY' ? 'bull' : 'bear',
      candles: ages.chartCandles,
    });
  }

  if (coin.signal !== 'NEUTRAL' && ages.aiCandles > 0) {
    const bull = coin.signal === 'BUY' || coin.signal === 'STRONG_BUY';
    out.push({
      id: 'ai',
      label: 'AI',
      side: bull ? 'bull' : 'bear',
      candles: ages.aiCandles,
    });
  }

  if (coin.researchSignal === 'BUY' || coin.researchSignal === 'SELL') {
    out.push({
      id: 'research',
      label: 'Bazar',
      side: coin.researchSignal === 'BUY' ? 'bull' : 'bear',
      candles: Math.max(ages.chartCandles, 1),
    });
  }

  if (coin.zoneBreakoutSignal !== 'NEUTRAL' && ages.zoneCandles > 0) {
    const bull = coin.zoneBreakoutSignal === 'LONG' || coin.zoneBreakoutSignal === 'STRONG_LONG';
    out.push({
      id: 'breakout',
      label: 'Zone Break',
      side: bull ? 'bull' : 'bear',
      candles: ages.zoneCandles,
    });
  } else if (coin.zoneSignal.includes('BUY') || coin.zoneSignal.includes('SELL')) {
    out.push({
      id: 'zone',
      label: 'S/D Zone',
      side: coin.zoneSignal.includes('BUY') ? 'bull' : 'bear',
      candles: ages.zoneCandles || 1,
    });
  }

  return out;
}

function analyzeSide(signals: TrackedSignal[]): {
  pairScore: number;
  leader: TrackedSignal | null;
  reasons: string[];
  /** Ən erkən və ən gec siqnal arasındakı şam fərqi (faktiki "lag") */
  clusterSpread: number;
} {
  if (signals.length === 0) {
    return { pairScore: 0.5, leader: null, reasons: ['Aktiv siqnal yoxdur'], clusterSpread: 99 };
  }

  if (signals.length === 1) {
    const s = signals[0];
    return {
      pairScore: s.candles >= 3 ? 0.85 : 0.6,
      leader: s,
      reasons: [`Lider: ${s.label} (${s.candles} şam)`],
      clusterSpread: 0,
    };
  }

  const pairScores: number[] = [];
  const gapNotes: string[] = [];

  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const gap = Math.abs(signals[i].candles - signals[j].candles);
      const sc = scoreGap(gap);
      pairScores.push(sc);
      if (gap >= IDEAL_GAP_MIN && gap <= IDEAL_GAP_MAX) {
        gapNotes.push(`${signals[i].label}↔${signals[j].label}: ${gap} şam ✓ (ideal 2–3)`);
      } else if (gap > WEAK_GAP_MAX) {
        gapNotes.push(`${signals[i].label}↔${signals[j].label}: ${gap} şam ✗ (çox fərq)`);
      }
    }
  }

  const leader = signals.reduce((a, b) => (a.candles >= b.candles ? a : b));
  const avgPair = pairScores.reduce((s, v) => s + v, 0) / pairScores.length;
  const candleArr = signals.map(s => s.candles);
  const minCandles = Math.min(...candleArr);
  const clusterSpread = Math.max(...candleArr) - minCandles;

  const reasons = [
    `Lider (ilk siqnal): ${leader.label} — ${leader.candles} şam`,
    `Klaster fərqi: ${clusterSpread} şam (hədəf ≤${IDEAL_GAP_MAX})`,
    ...gapNotes.slice(0, 3),
  ];

  if (minCandles <= 2) {
    reasons.push('⚠ Ən gənc siqnal ≤2 şam — flip riski');
  }

  return { pairScore: avgPair, leader, reasons, clusterSpread };
}

export function computeSignalSync(
  coin: CoinData,
  ages: SignalAges,
  activeTfs: MtfTf[],
): SignalSyncResult {
  const all = collectSignals(coin, ages, activeTfs);
  const bulls = all.filter(s => s.side === 'bull');
  const bears = all.filter(s => s.side === 'bear');

  let dominantSide: 'bull' | 'bear' | 'mixed' = 'mixed';
  if (bulls.length > bears.length && bulls.length >= 2) dominantSide = 'bull';
  else if (bears.length > bulls.length && bears.length >= 2) dominantSide = 'bear';

  const active = dominantSide === 'bull' ? bulls : dominantSide === 'bear' ? bears : all;

  if (bulls.length > 0 && bears.length > 0) {
    const mixRatio = Math.min(bulls.length, bears.length) / all.length;
    if (mixRatio >= 0.35) {
      return {
        syncStatus: 'MISMATCH',
        syncScore: Math.round(mixRatio * 40),
        syncLeader: '—',
        syncLeaderId: '',
        syncLeaderCandles: 0,
        syncReasons: [
          `Ziddiyyət: ${bulls.length} bull vs ${bears.length} bear`,
          'Sinxronizasiya uyğun deyil',
        ],
        convictionAdjust: -0.55,
        dominantSide: 'mixed',
      };
    }
  }

  const { pairScore, leader, reasons, clusterSpread } = analyzeSide(active);
  const minCandles = active.length > 0 ? Math.min(...active.map(s => s.candles)) : 0;

  let syncScore = Math.round(pairScore * 100);
  let syncStatus: SyncStatus = 'WEAK';
  let convictionAdjust = 0;

  // STRONG/GOOD yalnız indikatorlar dar şam pəncərəsində toplaşdıqda (faktiki lag az olduqda).
  // clusterSpread = ən erkən ↔ ən gec siqnal fərqi; hədəf ≤ IDEAL_GAP_MAX (3).
  if (pairScore >= 0.88 && clusterSpread <= IDEAL_GAP_MAX && minCandles >= 3 && active.length >= 3) {
    syncStatus = 'STRONG';
    convictionAdjust = 0.4;
    syncScore = Math.min(100, syncScore + 10);
  } else if (pairScore >= 0.72 && clusterSpread <= GOOD_GAP_MAX && minCandles >= 2) {
    syncStatus = 'GOOD';
    convictionAdjust = 0.18;
  } else if (pairScore >= 0.5) {
    syncStatus = 'WEAK';
    convictionAdjust = -0.2;
  } else {
    syncStatus = 'MISMATCH';
    convictionAdjust = -0.45;
    syncScore = Math.min(syncScore, 40);
  }

  // Geniş klaster (indikatorlar bir-birini gec təsdiqləyir) → güclü siqnalı zəiflət
  if (clusterSpread > WEAK_GAP_MAX && syncStatus !== 'MISMATCH') {
    convictionAdjust -= 0.2;
    reasons.push(`⚠ Klaster fərqi ${clusterSpread} şam — indikatorlar gec təsdiqləyir`);
  }

  if (minCandles <= 1 && syncStatus !== 'MISMATCH') {
    convictionAdjust -= 0.25;
    reasons.push('⚠ Siqnallar çox təzədir');
  }

  reasons.unshift(
    `Sinxron: ${syncStatus} (${syncScore}%) — ideal fərq ${IDEAL_GAP_MIN}–${IDEAL_GAP_MAX} şam`,
  );

  return {
    syncStatus,
    syncScore,
    syncLeader: leader?.label ?? '—',
    syncLeaderId: leader?.id ?? '',
    syncLeaderCandles: leader?.candles ?? 0,
    syncReasons: reasons,
    convictionAdjust,
    dominantSide,
  };
}

/** Sinxronizasiyaya görə setup siqnalını tənzimlə */
export function applySyncToSetup(
  setupSignal: SetupSignal,
  conviction: number,
  sync: SignalSyncResult,
): { setupSignal: SetupSignal; conviction: number } {
  let conv = conviction;
  let sig = setupSignal;

  if (sync.syncStatus === 'MISMATCH') {
    if (sig === 'STRONG_BUY') sig = 'BUY';
    else if (sig === 'BUY') sig = 'NEUTRAL';
    else if (sig === 'STRONG_SELL') sig = 'SELL';
    else if (sig === 'SELL') sig = 'NEUTRAL';
  } else if (sync.syncStatus === 'WEAK') {
    if (sig === 'STRONG_BUY') sig = 'BUY';
    else if (sig === 'STRONG_SELL') sig = 'SELL';
  }

  if (sync.syncStatus === 'STRONG' && conv >= 3.8) {
    if (sig === 'BUY') sig = 'STRONG_BUY';
    else if (sig === 'SELL') sig = 'STRONG_SELL';
  }

  return {
    setupSignal: sig,
    conviction: Math.round(conv * 100) / 100,
  };
}

/** Lider indikatorun vote çəkisini artır */
export function leaderWeightMultiplier(voteLabel: string, sync: SignalSyncResult): number {
  if (!sync.syncLeaderId) return 1;
  const map: Record<string, string[]> = {
    macd: ['MACD'],
    st: ['SuperTrend'],
    ha: ['Heikin Ashi', 'HA trend'],
    rsi: ['RSI 1H', 'RSI'],
    stoch: ['Stoch RSI'],
    chart: ['Chart signal'],
    ai: ['AI indikator'],
    research: ['Bazar araşdırması'],
    breakout: ['Zone breakout'],
    zone: ['Zone signal', 'S/D zone'],
    'mtf-15m': ['15m chart'],
    'mtf-30m': ['30m chart'],
    'mtf-1h': ['1H chart'],
    'mtf-4h': ['4H chart'],
  };
  const labels = map[sync.syncLeaderId] ?? [sync.syncLeader];
  if (labels.some(l => voteLabel.toLowerCase().includes(l.toLowerCase()) || voteLabel === l)) {
    return 1.45;
  }
  return 1;
}
