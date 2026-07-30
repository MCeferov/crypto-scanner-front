import type { Kline } from './binanceApi';

const CACHE_KEY = 'market:klines:v6';
const CACHE_TTL_MS = 5 * 60_000;

interface CacheEntry {
  at: number;
  data: Record<string, Record<string, Kline[]>>;
}

export function readKlineCache(ids: string[]): Map<string, Record<string, Kline[]>> {
  const out = new Map<string, Record<string, Kline[]>>();
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return out;
    const { at, data } = JSON.parse(raw) as CacheEntry;
    if (Date.now() - at > CACHE_TTL_MS) return out;
    for (const id of ids) {
      if (data[id]) out.set(id, data[id]);
    }
  } catch { /* ignore */ }
  return out;
}

/**
 * Persisting the full 1000-candle series for every asset × timeframe produced
 * tens of MB of JSON — sessionStorage.setItem always threw QuotaExceededError
 * (silently), so the warm-start cache never actually worked, while the
 * JSON.stringify of the huge Map still blocked the main thread. Trimming to
 * the last 400 candles keeps every indicator accurate (EMA200 included) and
 * fits comfortably in the ~5MB quota.
 */
const PERSIST_CANDLES = 400;
const MAX_PAYLOAD_CHARS = 4_000_000;

export function writeKlineCache(map: Map<string, Record<string, Kline[]>>): void {
  try {
    const data: Record<string, Record<string, Kline[]>> = {};
    map.forEach((byTf, id) => {
      const trimmed: Record<string, Kline[]> = {};
      for (const [tf, klines] of Object.entries(byTf)) {
        trimmed[tf] = klines.length > PERSIST_CANDLES ? klines.slice(-PERSIST_CANDLES) : klines;
      }
      data[id] = trimmed;
    });
    const entry: CacheEntry = { at: Date.now(), data };
    const payload = JSON.stringify(entry);
    if (payload.length > MAX_PAYLOAD_CHARS) return;
    sessionStorage.setItem(CACHE_KEY, payload);
  } catch { /* quota */ }
}

export function mergeKlineMaps(
  base: Map<string, Record<string, Kline[]>>,
  patch: Map<string, Record<string, Kline[]>>,
): Map<string, Record<string, Kline[]>> {
  const merged = new Map(base);
  patch.forEach((klines, sym) => {
    const existing = merged.get(sym) ?? {};
    merged.set(sym, { ...existing, ...klines });
  });
  return merged;
}
