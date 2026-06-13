/** Dev: Vite proxy; prod: API server proxy — CORS olmadan */
import { binanceFetch, BinanceBanError, isBinanceBanned } from './binanceRateLimiter';

const BASE = import.meta.env.DEV ? "/binance-api" : "/api/binance";

export { BinanceBanError, isBinanceBanned };

export interface Ticker24h {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  openTime: number;
  closeTime: number;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

const EXCLUDED = ['UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT', 'TUSDT'];
const EXCLUDED_FRAGMENTS = ['UP', 'DOWN', 'BULL', 'BEAR', 'LEVERAGE'];

const ALL_TIMEFRAMES = ['15m', '30m', '1h', '4h', '1d'] as const;
/** MACD(35) + buffer — limit 100 = weight 1 (200 = weight 2) */
const KLINE_LIMIT = 100;

const TICKER_CACHE_KEY = 'binance:ticker24hr';
const TICKER_CACHE_TTL_MS = 45_000;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function isValidPair(symbol: string): boolean {
  if (!symbol.endsWith('USDT')) return false;
  const base = symbol.replace('USDT', '');
  if (EXCLUDED.includes(symbol)) return false;
  for (const frag of EXCLUDED_FRAGMENTS) {
    if (base.endsWith(frag) || base.startsWith(frag)) return false;
  }
  if (base.length > 10) return false;
  return true;
}

/** Minimum candles needed: MACD (35) on 1h, RSI (15) on 15m */
export function hasMinimumKlineData(klineMap: Record<string, Kline[]>): boolean {
  return (klineMap['1h']?.length ?? 0) >= 35 && (klineMap['15m']?.length ?? 0) >= 15;
}

/** Relaxed threshold for partial indicator compute when a symbol fails full fetch */
export function hasPartialKlineData(klineMap: Record<string, Kline[]>): boolean {
  return (klineMap['1h']?.length ?? 0) >= 20 || (klineMap['15m']?.length ?? 0) >= 20;
}

function readTickerCache(): Ticker24h[] | null {
  try {
    const raw = sessionStorage.getItem(TICKER_CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: Ticker24h[] };
    if (Date.now() - at > TICKER_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeTickerCache(data: Ticker24h[]) {
  try {
    sessionStorage.setItem(TICKER_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch { /* quota */ }
}

export async function getTopUSDTPairs(limit = 50): Promise<Ticker24h[]> {
  const cached = readTickerCache();
  if (cached) {
    return cached
      .filter(t => isValidPair(t.symbol))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, limit);
  }

  const res = await binanceFetch(`${BASE}/ticker/24hr`, 40);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Binance API error: ${res.status}${body ? ` — ${body.slice(0, 120)}` : ''}`);
  }
  const data: Ticker24h[] = await res.json();
  writeTickerCache(data);
  return data
    .filter(t => isValidPair(t.symbol))
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, limit);
}

export async function getKlines(
  symbol: string,
  interval: string,
  limit = KLINE_LIMIT,
  retries = 2,
): Promise<Kline[]> {
  const url = `${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const weight = limit <= 100 ? 1 : limit <= 500 ? 2 : 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await binanceFetch(url, weight);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Klines error for ${symbol}/${interval}: ${res.status}${body ? ` ${body.slice(0, 80)}` : ''}`);
      }
      const raw: number[][] = await res.json();
      return raw.map(k => ({
        openTime: k[0],
        open: parseFloat(String(k[1])),
        high: parseFloat(String(k[2])),
        low: parseFloat(String(k[3])),
        close: parseFloat(String(k[4])),
        volume: parseFloat(String(k[5])),
        closeTime: k[6],
      }));
    } catch (err) {
      lastError = err;
      if (err instanceof BinanceBanError) throw err;
      if (attempt < retries - 1) await sleep(800 * (attempt + 1));
    }
  }

  throw lastError;
}

export async function get1hKlinePrice(symbol: string): Promise<number | null> {
  try {
    const klines = await getKlines(symbol, '1h', 2);
    if (klines.length >= 2) return klines[klines.length - 2].open;
    return null;
  } catch {
    return null;
  }
}

/** Timeframe-ləri ardıcıl yüklə — paralel burst yox */
export async function getAllKlines(
  symbol: string,
  timeframes: readonly string[] = ALL_TIMEFRAMES,
): Promise<Record<string, Kline[]>> {
  const out: Record<string, Kline[]> = {};
  for (const tf of timeframes) {
    try {
      out[tf] = await getKlines(symbol, tf, KLINE_LIMIT);
    } catch (err) {
      if (err instanceof BinanceBanError) throw err;
      out[tf] = [];
    }
    await sleep(80);
  }
  return out;
}

async function fetchSymbolKlines(
  symbol: string,
  timeframes: readonly string[],
): Promise<Record<string, Kline[]>> {
  return getAllKlines(symbol, timeframes);
}

export interface BatchFetchOptions {
  concurrency?: number;
  delayBetweenSymbolsMs?: number;
  timeframes?: readonly string[];
  onProgress?: (done: number, total: number) => void;
  /** Ban olduqda retry etmə */
  skipRetry?: boolean;
}

async function fetchBatch(
  symbols: string[],
  opts: BatchFetchOptions,
  progressOffset = 0,
  progressTotal?: number,
): Promise<Map<string, Record<string, Kline[]>>> {
  const {
    concurrency = 1,
    delayBetweenSymbolsMs = 450,
    timeframes = ALL_TIMEFRAMES,
    onProgress,
  } = opts;

  const results = new Map<string, Record<string, Kline[]>>();
  const total = progressTotal ?? symbols.length;
  let done = progressOffset;

  for (let i = 0; i < symbols.length; i += concurrency) {
    if (isBinanceBanned()) break;

    const batch = symbols.slice(i, i + concurrency);
    for (let j = 0; j < batch.length; j++) {
      const sym = batch[j];
      try {
        const klines = await fetchSymbolKlines(sym, timeframes);
        results.set(sym, klines);
      } catch (err) {
        if (err instanceof BinanceBanError) throw err;
        results.set(sym, {});
      }
      done++;
      onProgress?.(done, total);
      const isLast = i + j >= symbols.length - 1;
      if (!isLast) await sleep(delayBetweenSymbolsMs);
    }
  }

  return results;
}

export async function batchFetchKlines(
  symbols: string[],
  concurrencyOrOpts: number | BatchFetchOptions = 1,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, Record<string, Kline[]>>> {
  const opts: BatchFetchOptions = typeof concurrencyOrOpts === 'number'
    ? { concurrency: concurrencyOrOpts, onProgress }
    : { ...concurrencyOrOpts, onProgress: concurrencyOrOpts.onProgress ?? onProgress };

  const results = await fetchBatch(symbols, {
    concurrency: 1,
    delayBetweenSymbolsMs: 450,
    ...opts,
  });

  if (opts.skipRetry || isBinanceBanned()) return results;

  const failed = symbols.filter(sym => {
    const klines = results.get(sym);
    return !klines || !hasMinimumKlineData(klines);
  });

  if (failed.length > 0 && failed.length <= 15) {
    await sleep(8_000);
    if (isBinanceBanned()) return results;

    const retried = await fetchBatch(
      failed.slice(0, 10),
      { concurrency: 1, delayBetweenSymbolsMs: 600, timeframes: opts.timeframes, onProgress: opts.onProgress },
      symbols.length - failed.length,
      symbols.length,
    );
    retried.forEach((klines, sym) => {
      const existing = results.get(sym);
      if (!existing || !hasMinimumKlineData(existing)) {
        results.set(sym, klines);
      }
    });
  }

  return results;
}

/** Əvvəl top N, sonra qalanlar — UI tez açılır, ban riski azalır */
export async function batchFetchKlinesStaged(
  symbols: string[],
  onProgress?: (done: number, total: number) => void,
  priorityCount = 25,
): Promise<Map<string, Record<string, Kline[]>>> {
  const merged = new Map<string, Record<string, Kline[]>>();
  const priority = symbols.slice(0, priorityCount);
  const rest = symbols.slice(priorityCount);

  const first = await batchFetchKlines(priority, {
    concurrency: 1,
    delayBetweenSymbolsMs: 400,
    onProgress: (d) => onProgress?.(d, symbols.length),
  });
  first.forEach((v, k) => merged.set(k, v));

  if (rest.length > 0 && !isBinanceBanned()) {
    await sleep(2_000);
    const second = await batchFetchKlines(rest, {
      concurrency: 1,
      delayBetweenSymbolsMs: 500,
      skipRetry: true,
      onProgress: (d) => onProgress?.(priorityCount + d, symbols.length),
    });
    second.forEach((v, k) => merged.set(k, v));
  }

  return merged;
}
