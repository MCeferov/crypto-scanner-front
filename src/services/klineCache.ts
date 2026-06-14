import type { Kline } from './binanceApi';

const CACHE_KEY = 'market:klines:v2';
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

export function writeKlineCache(map: Map<string, Record<string, Kline[]>>): void {
  try {
    const data: Record<string, Record<string, Kline[]>> = {};
    map.forEach((v, k) => { data[k] = v; });
    const entry: CacheEntry = { at: Date.now(), data };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
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
