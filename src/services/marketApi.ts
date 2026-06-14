/** Market data API — backend failover layer */

import type { BackendAssetClass } from '../types/asset';

export interface NormalizedAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number | null;
  volume24h: number | null;
  source: string;
  assetClass: BackendAssetClass;
  lastUpdated: string;
}

export interface MarketsResponse {
  data: NormalizedAsset[];
  source: string;
  count: number;
}

export interface AllMarketsResponse {
  crypto: NormalizedAsset[];
  stocks: NormalizedAsset[];
  forex: NormalizedAsset[];
  commodities: NormalizedAsset[];
  sources: Record<string, string>;
  total: number;
}

const API_BASE = '/api';

async function fetchMarkets(path: string, query?: string): Promise<MarketsResponse> {
  const url = `${API_BASE}/markets/${path}${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) return { data: [], source: 'none', count: 0 };
  return res.json();
}

export async function getCryptoMarkets(symbols?: string[]): Promise<MarketsResponse> {
  const q = symbols?.length ? `symbols=${symbols.join(',')}` : '';
  return fetchMarkets('crypto', q);
}

export async function getStockMarkets(symbols?: string[]): Promise<MarketsResponse> {
  const q = symbols?.length ? `symbols=${symbols.join(',')}` : '';
  return fetchMarkets('stocks', q);
}

export async function getForexMarkets(pairs?: string[]): Promise<MarketsResponse> {
  const q = pairs?.length ? `pairs=${pairs.join(',')}` : '';
  return fetchMarkets('forex', q);
}

export async function getCommodityMarkets(): Promise<MarketsResponse> {
  return fetchMarkets('commodities');
}

/** Parallel fetch — bütün kateqoriyalar */
export async function getAllMarkets(): Promise<AllMarketsResponse> {
  const [crypto, stocks, forex, commodities] = await Promise.all([
    getCryptoMarkets(),
    getStockMarkets(),
    getForexMarkets(),
    getCommodityMarkets(),
  ]);
  return {
    crypto: crypto.data,
    stocks: stocks.data,
    forex: forex.data,
    commodities: commodities.data,
    sources: {
      crypto: crypto.source,
      stocks: stocks.source,
      forex: forex.source,
      commodities: commodities.source,
    },
    total: crypto.count + stocks.count + forex.count + commodities.count,
  };
}

export async function getAsset(
  symbol: string,
  assetClass: BackendAssetClass = 'crypto',
): Promise<NormalizedAsset | null> {
  const res = await fetch(`${API_BASE}/markets/asset/${symbol}?class=${assetClass}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

/** Legacy — yalnız crypto üçün Binance ticker formatı */
export function toTickerFormat(assets: NormalizedAsset[]) {
  return assets
    .filter(a => a.assetClass === 'crypto')
    .map(a => ({
      symbol: `${a.symbol}USDT`,
      priceChange: '0',
      priceChangePercent: String(a.change24h),
      weightedAvgPrice: String(a.price),
      lastPrice: String(a.price),
      volume: '0',
      quoteVolume: String(a.volume24h ?? 0),
      openPrice: String(a.price),
      highPrice: String(a.price),
      lowPrice: String(a.price),
      openTime: Date.now(),
      closeTime: Date.now(),
      _source: a.source,
    }));
}
