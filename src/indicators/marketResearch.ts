import type { CoinData } from '../context/MarketContext';
import type { ChartSignal } from './chartAnalysis';
import type { FearGreedData } from '../services/fearGreedApi';
import { computeUnifiedSetup, setupLabelFromSignal } from './setupSignal';
import { computeReversalRisk, applyReversalPenalty } from './reversalRisk';
import { computeSignalAges, recomputeSetupAge } from './signalAge';
import { computeSignalSync, applySyncToSetup } from './signalSync';
import { getPrimaryAnalysisTf, type MtfTf } from './chartAnalysis';
import type { Kline } from '../services/binanceApi';
import { computeMarketSentiment } from './marketSentiment';
import { computeConfidenceScore } from './confidenceScore';
import { MIN_CONFIDENCE_SHOW } from './signalConfig';

export type ResearchSignal = 'BUY' | 'SELL' | 'HOLD' | 'NEUTRAL';

export interface MarketContext {
  btcChange24h: number;
  btcChange1h: number;
  btcTrendScore: number;
  btcChartSignal: ChartSignal;
  fearGreed: FearGreedData | null;
}

export interface ResearchResult {
  researchSignal: ResearchSignal;
  researchLabel: string;
  researchScore: number;
  researchReasons: string[];
}

function marketBias(ctx: MarketContext): 'bullish' | 'bearish' | 'neutral' {
  let score = 0;
  if (ctx.btcChange24h > 1) score += 1;
  else if (ctx.btcChange24h < -1) score -= 1;
  if (ctx.btcChartSignal === 'BUY') score += 1;
  else if (ctx.btcChartSignal === 'SELL') score -= 1;
  if (ctx.btcTrendScore >= 60) score += 1;
  else if (ctx.btcTrendScore <= 40) score -= 1;
  if (ctx.fearGreed) {
    if (ctx.fearGreed.value <= 25) score += 0.5;
    else if (ctx.fearGreed.value >= 75) score -= 0.5;
  }
  if (score >= 1.5) return 'bullish';
  if (score <= -1.5) return 'bearish';
  return 'neutral';
}

function countMtfBull(coin: CoinData): number {
  return [coin.mtf1m, coin.mtf5m, coin.mtf15m, coin.mtf30m, coin.mtf1h, coin.mtf4h].filter(s => s === 'BUY').length;
}

function countMtfBear(coin: CoinData): number {
  return [coin.mtf1m, coin.mtf5m, coin.mtf15m, coin.mtf30m, coin.mtf1h, coin.mtf4h].filter(s => s === 'SELL').length;
}

export function buildMarketContext(btc: CoinData | undefined, fearGreed: FearGreedData | null): MarketContext {
  return {
    btcChange24h: btc?.priceChange24h ?? 0,
    btcChange1h: btc?.priceChange1h ?? 0,
    btcTrendScore: btc?.trendScore ?? 50,
    btcChartSignal: btc?.chartSignal ?? 'NEUTRAL',
    fearGreed,
  };
}

export function computeMarketResearch(coin: CoinData, ctx: MarketContext): ResearchResult {
  let score = 0;
  const reasons: string[] = [];
  const isBtc = coin.symbol === 'BTCUSDT';
  const bias = marketBias(ctx);

  // ── Ümumi bazar mühiti ──
  if (ctx.fearGreed) {
    const fg = ctx.fearGreed;
    if (fg.value <= 20) {
      score += 1;
      reasons.push(`Fear & Greed: ${fg.value} (${fg.classification}) — aşırı qorxu, contrarian alış fürsəti`);
    } else if (fg.value <= 40) {
      score += 0.3;
      reasons.push(`Fear & Greed: ${fg.value} — ehtiyatlı bazar`);
    } else if (fg.value >= 80) {
      score -= 1.5;
      reasons.push(`Fear & Greed: ${fg.value} (${fg.classification}) — həddən artıq hərs, satış riski`);
    } else if (fg.value >= 60) {
      score -= 0.3;
      reasons.push(`Fear & Greed: ${fg.value} — optimist bazar`);
    }
  }

  if (!isBtc) {
    const rel = coin.priceChange24h - ctx.btcChange24h;
    if (rel > 2) {
      score += 1.5;
      reasons.push(`BTC-dən güclü (+${rel.toFixed(1)}% rel.) — alts liderliyi`);
    } else if (rel > 0.5) {
      score += 0.5;
      reasons.push('BTC-dən yaxşı performans');
    } else if (rel < -2) {
      score -= 1.5;
      reasons.push(`BTC-dən zəif (${rel.toFixed(1)}% rel.) — satış təzyiqi`);
    } else if (rel < -0.5) {
      score -= 0.5;
      reasons.push('BTC-dən geri qalır');
    }
  }

  if (bias === 'bullish') {
    score += 0.8;
    reasons.push(`BTC bazar müsbət (${ctx.btcChange24h >= 0 ? '+' : ''}${ctx.btcChange24h.toFixed(1)}% 24s)`);
  } else if (bias === 'bearish') {
    score -= 0.8;
    reasons.push(`BTC bazar mənfi (${ctx.btcChange24h.toFixed(1)}% 24s) — ehtiyatlı ol`);
  }

  // ── Texniki təsdiq (qrafik + setup) ──
  if (coin.chartSignal === 'BUY') {
    score += 2;
    reasons.push('Qrafik analizi BUY — alış siqnalı');
  } else if (coin.chartSignal === 'SELL') {
    score -= 2;
    reasons.push('Qrafik analizi SELL — satış siqnalı');
  }

  const mtfBull = countMtfBull(coin);
  const mtfBear = countMtfBear(coin);
  if (mtfBull >= 3) {
    score += 1.5;
    reasons.push(`${mtfBull}/4 timeframe BUY — güclü trend`);
  } else if (mtfBull >= 2) {
    score += 0.5;
  }
  if (mtfBear >= 3) {
    score -= 1.5;
    reasons.push(`${mtfBear}/4 timeframe SELL — düşüş trendi`);
  } else if (mtfBear >= 2) {
    score -= 0.5;
  }

  if (coin.setupSignal === 'STRONG_BUY' || coin.setupSignal === 'BUY') {
    score += 1;
    reasons.push(`Setup: ${coin.setupLabel} — texniki uyğunluq`);
  } else if (coin.setupSignal === 'STRONG_SELL' || coin.setupSignal === 'SELL') {
    score -= 1;
    reasons.push(`Setup: ${coin.setupLabel} — satış setup`);
  }

  if (coin.trendScore >= 65) {
    score += 1;
    reasons.push(`Trend score ${coin.trendScore} — güclü momentum`);
  } else if (coin.trendScore <= 35) {
    score -= 1;
    reasons.push(`Trend score ${coin.trendScore} — zəif momentum`);
  }

  // ── Həcm + qiymət (bazar marağı) ──
  if (coin.priceChange24h > 3 && coin.volume24h >= 100_000_000) {
    score += 1;
    reasons.push('Yüksək həcm + qiymət artımı — alıcı marağı');
  } else if (coin.priceChange24h < -3 && coin.volume24h >= 100_000_000) {
    score -= 1;
    reasons.push('Yüksək həcm + düşüş — satış təzyiqi');
  }

  if (coin.rsi1h !== null) {
    if (coin.rsi1h < 25) {
      score += 0.8;
      reasons.push(`RSI oversold (${coin.rsi1h.toFixed(0)}) — geri dönüş potensialı`);
    } else if (coin.rsi1h > 75) {
      score -= 0.8;
      reasons.push(`RSI overbought (${coin.rsi1h.toFixed(0)}) — düzəliş riski`);
    }
  }

  if (coin.zonePosition === 'at_demand' || coin.zonePosition === 'near_demand') {
    score += 0.5;
    reasons.push('Demand zonasında — dəstək səviyyəsi');
  } else if (coin.zonePosition === 'at_supply' || coin.zonePosition === 'near_supply') {
    score -= 0.5;
    reasons.push('Supply zonasında — müqavimət səviyyəsi');
  }

  if (coin.haTrend === 1 && coin.haConsecutive >= 3) {
    score += 0.5;
  } else if (coin.haTrend === -1 && coin.haConsecutive >= 3) {
    score -= 0.5;
  }

  if (coin.riskReward !== null && coin.riskReward >= 2 && score > 0) {
    score += 0.3;
    reasons.push(`R:R ${coin.riskReward.toFixed(1)} — risk/mükafat uyğundur`);
  }

  // BTC xüsusi: öz texnikası + bazar lideri
  if (isBtc) {
    if (coin.chartSignal === 'BUY' && bias !== 'bearish') {
      score += 1;
      reasons.push('BTC qalxış trendində — bazar alışa meyllidir');
    } else if (coin.chartSignal === 'SELL') {
      score -= 1;
      reasons.push('BTC düşüş trendində — bazar ehtiyatlı olmalıdır');
    }
  }

  const researchScore = Math.round(Math.max(-100, Math.min(100, score * 18)));

  let researchSignal: ResearchSignal;
  let researchLabel: string;

  if (score >= 2.5) {
    researchSignal = 'BUY';
    researchLabel = 'AL';
    reasons.unshift(isBtc
      ? 'Bazar araşdırması: BTC alış üçün uyğun görünür'
      : `${coin.baseAsset} alış üçün uyğun görünür`);
  } else if (score <= -2.5) {
    researchSignal = 'SELL';
    researchLabel = 'SAT';
    reasons.unshift(isBtc
      ? 'Bazar araşdırması: BTC satış/qısa mövqe düşünülə bilər'
      : `${coin.baseAsset} satış üçün risk artır`);
  } else if (Math.abs(score) >= 1.2) {
    researchSignal = 'HOLD';
    researchLabel = score > 0 ? 'GÖZLƏ↑' : 'GÖZLƏ↓';
    reasons.unshift('Qarışıq siqnallar — gözlə, təsdiq gözlə');
  } else {
    researchSignal = 'NEUTRAL';
    researchLabel = '—';
    if (reasons.length === 0) reasons.push('Aydın bazar rəyi yoxdur');
  }

  return {
    researchSignal,
    researchLabel,
    researchScore,
    researchReasons: reasons.slice(0, 6),
  };
}

export function enrichCoinWithResearch(
  coin: CoinData,
  ctx: MarketContext,
  activeTfs: MtfTf[] = ['15m', '30m', '1h', '4h'],
  klines?: Record<string, Kline[]>,
  indicatorTf: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
): CoinData {
  const withResearch = { ...coin, ...computeMarketResearch(coin, ctx) };

  const primaryTf = getPrimaryAnalysisTf(activeTfs);
  const primaryK = klines
    ? (klines[primaryTf]?.length >= 20 ? klines[primaryTf] : klines['1h'] || [])
    : [];
  // MACD/ST yaşı — yalnız seçilmiş TF (1h fallback yox)
  const indicatorK = klines && (klines[indicatorTf]?.length ?? 0) >= 20
    ? klines[indicatorTf]!
    : [];
  const haK = indicatorK.length >= 20
    ? indicatorK
    : (klines && (klines['15m']?.length ?? 0) >= 20 ? klines['15m']! : primaryK);

  const preAges = klines && indicatorK.length >= 15
    ? computeSignalAges({
        klineMap: klines,
        primaryKlines: indicatorK,
        haKlines: haK,
        chartSignal: withResearch.chartSignal,
        aiSignal: withResearch.signal,
        setupSignal: 'NEUTRAL',
        zonePosition: withResearch.zonePosition,
        zoneBreakoutSignal: withResearch.zoneBreakoutSignal,
        mtf1m: withResearch.mtf1m,
        mtf5m: withResearch.mtf5m,
        mtf15m: withResearch.mtf15m,
        mtf30m: withResearch.mtf30m,
        mtf1h: withResearch.mtf1h,
        mtf4h: withResearch.mtf4h,
        activeTfs,
      })
    : null;

  const sync = computeSignalSync(withResearch, preAges ?? {
    mtf1mCandles: 0, mtf5mCandles: 0, mtf15mCandles: 0, mtf30mCandles: 0, mtf1hCandles: 0, mtf4hCandles: 0,
    macdCandles: 0, stCandles: 0, stochCandles: 0, haCandles: 0,
    chartCandles: 0, aiCandles: 0, zoneCandles: 0, setupCandles: 0, rsiCandles: 0,
  }, activeTfs);

  const sentiment = computeMarketSentiment({
    fearGreed: ctx.fearGreed,
    btcChange24h: ctx.btcChange24h,
    btcTrendScore: ctx.btcTrendScore,
    btcChartSignal: ctx.btcChartSignal,
  });

  const setup = computeUnifiedSetup(withResearch, sync, {
    volumeGate: withResearch.volumeGate,
    volumeSide:
      withResearch.volBuyRatios[indicatorTf] != null
        ? (withResearch.volBuyRatios[indicatorTf]! >= 0.55
          ? 'buy'
          : withResearch.volBuyRatios[indicatorTf]! <= 0.45
            ? 'sell'
            : null)
        : null,
    rsiBias: withResearch.rsiBias,
    sentimentScore: sentiment.score,
    activeTfs,
  });
  const reversal = computeReversalRisk({ ...withResearch, ...setup });
  const adjusted = applyReversalPenalty(setup.setupSignal, setup.setupConviction, reversal.reversalRisk);
  const synced = applySyncToSetup(adjusted.setupSignal, adjusted.setupConviction, sync);

  const afterSetup = {
    ...withResearch,
    setupSignal: synced.setupSignal,
    setupLabel: setupLabelFromSignal(synced.setupSignal),
    setupReasons: [
      ...reversal.reversalReasons.filter(r => r.startsWith('⚠')),
      ...setup.setupReasons,
    ],
    setupConviction: synced.conviction,
    reversalRisk: reversal.reversalRisk,
    reversalReasons: reversal.reversalReasons,
    mtfAlignment: reversal.mtfAlignment,
    riskRewardNote: reversal.riskRewardNote,
    syncStatus: sync.syncStatus,
    syncScore: sync.syncScore,
    syncLeader: sync.syncLeader,
    syncLeaderId: sync.syncLeaderId,
    syncLeaderCandles: sync.syncLeaderCandles,
    syncReasons: sync.syncReasons,
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label,
  };

  const conf = computeConfidenceScore({
    coin: afterSetup,
    rsiAnalysis: {
      rsi: afterSetup.rsi1h,
      slope: null,
      turningUp: afterSetup.rsiBias === 'bullish',
      turningDown: afterSetup.rsiBias === 'bearish',
      regime: afterSetup.rsiRegime,
      bias: afterSetup.rsiBias,
      quality: afterSetup.rsiQuality,
      reasons: [],
    },
    volume: {
      buyRatio: afterSetup.volBuyRatios['1h'],
      volVsSma: null,
      gate: afterSetup.volumeGate,
      volumeScore: afterSetup.volumeScore,
      reason: afterSetup.volumeReason,
    },
    sentiment,
  });

  // Confidence: ≥ MIN_CONFIDENCE_SHOW göstər; əks halda NEUTRAL
  let finalSetup = synced.setupSignal;
  let finalLabel = setupLabelFromSignal(synced.setupSignal);
  if (finalSetup !== 'NEUTRAL') {
    if (conf.confidence >= MIN_CONFIDENCE_SHOW) {
      const prefix = finalSetup === 'STRONG_BUY' ? 'S BUY'
        : finalSetup === 'STRONG_SELL' ? 'S SELL'
        : finalSetup === 'BUY' ? 'BUY'
        : finalSetup === 'SELL' ? 'SELL'
        : finalLabel;
      finalLabel = `${prefix} ${conf.confidence}%`;
    } else {
      finalSetup = 'NEUTRAL';
      finalLabel = '—';
    }
  }

  // Only setupCandles depends on the final setup signal — reuse preAges
  // instead of re-running the whole (expensive) age computation.
  const finalAges = preAges
    ? recomputeSetupAge(preAges, finalSetup, {
        '1m': withResearch.mtf1m, '5m': withResearch.mtf5m,
        '15m': withResearch.mtf15m, '30m': withResearch.mtf30m,
        '1h': withResearch.mtf1h, '4h': withResearch.mtf4h,
      }, activeTfs)
    : null;

  return {
    ...afterSetup,
    setupSignal: finalSetup,
    setupLabel: finalLabel,
    confidence: conf.confidence,
    confidenceSide: conf.side,
    confidenceReasons: conf.reasons,
    ...(finalAges ?? preAges ?? {
      mtf1mCandles: 0, mtf5mCandles: 0, mtf15mCandles: 0, mtf30mCandles: 0, mtf1hCandles: 0, mtf4hCandles: 0,
      macdCandles: 0, stCandles: 0, stochCandles: 0, haCandles: 0,
      chartCandles: 0, aiCandles: 0, zoneCandles: 0, setupCandles: 0, rsiCandles: 0,
    }),
  };
}

export function enrichCoinsWithResearch(
  coins: CoinData[],
  fearGreed: FearGreedData | null,
  activeTfs: MtfTf[] = ['15m', '30m', '1h', '4h'],
  klineCache?: Map<string, Record<string, Kline[]>>,
  indicatorTf: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
): CoinData[] {
  const btc = coins.find(c => c.symbol === 'BTCUSDT');
  const ctx = buildMarketContext(btc, fearGreed);
  return coins.map(coin =>
    enrichCoinWithResearch(coin, ctx, activeTfs, klineCache?.get(coin.id), indicatorTf),
  );
}
