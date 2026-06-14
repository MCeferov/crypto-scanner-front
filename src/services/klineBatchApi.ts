import type { Kline } from './binanceApi';
import type { AssetType } from '../types/asset';
import { ESSENTIAL_TIMEFRAMES, EXTRA_TIMEFRAMES } from './binanceApi';

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

/** Server-side SSE — crypto (Binance) + digər assetlər (Yahoo) */
export function streamKlinesFromServer(
  assets: KlineAssetRef[],
  intervals: readonly string[],
  onAsset: (id: string, klines: Record<string, Kline[]>, done: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({
      assets: encodeAssets(assets),
      intervals: intervals.join(','),
    });
    const es = new EventSource(`/api/markets/klines/stream?${qs}`);

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
        if (id && msg.klines) {
          onAsset(id, msg.klines, msg.done ?? 0, msg.total ?? assets.length);
        }
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

/** Bir POST ilə batch (SSE işləməsə fallback) */
export async function batchKlinesFromServer(
  assets: KlineAssetRef[],
  intervals: readonly string[] = ESSENTIAL_TIMEFRAMES,
): Promise<Map<string, Record<string, Kline[]>>> {
  const res = await fetch('/api/markets/klines/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets, intervals }),
  });
  if (!res.ok) throw new Error(`Batch klines failed: ${res.status}`);
  const json = await res.json() as { data: Record<string, Record<string, Kline[]>> };
  return new Map(Object.entries(json.data ?? {}));
}

/** Chart səhifəsi üçün tək asset klines */
export async function getChartKlines(
  type: AssetType,
  symbol: string,
  interval: string,
  limit = 200,
): Promise<Kline[]> {
  const qs = new URLSearchParams({ type, symbol, interval, limit: String(limit) });
  const res = await fetch(`/api/markets/klines/chart?${qs}`);
  if (!res.ok) throw new Error(`Chart klines failed: ${res.status}`);
  const json = await res.json() as { data: Kline[] };
  return json.data ?? [];
}

export function toKlineAssetRef(coin: { id: string; symbol: string; type: AssetType }): KlineAssetRef {
  return { id: coin.id, symbol: coin.symbol, type: coin.type };
}

export { ESSENTIAL_TIMEFRAMES, EXTRA_TIMEFRAMES };
