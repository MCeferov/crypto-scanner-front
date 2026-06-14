import type { AssetType } from './asset';

export type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export interface ChartAsset {
  symbol: string;
  type: AssetType;
}

export const CHART_TIMEFRAMES: { key: ChartTimeframe; label: string; binance: string }[] = [
  { key: '1m', label: '1m', binance: '1m' },
  { key: '5m', label: '5m', binance: '5m' },
  { key: '15m', label: '15m', binance: '15m' },
  { key: '1h', label: '1H', binance: '1h' },
  { key: '4h', label: '4H', binance: '4h' },
  { key: '1d', label: '1D', binance: '1d' },
  { key: '1w', label: '1W', binance: '1w' },
];

export type IndicatorKey =
  | 'volume'
  | 'bollingerBands'
  | 'superTrend'
  | 'rsi'
  | 'macd'
  | 'atr'
  | 'stochRsi';

export interface IndicatorSettings {
  rsi: { period: number; enabled: boolean; panel: boolean };
  macd: { fast: number; slow: number; signal: number; enabled: boolean; panel: boolean };
  volume: { enabled: boolean };
  atr: { period: number; enabled: boolean };
  stochRsi: { rsiPeriod: number; stochPeriod: number; kSmooth: number; dSmooth: number; enabled: boolean; panel: boolean };
  superTrend: { period: number; multiplier: number; enabled: boolean };
  bollingerBands: { period: number; stdDev: number; enabled: boolean };
}

export const DEFAULT_INDICATOR_SETTINGS: IndicatorSettings = {
  rsi: { period: 14, enabled: true, panel: true },
  macd: { fast: 12, slow: 26, signal: 9, enabled: true, panel: true },
  volume: { enabled: true },
  atr: { period: 14, enabled: false },
  stochRsi: { rsiPeriod: 14, stochPeriod: 14, kSmooth: 3, dSmooth: 3, enabled: true, panel: true },
  superTrend: { period: 10, multiplier: 3, enabled: true },
  bollingerBands: { period: 20, stdDev: 2, enabled: true },
};

export interface ChartThemeColors {
  background: string;
  text: string;
  grid: string;
  border: string;
  crosshair: string;
  upColor: string;
  downColor: string;
  volumeUp: string;
  volumeDown: string;
  bbUpper: string;
  bbMiddle: string;
  bbLower: string;
  stBull: string;
  stBear: string;
  rsi: string;
  macd: string;
  macdSignal: string;
  macdHistUp: string;
  macdHistDown: string;
  stochK: string;
  stochD: string;
}

const CHART_COLORS_SHARED = {
  upColor: '#26a69a',
  downColor: '#ef5350',
  volumeUp: 'rgba(38,166,154,0.5)',
  volumeDown: 'rgba(239,83,80,0.5)',
  bbUpper: 'rgba(41,98,255,0.6)',
  bbMiddle: 'rgba(150,150,150,0.4)',
  bbLower: 'rgba(41,98,255,0.6)',
  stBull: '#26a69a',
  stBear: '#ef5350',
  rsi: '#7c4dff',
  macd: '#2962ff',
  macdSignal: '#ff6d00',
  macdHistUp: 'rgba(38,166,154,0.7)',
  macdHistDown: 'rgba(239,83,80,0.7)',
  stochK: '#26a69a',
  stochD: '#ff6d00',
} as const;

export const CHART_THEME_LIGHT: ChartThemeColors = {
  background: '#ffffff',
  text: '#64748b',
  grid: '#f1f5f9',
  border: '#e2e8f0',
  crosshair: '#94a3b8',
  ...CHART_COLORS_SHARED,
};

export const CHART_THEME_DARK: ChartThemeColors = {
  background: '#0d1117',
  text: '#8b949e',
  grid: '#1c2128',
  border: '#21262d',
  crosshair: '#484f58',
  ...CHART_COLORS_SHARED,
};

/** @deprecated Use getChartTheme() */
export const CHART_THEME = CHART_THEME_DARK;

export function getChartTheme(isDark: boolean): ChartThemeColors {
  return isDark ? CHART_THEME_DARK : CHART_THEME_LIGHT;
}
