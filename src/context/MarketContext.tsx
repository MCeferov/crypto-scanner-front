import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react';
import { BinanceBanError, isBinanceBanned } from '../services/binanceRateLimiter';
import {
  getTopUSDTPairs,
  batchFetchKlinesIncremental,
  EXTRA_TIMEFRAMES,
  hasMinimumKlineData, hasPartialKlineData, type Ticker24h, type Kline,
} from '../services/binanceApi';
import { getAllMarkets, getCryptoMarkets, toTickerFormat, type NormalizedAsset } from '../services/marketApi';
import {
  createAssetFromNormalized, sortByPopularity, matchesSearch,
  hasIndicatorSupport, isCryptoAsset,
} from '../utils/assetHelpers';
import type { AssetCategory } from '../types/asset';
import { assetMatchesCategory } from '../types/asset';
import { readKlineCache, writeKlineCache } from '../services/klineCache';
import { streamKlinesFromServer, batchKlinesFromServer, toKlineAssetRef } from '../services/klineBatchApi';
import { BinanceWebSocket, type TickerUpdate } from '../websocket/BinanceWebSocket';
import { getLatestRSI } from '../indicators/rsi';
import { getLatestMACD } from '../indicators/macd';
import { getLatestBB } from '../indicators/bollingerBands';
import { getLatestATR } from '../indicators/atr';
import { getLatestStochRSI } from '../indicators/stochRsi';
import { getLatestSuperTrend } from '../indicators/supertrend';
import { calculateTrendScore } from '../indicators/trendScore';
import { computeSignal, type Signal } from '../indicators/aiSignal';
import { analyzeSupplyDemand, type ZoneBreakoutSignal, type ZonePosition, type ZoneSignal } from '../indicators/supplyDemand';
import { analyzeHeikinAshi, type HaSignal } from '../indicators/heikinAshi';
import { type SetupSignal } from '../indicators/setupSignal';
import type { ReversalRisk, MtfAlignment } from '../indicators/reversalRisk';
import { computeMultiTimeframeAnalysis, getPrimaryAnalysisTf, MTF_TIMEFRAMES, type ChartSignal, type MtfTf, type TfDir } from '../indicators/chartAnalysis';
import { computeSignalAges } from '../indicators/signalAge';
import { enrichCoinsWithResearch, enrichCoinWithResearch, buildMarketContext, type ResearchSignal } from '../indicators/marketResearch';
import { fetchFearGreedIndex, type FearGreedData } from '../services/fearGreedApi';
import { computeBuyRatios, analyzeVolumeForSignal } from '../indicators/volumeConfirmation';
import { analyzeRsi } from '../indicators/rsiAnalysis';
import { computeMarketSentiment } from '../indicators/marketSentiment';
import { computeConfidenceScore } from '../indicators/confidenceScore';
import { RSI_STRONG_OS, RSI_STRONG_OB } from '../indicators/signalConfig';

import type { AssetType } from '../types/asset';

export type SortKey =
  | 'symbol' | 'price' | 'change1h' | 'change24h' | 'volume' | 'marketCap'
  | 'rsi1m' | 'rsi5m' | 'rsi15m' | 'rsi1h' | 'rsi4h' | 'rsi1d'
  | 'trendScore' | 'signal' | 'macd' | 'superTrend'
  | 'zoneSignal' | 'zoneBreakout' | 'haSignal' | 'setup' | 'chartSignal' | 'research'
  | 'stopLoss' | 'takeProfit' | 'riskReward';

export type FilterKey =
  | 'all' | 'oversold' | 'overbought' | 'highVolume'
  | 'topGainers' | 'topLosers' | 'strongBuy' | 'strongSell'
  | 'zoneBuy' | 'zoneSell' | 'zoneBreakLong' | 'zoneBreakShort'
  | 'haBuy' | 'haSell' | 'setupBuy' | 'setupSell'
  | 'chartBuy' | 'chartSell'
  | 'researchBuy' | 'researchSell'
  | 'setupStrongBuy' | 'setupStrongSell'
  | 'candlesMature' | 'candlesFresh' | 'syncStrong';

/** Optional detail columns — hidden by default to reduce clutter */
export type ExtraCol =
  | 'macd' | 'volume' | 'stoch' | 'st'
  | 'research' | 'ha' | 'zone' | 'break' | 'sl' | 'tp';
export const ALL_EXTRA_COLS: ExtraCol[] = [
  'macd', 'volume', 'stoch', 'st',
  'research', 'ha', 'zone', 'break', 'sl', 'tp',
];
export const EXTRA_COL_LABELS: Record<ExtraCol, string> = {
  macd: 'MACD', volume: 'Vol', stoch: 'Stoch', st: 'ST',
  research: 'Market', ha: 'HA', zone: 'Zone', break: 'Break', sl: 'SL', tp: 'TP',
};

/** RSI timeframe column visibility — 1m/5m daxil, sıra qısa→uzun */
export type RsiTf = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export const ALL_RSI_TFS: RsiTf[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
export const RSI_TF_SORT: Record<RsiTf, SortKey> = {
  '1m': 'rsi1m', '5m': 'rsi5m', '15m': 'rsi15m', '1h': 'rsi1h', '4h': 'rsi4h', '1d': 'rsi1d',
};

/** Chart / analiz timeframe seçimi */
export type AnalysisTf = MtfTf;
export const ALL_ANALYSIS_TFS: AnalysisTf[] = [...MTF_TIMEFRAMES];
export const ANALYSIS_TF_LABELS: Record<AnalysisTf, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H',
};

export interface CoinData {
  id: string;
  name: string;
  type: AssetType;
  marketCap: number | null;
  source?: string;
  symbol: string;
  baseAsset: string;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  volBuyRatios: Record<RsiTf, number | null>;
  rsi1m: number | null;
  rsi5m: number | null;
  rsi15m: number | null;
  rsi1h: number | null;
  rsi4h: number | null;
  rsi1d: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbPercent: number | null;
  atr: number | null;
  atrPercent: number | null;
  stochRsiK: number | null;
  stochRsiD: number | null;
  superTrend: 1 | -1 | null;
  superTrendValue: number | null;
  trendScore: number;
  signal: Signal;
  signalReasons: string[];
  zonePosition: ZonePosition;
  zoneSignal: ZoneSignal;
  zoneBreakoutSignal: ZoneBreakoutSignal;
  zoneBreakoutReasons: string[];
  zoneSignalReasons: string[];
  /** Ən yaxın demand zona qiyməti (yuxarı kənar) */
  demandZonePrice: number | null;
  /** Ən yaxın supply zona qiyməti (aşağı kənar) */
  supplyZonePrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  haTrend: 1 | -1 | 0;
  haConsecutive: number;
  haSignal: HaSignal;
  haReasons: string[];
  setupSignal: SetupSignal;
  setupLabel: string;
  setupReasons: string[];
  setupConviction: number;
  mtf1m: TfDir;
  mtf5m: TfDir;
  mtf15m: TfDir;
  mtf30m: TfDir;
  mtf1h: TfDir;
  mtf4h: TfDir;
  chartSignal: ChartSignal;
  chartSignalReasons: string[];
  researchSignal: ResearchSignal;
  researchLabel: string;
  researchScore: number;
  researchReasons: string[];
  reversalRisk: ReversalRisk;
  reversalReasons: string[];
  mtfAlignment: MtfAlignment;
  riskRewardNote: string;
  primaryAnalysisTf: AnalysisTf;
  mtf1mCandles: number;
  mtf5mCandles: number;
  mtf15mCandles: number;
  mtf30mCandles: number;
  mtf1hCandles: number;
  mtf4hCandles: number;
  macdCandles: number;
  stCandles: number;
  stochCandles: number;
  haCandles: number;
  chartCandles: number;
  aiCandles: number;
  zoneCandles: number;
  setupCandles: number;
  rsiCandles: number;
  syncStatus: 'STRONG' | 'GOOD' | 'WEAK' | 'MISMATCH';
  syncScore: number;
  syncLeader: string;
  syncLeaderId: string;
  syncLeaderCandles: number;
  syncReasons: string[];
  /** Volume gate for signal engine */
  volumeGate: 'confirm' | 'weak' | 'diverge' | 'neutral' | 'nodata';
  volumeScore: number;
  volumeReason: string;
  /** RSI analysis */
  rsiBias: 'bullish' | 'bearish' | 'neutral' | 'blocked';
  rsiQuality: number;
  rsiRegime: 'uptrend' | 'downtrend' | 'range';
  /** Sentiment */
  sentimentScore: number;
  sentimentLabel: string;
  /** Unified confidence */
  confidence: number;
  confidenceSide: 'BUY' | 'SELL' | 'NONE';
  confidenceReasons: string[];
  indicatorsLoaded: boolean;
  flashUp?: boolean;
  flashDown?: boolean;
}

interface MarketContextType {
  coins: CoinData[];
  filteredCoins: CoinData[];
  assetCategory: AssetCategory;
  setAssetCategory: (cat: AssetCategory) => void;
  showIndicatorColumns: boolean;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  wsReconnecting: boolean;
  loadingProgress: number;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  filter: FilterKey;
  searchQuery: string;
  visibleRsiCols: RsiTf[];
  visibleExtraCols: ExtraCol[];
  visibleOptionalFilters: FilterKey[];
  visibleAnalysisTfs: AnalysisTf[];
  setSortKey: (key: SortKey) => void;
  setSortDir: (dir: 'asc' | 'desc') => void;
  setFilter: (filter: FilterKey) => void;
  setSearchQuery: (q: string) => void;
  handleSort: (key: SortKey) => void;
  toggleRsiCol: (tf: RsiTf) => void;
  toggleExtraCol: (col: ExtraCol) => void;
  addOptionalFilter: (key: FilterKey) => void;
  removeOptionalFilter: (key: FilterKey) => void;
  toggleAnalysisTf: (tf: AnalysisTf) => void;
  /** Watchlist — persisted asset ids */
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  showOnlyFavorites: boolean;
  setShowOnlyFavorites: (v: boolean) => void;
  /** Table row density — persisted */
  density: 'comfortable' | 'compact';
  setDensity: (d: 'comfortable' | 'compact') => void;
  refresh: () => void;
  /** Detail qrafikdən və ya server refresh-dən gələn klines ilə cədvəl indikatorlarını yenilə */
  syncAssetKlines: (assetId: string, patch: Record<string, Kline[]>) => void;
}

const MarketContext = createContext<MarketContextType | null>(null);

/** Top N keyfiyyətli crypto: volume + marketCap, BTC/ETH həmişə */
function selectQualityCrypto(assets: NormalizedAsset[], limit = 15): NormalizedAsset[] {
  const anchors = ['BTC', 'ETH'];
  const bySym = new Map(assets.map(a => [a.symbol.replace(/USDT$/i, '').toUpperCase(), a]));

  const scored = assets
    .filter(a => {
      const base = a.symbol.replace(/USDT$/i, '').toUpperCase();
      if (['USDC', 'USDT', 'BUSD', 'DAI', 'TUSD', 'FDUSD'].includes(base)) return false;
      return (a.volume24h ?? 0) > 0;
    })
    .map(a => {
      const vol = a.volume24h ?? 0;
      const cap = a.marketCap ?? 0;
      const volScore = Math.log10(vol + 1);
      const capScore = cap > 0 ? Math.log10(cap + 1) : volScore * 0.7;
      const base = a.symbol.replace(/USDT$/i, '').toUpperCase();
      const anchorBoost = anchors.includes(base) ? 100 : 0;
      return { a, score: volScore * 1.2 + capScore + anchorBoost };
    })
    .sort((x, y) => y.score - x.score);

  const picked: NormalizedAsset[] = [];
  const seen = new Set<string>();

  for (const sym of anchors) {
    const hit = bySym.get(sym);
    if (hit) {
      picked.push(hit);
      seen.add(sym);
    }
  }

  for (const { a } of scored) {
    const base = a.symbol.replace(/USDT$/i, '').toUpperCase();
    if (seen.has(base)) continue;
    picked.push(a);
    seen.add(base);
    if (picked.length >= limit) break;
  }

  return picked;
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used inside MarketProvider');
  return ctx;
}

function computeIndicators(
  symbol: string,
  klineMap: Record<string, Kline[]>,
  price: number,
  change24h: number,
  activeTfs: MtfTf[] = [...MTF_TIMEFRAMES],
  /** Cədvəl MACD/ST/Stoch — aktiv RSI TF ilə eyni (başqa TF-yə düşülmür) */
  indicatorTf: RsiTf = '15m',
): Partial<CoinData> {
  const k1m = klineMap['1m'] || [];
  const k5m = klineMap['5m'] || [];
  const k15m = klineMap['15m'] || [];
  const k1h = klineMap['1h'] || [];
  const k4h = klineMap['4h'] || [];
  const k1d = klineMap['1d'] || [];

  // Yalnız seçilmiş TF — 1m seçilibsə heç vaxt 1h MACD göstərmə
  const indicatorK = (klineMap[indicatorTf]?.length ?? 0) >= 20
    ? klineMap[indicatorTf]!
    : [];

  const primaryTf = getPrimaryAnalysisTf(activeTfs);
  const primaryK = (klineMap[primaryTf]?.length ?? 0) >= 20
    ? klineMap[primaryTf]!
    : (k1h.length >= 20 ? k1h : k15m);

  // HA / zone: mümkün qədər indicator TF, yoxsa 15m
  const haKlines = indicatorK.length >= 20
    ? indicatorK
    : (k15m.length >= 20 ? k15m : primaryK);
  const zoneKlines = haKlines;

  const indicatorCloses = indicatorK.map(k => k.close);

  const rsi1m  = getLatestRSI(k1m.map(k => k.close), 14);
  const rsi5m  = getLatestRSI(k5m.map(k => k.close), 14);
  const rsi15m = getLatestRSI(k15m.map(k => k.close), 14);
  const rsi1h  = getLatestRSI(k1h.map(k => k.close),  14);
  const rsi4h  = getLatestRSI(k4h.map(k => k.close),  14);
  const rsi1d  = getLatestRSI(k1d.map(k => k.close),  14);

  const macdResult    = indicatorCloses.length >= 35 ? getLatestMACD(indicatorCloses) : null;
  const macd          = macdResult?.macd      ?? null;
  const macdSignal    = macdResult?.signal    ?? null;
  const macdHistogram = macdResult?.histogram ?? null;

  const bbResult = indicatorCloses.length >= 20 ? getLatestBB(indicatorCloses) : null;
  const bbUpper  = bbResult?.upper    ?? null;
  const bbMiddle = bbResult?.middle   ?? null;
  const bbLower  = bbResult?.lower    ?? null;
  const bbPercent = bbResult?.percentB ?? null;

  const atr        = getLatestATR(primaryK, 14);
  const atrPercent = atr !== null && price > 0 ? (atr / price) * 100 : null;

  const stochResult = indicatorCloses.length >= 20 ? getLatestStochRSI(indicatorCloses) : null;
  const stochRsiK   = stochResult?.k ?? null;
  const stochRsiD   = stochResult?.d ?? null;

  const stResult        = indicatorK.length >= 20 ? getLatestSuperTrend(indicatorK) : null;
  const superTrend      = stResult?.trend ?? null;
  const superTrendValue = stResult?.value ?? null;

  const trendK = k4h.length >= 30 ? k4h : k1h;
  const rsiAnalysis = analyzeRsi({
    closes: indicatorCloses,
    trendCloses: trendK.map(k => k.close),
    higherTfTrend: getLatestSuperTrend(trendK)?.trend ?? null,
    atrPercent,
  });

  const rsiByTf: Record<RsiTf, number | null> = {
    '1m': rsi1m, '5m': rsi5m, '15m': rsi15m, '1h': rsi1h, '4h': rsi4h, '1d': rsi1d,
  };
  const activeRsi = rsiByTf[indicatorTf];

  const rsiSide =
    activeRsi !== null && activeRsi < RSI_STRONG_OS ? 'buy' as const
    : activeRsi !== null && activeRsi > RSI_STRONG_OB ? 'sell' as const
    : rsiAnalysis.bias === 'bullish' ? 'buy' as const
    : rsiAnalysis.bias === 'bearish' ? 'sell' as const
    : null;

  const volAnalysis = analyzeVolumeForSignal(indicatorK, rsiSide);

  let priceChange1h = 0;
  if (k1h.length >= 2) {
    // Last element is the in-progress candle; its open (== previous close)
    // is the price exactly 0–1h ago. The previous candle's open would be
    // 1–2h in the past.
    const refPrice = k1h[k1h.length - 2].close;
    if (refPrice > 0) priceChange1h = ((price - refPrice) / refPrice) * 100;
  }

  const haResult = analyzeHeikinAshi(haKlines);

  const trendScore = calculateTrendScore({
    rsi1h, rsi4h, rsi1d, macdHistogram,
    priceChange24h: change24h, stochRsiK,
    haTrend: haResult.trend,
    haConsecutive: haResult.consecutive,
  });

  const signalResult = computeSignal({
    rsi15m, rsi1h, rsi4h, rsi1d, macdHistogram,
    stochRsiK, priceChange24h: change24h,
    haTrend: haResult.trend,
    haConsecutive: haResult.consecutive,
    haSignal: haResult.signal,
    rsiAnalysis,
    volumeGate: volAnalysis.gate,
  });

  const zoneResult = analyzeSupplyDemand({
    klines: zoneKlines,
    price,
    atr,
    rsi15m,
    rsi1h,
    macdHistogram,
    superTrend,
    stochRsiK,
    stochRsiD,
    haTrend: haResult.trend,
    haConsecutive: haResult.consecutive,
  });

  const mtfResult = computeMultiTimeframeAnalysis(klineMap, activeTfs);

  const emptyAges = {
    mtf1mCandles: 0, mtf5mCandles: 0, mtf15mCandles: 0, mtf30mCandles: 0, mtf1hCandles: 0, mtf4hCandles: 0,
    macdCandles: 0, stCandles: 0, stochCandles: 0, haCandles: haResult.consecutive,
    chartCandles: 0, aiCandles: 0, zoneCandles: 0, setupCandles: 0, rsiCandles: 0,
    syncStatus: 'WEAK' as const, syncScore: 0, syncLeader: '—', syncLeaderId: '', syncLeaderCandles: 0, syncReasons: [],
  };

  const indicatorsLoaded = hasMinimumKlineData(klineMap) || hasPartialKlineData(klineMap);

  return {
    rsi1m, rsi5m, rsi15m, rsi1h, rsi4h, rsi1d,
    macd, macdSignal, macdHistogram,
    bbUpper, bbMiddle, bbLower, bbPercent,
    atr, atrPercent,
    stochRsiK, stochRsiD,
    superTrend, superTrendValue,
    priceChange1h, trendScore,
    signal: signalResult.signal,
    signalReasons: signalResult.reasons,
    zonePosition: zoneResult.zonePosition,
    zoneSignal: zoneResult.zoneSignal,
    zoneBreakoutSignal: zoneResult.zoneBreakoutSignal,
    zoneBreakoutReasons: zoneResult.zoneBreakoutReasons,
    zoneSignalReasons: zoneResult.zoneSignalReasons,
    demandZonePrice: zoneResult.nearestDemand?.top ?? null,
    supplyZonePrice: zoneResult.nearestSupply?.bottom ?? null,
    stopLoss: zoneResult.stopLoss,
    takeProfit: zoneResult.takeProfit,
    riskReward: zoneResult.riskReward,
    haTrend: haResult.trend,
    haConsecutive: haResult.consecutive,
    haSignal: haResult.signal,
    haReasons: haResult.reasons,
    mtf1m: mtfResult.mtf1m,
    mtf5m: mtfResult.mtf5m,
    mtf15m: mtfResult.mtf15m,
    mtf30m: mtfResult.mtf30m,
    mtf1h: mtfResult.mtf1h,
    mtf4h: mtfResult.mtf4h,
    chartSignal: mtfResult.chartSignal,
    chartSignalReasons: mtfResult.chartSignalReasons,
    primaryAnalysisTf: primaryTf,
    volBuyRatios: computeBuyRatios(klineMap),
    volumeGate: volAnalysis.gate,
    volumeScore: volAnalysis.volumeScore,
    volumeReason: volAnalysis.reason,
    rsiBias: rsiAnalysis.bias,
    rsiQuality: rsiAnalysis.quality,
    rsiRegime: rsiAnalysis.regime,
    sentimentScore: 0,
    sentimentLabel: 'Neytral',
    confidence: 0,
    confidenceSide: 'NONE',
    confidenceReasons: [],
    ...emptyAges,
    indicatorsLoaded,
  };
}

const INDICATOR_FILTERS: FilterKey[] = [
  'oversold', 'overbought', 'strongBuy', 'strongSell',
  'zoneBuy', 'zoneSell', 'zoneBreakLong', 'zoneBreakShort',
  'haBuy', 'haSell', 'setupBuy', 'setupSell', 'setupStrongBuy', 'setupStrongSell',
  'chartBuy', 'chartSell', 'researchBuy', 'researchSell',
  'candlesMature', 'candlesFresh', 'syncStrong',
];

function buildEmptyCoinFields(): Omit<CoinData, keyof ReturnType<typeof createAssetFromNormalized>> {
  return {
    rsi1m: null, rsi5m: null, rsi15m: null, rsi1h: null, rsi4h: null, rsi1d: null,
    macd: null, macdSignal: null, macdHistogram: null,
    bbUpper: null, bbMiddle: null, bbLower: null, bbPercent: null,
    atr: null, atrPercent: null,
    stochRsiK: null, stochRsiD: null,
    superTrend: null, superTrendValue: null,
    trendScore: 50, signal: 'NEUTRAL', signalReasons: [],
    zonePosition: null, zoneSignal: 'ZONE_NEUTRAL', zoneBreakoutSignal: 'NEUTRAL',
    zoneBreakoutReasons: [], zoneSignalReasons: [],
    demandZonePrice: null, supplyZonePrice: null,
    stopLoss: null, takeProfit: null, riskReward: null,
    haTrend: 0, haConsecutive: 0, haSignal: 'NEUTRAL', haReasons: [],
    setupSignal: 'NEUTRAL', setupLabel: '—', setupReasons: [], setupConviction: 0,
    mtf1m: 'NEUTRAL', mtf5m: 'NEUTRAL', mtf15m: 'NEUTRAL', mtf30m: 'NEUTRAL', mtf1h: 'NEUTRAL', mtf4h: 'NEUTRAL',
    chartSignal: 'NEUTRAL', chartSignalReasons: [],
    researchSignal: 'NEUTRAL', researchLabel: '—', researchScore: 0, researchReasons: [],
    reversalRisk: 'NONE', reversalReasons: [], mtfAlignment: 'MIXED', riskRewardNote: '',
    primaryAnalysisTf: '1h',
    mtf1mCandles: 0, mtf5mCandles: 0, mtf15mCandles: 0, mtf30mCandles: 0, mtf1hCandles: 0, mtf4hCandles: 0,
    macdCandles: 0, stCandles: 0, stochCandles: 0, haCandles: 0,
    chartCandles: 0, aiCandles: 0, zoneCandles: 0, setupCandles: 0, rsiCandles: 0,
    syncStatus: 'WEAK', syncScore: 0, syncLeader: '—', syncLeaderId: '', syncLeaderCandles: 0, syncReasons: [],
    volBuyRatios: { '1m': null, '5m': null, '15m': null, '1h': null, '4h': null, '1d': null },
    volumeGate: 'neutral',
    volumeScore: 50,
    volumeReason: '',
    rsiBias: 'neutral',
    rsiQuality: 0,
    rsiRegime: 'range',
    sentimentScore: 0,
    sentimentLabel: 'Neytral',
    confidence: 0,
    confidenceSide: 'NONE',
    confidenceReasons: [],
    indicatorsLoaded: false,
  };
}

function buildCoinFromTicker(t: Ticker24h): CoinData {
  const base = createAssetFromNormalized({
    symbol: t.symbol.replace('USDT', ''),
    name: t.symbol.replace('USDT', ''),
    price: parseFloat(t.lastPrice),
    change24h: parseFloat(t.priceChangePercent),
    marketCap: null,
    volume24h: parseFloat(t.quoteVolume),
    source: 'binance',
    assetClass: 'crypto',
    lastUpdated: new Date().toISOString(),
  });
  return { ...base, ...buildEmptyCoinFields() };
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [coins, setCoins]                 = useState<CoinData[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [wsConnected, setWsConnected]     = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [sortKey, setSortKey]             = useState<SortKey>('trendScore');
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter]               = useState<FilterKey>('all');
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [visibleRsiCols, setVisibleRsiCols] = useState<RsiTf[]>(['1m']);
  const [visibleExtraCols, setVisibleExtraCols] = useState<ExtraCol[]>([]);
  const [visibleOptionalFilters, setVisibleOptionalFilters] = useState<FilterKey[]>([]);
  const [visibleAnalysisTfs, setVisibleAnalysisTfs] = useState<AnalysisTf[]>(['15m', '1h', '4h']);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('market:favorites');
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [density, setDensityState] = useState<'comfortable' | 'compact'>(() => {
    try {
      return localStorage.getItem('market:density') === 'compact' ? 'compact' : 'comfortable';
    } catch { return 'comfortable'; }
  });

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem('market:favorites', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setDensity = useCallback((d: 'comfortable' | 'compact') => {
    setDensityState(d);
    try { localStorage.setItem('market:density', d); } catch { /* ignore */ }
  }, []);

  const toggleExtraCol = useCallback((col: ExtraCol) => {
    setVisibleExtraCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col],
    );
  }, []);

  const addOptionalFilter = useCallback((key: FilterKey) => {
    setVisibleOptionalFilters(prev => prev.includes(key) ? prev : [...prev, key]);
  }, []);

  const removeOptionalFilter = useCallback((key: FilterKey) => {
    setVisibleOptionalFilters(prev => prev.filter(k => k !== key));
    setFilter(prev => prev === key ? 'all' : prev);
  }, []);

  const wsRef            = useRef<BinanceWebSocket | null>(null);
  const flashSweepRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fearGreedRef     = useRef<FearGreedData | null>(null);
  const klineCacheRef    = useRef<Map<string, Record<string, Kline[]>>>(new Map());
  const activeTfsRef     = useRef<MtfTf[]>([...ALL_ANALYSIS_TFS]);
  const rsiTfRef         = useRef<RsiTf>('1m');
  const coinsRef         = useRef<CoinData[]>([]);
  activeTfsRef.current = visibleAnalysisTfs;
  rsiTfRef.current = visibleRsiCols[0] ?? '1m';

  /** Batch variant: one setCoins for many assets instead of N sequential passes. */
  const syncAssetKlinesBatch = useCallback((patches: Map<string, Record<string, Kline[]>>) => {
    if (patches.size === 0) return;
    const mergedById = new Map<string, Record<string, Kline[]>>();
    patches.forEach((patch, assetId) => {
      const merged = { ...(klineCacheRef.current.get(assetId) ?? {}), ...patch };
      klineCacheRef.current.set(assetId, merged);
      mergedById.set(assetId, merged);
    });

    startTransition(() => {
      setCoins(prev => {
        const ctx = buildMarketContext(prev.find(c => c.symbol === 'BTCUSDT'), fearGreedRef.current);
        return prev.map(coin => {
          const merged = mergedById.get(coin.id);
          if (!merged || !hasIndicatorSupport(coin)) return coin;
          const updated = {
            ...coin,
            ...computeIndicators(coin.symbol, merged, coin.price, coin.priceChange24h, activeTfsRef.current, rsiTfRef.current),
          };
          return enrichCoinWithResearch(
            updated,
            ctx,
            activeTfsRef.current,
            merged,
            rsiTfRef.current,
          );
        });
      });
    });
  }, []);

  const syncAssetKlines = useCallback((assetId: string, patch: Record<string, Kline[]>) => {
    syncAssetKlinesBatch(new Map([[assetId, patch]]));
  }, [syncAssetKlinesBatch]);

  const refreshNonCryptoKlines = useCallback(async () => {
    const targets = coinsRef.current.filter(c => c.type !== 'crypto' && hasIndicatorSupport(c));
    if (!targets.length) return;
    try {
      const map = await batchKlinesFromServer(
        targets.map(toKlineAssetRef),
        ['1m', '5m', '15m', '1h', '4h'],
        true,
      );
      syncAssetKlinesBatch(map);
    } catch {
      /* ignore background refresh errors */
    }
  }, [syncAssetKlinesBatch]);

  const ensureIntervalLoaded = useCallback(async (tf: RsiTf) => {
    const targets = coinsRef.current.filter(hasIndicatorSupport);
    if (!targets.length) return;
    const needFetch = targets.some(c => {
      const cached = klineCacheRef.current.get(c.id);
      return (cached?.[tf]?.length ?? 0) < 20;
    });
    if (!needFetch) return;
    try {
      const map = await batchKlinesFromServer(
        targets.map(toKlineAssetRef),
        [tf],
        true,
      );
      map.forEach((klines, id) => {
        const merged = { ...(klineCacheRef.current.get(id) ?? {}), ...klines };
        klineCacheRef.current.set(id, merged);
      });
      writeKlineCache(klineCacheRef.current);
    } catch {
      /* ignore */
    }
  }, []);

  const recomputeFromCache = useCallback((activeTfs: MtfTf[], indicatorTf?: RsiTf) => {
    const indTf = indicatorTf ?? rsiTfRef.current;
    setCoins(prev => enrichCoinsWithResearch(
      prev.map(coin => {
        const klines = klineCacheRef.current.get(coin.id);
        if (!klines) return coin;
        return { ...coin, ...computeIndicators(coin.symbol, klines, coin.price, coin.priceChange24h, activeTfs, indTf) };
      }),
      fearGreedRef.current,
      activeTfs,
      klineCacheRef.current,
      indTf,
    ));
  }, []);

  const toggleRsiCol = useCallback((tf: RsiTf) => {
    setVisibleRsiCols(prev => {
      let next: RsiTf[];
      if (prev.includes(tf)) {
        if (prev.length === 1) return prev;
        next = prev.filter(t => t !== tf);
      } else {
        next = ALL_RSI_TFS.filter(t => prev.includes(t) || t === tf);
      }
      const indTf = next[0] ?? '1m';
      queueMicrotask(() => {
        void (async () => {
          await ensureIntervalLoaded(indTf);
          recomputeFromCache(activeTfsRef.current, indTf);
        })();
      });
      return next;
    });
  }, [ensureIntervalLoaded, recomputeFromCache]);

  const toggleAnalysisTf = useCallback((tf: AnalysisTf) => {
    setVisibleAnalysisTfs(prev => {
      if (prev.includes(tf)) {
        if (prev.length === 1) return prev;
        const next = prev.filter(t => t !== tf);
        queueMicrotask(() => recomputeFromCache(next));
        return next;
      }
      const next = ALL_ANALYSIS_TFS.filter(t => prev.includes(t) || t === tf);
      queueMicrotask(() => recomputeFromCache(next));
      return next;
    });
  }, [recomputeFromCache]);

  const handleWSMessage = useCallback((updates: TickerUpdate[]) => {
    // Pure updater: no timers or ref mutations inside (unsafe under React 18
    // replay), and an index map instead of O(n) find per update.
    setCoins(prev => {
      const idxBySymbol = new Map<string, number>();
      prev.forEach((c, i) => { if (isCryptoAsset(c)) idxBySymbol.set(c.symbol, i); });
      let changed = false;
      const next = [...prev];
      for (const upd of updates) {
        const idx = idxBySymbol.get(upd.symbol);
        if (idx === undefined) continue;
        const existing = next[idx];
        const newPrice    = parseFloat(upd.close);
        const newChange24h = parseFloat(upd.changePercent);
        const newVolume   = parseFloat(upd.quoteVolume);
        if (Math.abs(newPrice - existing.price) < 1e-12) continue;
        next[idx] = {
          ...existing,
          price: newPrice,
          priceChange24h: newChange24h,
          volume24h: newVolume,
          flashUp:   newPrice > existing.price,
          flashDown: newPrice < existing.price,
        };
        changed = true;
      }
      return changed ? next : prev;
    });

    // One sweep timer per batch instead of one timer per coin — the CSS flash
    // animation is one-shot anyway; this just clears the flags afterwards.
    if (flashSweepRef.current) clearTimeout(flashSweepRef.current);
    flashSweepRef.current = setTimeout(() => {
      flashSweepRef.current = null;
      setCoins(p => {
        let any = false;
        const cleared = p.map(c => {
          if (!c.flashUp && !c.flashDown) return c;
          any = true;
          return { ...c, flashUp: false, flashDown: false };
        });
        return any ? cleared : p;
      });
    }, 850);
  }, []);

  const handleWSStatus = useCallback((connected: boolean, reconnecting: boolean) => {
    setWsConnected(connected);
    setWsReconnecting(reconnecting);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingProgress(0);
    try {
      const fearGreed = await fetchFearGreedIndex();
      fearGreedRef.current = fearGreed;
      setLoadingProgress(3);

      let initialCoins: CoinData[] = [];
      try {
        const allMarkets = await getAllMarkets();
        const merged = [
          ...allMarkets.crypto,
          ...allMarkets.stocks,
          ...allMarkets.forex,
          ...allMarkets.commodities,
        ];
        if (merged.length > 0) {
          const cryptoTop = selectQualityCrypto(allMarkets.crypto, 15);
          const combined = [
            ...cryptoTop,
            ...allMarkets.stocks,
            ...allMarkets.forex,
            ...allMarkets.commodities,
          ];
          initialCoins = sortByPopularity(
            combined.map(a => ({ ...createAssetFromNormalized(a), ...buildEmptyCoinFields() })),
          );
          console.info(`[market] loaded ${initialCoins.length} assets`, allMarkets.sources);
        }
      } catch {
        /* fallback below */
      }

      if (initialCoins.length === 0) {
        try {
          const marketRes = await getCryptoMarkets();
          if (marketRes.data.length > 0) {
            initialCoins = sortByPopularity(
              marketRes.data.map(a => ({ ...createAssetFromNormalized(a), ...buildEmptyCoinFields() })),
            );
          } else {
            const tickers = await getTopUSDTPairs(50);
            initialCoins = tickers.map(buildCoinFromTicker);
          }
        } catch {
          const tickers = await getTopUSDTPairs(50);
          initialCoins = tickers.map(buildCoinFromTicker);
        }
      }

      setCoins(initialCoins);
      setLoading(false);

      const indicatorAssets = initialCoins.filter(hasIndicatorSupport);
      const assetRefs = indicatorAssets.map(toKlineAssetRef);
      if (assetRefs.length === 0) {
        setLoadingProgress(100);
        return;
      }

      const researchCtxRef = { current: buildMarketContext(undefined, fearGreedRef.current) };

      const applyAssetKlines = (assetId: string, klines: Record<string, Kline[]>) => {
        klineCacheRef.current.set(assetId, {
          ...(klineCacheRef.current.get(assetId) ?? {}),
          ...klines,
        });
        const merged = klineCacheRef.current.get(assetId);
        if (!merged || (!hasMinimumKlineData(merged) && !hasPartialKlineData(merged))) return;

        startTransition(() => {
          setCoins(prev => {
            const next = prev.map(coin => {
              if (coin.id !== assetId || !hasIndicatorSupport(coin)) return coin;
              const updated = {
                ...coin,
                ...computeIndicators(coin.symbol, merged, coin.price, coin.priceChange24h, activeTfsRef.current, rsiTfRef.current),
              };
              return enrichCoinWithResearch(
                updated,
                researchCtxRef.current,
                activeTfsRef.current,
                merged,
                rsiTfRef.current,
              );
            });
            const btc = next.find(c => c.symbol === 'BTCUSDT');
            researchCtxRef.current = buildMarketContext(btc, fearGreedRef.current);
            return next;
          });
        });
      };

      const finalizeResearch = () => {
        setCoins(prev => enrichCoinsWithResearch(
          prev,
          fearGreedRef.current,
          activeTfsRef.current,
          klineCacheRef.current,
          rsiTfRef.current,
        ));
      };

      const cacheIds = assetRefs.map(a => a.id);
      const cached = readKlineCache(cacheIds);
      if (cached.size > 0) {
        cached.forEach((klines, id) => klineCacheRef.current.set(id, klines));
        startTransition(() => {
          setCoins(prev => {
            const next = prev.map(coin => {
              if (!hasIndicatorSupport(coin)) return coin;
              const merged = klineCacheRef.current.get(coin.id);
              if (!merged || (!hasMinimumKlineData(merged) && !hasPartialKlineData(merged))) {
                return coin;
              }
              const updated = {
                ...coin,
                ...computeIndicators(coin.symbol, merged, coin.price, coin.priceChange24h, activeTfsRef.current, rsiTfRef.current),
              };
              return enrichCoinWithResearch(
                updated,
                researchCtxRef.current,
                activeTfsRef.current,
                merged,
                rsiTfRef.current,
              );
            });
            const btc = next.find(c => c.symbol === 'BTCUSDT');
            researchCtxRef.current = buildMarketContext(btc, fearGreedRef.current);
            return next;
          });
        });
        setLoadingProgress(Math.min(90, 5 + Math.round((cached.size / assetRefs.length) * 85)));
      }

      const loadKlines = async (
        intervals: readonly string[],
        onProgress?: (done: number, total: number) => void,
      ) => {
        const apply = (id: string, klines: Record<string, Kline[]>, done: number, total: number) => {
          applyAssetKlines(id, klines);
          onProgress?.(done, total);
        };

        try {
          await streamKlinesFromServer(assetRefs, intervals, apply);
          return;
        } catch { /* SSE failed */ }

        try {
          const map = await batchKlinesFromServer(assetRefs, intervals);
          let done = 0;
          map.forEach((klines, id) => {
            done++;
            apply(id, klines, done, assetRefs.length);
          });
        } catch (batchErr) {
          console.warn('[market] server kline batch failed, falling back', batchErr);
          const cryptoRefs = assetRefs.filter(a => a.type === 'crypto');
          const nonCryptoRefs = assetRefs.filter(a => a.type !== 'crypto');

          if (cryptoRefs.length > 0) {
            await batchFetchKlinesIncremental(cryptoRefs.map(a => a.symbol), {
              concurrency: 4,
              timeframes: intervals,
              onSymbol: (sym, klines, done, total) => {
                const ref = cryptoRefs.find(a => a.symbol === sym);
                if (ref) apply(ref.id, klines, done, total);
              },
            });
          }

          if (nonCryptoRefs.length > 0) {
            try {
              const map = await batchKlinesFromServer(nonCryptoRefs, intervals);
              let done = 0;
              map.forEach((klines, id) => {
                done++;
                apply(id, klines, done, nonCryptoRefs.length);
              });
            } catch (nonCryptoErr) {
              console.error('[market] non-crypto klines failed — restart API: pnpm dev:api', nonCryptoErr);
            }
          }
        }
      };

      await loadKlines(['15m', '30m', '1h', '4h'], (done, total) => {
        setLoadingProgress(5 + Math.round((done / total) * 90));
      });

      // Qısa TF-lər (1m/5m) — MACD/RSI dinamik üçün dərhal yüklə
      if (!isBinanceBanned()) {
        await loadKlines(['1m', '5m'], (done, total) => {
          setLoadingProgress(95 + Math.round((done / Math.max(total, 1)) * 3));
        });
      }

      finalizeResearch();
      writeKlineCache(klineCacheRef.current);
      setLoadingProgress(98);

      if (!isBinanceBanned()) {
        loadKlines(['1d']).then(() => writeKlineCache(klineCacheRef.current)).catch(() => {});
      }

      setLoadingProgress(100);

    } catch (err: unknown) {
      const msg = err instanceof BinanceBanError
        ? err.message
        : err instanceof Error ? err.message : 'Failed to load market data';
      setError(msg);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  useEffect(() => {
    const timer = setInterval(() => { void refreshNonCryptoKlines(); }, 60_000);
    return () => clearInterval(timer);
  }, [refreshNonCryptoKlines]);

  useEffect(() => {
    loadData();
    const ws = new BinanceWebSocket(handleWSMessage, handleWSStatus);
    ws.connect();
    wsRef.current = ws;
    return () => {
      ws.destroy();
      wsRef.current = null;
      if (flashSweepRef.current) clearTimeout(flashSweepRef.current);
    };
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; }
      setSortDir('desc');
      return key;
    });
  }, []);

  const showIndicatorColumns = true;

  const filteredCoins = useMemo(() => {
    let result = [...coins];

    result = result.filter(c => assetMatchesCategory(c.type, assetCategory));

    if (showOnlyFavorites) {
      result = result.filter(c => favorites.has(c.id));
    }

    if (searchQuery) {
      result = result.filter(c => matchesSearch(c, searchQuery));
    }

    const indicatorOnly = INDICATOR_FILTERS.includes(filter);
    const activeRsiTf: RsiTf = visibleRsiCols[0] ?? '1m';
    const rsiForActiveTf = (c: CoinData): number | null => {
      switch (activeRsiTf) {
        case '1m':  return c.rsi1m;
        case '5m':  return c.rsi5m;
        case '15m': return c.rsi15m;
        case '1h':  return c.rsi1h;
        case '4h':  return c.rsi4h;
        case '1d':  return c.rsi1d;
      }
    };

    switch (filter) {
      case 'oversold':
        result = result.filter(c => {
          if (!hasIndicatorSupport(c)) return !indicatorOnly;
          const v = rsiForActiveTf(c);
          return v !== null && v < 30;
        });
        break;
      case 'overbought':
        result = result.filter(c => {
          if (!hasIndicatorSupport(c)) return !indicatorOnly;
          const v = rsiForActiveTf(c);
          return v !== null && v > 70;
        });
        break;
      case 'highVolume':
        result = [...result].sort((a, b) => b.volume24h - a.volume24h).slice(0, 20);
        break;
      case 'topGainers':
        result = result.filter(c => c.priceChange24h > 0).sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 30);
        break;
      case 'topLosers':
        result = result.filter(c => c.priceChange24h < 0).sort((a, b) => a.priceChange24h - b.priceChange24h).slice(0, 30);
        break;
      case 'strongBuy':
        result = result.filter(c => hasIndicatorSupport(c) && (c.signal === 'STRONG_BUY' || c.signal === 'BUY'));
        break;
      case 'strongSell':
        result = result.filter(c => hasIndicatorSupport(c) && (c.signal === 'STRONG_SELL' || c.signal === 'SELL'));
        break;
      case 'zoneBuy':
        result = result.filter(c => c.zoneSignal === 'ZONE_STRONG_BUY' || c.zoneSignal === 'ZONE_BUY');
        break;
      case 'zoneSell':
        result = result.filter(c => c.zoneSignal === 'ZONE_STRONG_SELL' || c.zoneSignal === 'ZONE_SELL');
        break;
      case 'zoneBreakLong':
        result = result.filter(c => c.zoneBreakoutSignal === 'STRONG_LONG' || c.zoneBreakoutSignal === 'LONG');
        break;
      case 'zoneBreakShort':
        result = result.filter(c => c.zoneBreakoutSignal === 'STRONG_SHORT' || c.zoneBreakoutSignal === 'SHORT');
        break;
      case 'haBuy':
        result = result.filter(c => c.haSignal === 'STRONG_BUY' || c.haSignal === 'BUY');
        break;
      case 'haSell':
        result = result.filter(c => c.haSignal === 'STRONG_SELL' || c.haSignal === 'SELL');
        break;
      case 'setupBuy':
        result = result.filter(c => c.setupSignal === 'STRONG_BUY' || c.setupSignal === 'BUY');
        break;
      case 'setupSell':
        result = result.filter(c => c.setupSignal === 'STRONG_SELL' || c.setupSignal === 'SELL');
        break;
      case 'setupStrongBuy':
        result = result.filter(c => c.setupSignal === 'STRONG_BUY');
        break;
      case 'setupStrongSell':
        result = result.filter(c => c.setupSignal === 'STRONG_SELL');
        break;
      case 'chartBuy':
        result = result.filter(c => c.chartSignal === 'BUY');
        break;
      case 'chartSell':
        result = result.filter(c => c.chartSignal === 'SELL');
        break;
      case 'researchBuy':
        result = result.filter(c => c.researchSignal === 'BUY');
        break;
      case 'researchSell':
        result = result.filter(c => c.researchSignal === 'SELL');
        break;
      case 'candlesMature':
        result = result.filter(c =>
          c.setupSignal !== 'NEUTRAL' && c.setupCandles >= 3,
        );
        break;
      case 'candlesFresh':
        result = result.filter(c =>
          c.setupSignal !== 'NEUTRAL' && c.setupCandles > 0 && c.setupCandles <= 2,
        );
        break;
      case 'syncStrong':
        result = result.filter(c =>
          c.syncStatus === 'STRONG' || c.syncStatus === 'GOOD',
        );
        break;
    }

    result.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case 'symbol':     return sortDir === 'asc' ? (a.baseAsset < b.baseAsset ? -1 : 1) : (a.baseAsset > b.baseAsset ? -1 : 1);
        case 'price':      av = a.price;        bv = b.price;        break;
        case 'change1h':   av = a.priceChange1h; bv = b.priceChange1h; break;
        case 'change24h':  av = a.priceChange24h; bv = b.priceChange24h; break;
        case 'marketCap':  av = a.marketCap ?? -1; bv = b.marketCap ?? -1; break;
        case 'volume':     av = a.volume24h;    bv = b.volume24h;    break;
        case 'rsi1m':      av = a.rsi1m  ?? -1; bv = b.rsi1m  ?? -1; break;
        case 'rsi5m':      av = a.rsi5m  ?? -1; bv = b.rsi5m  ?? -1; break;
        case 'rsi15m':     av = a.rsi15m ?? -1; bv = b.rsi15m ?? -1; break;
        case 'rsi1h':      av = a.rsi1h  ?? -1; bv = b.rsi1h  ?? -1; break;
        case 'rsi4h':      av = a.rsi4h  ?? -1; bv = b.rsi4h  ?? -1; break;
        case 'rsi1d':      av = a.rsi1d  ?? -1; bv = b.rsi1d  ?? -1; break;
        case 'trendScore': av = a.trendScore;   bv = b.trendScore;   break;
        case 'macd':       av = a.macdHistogram ?? -999; bv = b.macdHistogram ?? -999; break;
        case 'superTrend': av = a.superTrend ?? 0; bv = b.superTrend ?? 0; break;
        case 'signal': {
          const o: Record<string, number> = { STRONG_BUY: 5, BUY: 4, NEUTRAL: 3, SELL: 2, STRONG_SELL: 1 };
          av = o[a.signal] ?? 3; bv = o[b.signal] ?? 3; break;
        }
        case 'zoneSignal': {
          const o: Record<string, number> = {
            ZONE_STRONG_BUY: 5, ZONE_BUY: 4, ZONE_NEUTRAL: 3, ZONE_SELL: 2, ZONE_STRONG_SELL: 1,
          };
          av = o[a.zoneSignal] ?? 3; bv = o[b.zoneSignal] ?? 3; break;
        }
        case 'zoneBreakout': {
          const o: Record<string, number> = {
            STRONG_LONG: 5, LONG: 4, NEUTRAL: 3, SHORT: 2, STRONG_SHORT: 1,
          };
          av = o[a.zoneBreakoutSignal] ?? 3; bv = o[b.zoneBreakoutSignal] ?? 3; break;
        }
        case 'haSignal': {
          const o: Record<string, number> = {
            STRONG_BUY: 5, BUY: 4, NEUTRAL: 3, SELL: 2, STRONG_SELL: 1,
          };
          av = o[a.haSignal] ?? 3; bv = o[b.haSignal] ?? 3; break;
        }
        case 'setup': {
          const o: Record<string, number> = {
            STRONG_BUY: 5, BUY: 4, NEUTRAL: 3, SELL: 2, STRONG_SELL: 1,
          };
          av = o[a.setupSignal] ?? 3; bv = o[b.setupSignal] ?? 3; break;
        }
        case 'chartSignal': {
          const o: Record<string, number> = { BUY: 2, NEUTRAL: 1, SELL: 0 };
          av = o[a.chartSignal] ?? 1; bv = o[b.chartSignal] ?? 1; break;
        }
        case 'research': {
          av = a.researchScore; bv = b.researchScore; break;
        }
        case 'stopLoss':   av = a.stopLoss ?? -1;   bv = b.stopLoss ?? -1;   break;
        case 'takeProfit': av = a.takeProfit ?? -1; bv = b.takeProfit ?? -1; break;
        case 'riskReward': av = a.riskReward ?? -1; bv = b.riskReward ?? -1; break;
        default: av = a.volume24h; bv = b.volume24h;
      }
      // NaN in either operand would make the comparator inconsistent and
      // the resulting order arbitrary.
      if (Number.isNaN(av)) av = -Infinity;
      if (Number.isNaN(bv)) bv = -Infinity;
      if (av === bv) return 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return result;
  }, [coins, searchQuery, filter, sortKey, sortDir, assetCategory, visibleRsiCols, favorites, showOnlyFavorites]);

  return (
    <MarketContext.Provider value={{
      coins, filteredCoins, assetCategory, setAssetCategory, showIndicatorColumns,
      loading, error, wsConnected, wsReconnecting,
      loadingProgress, sortKey, sortDir, filter, searchQuery, visibleRsiCols, visibleExtraCols,
      visibleOptionalFilters, visibleAnalysisTfs,
      setSortKey, setSortDir, setFilter, setSearchQuery,
      handleSort, toggleRsiCol, toggleExtraCol, addOptionalFilter, removeOptionalFilter,
      toggleAnalysisTf, refresh: loadData, syncAssetKlines,
      favorites, toggleFavorite, showOnlyFavorites, setShowOnlyFavorites,
      density, setDensity,
    }}>
      {children}
    </MarketContext.Provider>
  );
}
