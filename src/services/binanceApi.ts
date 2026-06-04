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

function isValidPair(symbol: string): boolean {
  if (!symbol.endsWith('USDT')) return false;
  const base = symbol.replace('USDT', '');
  if (EXCLUDED.includes(symbol)) return false;
  for (const frag of EXCLUDED_FRAGMENTS) {
    if (base.endsWith(frag) || base.startsWith(frag)) return false;
  }
  // Filter out very long symbols (likely leveraged tokens)
  if (base.length > 10) return false;
  return true;
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
  limit = 200
): Promise<Kline[]> {
  const url = `${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
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

// Fetch klines for a symbol across all 4 timeframes concurrently
export async function getAllKlines(symbol: string): Promise<Record<string, Kline[]>> {
  const timeframes = ['15m', '1h', '4h', '1d'];
  const limit = 200;
  const results = await Promise.all(
    timeframes.map(tf => getKlines(symbol, tf, limit).catch(() => [] as Kline[]))
  );
  return Object.fromEntries(timeframes.map((tf, i) => [tf, results[i]]));
}

// Batch fetch with concurrency control
export async function batchFetchKlines(
  symbols: string[],
  concurrency = 5,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, Record<string, Kline[]>>> {
  const results = new Map<string, Record<string, Kline[]>>();
  let done = 0;

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async sym => {
        const klines = await getAllKlines(sym);
        done++;
        onProgress?.(done, symbols.length);
        return [sym, klines] as [string, Record<string, Kline[]>];
      })
    );
    batchResults.forEach(([sym, klines]) => results.set(sym, klines));
    // Small delay to avoid hitting rate limits
    if (i + concurrency < symbols.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return results;
}
