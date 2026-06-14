import type { NormalizedAsset } from '../services/marketApi';
import {
  assetId, backendClassToType, POPULARITY_RANK, SEARCH_ALIASES,
  type AssetType,
} from '../types/asset';

export interface AssetRowBase {
  id: string;
  name: string;
  type: AssetType;
  marketCap: number | null;
  symbol: string;
  baseAsset: string;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  source?: string;
}

const EMPTY_INDICATORS = {
  rsi15m: null, rsi1h: null, rsi4h: null, rsi1d: null,
  macd: null, macdSignal: null, macdHistogram: null,
  bbUpper: null, bbMiddle: null, bbLower: null, bbPercent: null,
  atr: null, atrPercent: null,
  stochRsiK: null, stochRsiD: null,
  superTrend: null, superTrendValue: null,
  trendScore: 50, signal: 'NEUTRAL' as const, signalReasons: [] as string[],
  zonePosition: null, zoneSignal: 'ZONE_NEUTRAL' as const, zoneBreakoutSignal: 'NEUTRAL' as const,
  zoneBreakoutReasons: [] as string[], zoneSignalReasons: [] as string[],
  stopLoss: null, takeProfit: null, riskReward: null,
  haTrend: 0 as const, haConsecutive: 0, haSignal: 'NEUTRAL' as const, haReasons: [] as string[],
  setupSignal: 'NEUTRAL' as const, setupLabel: '—', setupReasons: [] as string[], setupConviction: 0,
  mtf15m: 'NEUTRAL' as const, mtf30m: 'NEUTRAL' as const, mtf1h: 'NEUTRAL' as const, mtf4h: 'NEUTRAL' as const,
  chartSignal: 'NEUTRAL' as const, chartSignalReasons: [] as string[],
  researchSignal: 'NEUTRAL' as const, researchLabel: '—', researchScore: 0, researchReasons: [] as string[],
  reversalRisk: 'NONE' as const, reversalReasons: [] as string[], mtfAlignment: 'MIXED' as const, riskRewardNote: '',
  primaryAnalysisTf: '1h' as const,
  mtf15mCandles: 0, mtf30mCandles: 0, mtf1hCandles: 0, mtf4hCandles: 0,
  macdCandles: 0, stCandles: 0, stochCandles: 0, haCandles: 0,
  chartCandles: 0, aiCandles: 0, zoneCandles: 0, setupCandles: 0, rsiCandles: 0,
  syncStatus: 'WEAK' as const, syncScore: 0, syncLeader: '—', syncLeaderId: '', syncLeaderCandles: 0, syncReasons: [] as string[],
  indicatorsLoaded: false,
};

export function cryptoTradingSymbol(symbol: string): string {
  return symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
}

export function displaySymbol(symbol: string, type: AssetType): string {
  if (type === 'crypto') return symbol.replace(/USDT$/, '');
  return symbol;
}

export function createAssetFromNormalized(asset: NormalizedAsset): AssetRowBase {
  const type = backendClassToType(asset.assetClass);
  const sym = type === 'crypto' ? cryptoTradingSymbol(asset.symbol) : asset.symbol;
  const base = displaySymbol(sym, type);

  return {
    id: assetId(type, base),
    name: asset.name,
    type,
    marketCap: asset.marketCap,
    symbol: sym,
    baseAsset: base,
    price: asset.price,
    priceChange1h: 0,
    priceChange24h: asset.change24h,
    volume24h: asset.volume24h ?? 0,
    source: asset.source,
    ...EMPTY_INDICATORS,
  };
}

export function popularityScore(asset: AssetRowBase): number {
  const rank = POPULARITY_RANK[asset.id];
  if (rank !== undefined) return rank;
  const cap = asset.marketCap ?? 0;
  const vol = asset.volume24h ?? 0;
  if (cap > 0) return 1000 - Math.log10(cap);
  if (vol > 0) return 2000 - Math.log10(vol);
  return 9000;
}

export function sortByPopularity<T extends AssetRowBase>(assets: T[]): T[] {
  return [...assets].sort((a, b) => popularityScore(a) - popularityScore(b));
}

export function matchesSearch(asset: AssetRowBase, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    asset.baseAsset, asset.symbol, asset.name, asset.type,
  ].join(' ').toLowerCase();
  if (hay.includes(q)) return true;
  const aliases = SEARCH_ALIASES[asset.baseAsset] ?? [];
  return aliases.some(a => a.includes(q) || q.includes(a));
}

export function isCryptoAsset(asset: AssetRowBase): boolean {
  return asset.type === 'crypto';
}

export function hasIndicatorSupport(asset: AssetRowBase): boolean {
  return ['crypto', 'stock', 'commodity', 'forex'].includes(asset.type);
}
