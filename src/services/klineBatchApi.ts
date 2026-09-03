import type { Kline } from './binanceApi';
import type { AssetType } from '../types/asset';
import { ESSENTIAL_TIMEFRAMES, EXTRA_TIMEFRAMES } from './binanceApi';
import { apiUrl } from './apiBase';

/** Cədvəl indikator hesabı — MACD EMA üçün detail ilə eyni uzunluqda tarixçə */
export const INDICATOR_KLINE_LIMIT = 1000;
/** Detail qrafik — mümkün qədər uzun tarixçə (Binance max ~1000/sorğu, pagination ilə daha çox) */
export const CHART_KLINE_LIMIT = 3000;

export interface KlineAssetRef {
  id: string;
  symbol: string;
  type: AssetType;
}

export interface KlineStreamEvent {
  id?: string;
  symbol?: string;
  klines?: Record<string, Kline[]>;
  done?: number;
  total?: number;
  complete?: boolean;
  error?: string;
}

function encodeAssets(assets: KlineAssetRef[]): string {
  return assets.map(a => `${a.type}:${a.symbol}`).join(',');
}

/**
 * Server bir sorğuda yalnız ilk 80 aktivi emal edir və qalanını SƏSSİZCƏ atır —
 * nə xəta qaytarır, nə də kəsilmə barədə xəbər verir (SSE sadəcə `complete`
 * göndərir, batch isə 80 açarlı obyekt). Yəni siyahı bölünməsə, sondakı
 * aktivlər heç vaxt kline almır və cədvəldə həmişəlik boş qalır.
 *
 * Burada 60 götürülür ki, serverin limiti bir az aşağı düşsə belə işləsin.
 */
const MAX_ASSETS_PER_REQUEST = 60;

function chunkAssets(assets: KlineAssetRef[]): KlineAssetRef[][] {
  if (assets.length <= MAX_ASSETS_PER_REQUEST) return [assets];
  const out: KlineAssetRef[][] = [];
  for (let i = 0; i < assets.length; i += MAX_ASSETS_PER_REQUEST) {
    out.push(assets.slice(i, i + MAX_ASSETS_PER_REQUEST));
  }
  return out;
}

/** Server-side SSE — crypto (Binance) + digər assetlər (Yahoo) */
function streamChunk(
  assets: KlineAssetRef[],
  intervals: readonly string[],
  onAsset: (id: string, klines: Record<string, Kline[]>) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({
      assets: encodeAssets(assets),
      intervals: intervals.join(','),
    });
    const es = new EventSource(apiUrl(`/api/markets/klines/stream?${qs}`));

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as KlineStreamEvent;
        if (msg.error) {
          es.close();
          reject(new Error(msg.error));
          return;
        }
        if (msg.complete) {
          es.close();
          resolve();
          return;
        }
        const id = msg.id ?? msg.symbol;
        if (id && msg.klines) onAsset(id, msg.klines);
      } catch {
        /* ignore parse */
      }
    };

    es.onerror = () => {
      es.close();
      reject(new Error('Kline stream disconnected'));
    };
  });
}

/**
 * Bütün aktivləri stream edir — server limitindən asılı olmayaraq HAMISINI.
 * Hissələr ardıcıl gedir ki, Yahoo/Binance eyni anda çox sorğu almasın;
 * `done` sayğacı hissələr arasında davam edir, ona görə progress bar geri
 * atmır.
 */
export async function streamKlinesFromServer(
  assets: KlineAssetRef[],
  intervals: readonly string[],
  onAsset: (id: string, klines: Record<string, Kline[]>, done: number, total: number) => void,
): Promise<void> {
  let done = 0;
  for (const group of chunkAssets(assets)) {
    await streamChunk(group, intervals, (id, klines) => {
      done++;
      onAsset(id, klines, done, assets.length);
    });
  }
}

async function batchChunk(
  assets: KlineAssetRef[],
  intervals: readonly string[],
  refresh: boolean,
): Promise<Map<string, Record<string, Kline[]>>> {
  const res = await fetch(apiUrl('/api/markets/klines/batch'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets, intervals, refresh }),
  });
  if (!res.ok) throw new Error(`Batch klines failed: ${res.status}`);
  const json = await res.json() as { data: Record<string, Record<string, Kline[]>> };
  return new Map(Object.entries(json.data ?? {}));
}

/** Bir POST ilə batch (SSE işləməsə fallback) — 80-lik server limiti bölünür */
export async function batchKlinesFromServer(
  assets: KlineAssetRef[],
  intervals: readonly string[] = ESSENTIAL_TIMEFRAMES,
  refresh = false,
): Promise<Map<string, Record<string, Kline[]>>> {
  const groups = chunkAssets(assets);
  if (groups.length === 1) return batchChunk(assets, intervals, refresh);

  const merged = new Map<string, Record<string, Kline[]>>();
  for (const group of groups) {
    const part = await batchChunk(group, intervals, refresh);
    part.forEach((klines, id) => merged.set(id, klines));
  }
  return merged;
}

/** Chart səhifəsi üçün tək asset klines */
export async function getChartKlines(
  type: AssetType,
  symbol: string,
  interval: string,
  limit = INDICATOR_KLINE_LIMIT,
): Promise<Kline[]> {
  const qs = new URLSearchParams({ type, symbol, interval, limit: String(limit) });
  const res = await fetch(apiUrl(`/api/markets/klines/chart?${qs}`));
  if (!res.ok) throw new Error(`Chart klines failed: ${res.status}`);
  const json = await res.json() as { data: Kline[] };
  return json.data ?? [];
}

export function toKlineAssetRef(coin: { id: string; symbol: string; type: AssetType }): KlineAssetRef {
  return { id: coin.id, symbol: coin.symbol, type: coin.type };
}

export { ESSENTIAL_TIMEFRAMES, EXTRA_TIMEFRAMES };
