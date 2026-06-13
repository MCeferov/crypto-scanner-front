import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getTopUSDTPairs, batchFetchKlines, hasMinimumKlineData, hasPartialKlineData, type Ticker24h, type Kline } from '../services/binanceApi';
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
import { analyzeHeikinAshi, heikinAshiToKlines, type HaSignal } from '../indicators/heikinAshi';
import { type SetupSignal } from '../indicators/setupSignal';
import type { ReversalRisk, MtfAlignment } from '../indicators/reversalRisk';
import { computeMultiTimeframeAnalysis, getPrimaryAnalysisTf, MTF_TIMEFRAMES, type ChartSignal, type MtfTf, type TfDir } from '../indicators/chartAnalysis';
import { computeSignalAges } from '../indicators/signalAge';
import { enrichCoinsWithResearch, type ResearchSignal } from '../indicators/marketResearch';
import { fetchFearGreedIndex, type FearGreedData } from '../services/fearGreedApi';

export type SortKey =
  | 'symbol' | 'price' | 'change1h' | 'change24h' | 'volume'
  | 'rsi15m' | 'rsi1h' | 'rsi4h' | 'rsi1d'
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
  | 'setupStrongBuy' | 'setupStrongSell';

/** Optional detail columns — hidden by default to reduce clutter */
export type ExtraCol = 'macd' | 'volume' | 'atr' | 'stoch' | 'st' | 'bb';
export const ALL_EXTRA_COLS: ExtraCol[] = ['macd', 'volume', 'atr', 'stoch', 'st', 'bb'];
export const EXTRA_COL_LABELS: Record<ExtraCol, string> = {
  macd: 'MACD', volume: 'Vol', atr: 'ATR', stoch: 'Stoch', st: 'ST', bb: 'BB',
};

/** RSI timeframe column visibility */
export type RsiTf = '15m' | '1h' | '4h' | '1d';
export const ALL_RSI_TFS: RsiTf[] = ['15m', '1h', '4h', '1d'];
export const RSI_TF_SORT: Record<RsiTf, SortKey> = { '15m': 'rsi15m', '1h': 'rsi1h', '4h': 'rsi4h', '1d': 'rsi1d' };

/** Chart / analiz timeframe seçimi */
export type AnalysisTf = MtfTf;
export const ALL_ANALYSIS_TFS: AnalysisTf[] = [...MTF_TIMEFRAMES];
export const ANALYSIS_TF_LABELS: Record<AnalysisTf, string> = {
  '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H',
};

export interface CoinData {
  symbol: string;
  baseAsset: string;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
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
  indicatorsLoaded: boolean;
  flashUp?: boolean;
  flashDown?: boolean;
}

interface MarketContextType {
  coins: CoinData[];
  filteredCoins: CoinData[];
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
  refresh: () => void;
}

const MarketContext = createContext<MarketContextType | null>(null);

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
): Partial<CoinData> {
  const k15m = klineMap['15m'] || [];
  const k30m = klineMap['30m'] || [];
  const k1h = klineMap['1h'] || [];
  const k4h = klineMap['4h'] || [];
  const k1d = klineMap['1d'] || [];

  const primaryTf = getPrimaryAnalysisTf(activeTfs);
  const primaryK = klineMap[primaryTf]?.length >= 20 ? klineMap[primaryTf] : k1h;
  const haKlines = activeTfs.includes('15m') && k15m.length >= 20 ? k15m : primaryK;
  const zoneKlines = activeTfs.includes('15m') && k15m.length >= 20 ? k15m : primaryK;

  const k15mHa = heikinAshiToKlines(k15m);
  const k30mHa = heikinAshiToKlines(k30m);
  const k1hHa  = heikinAshiToKlines(k1h);
  const k4hHa  = heikinAshiToKlines(k4h);
  const k1dHa  = heikinAshiToKlines(k1d);
  const primaryHa = heikinAshiToKlines(primaryK);

  const rsi15m = getLatestRSI(k15mHa.map(k => k.close), 14);
  const rsi1h  = getLatestRSI(k1hHa.map(k => k.close),  14);
  const rsi4h  = getLatestRSI(k4hHa.map(k => k.close),  14);
  const rsi1d  = getLatestRSI(k1dHa.map(k => k.close),  14);

  const macdResult    = getLatestMACD(primaryHa.map(k => k.close));
  const macd          = macdResult?.macd      ?? null;
  const macdSignal    = macdResult?.signal    ?? null;
  const macdHistogram = macdResult?.histogram ?? null;

  const bbResult = getLatestBB(primaryHa.map(k => k.close));
  const bbUpper  = bbResult?.upper    ?? null;
  const bbMiddle = bbResult?.middle   ?? null;
  const bbLower  = bbResult?.lower    ?? null;
  const bbPercent = bbResult?.percentB ?? null;

  // ATR + zones → real candles (actual volatility & price levels)
  const atr        = getLatestATR(primaryK, 14);
  const atrPercent = atr !== null && price > 0 ? (atr / price) * 100 : null;

  const stochResult = getLatestStochRSI(primaryHa.map(k => k.close));
  const stochRsiK   = stochResult?.k ?? null;
  const stochRsiD   = stochResult?.d ?? null;

  const stResult       = getLatestSuperTrend(primaryHa);
  const superTrend      = stResult?.trend ?? null;
  const superTrendValue = stResult?.value ?? null;

  let priceChange1h = 0;
  if (k1h.length >= 2) {
    const prevOpen = k1h[k1h.length - 2].open;
    if (prevOpen > 0) priceChange1h = ((price - prevOpen) / prevOpen) * 100;
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
  });

  const zoneKlinesResolved = zoneKlines;
  const zoneResult = analyzeSupplyDemand({
    klines: zoneKlinesResolved,
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
    mtf15mCandles: 0, mtf30mCandles: 0, mtf1hCandles: 0, mtf4hCandles: 0,
    macdCandles: 0, stCandles: 0, stochCandles: 0, haCandles: haResult.consecutive,
    chartCandles: 0, aiCandles: 0, zoneCandles: 0, setupCandles: 0,
  };

  const indicatorsLoaded = hasMinimumKlineData(klineMap) || hasPartialKlineData(klineMap);

  return {
    rsi15m, rsi1h, rsi4h, rsi1d,
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
    stopLoss: zoneResult.stopLoss,
    takeProfit: zoneResult.takeProfit,
    riskReward: zoneResult.riskReward,
    haTrend: haResult.trend,
    haConsecutive: haResult.consecutive,
    haSignal: haResult.signal,
    haReasons: haResult.reasons,
    mtf15m: mtfResult.mtf15m,
    mtf30m: mtfResult.mtf30m,
    mtf1h: mtfResult.mtf1h,
    mtf4h: mtfResult.mtf4h,
    chartSignal: mtfResult.chartSignal,
    chartSignalReasons: mtfResult.chartSignalReasons,
    primaryAnalysisTf: primaryTf,
    ...emptyAges,
    indicatorsLoaded,
  };
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
  const [searchQuery, setSearchQuery]     = useState('');
  const [visibleRsiCols, setVisibleRsiCols] = useState<RsiTf[]>(['15m']);
  const [visibleExtraCols, setVisibleExtraCols] = useState<ExtraCol[]>([]);
  const [visibleOptionalFilters, setVisibleOptionalFilters] = useState<FilterKey[]>([]);
  const [visibleAnalysisTfs, setVisibleAnalysisTfs] = useState<AnalysisTf[]>([...ALL_ANALYSIS_TFS]);

  const toggleRsiCol = useCallback((tf: RsiTf) => {
    setVisibleRsiCols(prev => {
      if (prev.includes(tf)) {
        // always keep at least one column
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== tf);
      }
      // insert in canonical order
      const next = ALL_RSI_TFS.filter(t => prev.includes(t) || t === tf);
      return next;
    });
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
  const flashTimersRef   = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const fearGreedRef     = useRef<FearGreedData | null>(null);
  const klineCacheRef    = useRef<Map<string, Record<string, Kline[]>>>(new Map());
  const activeTfsRef     = useRef<MtfTf[]>([...ALL_ANALYSIS_TFS]);
  activeTfsRef.current = visibleAnalysisTfs;

  const recomputeFromCache = useCallback((activeTfs: MtfTf[]) => {
    setCoins(prev => enrichCoinsWithResearch(
      prev.map(coin => {
        const klines = klineCacheRef.current.get(coin.symbol);
        if (!klines) return coin;
        return { ...coin, ...computeIndicators(coin.symbol, klines, coin.price, coin.priceChange24h, activeTfs) };
      }),
      fearGreedRef.current,
      activeTfs,
      klineCacheRef.current,
    ));
  }, []);

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
    setCoins(prev => {
      const map = new Map(prev.map(c => [c.symbol, c]));
      let changed = false;
      for (const upd of updates) {
        const existing = map.get(upd.symbol);
        if (!existing) continue;
        const newPrice    = parseFloat(upd.close);
        const newChange24h = parseFloat(upd.changePercent);
        const newVolume   = parseFloat(upd.quoteVolume);
        if (Math.abs(newPrice - existing.price) < 1e-12) continue;
        map.set(upd.symbol, {
          ...existing,
          price: newPrice,
          priceChange24h: newChange24h,
          volume24h: newVolume,
          flashUp:   newPrice > existing.price,
          flashDown: newPrice < existing.price,
        });
        changed = true;
        const key = upd.symbol;
        const t = flashTimersRef.current.get(key);
        if (t) clearTimeout(t);
        flashTimersRef.current.set(key, setTimeout(() => {
          setCoins(p => p.map(c => c.symbol === key ? { ...c, flashUp: false, flashDown: false } : c));
          flashTimersRef.current.delete(key);
        }, 800));
      }
      return changed ? Array.from(map.values()) : prev;
    });
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
      const [tickers, fearGreed] = await Promise.all([
        getTopUSDTPairs(100),
        fetchFearGreedIndex(),
      ]);
      fearGreedRef.current = fearGreed;
      setLoadingProgress(5);

      const initialCoins: CoinData[] = tickers.map((t: Ticker24h) => ({
        symbol: t.symbol,
        baseAsset: t.symbol.replace('USDT', ''),
        price: parseFloat(t.lastPrice),
        priceChange1h: 0,
        priceChange24h: parseFloat(t.priceChangePercent),
        volume24h: parseFloat(t.quoteVolume),
        rsi15m: null, rsi1h: null, rsi4h: null, rsi1d: null,
        macd: null, macdSignal: null, macdHistogram: null,
        bbUpper: null, bbMiddle: null, bbLower: null, bbPercent: null,
        atr: null, atrPercent: null,
        stochRsiK: null, stochRsiD: null,
        superTrend: null, superTrendValue: null,
        trendScore: 50, signal: 'NEUTRAL', signalReasons: [],
        zonePosition: null, zoneSignal: 'ZONE_NEUTRAL', zoneBreakoutSignal: 'NEUTRAL',
        zoneBreakoutReasons: [], zoneSignalReasons: [],
        stopLoss: null, takeProfit: null, riskReward: null,
        haTrend: 0, haConsecutive: 0, haSignal: 'NEUTRAL', haReasons: [],
        setupSignal: 'NEUTRAL', setupLabel: '—', setupReasons: [], setupConviction: 0,
        mtf15m: 'NEUTRAL', mtf30m: 'NEUTRAL', mtf1h: 'NEUTRAL', mtf4h: 'NEUTRAL',
        chartSignal: 'NEUTRAL', chartSignalReasons: [],
        researchSignal: 'NEUTRAL', researchLabel: '—', researchScore: 0, researchReasons: [],
        reversalRisk: 'NONE', reversalReasons: [], mtfAlignment: 'MIXED', riskRewardNote: '',
        primaryAnalysisTf: '1h',
        mtf15mCandles: 0, mtf30mCandles: 0, mtf1hCandles: 0, mtf4hCandles: 0,
        macdCandles: 0, stCandles: 0, stochCandles: 0, haCandles: 0,
        chartCandles: 0, aiCandles: 0, zoneCandles: 0, setupCandles: 0,
        indicatorsLoaded: false,
      }));
      setCoins(initialCoins);
      setLoading(false);

      const symbols = initialCoins.map(c => c.symbol);
      const total   = symbols.length;

      const klineMap = await batchFetchKlines(symbols, 3, (done, batchTotal) => {
        setLoadingProgress(5 + Math.round((done / batchTotal) * 90));
      });

      klineMap.forEach((v, k) => klineCacheRef.current.set(k, v));

      setCoins(prev => enrichCoinsWithResearch(
        prev.map(coin => {
          const klines = klineMap.get(coin.symbol);
          if (!klines) return coin;
          return { ...coin, ...computeIndicators(coin.symbol, klines, coin.price, coin.priceChange24h, activeTfsRef.current) };
        }),
        fearGreedRef.current,
        activeTfsRef.current,
        klineCacheRef.current,
      ));

      setLoadingProgress(100);

      // Background retry for stubborn symbols (rate limits)
      const runRetry = async () => {
        let missing: string[] = [];
        setCoins(prev => {
          missing = prev.filter(c => !c.indicatorsLoaded).map(c => c.symbol);
          return prev;
        });
        if (missing.length === 0) return;
        try {
          const retryMap = await batchFetchKlines(missing, 1);
          retryMap.forEach((v, k) => klineCacheRef.current.set(k, v));
          setCoins(prev => enrichCoinsWithResearch(
            prev.map(coin => {
              const klines = klineCacheRef.current.get(coin.symbol);
              if (!klines) return coin;
              const canCompute = hasMinimumKlineData(klines) || hasPartialKlineData(klines);
              if (!canCompute) return coin;
              return { ...coin, ...computeIndicators(coin.symbol, klines, coin.price, coin.priceChange24h, activeTfsRef.current) };
            }),
            fearGreedRef.current,
            activeTfsRef.current,
            klineCacheRef.current,
          ));
        } catch { /* silent */ }
      };

      setTimeout(() => runRetry(), 4000);
      setTimeout(() => runRetry(), 12000);

      // Finalize: mark any remaining coins as loaded to clear 99/100 stuck state
      setTimeout(() => {
        setCoins(prev => prev.map(coin =>
          coin.indicatorsLoaded ? coin : { ...coin, indicatorsLoaded: true }
        ));
      }, 20000);
    } catch (err: any) {
      setError(err?.message || 'Failed to load market data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const ws = new BinanceWebSocket(handleWSMessage, handleWSStatus);
    ws.connect();
    wsRef.current = ws;
    return () => {
      ws.destroy();
      wsRef.current = null;
      flashTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; }
      setSortDir('desc');
      return key;
    });
  }, []);

  const filteredCoins = useMemo(() => {
    let result = [...coins];

    if (searchQuery) {
      const q = searchQuery.toUpperCase();
      result = result.filter(c => c.baseAsset.includes(q) || c.symbol.includes(q));
    }

    switch (filter) {
      case 'oversold':
        result = result.filter(c => {
          const v = c.rsi15m ?? c.rsi1h;
          return v !== null && v < 30;
        });
        break;
      case 'overbought':
        result = result.filter(c => {
          const v = c.rsi15m ?? c.rsi1h;
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
        result = result.filter(c => c.signal === 'STRONG_BUY' || c.signal === 'BUY');
        break;
      case 'strongSell':
        result = result.filter(c => c.signal === 'STRONG_SELL' || c.signal === 'SELL');
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
    }

    result.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case 'symbol':     return sortDir === 'asc' ? (a.baseAsset < b.baseAsset ? -1 : 1) : (a.baseAsset > b.baseAsset ? -1 : 1);
        case 'price':      av = a.price;        bv = b.price;        break;
        case 'change1h':   av = a.priceChange1h; bv = b.priceChange1h; break;
        case 'change24h':  av = a.priceChange24h; bv = b.priceChange24h; break;
        case 'volume':     av = a.volume24h;    bv = b.volume24h;    break;
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
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return result;
  }, [coins, searchQuery, filter, sortKey, sortDir]);

  return (
    <MarketContext.Provider value={{
      coins, filteredCoins, loading, error, wsConnected, wsReconnecting,
      loadingProgress, sortKey, sortDir, filter, searchQuery, visibleRsiCols, visibleExtraCols,
      visibleOptionalFilters, visibleAnalysisTfs,
      setSortKey, setSortDir, setFilter, setSearchQuery,
      handleSort, toggleRsiCol, toggleExtraCol, addOptionalFilter, removeOptionalFilter,
      toggleAnalysisTf, refresh: loadData,
    }}>
      {children}
    </MarketContext.Provider>
  );
}
