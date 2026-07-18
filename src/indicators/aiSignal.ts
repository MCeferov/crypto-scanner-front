import {
  RSI_STRONG_OS,
  RSI_STRONG_OB,
  RSI_MILD_OS,
  RSI_MILD_OB,
} from './signalConfig';
import type { RsiAnalysisResult } from './rsiAnalysis';
import type { VolumeGate } from './volumeConfirmation';

export type Signal = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface SignalInput {
  rsi15m: number | null;
  rsi1h: number | null;
  rsi4h: number | null;
  rsi1d: number | null;
  macdHistogram: number | null;
  stochRsiK: number | null;
  priceChange24h: number;
  haTrend: 1 | -1 | 0;
  haConsecutive: number;
  haSignal: import('./heikinAshi').HaSignal;
  /** Optional: rsiAnalysis engine */
  rsiAnalysis?: RsiAnalysisResult | null;
  /** Optional: volume gate */
  volumeGate?: VolumeGate | null;
}

export interface SignalResult {
  signal: Signal;
  reasons: string[];
  bullishCount: number;
  bearishCount: number;
}

export function computeSignal(input: SignalInput): SignalResult {
  const reasons: string[] = [];
  let bullishCount = 0;
  let bearishCount = 0;

  const macdBullish = input.macdHistogram !== null && input.macdHistogram > 0;
  const macdBearish = input.macdHistogram !== null && input.macdHistogram < 0;
  const stochOversold = input.stochRsiK !== null && input.stochRsiK < 15;
  const stochOverbought = input.stochRsiK !== null && input.stochRsiK > 85;

  // RSI: prefer analysis engine; else level-based with unified thresholds
  const ra = input.rsiAnalysis;
  if (ra) {
    if (ra.bias === 'bullish') {
      bullishCount += ra.quality >= 80 ? 2 : 1;
      reasons.push(...ra.reasons.slice(0, 2));
    } else if (ra.bias === 'bearish') {
      bearishCount += ra.quality >= 80 ? 2 : 1;
      reasons.push(...ra.reasons.slice(0, 2));
    } else if (ra.bias === 'blocked') {
      reasons.push(ra.reasons.find(r => r.includes('blok')) ?? 'RSI trend-gate blocked');
    }
  } else if (input.rsi1h !== null) {
    if (input.rsi1h < RSI_STRONG_OS) { bullishCount += 2; reasons.push('RSI 1H güclü oversold'); }
    else if (input.rsi1h < RSI_MILD_OS) { bullishCount += 1; reasons.push('RSI 1H low'); }
    else if (input.rsi1h > RSI_STRONG_OB) { bearishCount += 2; reasons.push('RSI 1H güclü overbought'); }
    else if (input.rsi1h > RSI_MILD_OB) { bearishCount += 1; reasons.push('RSI 1H high'); }
  }

  if (input.rsi4h !== null) {
    if (input.rsi4h < RSI_MILD_OS) { bullishCount += 1; reasons.push('RSI 4H oversold'); }
    else if (input.rsi4h > RSI_MILD_OB) { bearishCount += 1; reasons.push('RSI 4H overbought'); }
  }
  if (input.rsi1d !== null) {
    if (input.rsi1d < RSI_MILD_OS) { bullishCount += 1; reasons.push('RSI 1D oversold'); }
    else if (input.rsi1d > RSI_MILD_OB) { bearishCount += 1; reasons.push('RSI 1D overbought'); }
  }

  if (macdBullish) { bullishCount += 1; reasons.push('MACD bullish'); }
  if (macdBearish) { bearishCount += 1; reasons.push('MACD bearish'); }

  // HA: tək vote (trend+signal double-count yox)
  const haBull = input.haTrend === 1 && input.haConsecutive >= 2;
  const haBear = input.haTrend === -1 && input.haConsecutive >= 2;
  if (input.haSignal === 'STRONG_BUY' || (haBull && input.haSignal === 'BUY')) {
    bullishCount += input.haSignal === 'STRONG_BUY' ? 2 : 1;
    reasons.push(`HA ${input.haSignal === 'STRONG_BUY' ? 'strong buy' : `▲${input.haConsecutive}`}`);
  } else if (input.haSignal === 'STRONG_SELL' || (haBear && input.haSignal === 'SELL')) {
    bearishCount += input.haSignal === 'STRONG_SELL' ? 2 : 1;
    reasons.push(`HA ${input.haSignal === 'STRONG_SELL' ? 'strong sell' : `▼${input.haConsecutive}`}`);
  } else if (haBull) {
    bullishCount += 1;
    reasons.push(`HA ▲${input.haConsecutive}`);
  } else if (haBear) {
    bearishCount += 1;
    reasons.push(`HA ▼${input.haConsecutive}`);
  }

  if (stochOversold) { bullishCount += 1; reasons.push('Stoch RSI oversold (<15)'); }
  if (stochOverbought) { bearishCount += 1; reasons.push('Stoch RSI overbought (>85)'); }

  // Volume hard veto
  const vol = input.volumeGate;
  if (vol === 'diverge' || vol === 'nodata') {
    if (bullishCount > bearishCount) {
      reasons.push('Volume gate: diverge/nodata — AL veto');
      bullishCount = Math.min(bullishCount, bearishCount);
    } else if (bearishCount > bullishCount) {
      reasons.push('Volume gate: diverge/nodata — SAT veto');
      bearishCount = Math.min(bearishCount, bullishCount);
    }
  } else if (vol === 'weak') {
    bullishCount = Math.max(0, bullishCount - 1);
    bearishCount = Math.max(0, bearishCount - 1);
    reasons.push('Volume zəif — səs azaldıldı');
  } else if (vol === 'confirm') {
    if (bullishCount > bearishCount) bullishCount += 1;
    if (bearishCount > bullishCount) bearishCount += 1;
    reasons.push('Volume təsdiqləyir');
  }

  // RSI blocked → no directional signal from RSI side
  const rsiBlocked = ra?.bias === 'blocked';

  const isStrongBuy =
    !rsiBlocked &&
    vol !== 'diverge' &&
    ((input.rsi1h !== null && input.rsi1h < RSI_STRONG_OS && macdBullish && haBull) ||
      (ra?.bias === 'bullish' && ra.quality >= 80 && macdBullish && vol === 'confirm'));

  const isStrongSell =
    !rsiBlocked &&
    vol !== 'diverge' &&
    ((input.rsi1h !== null && input.rsi1h > RSI_STRONG_OB && macdBearish && haBear) ||
      (ra?.bias === 'bearish' && ra.quality >= 80 && macdBearish && vol === 'confirm'));

  let signal: Signal;
  if (isStrongBuy && bullishCount >= 4) {
    signal = 'STRONG_BUY';
  } else if (isStrongSell && bearishCount >= 4) {
    signal = 'STRONG_SELL';
  } else if (!rsiBlocked && bullishCount >= 4 && bullishCount > bearishCount + 1) {
    signal = 'BUY';
  } else if (!rsiBlocked && bearishCount >= 4 && bearishCount > bullishCount + 1) {
    signal = 'SELL';
  } else {
    signal = 'NEUTRAL';
  }

  return { signal, reasons, bullishCount, bearishCount };
}
