import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getTopUSDTPairs, batchFetchKlines, type Ticker24h, type Kline } from '../services/binanceApi';
import { BinanceWebSocket, type TickerUpdate } from '../websocket/BinanceWebSocket';
import { getLatestRSI } from '../indicators/rsi';
import { getLatestEMA } from '../indicators/ema';
import { getLatestMACD } from '../indicators/macd';
import { getLatestBB } from '../indicators/bollingerBands';
import { getLatestATR } from '../indicators/atr';
import { getLatestStochRSI } from '../indicators/stochRsi';
import { calculateTrendScore } from '../indicators/trendScore';
import { computeSignal, type Signal } from '../indicators/aiSignal';

export type SortKey =
  | 'symbol' | 'price' | 'change1h' | 'change24h' | 'volume'
  | 'rsi15m' | 'rsi1h' | 'rsi4h' | 'rsi1d'
  | 'trendScore' | 'signal' | 'macd' | 'ema20' | 'ema50' | 'ema200';

export type FilterKey =
  | 'all' | 'oversold' | 'overbought' | 'highVolume'
  | 'topGainers' | 'topLosers' | 'strongBuy' | 'strongSell';

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
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
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
  trendScore: number;
  signal: Signal;
  signalReasons: string[];
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
  rsiTimeframe: '15m' | '1h' | '4h' | '1d';
  setSortKey: (key: SortKey) => void;
  setSortDir: (dir: 'asc' | 'desc') => void;
  setFilter: (filter: FilterKey) => void;
  setSearchQuery: (q: string) => void;
  setRsiTimeframe: (tf: '15m' | '1h' | '4h' | '1d') => void;
  handleSort: (key: SortKey) => void;
  refresh: () => void;
}

const MarketContext = createContext<MarketContextType | null>(null);

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used inside MarketProvider');
  return ctx;
}

function computeIndicators(symbol: string, klineMap: Record<string, Kline[]>, price: number, change24h: number): Partial<CoinData> {
  const k15m = klineMap['15m'] || [];
  const k1h = klineMap['1h'] || [];
  const k4h = klineMap['4h'] || [];
  const k1d = klineMap['1d'] || [];

  const closes15m = k15m.map(k => k.close);
  const closes1h = k1h.map(k => k.close);
  const closes4h = k4h.map(k => k.close);
  const closes1d = k1d.map(k => k.close);
  const closesForIndicators = closes1h;

  const rsi15m = getLatestRSI(closes15m, 14);
  const rsi1h = getLatestRSI(closes1h, 14);
  const rsi4h = getLatestRSI(closes4h, 14);
  const rsi1d = getLatestRSI(closes1d, 14);

  const ema20 = getLatestEMA(closesForIndicators, 20);
  const ema50 = getLatestEMA(closesForIndicators, 50);
  const ema200 = getLatestEMA(closesForIndicators, 200);

  const macdResult = getLatestMACD(closesForIndicators);
  const macd = macdResult?.macd ?? null;
  const macdSignal = macdResult?.signal ?? null;
  const macdHistogram = macdResult?.histogram ?? null;

  const bbResult = getLatestBB(closesForIndicators);
  const bbUpper = bbResult?.upper ?? null;
  const bbMiddle = bbResult?.middle ?? null;
  const bbLower = bbResult?.lower ?? null;
  const bbPercent = bbResult?.percentB ?? null;

  const atr = getLatestATR(k1h, 14);
  const atrPercent = atr !== null && price > 0 ? (atr / price) * 100 : null;

  const stochRsiResult = getLatestStochRSI(closesForIndicators);
  const stochRsiK = stochRsiResult?.k ?? null;
  const stochRsiD = stochRsiResult?.d ?? null;

  // Calculate 1h price change from kline
  let priceChange1h = 0;
  if (k1h.length >= 2) {
    const prevOpen = k1h[k1h.length - 2].open;
    if (prevOpen > 0) priceChange1h = ((price - prevOpen) / prevOpen) * 100;
  }

  const trendScore = calculateTrendScore({
    rsi1h, rsi4h, rsi1d, macdHistogram,
    price, ema20, ema50, ema200,
    priceChange24h: change24h, stochRsiK,
  });

  const signalResult = computeSignal({
    rsi15m, rsi1h, rsi4h, rsi1d, macdHistogram,
    price, ema50, ema200, stochRsiK, priceChange24h: change24h,
  });

  return {
    rsi15m, rsi1h, rsi4h, rsi1d,
    ema20, ema50, ema200,
    macd, macdSignal, macdHistogram,
    bbUpper, bbMiddle, bbLower, bbPercent,
    atr, atrPercent,
    stochRsiK, stochRsiD,
    priceChange1h, trendScore,
    signal: signalResult.signal,
    signalReasons: signalResult.reasons,
    indicatorsLoaded: true,
  };
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rsiTimeframe, setRsiTimeframe] = useState<'15m' | '1h' | '4h' | '1d'>('1h');

  const wsRef = useRef<BinanceWebSocket | null>(null);
  const coinsRef = useRef<CoinData[]>([]);
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  coinsRef.current = coins;

  const handleWSMessage = useCallback((updates: TickerUpdate[]) => {
    setCoins(prev => {
      const map = new Map(prev.map(c => [c.symbol, c]));
      let changed = false;
      const now = Date.now();
      for (const upd of updates) {
        const existing = map.get(upd.symbol);
        if (!existing) continue;
        const newPrice = parseFloat(upd.close);
        const newChange24h = parseFloat(upd.changePercent);
        const newVolume = parseFloat(upd.quoteVolume);
        if (Math.abs(newPrice - existing.price) < 1e-12) continue;
        const flashUp = newPrice > existing.price;
        const flashDown = newPrice < existing.price;
        map.set(upd.symbol, {
          ...existing,
          price: newPrice,
          priceChange24h: newChange24h,
          volume24h: newVolume,
          flashUp, flashDown,
        });
        changed = true;
        // Clear flash after 800ms
        const key = upd.symbol;
        const existingTimer = flashTimersRef.current.get(key);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          setCoins(p => p.map(c => c.symbol === key ? { ...c, flashUp: false, flashDown: false } : c));
          flashTimersRef.current.delete(key);
        }, 800);
        flashTimersRef.current.set(key, timer);
      }
      if (!changed) return prev;
      return Array.from(map.values());
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
      const tickers = await getTopUSDTPairs(100);
      setLoadingProgress(5);

      const initialCoins: CoinData[] = tickers.map((t: Ticker24h) => ({
        symbol: t.symbol,
        baseAsset: t.symbol.replace('USDT', ''),
        price: parseFloat(t.lastPrice),
        priceChange1h: 0,
        priceChange24h: parseFloat(t.priceChangePercent),
        volume24h: parseFloat(t.quoteVolume),
        rsi15m: null, rsi1h: null, rsi4h: null, rsi1d: null,
        ema20: null, ema50: null, ema200: null,
        macd: null, macdSignal: null, macdHistogram: null,
        bbUpper: null, bbMiddle: null, bbLower: null, bbPercent: null,
        atr: null, atrPercent: null,
        stochRsiK: null, stochRsiD: null,
        trendScore: 50, signal: 'NEUTRAL', signalReasons: [],
        indicatorsLoaded: false,
      }));
      setCoins(initialCoins);
      setLoading(false);

      const symbols = initialCoins.map(c => c.symbol);
      const total = symbols.length;
      let done = 0;

      const klineMap = await batchFetchKlines(symbols, 5, (d) => {
        done = d;
        setLoadingProgress(5 + Math.round((done / total) * 90));
      });

      setCoins(prev => {
        return prev.map(coin => {
          const klines = klineMap.get(coin.symbol);
          if (!klines) return coin;
          const indicators = computeIndicators(coin.symbol, klines, coin.price, coin.priceChange24h);
          return { ...coin, ...indicators };
        });
      });

      setLoadingProgress(100);
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
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('desc');
      return key;
    });
  }, []);

  const filteredCoins = useMemo(() => {
    let result = [...coins];

    // Search
    if (searchQuery) {
      const q = searchQuery.toUpperCase();
      result = result.filter(c => c.baseAsset.includes(q) || c.symbol.includes(q));
    }

    // Filter
    switch (filter) {
      case 'oversold':
        result = result.filter(c => {
          const r = rsiTimeframe === '15m' ? c.rsi15m : rsiTimeframe === '1h' ? c.rsi1h : rsiTimeframe === '4h' ? c.rsi4h : c.rsi1d;
          return r !== null && r < 30;
        });
        break;
      case 'overbought':
        result = result.filter(c => {
          const r = rsiTimeframe === '15m' ? c.rsi15m : rsiTimeframe === '1h' ? c.rsi1h : rsiTimeframe === '4h' ? c.rsi4h : c.rsi1d;
          return r !== null && r > 70;
        });
        break;
      case 'highVolume': {
        const sorted = [...result].sort((a, b) => b.volume24h - a.volume24h);
        result = sorted.slice(0, 20);
        break;
      }
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
    }

    // Sort
    result.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case 'symbol': av = a.baseAsset < b.baseAsset ? -1 : 1; bv = 0; break;
        case 'price': av = a.price; bv = b.price; break;
        case 'change1h': av = a.priceChange1h; bv = b.priceChange1h; break;
        case 'change24h': av = a.priceChange24h; bv = b.priceChange24h; break;
        case 'volume': av = a.volume24h; bv = b.volume24h; break;
        case 'rsi15m': av = a.rsi15m ?? -1; bv = b.rsi15m ?? -1; break;
        case 'rsi1h': av = a.rsi1h ?? -1; bv = b.rsi1h ?? -1; break;
        case 'rsi4h': av = a.rsi4h ?? -1; bv = b.rsi4h ?? -1; break;
        case 'rsi1d': av = a.rsi1d ?? -1; bv = b.rsi1d ?? -1; break;
        case 'trendScore': av = a.trendScore; bv = b.trendScore; break;
        case 'signal': {
          const order: Record<string, number> = { STRONG_BUY: 5, BUY: 4, NEUTRAL: 3, SELL: 2, STRONG_SELL: 1 };
          av = order[a.signal] ?? 3; bv = order[b.signal] ?? 3; break;
        }
        case 'macd': av = a.macdHistogram ?? -999; bv = b.macdHistogram ?? -999; break;
        case 'ema20': av = a.price - (a.ema20 ?? a.price); bv = b.price - (b.ema20 ?? b.price); break;
        case 'ema50': av = a.price - (a.ema50 ?? a.price); bv = b.price - (b.ema50 ?? b.price); break;
        case 'ema200': av = a.price - (a.ema200 ?? a.price); bv = b.price - (b.ema200 ?? b.price); break;
        default: av = a.volume24h; bv = b.volume24h;
      }
      if (sortKey === 'symbol') return sortDir === 'asc' ? (av as any) : -(av as any);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return result;
  }, [coins, searchQuery, filter, sortKey, sortDir, rsiTimeframe]);

  return (
    <MarketContext.Provider value={{
      coins, filteredCoins, loading, error, wsConnected, wsReconnecting,
      loadingProgress, sortKey, sortDir, filter, searchQuery, rsiTimeframe,
      setSortKey, setSortDir, setFilter, setSearchQuery, setRsiTimeframe,
      handleSort, refresh: loadData,
    }}>
      {children}
    </MarketContext.Provider>
  );
}
