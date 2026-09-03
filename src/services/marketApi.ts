/** Market data API — backend failover layer */

import type { BackendAssetClass } from '../types/asset';
import type { Ticker24h } from './binanceApi';
import { apiUrl } from './apiBase';

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

async function fetchMarkets(path: string, query?: string): Promise<MarketsResponse> {
  const url = apiUrl(`/api/markets/${path}${query ? `?${query}` : ''}`);
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
  const res = await fetch(apiUrl(`/api/markets/asset/${symbol}?class=${assetClass}`));
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

/**
 * Backend-in default hissə siyahısından kənar, geniş yayılmış tickerlər.
 * Bunlar ayrıca sorğu ilə istənilir və mövcud siyahı ilə BİRLƏŞDİRİLİR —
 * backend hansısa simvolu tanımırsa nəticə sadəcə dəyişməz qalır, azalmır.
 */
export const EXTRA_STOCK_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA', 'GOOGL', 'META', 'AMD',
  'NFLX', 'INTC', 'JPM', 'V', 'MA', 'DIS', 'BA', 'KO', 'PEP',
  'WMT', 'XOM', 'PFE', 'BABA', 'UBER', 'COIN', 'PLTR',
];

/** Binance 24h ticker → NormalizedAsset (crypto) */
export function tickerToNormalized(t: Ticker24h): NormalizedAsset {
  const base = t.symbol.replace(/USDT$/, '');
  return {
    symbol: base,
    name: base,
    price: parseFloat(t.lastPrice),
    change24h: parseFloat(t.priceChangePercent),
    marketCap: null,
    volume24h: parseFloat(t.quoteVolume),
    source: 'binance',
    assetClass: 'crypto',
    lastUpdated: new Date().toISOString(),
  };
}

/** Simvola görə union — mövcud (backend) qeydlər üstünlük təşkil edir */
export function mergeAssets(
  primary: NormalizedAsset[],
  extra: NormalizedAsset[],
): NormalizedAsset[] {
  const seen = new Set(primary.map(a => a.symbol.replace(/USDT$/i, '').toUpperCase()));
  const out = [...primary];
  for (const a of extra) {
    const key = a.symbol.replace(/USDT$/i, '').toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/**
 * Backend-in default forex siyahısı yalnız 5 cütdür; bunlar əlavə olaraq
 * istənir. Hamısı backend-də həm qiymət, həm də kline verir (yoxlanılıb).
 */
export const EXTRA_FOREX_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'EURCHF',
  'USDTRY', 'EURTRY', 'USDAZN', 'USDRUB', 'USDCNY', 'USDINR',
  'USDMXN', 'USDZAR', 'USDSEK', 'USDNOK',
];

/**
 * Siyahını genişləndirir: default siyahı + açıq şəkildə istənən tickerlər.
 *
 * Bu backend-in default siyahısı qısa olduğu dövr üçün körpüdür. Backend
 * default-u tam siyahını qaytarmağa başlayanda əlavə sorğu ÜMUMİYYƏTLƏ
 * göndərilmir — yəni deploy-dan sonra bu kod özü-özünə söndürülür.
 * Sorğu uğursuz olarsa mövcud siyahı olduğu kimi qalır (heç vaxt azalmır).
 */
async function expandMarkets(
  base: NormalizedAsset[],
  wanted: string[],
  fetcher: (list: string[]) => Promise<MarketsResponse>,
): Promise<NormalizedAsset[]> {
  const have = new Set(base.map(a => a.symbol.toUpperCase()));
  if (wanted.every(sym => have.has(sym))) return base;
  try {
    const res = await fetcher(wanted);
    return res.data.length > 0 ? mergeAssets(base, res.data) : base;
  } catch {
    return base;
  }
}

export function expandStockMarkets(base: NormalizedAsset[]): Promise<NormalizedAsset[]> {
  return expandMarkets(base, EXTRA_STOCK_SYMBOLS, getStockMarkets);
}

export function expandForexMarkets(base: NormalizedAsset[]): Promise<NormalizedAsset[]> {
  return expandMarkets(base, EXTRA_FOREX_PAIRS, getForexMarkets);
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
