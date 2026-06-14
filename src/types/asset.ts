/** Unified asset taxonomy — extensible for future types */

export type AssetType =
  | 'crypto'
  | 'stock'
  | 'commodity'
  | 'forex'
  | 'etf'
  | 'index'
  | 'bond'
  | 'crypto_etf';

/** UI category tabs */
export type AssetCategory = 'all' | 'crypto' | 'stock' | 'commodity' | 'forex';

export type BackendAssetClass = 'crypto' | 'stocks' | 'forex' | 'commodities';

export function backendClassToType(ac: BackendAssetClass): AssetType {
  switch (ac) {
    case 'stocks': return 'stock';
    case 'commodities': return 'commodity';
    case 'forex': return 'forex';
    default: return 'crypto';
  }
}

export function categoryToType(cat: AssetCategory): AssetType | null {
  if (cat === 'all') return null;
  return cat;
}

export function assetMatchesCategory(type: AssetType, category: AssetCategory): boolean {
  if (category === 'all') return true;
  return type === category;
}

export function assetId(type: AssetType, symbol: string): string {
  return `${type}:${symbol}`;
}

export const CATEGORY_TABS: { id: AssetCategory; label: string; labelAz: string }[] = [
  { id: 'all', label: 'All', labelAz: 'Tümü' },
  { id: 'crypto', label: 'Crypto', labelAz: 'Kripto' },
  { id: 'stock', label: 'Stocks', labelAz: 'Hisseler' },
  { id: 'commodity', label: 'Commodities', labelAz: 'Emtialar' },
  { id: 'forex', label: 'Forex', labelAz: 'Dövizler' },
];

export const TYPE_LABELS: Record<AssetType, string> = {
  crypto: 'Kripto',
  stock: 'Hisse',
  commodity: 'Emtia',
  forex: 'Döviz',
  etf: 'ETF',
  index: 'Endeks',
  bond: 'Tahvil',
  crypto_etf: 'Kripto ETF',
};

export const TYPE_COLORS: Record<AssetType, { bg: string; text: string; border: string }> = {
  crypto: { bg: 'rgba(240,185,11,.12)', text: '#f0b90b', border: 'rgba(240,185,11,.3)' },
  stock: { bg: 'rgba(59,130,246,.12)', text: '#60a5fa', border: 'rgba(59,130,246,.3)' },
  commodity: { bg: 'rgba(168,85,247,.12)', text: '#c084fc', border: 'rgba(168,85,247,.3)' },
  forex: { bg: 'rgba(38,166,154,.12)', text: '#26a69a', border: 'rgba(38,166,154,.3)' },
  etf: { bg: 'rgba(99,102,241,.12)', text: '#818cf8', border: 'rgba(99,102,241,.3)' },
  index: { bg: 'rgba(236,72,153,.12)', text: '#f472b6', border: 'rgba(236,72,153,.3)' },
  bond: { bg: 'rgba(107,114,128,.12)', text: '#9ca3af', border: 'rgba(107,114,128,.3)' },
  crypto_etf: { bg: 'rgba(245,158,11,.12)', text: '#fbbf24', border: 'rgba(245,158,11,.3)' },
};

/** Popularity rank for default "All" view (lower = higher priority) */
export const POPULARITY_RANK: Record<string, number> = {
  'crypto:BTC': 1, 'crypto:ETH': 2, 'stock:AAPL': 3, 'stock:MSFT': 4,
  'stock:NVDA': 5, 'commodity:GOLD': 6, 'commodity:SILVER': 7,
  'forex:USD': 8, 'forex:EUR': 9, 'crypto:SOL': 10, 'crypto:BNB': 11,
  'stock:AMZN': 12, 'stock:TSLA': 13, 'stock:GOOGL': 14,
};

/** Search aliases (Turkish / common names) */
export const SEARCH_ALIASES: Record<string, string[]> = {
  BTC: ['bitcoin', 'bitkoin'],
  ETH: ['ethereum', 'eter'],
  GOLD: ['altın', 'altin', 'xau'],
  SILVER: ['gümüş', 'gumus', 'xag'],
  USD: ['dollar', 'dolar', 'us dollar'],
  EUR: ['euro', 'avro'],
  GBP: ['pound', 'sterlin'],
  TRY: ['lira', 'turkish'],
  AZN: ['manat', 'azerbaijan'],
  AAPL: ['apple', 'elma'],
  MSFT: ['microsoft'],
  NVDA: ['nvidia'],
  AMZN: ['amazon'],
  TSLA: ['tesla'],
  GOOGL: ['google', 'alphabet'],
  OIL: ['petrol', 'crude', 'wti'],
  NATGAS: ['doğal gaz', 'dogal gaz', 'natural gas'],
};
