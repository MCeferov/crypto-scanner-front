import type { CoinData } from '../context/MarketContext';
import type { RsiAnalysisResult } from './rsiAnalysis';
import type { VolumeAnalysis } from './volumeConfirmation';
import type { SentimentResult } from './marketSentiment';
import { MIN_CONFIDENCE_SHOW, MIN_RR_ACCEPT } from './signalConfig';

export type ConfidenceSide = 'BUY' | 'SELL' | 'NONE';

export interface ConfidenceBreakdown {
  key: string;
  label: string;
  points: number;
  max: number;
  reason: string;
}

export interface ConfidenceResult {
  side: ConfidenceSide;
  confidence: number;
  breakdown: ConfidenceBreakdown[];
  reasons: string[];
  pass: boolean;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Vahid Confidence Score (0–100).
 * Ağırlıqlar: RSI 20, Volume 20, Trend 15, Sentiment 10, Zone 15, S/R 10, Sync 10.
 */
export function computeConfidenceScore(input: {
  coin: CoinData;
  rsiAnalysis?: RsiAnalysisResult | null;
  volume?: VolumeAnalysis | null;
  sentiment?: SentimentResult | null;
  sideHint?: 'buy' | 'sell' | 'neutral';
}): ConfidenceResult {
  const { coin } = input;
  const breakdown: ConfidenceBreakdown[] = [];
  const reasons: string[] = [];

  // Determine side from setup / chart / AI
  let side: ConfidenceSide = 'NONE';
  const setupBull = coin.setupSignal === 'BUY' || coin.setupSignal === 'STRONG_BUY';
  const setupBear = coin.setupSignal === 'SELL' || coin.setupSignal === 'STRONG_SELL';
  if (setupBull || coin.chartSignal === 'BUY' || coin.signal === 'BUY' || coin.signal === 'STRONG_BUY') {
    side = 'BUY';
  } else if (setupBear || coin.chartSignal === 'SELL' || coin.signal === 'SELL' || coin.signal === 'STRONG_SELL') {
    side = 'SELL';
  }
  if (input.sideHint === 'buy') side = 'BUY';
  if (input.sideHint === 'sell') side = 'SELL';
  if (input.sideHint === 'neutral') side = 'NONE';

  // RSI quality (20)
  const ra = input.rsiAnalysis;
  let rsiPts = 8;
  let rsiReason = 'RSI neytral';
  if (ra) {
    if (ra.bias === 'blocked') {
      rsiPts = 2;
      rsiReason = ra.reasons.find(r => r.includes('blok')) ?? 'RSI blocked by trend';
    } else if (
      (side === 'BUY' && ra.bias === 'bullish') ||
      (side === 'SELL' && ra.bias === 'bearish')
    ) {
      rsiPts = Math.round((ra.quality / 100) * 20);
      rsiReason = `RSI quality ${ra.quality}% · ${ra.regime}`;
    } else if (ra.bias === 'neutral') {
      rsiPts = 6;
      rsiReason = 'RSI neytral/range';
    } else {
      rsiPts = 3;
      rsiReason = 'RSI istiqaməti siqnalla zidd';
    }
  }
  breakdown.push({ key: 'rsi', label: 'RSI Kalitesi', points: rsiPts, max: 20, reason: rsiReason });

  // Volume (20)
  const vol = input.volume;
  let volPts = 8;
  let volReason = 'Volume neytral';
  if (vol) {
    if (vol.gate === 'confirm') {
      volPts = Math.round((vol.volumeScore / 100) * 20);
      volReason = vol.reason;
    } else if (vol.gate === 'weak') {
      volPts = 5;
      volReason = vol.reason;
    } else if (vol.gate === 'diverge' || vol.gate === 'nodata') {
      volPts = 1;
      volReason = vol.reason;
    }
  }
  breakdown.push({ key: 'volume', label: 'Volume Onayı', points: volPts, max: 20, reason: volReason });

  // Trend (15)
  let trendPts = Math.round((coin.trendScore / 100) * 15);
  if (side === 'BUY' && coin.superTrend === -1) trendPts = Math.max(0, trendPts - 5);
  if (side === 'SELL' && coin.superTrend === 1) trendPts = Math.max(0, trendPts - 5);
  if (side === 'BUY' && coin.mtf1h === 'BUY' && coin.mtf4h === 'BUY') trendPts = Math.min(15, trendPts + 3);
  if (side === 'SELL' && coin.mtf1h === 'SELL' && coin.mtf4h === 'SELL') trendPts = Math.min(15, trendPts + 3);
  const trendReason = `Trend ${coin.trendScore} · ST ${coin.superTrend === 1 ? '▲' : coin.superTrend === -1 ? '▼' : '—'} · 1H/4H ${coin.mtf1h}/${coin.mtf4h}`;
  breakdown.push({ key: 'trend', label: 'Trend Gücü', points: clamp(trendPts, 0, 15), max: 15, reason: trendReason });

  // Sentiment (10)
  const sent = input.sentiment;
  let sentPts = 5;
  let sentReason = 'Sentiment neytral';
  if (sent) {
    if (side === 'BUY') {
      sentPts = clamp(Math.round(5 + sent.score / 20), 0, 10);
    } else if (side === 'SELL') {
      sentPts = clamp(Math.round(5 - sent.score / 20), 0, 10);
    }
    sentReason = `${sent.label} (${sent.score})`;
  }
  breakdown.push({ key: 'sentiment', label: 'Market Sentiment', points: sentPts, max: 10, reason: sentReason });

  // Zone / Liquidity (15)
  let zonePts = 5;
  let zoneReason = 'Zone uzaq / yox';
  const atDemand = coin.zonePosition === 'at_demand' || coin.zonePosition === 'near_demand';
  const atSupply = coin.zonePosition === 'at_supply' || coin.zonePosition === 'near_supply';
  if (side === 'BUY' && atDemand) {
    zonePts = coin.zonePosition === 'at_demand' ? 14 : 11;
    zoneReason = `Demand zone: ${coin.zonePosition}`;
  } else if (side === 'SELL' && atSupply) {
    zonePts = coin.zonePosition === 'at_supply' ? 14 : 11;
    zoneReason = `Supply zone: ${coin.zonePosition}`;
  } else if (coin.zoneBreakoutSignal === 'STRONG_LONG' || coin.zoneBreakoutSignal === 'LONG') {
    zonePts = side === 'BUY' ? 12 : 3;
    zoneReason = `Breakout ${coin.zoneBreakoutSignal}`;
  } else if (coin.zoneBreakoutSignal === 'STRONG_SHORT' || coin.zoneBreakoutSignal === 'SHORT') {
    zonePts = side === 'SELL' ? 12 : 3;
    zoneReason = `Breakout ${coin.zoneBreakoutSignal}`;
  }
  breakdown.push({ key: 'zone', label: 'Likidite / Zone', points: zonePts, max: 15, reason: zoneReason });

  // S/R proximity via RR quality (10)
  let srPts = 4;
  let srReason = 'R:R yox';
  if (coin.riskReward !== null) {
    if (coin.riskReward >= 2.5) { srPts = 10; srReason = `R:R ${coin.riskReward.toFixed(1)} — güclü`; }
    else if (coin.riskReward >= MIN_RR_ACCEPT) { srPts = 7; srReason = `R:R ${coin.riskReward.toFixed(1)} — qəbul`; }
    else { srPts = 2; srReason = `R:R ${coin.riskReward.toFixed(1)} < ${MIN_RR_ACCEPT} — zəif`; }
  }
  breakdown.push({ key: 'sr', label: 'Destek / Direnç (R:R)', points: srPts, max: 10, reason: srReason });

  // Momentum sync (10)
  let syncPts = 4;
  let syncReason = `Sync ${coin.syncStatus}`;
  if (coin.syncStatus === 'STRONG') syncPts = 10;
  else if (coin.syncStatus === 'GOOD') syncPts = 7;
  else if (coin.syncStatus === 'WEAK') syncPts = 3;
  else if (coin.syncStatus === 'MISMATCH') syncPts = 1;
  syncPts = Math.round(syncPts * (coin.syncScore / 100 || 0.5));
  syncPts = clamp(syncPts, 0, 10);
  syncReason = `Sync ${coin.syncStatus} (${coin.syncScore}%)`;
  breakdown.push({ key: 'sync', label: 'Momentum Sync', points: syncPts, max: 10, reason: syncReason });

  let confidence = breakdown.reduce((s, b) => s + b.points, 0);
  confidence = clamp(Math.round(confidence), 0, 100);

  // Hard penalties
  if (vol?.gate === 'diverge' && side !== 'NONE') {
    confidence = Math.min(confidence, 55);
    reasons.push('Volume divergence — confidence cap 55');
  }
  if (ra?.bias === 'blocked' && side !== 'NONE') {
    confidence = Math.min(confidence, 50);
    reasons.push('RSI trend-gate blocked — confidence cap 50');
  }
  if (coin.riskReward !== null && coin.riskReward < MIN_RR_ACCEPT && side !== 'NONE') {
    confidence = Math.min(confidence, 60);
    reasons.push(`R:R < ${MIN_RR_ACCEPT} — confidence cap 60`);
  }
  if (sent && side === 'BUY' && sent.score <= -45) {
    confidence = Math.min(confidence, 45);
    reasons.push('Extreme bearish sentiment — AL blocked');
    side = 'NONE';
  }
  if (sent && side === 'SELL' && sent.score >= 45) {
    confidence = Math.min(confidence, 45);
    reasons.push('Extreme bullish sentiment — SAT blocked');
    side = 'NONE';
  }

  if (side === 'NONE') confidence = Math.min(confidence, 49);

  for (const b of breakdown) {
    if (b.points >= b.max * 0.7 || b.points <= b.max * 0.25) {
      reasons.push(`${b.label}: ${b.reason}`);
    }
  }

  const pass = side !== 'NONE' && confidence >= MIN_CONFIDENCE_SHOW;

  return { side, confidence, breakdown, reasons: reasons.slice(0, 10), pass };
}
