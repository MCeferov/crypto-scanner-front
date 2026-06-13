const BASE = 'https://api.binance.com/api/v3';

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

const KLINE_TIMEFRAMES = ['15m', '30m', '1h', '4h', '1d'] as const;
const KLINE_LIMIT = 200;

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

export async function getTopUSDTPairs(limit = 100): Promise<Ticker24h[]> {
  const res = await fetch(`${BASE}/ticker/24hr`);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data: Ticker24h[] = await res.json();
  return data
    .filter(t => isValidPair(t.symbol))
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, limit);
}

export async function getKlines(
  symbol: string,
  interval: string,
  limit = KLINE_LIMIT,
  retries = 3,
): Promise<Kline[]> {
  const url = `${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status === 418) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '1', 10);
        await sleep(Math.max(retryAfter, 1) * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`Klines error for ${symbol}/${interval}: ${res.status}`);
      const raw: any[][] = await res.json();
      return raw.map(k => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        closeTime: k[6],
      }));
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) await sleep(500 * (attempt + 1));
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

export async function getAllKlines(symbol: string): Promise<Record<string, Kline[]>> {
  const results = await Promise.all(
    KLINE_TIMEFRAMES.map(async tf => {
      try {
        return await getKlines(symbol, tf, KLINE_LIMIT);
      } catch {
        return [] as Kline[];
      }
    }),
  );
  return Object.fromEntries(KLINE_TIMEFRAMES.map((tf, i) => [tf, results[i]]));
}

async function fetchSymbolKlines(symbol: string): Promise<Record<string, Kline[]>> {
  return getAllKlines(symbol);
}

async function fetchBatch(
  symbols: string[],
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
  progressOffset = 0,
  progressTotal?: number,
): Promise<Map<string, Record<string, Kline[]>>> {
  const results = new Map<string, Record<string, Kline[]>>();
  const total = progressTotal ?? symbols.length;
  let done = progressOffset;

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async sym => {
        const klines = await fetchSymbolKlines(sym);
        done++;
        onProgress?.(done, total);
        return [sym, klines] as [string, Record<string, Kline[]>];
      }),
    );
    batchResults.forEach(([sym, klines]) => results.set(sym, klines));

    if (i + concurrency < symbols.length) {
      await sleep(300);
    }
  }

  return results;
}

export async function batchFetchKlines(
  symbols: string[],
  concurrency = 3,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, Record<string, Kline[]>>> {
  const results = await fetchBatch(symbols, concurrency, onProgress);

  // Retry symbols that failed due to rate limits (empty kline arrays)
  const failed = symbols.filter(sym => {
    const klines = results.get(sym);
    return !klines || !hasMinimumKlineData(klines);
  });

  if (failed.length > 0) {
    await sleep(2000);
    const retried = await fetchBatch(
      failed,
      2,
      onProgress,
      symbols.length - failed.length,
      symbols.length + failed.length,
    );
    retried.forEach((klines, sym) => {
      const existing = results.get(sym);
      if (!existing || !hasMinimumKlineData(existing) || hasMinimumKlineData(klines)) {
        results.set(sym, klines);
      }
    });

    // Final retry — one symbol at a time for stubborn rate-limit failures
    const stillFailed = symbols.filter(sym => {
      const klines = results.get(sym);
      return !klines || !hasMinimumKlineData(klines);
    });
    if (stillFailed.length > 0) {
      await sleep(3000);
      for (const sym of stillFailed) {
        try {
          const klines = await getAllKlines(sym);
          if (hasMinimumKlineData(klines) || hasPartialKlineData(klines)) {
            results.set(sym, klines);
          }
        } catch { /* skip */ }
        await sleep(400);
      }
    }
  }

  return results;
}
