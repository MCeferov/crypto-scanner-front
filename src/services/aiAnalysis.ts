import type { TranslateFn } from '@workspace/i18n';
import type { CoinData } from '../context/MarketContext';
import type { Kline } from './binanceApi';
import type { Signal } from '../indicators/aiSignal';
import { computeSignal } from '../indicators/aiSignal';
import { getLatestRSI } from '../indicators/rsi';
import { getLatestMACD } from '../indicators/macd';
import { getLatestBB } from '../indicators/bollingerBands';
import { getLatestATR } from '../indicators/atr';
import { getLatestStochRSI } from '../indicators/stochRsi';
import { getLatestSuperTrend } from '../indicators/supertrend';
import { calculateTrendScore } from '../indicators/trendScore';
import { analyzeHeikinAshi } from '../indicators/heikinAshi';

export interface IndicatorSummaryItem {
  name: string;
  value: string;
  bias: 'bullish' | 'bearish' | 'neutral';
}

export interface AIAnalysisResult {
  signal: Signal;
  bullishScore: number;
  bearishScore: number;
  trendStrength: number;
  summary: string;
  reasons: string[];
  indicatorSummary: IndicatorSummaryItem[];
}

function biasFromRSI(rsi: number | null): 'bullish' | 'bearish' | 'neutral' {
  if (rsi === null) return 'neutral';
  if (rsi < 38) return 'bullish';
  if (rsi > 62) return 'bearish';
  return 'neutral';
}

function biasLabel(t: TranslateFn, bias: 'bullish' | 'bearish' | 'neutral'): string {
  if (bias === 'bullish') return t('detail.biasBullish');
  if (bias === 'bearish') return t('detail.biasBearish');
  return '—';
}

function buildSummary(
  t: TranslateFn,
  signal: Signal,
  bullish: number,
  bearish: number,
  trendStrength: number,
): string {
  const net = bullish - bearish;
  if (signal === 'STRONG_BUY') {
    return t('detail.summaryStrongBuy', { strength: trendStrength });
  }
  if (signal === 'BUY') {
    return t('detail.summaryBuy', { net, strength: trendStrength });
  }
  if (signal === 'STRONG_SELL') {
    return t('detail.summaryStrongSell', { strength: trendStrength });
  }
  if (signal === 'SELL') {
    return t('detail.summarySell', { net, strength: trendStrength });
  }
  return t('detail.summaryNeutral', { bullish, bearish });
}

export function analyzeFromCoin(coin: CoinData, t: TranslateFn): AIAnalysisResult {
  const signalResult = computeSignal({
    rsi15m: coin.rsi15m,
    rsi1h: coin.rsi1h,
    rsi4h: coin.rsi4h,
    rsi1d: coin.rsi1d,
    macdHistogram: coin.macdHistogram,
    stochRsiK: coin.stochRsiK,
    priceChange24h: coin.priceChange24h,
    haTrend: coin.haTrend,
    haConsecutive: coin.haConsecutive,
    haSignal: coin.haSignal,
  });

  const bullishScore = Math.min(100, Math.round((signalResult.bullishCount / 8) * 100));
  const bearishScore = Math.min(100, Math.round((signalResult.bearishCount / 8) * 100));
  const trendStrength = coin.trendScore;

  const macdBias = coin.macdHistogram === null
    ? 'neutral' as const
    : coin.macdHistogram > 0 ? 'bullish' as const : 'bearish' as const;
  const stBias = coin.superTrend === 1
    ? 'bullish' as const
    : coin.superTrend === -1 ? 'bearish' as const : 'neutral' as const;

  const zoneValue = coin.zonePosition === 'at_demand'
    ? t('detail.zoneDemand')
    : coin.zonePosition === 'at_supply'
      ? t('detail.zoneSupply')
      : '—';

  const indicatorSummary: IndicatorSummaryItem[] = [
    {
      name: t('detail.indRsi1h'),
      value: coin.rsi1h !== null ? coin.rsi1h.toFixed(1) : '—',
      bias: biasFromRSI(coin.rsi1h),
    },
    {
      name: t('detail.indMacd'),
      value: macdBias === 'neutral' ? '—' : biasLabel(t, macdBias),
      bias: macdBias,
    },
    {
      name: t('detail.indVolume'),
      value: coin.volume24h >= 1e9
        ? `$${(coin.volume24h / 1e9).toFixed(2)}B`
        : coin.volume24h >= 1e6
          ? `$${(coin.volume24h / 1e6).toFixed(1)}M`
          : `$${coin.volume24h.toFixed(0)}`,
      bias: 'neutral',
    },
    {
      name: t('detail.indStoch'),
      value: coin.stochRsiK !== null ? `K ${coin.stochRsiK.toFixed(1)}` : '—',
      bias: coin.stochRsiK === null ? 'neutral' : coin.stochRsiK < 15 ? 'bullish' : coin.stochRsiK > 85 ? 'bearish' : 'neutral',
    },
    {
      name: t('detail.indSt'),
      value: stBias === 'neutral' ? '—' : biasLabel(t, stBias),
      bias: stBias,
    },
    {
      name: t('detail.indZone'),
      value: zoneValue,
      bias: coin.zonePosition === 'at_demand' ? 'bullish' : coin.zonePosition === 'at_supply' ? 'bearish' : 'neutral',
    },
    {
      name: t('detail.indZoneSignal'),
      value: coin.zoneSignal !== 'ZONE_NEUTRAL'
        ? (t(`signal.${coin.zoneSignal}`) !== `signal.${coin.zoneSignal}`
          ? t(`signal.${coin.zoneSignal}`)
          : coin.zoneSignal.replace('ZONE_', ''))
        : '—',
      bias: coin.zoneSignal.includes('BUY') ? 'bullish' : coin.zoneSignal.includes('SELL') ? 'bearish' : 'neutral',
    },
    {
      name: t('detail.indHa'),
      value: coin.haTrend === 1 ? `▲${coin.haConsecutive}` : coin.haTrend === -1 ? `▼${coin.haConsecutive}` : '—',
      bias: coin.haTrend === 1 ? 'bullish' : coin.haTrend === -1 ? 'bearish' : 'neutral',
    },
    {
      name: t('detail.indSetup'),
      value: coin.setupLabel,
      bias: coin.setupSignal.includes('BUY') ? 'bullish' : coin.setupSignal.includes('SELL') ? 'bearish' : 'neutral',
    },
    {
      name: t('detail.indSlTp'),
      value: coin.stopLoss && coin.takeProfit
        ? `${coin.stopLoss.toFixed(4)} / ${coin.takeProfit.toFixed(4)}`
        : '—',
      bias: 'neutral',
    },
  ];

  const reasons = [...signalResult.reasons];
  if (coin.haReasons.length > 0) reasons.push(...coin.haReasons.slice(0, 2));
  if (coin.zoneSignalReasons.length > 0) reasons.push(...coin.zoneSignalReasons.slice(0, 2));
  if (coin.setupReasons.length > 0) reasons.push(...coin.setupReasons.slice(0, 2));

  return {
    signal: signalResult.signal,
    bullishScore,
    bearishScore,
    trendStrength,
    summary: buildSummary(t, signalResult.signal, bullishScore, bearishScore, trendStrength),
    reasons,
    indicatorSummary,
  };
}

export function analyzeFromKlines(
  klines: Kline[],
  price: number,
  change24h: number,
  t: TranslateFn,
): AIAnalysisResult {
  const closes = klines.map(k => k.close);
  const rsi1h = getLatestRSI(closes, 14);
  const macd = getLatestMACD(closes);
  const bb = getLatestBB(closes);
  const atr = getLatestATR(klines, 14);
  const atrPercent = atr !== null && price > 0 ? (atr / price) * 100 : null;
  const stoch = getLatestStochRSI(closes);
  const st = getLatestSuperTrend(klines);
  const haResult = analyzeHeikinAshi(klines);
  const trendScore = calculateTrendScore({
    rsi1h, rsi4h: null, rsi1d: null,
    macdHistogram: macd?.histogram ?? null,
    priceChange24h: change24h, stochRsiK: stoch?.k ?? null,
    haTrend: haResult.trend,
    haConsecutive: haResult.consecutive,
  });

  const coin: CoinData = {
    id: 'crypto:ANALYSIS', name: 'Analysis', type: 'crypto', marketCap: null,
    symbol: '', baseAsset: '', price, priceChange1h: 0, priceChange24h: change24h,
    volume24h: 0, volBuyRatios: { '1m': null, '5m': null, '15m': null, '1h': null, '4h': null, '1d': null },
    rsi1m: null, rsi5m: null, rsi15m: null, rsi1h, rsi4h: null, rsi1d: null,
    macd: macd?.macd ?? null, macdSignal: macd?.signal ?? null, macdHistogram: macd?.histogram ?? null,
    bbUpper: bb?.upper ?? null, bbMiddle: bb?.middle ?? null, bbLower: bb?.lower ?? null,
    bbPercent: bb?.percentB ?? null, atr, atrPercent,
    stochRsiK: stoch?.k ?? null, stochRsiD: stoch?.d ?? null,
    superTrend: st?.trend ?? null, superTrendValue: st?.value ?? null,
    trendScore, signal: 'NEUTRAL', signalReasons: [],
    zonePosition: null, zoneSignal: 'ZONE_NEUTRAL', zoneBreakoutSignal: 'NEUTRAL',
    zoneBreakoutReasons: [], zoneSignalReasons: [],
    demandZonePrice: null, supplyZonePrice: null,
    stopLoss: null, takeProfit: null, riskReward: null,
    haTrend: haResult.trend, haConsecutive: haResult.consecutive,
    haSignal: haResult.signal, haReasons: haResult.reasons,
    setupSignal: 'NEUTRAL', setupLabel: '—', setupReasons: [], setupConviction: 0,
    mtf1m: 'NEUTRAL', mtf5m: 'NEUTRAL', mtf15m: 'NEUTRAL', mtf30m: 'NEUTRAL', mtf1h: 'NEUTRAL', mtf4h: 'NEUTRAL',
    chartSignal: 'NEUTRAL', chartSignalReasons: [],
    researchSignal: 'NEUTRAL', researchLabel: '—', researchScore: 0, researchReasons: [],
    reversalRisk: 'NONE', reversalReasons: [], mtfAlignment: 'MIXED', riskRewardNote: '',
    primaryAnalysisTf: '1h',
    mtf1mCandles: 0, mtf5mCandles: 0, mtf15mCandles: 0, mtf30mCandles: 0, mtf1hCandles: 0, mtf4hCandles: 0,
    macdCandles: 0, stCandles: 0, stochCandles: 0, haCandles: 0,
    chartCandles: 0, aiCandles: 0, zoneCandles: 0, setupCandles: 0, rsiCandles: 0,
    syncStatus: 'WEAK' as const, syncScore: 0, syncLeader: '—', syncLeaderId: '', syncLeaderCandles: 0, syncReasons: [],
    volumeGate: 'neutral', volumeScore: 50, volumeReason: '',
    rsiBias: 'neutral', rsiQuality: 0, rsiRegime: 'range',
    sentimentScore: 0, sentimentLabel: 'Neytral',
    confidence: 0, confidenceSide: 'NONE', confidenceReasons: [],
    indicatorsLoaded: true,
  };

  return analyzeFromCoin(coin, t);
}
