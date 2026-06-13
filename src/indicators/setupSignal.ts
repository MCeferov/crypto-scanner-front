import type { Signal } from './aiSignal';
import type { HaSignal } from './heikinAshi';
import type { ZoneBreakoutSignal } from './supplyDemand';
import type { ZoneSignal } from './supplyDemand';

export type SetupSignal =
  | 'STRONG_BUY'
  | 'BUY'
  | 'NEUTRAL'
  | 'SELL'
  | 'STRONG_SELL';

export interface SetupInput {
  haSignal: HaSignal;
  zoneBreakoutSignal: ZoneBreakoutSignal;
  zoneSignal: ZoneSignal;
  signal: Signal;
  haReasons: string[];
  zoneBreakoutReasons: string[];
  zoneSignalReasons: string[];
  signalReasons: string[];
}

export interface SetupResult {
  setupSignal: SetupSignal;
  setupLabel: string;
  setupReasons: string[];
  conviction: number;
}

const SCORE: Record<string, number> = {
  STRONG_BUY: 5, BUY: 4, NEUTRAL: 3, SELL: 2, STRONG_SELL: 1,
  STRONG_LONG: 5, LONG: 4, SHORT: 2, STRONG_SHORT: 1,
  ZONE_STRONG_BUY: 5, ZONE_BUY: 4, ZONE_NEUTRAL: 3, ZONE_SELL: 2, ZONE_STRONG_SELL: 1,
};

function toSetup(score: number): SetupSignal {
  if (score >= 4.5) return 'STRONG_BUY';
  if (score >= 3.6) return 'BUY';
  if (score <= 1.5) return 'STRONG_SELL';
  if (score <= 2.4) return 'SELL';
  return 'NEUTRAL';
}

export function computeSetup(input: SetupInput): SetupResult {
  const parts: { score: number; label: string; reasons: string[] }[] = [];

  if (input.zoneBreakoutSignal !== 'NEUTRAL') {
    parts.push({
      score: SCORE[input.zoneBreakoutSignal] ?? 3,
      label: input.zoneBreakoutSignal.replace('_', ' '),
      reasons: input.zoneBreakoutReasons,
    });
  }
  if (input.haSignal !== 'NEUTRAL') {
    parts.push({
      score: SCORE[input.haSignal] ?? 3,
      label: `HA ${input.haSignal.replace('_', ' ')}`,
      reasons: input.haReasons,
    });
  }
  if (input.zoneSignal !== 'ZONE_NEUTRAL') {
    parts.push({
      score: SCORE[input.zoneSignal] ?? 3,
      label: input.zoneSignal.replace('ZONE_', '').replace('_', ' '),
      reasons: input.zoneSignalReasons,
    });
  }
  if (input.signal !== 'NEUTRAL') {
    parts.push({
      score: SCORE[input.signal] ?? 3,
      label: input.signal.replace('_', ' '),
      reasons: input.signalReasons,
    });
  }

  if (parts.length === 0) {
    return { setupSignal: 'NEUTRAL', setupLabel: '—', setupReasons: [], conviction: 0 };
  }

  const avg = parts.reduce((s, p) => s + p.score, 0) / parts.length;

  // Boost when HA aligns with zone breakout direction
  const haBull = input.haSignal === 'STRONG_BUY' || input.haSignal === 'BUY';
  const haBear = input.haSignal === 'STRONG_SELL' || input.haSignal === 'SELL';
  const breakLong = input.zoneBreakoutSignal === 'LONG' || input.zoneBreakoutSignal === 'STRONG_LONG';
  const breakShort = input.zoneBreakoutSignal === 'SHORT' || input.zoneBreakoutSignal === 'STRONG_SHORT';

  let conviction = avg;
  if ((haBull && breakLong) || (haBear && breakShort)) conviction += 0.5;
  if (haBull && (input.zoneSignal === 'ZONE_BUY' || input.zoneSignal === 'ZONE_STRONG_BUY')) conviction += 0.3;
  if (haBear && (input.zoneSignal === 'ZONE_SELL' || input.zoneSignal === 'ZONE_STRONG_SELL')) conviction += 0.3;

  const setupSignal = toSetup(conviction);
  const primary = parts.sort((a, b) => b.score - a.score)[0];
  const setupLabel = primary.label;
  const setupReasons = parts.flatMap(p => p.reasons).filter((r, i, arr) => arr.indexOf(r) === i);

  return { setupSignal, setupLabel, setupReasons, conviction: Math.round(conviction * 10) / 10 };
}
