import type { AssetType } from './asset';
import { defaultStudySettings } from '../indicators/library/studies';
import type { StudySettings } from '../indicators/library/types';

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

export type CandleMode = 'normal' | 'heikinAshi' | 'line' | 'area';

export type IndicatorKey =
  | 'volume'
  | 'superTrend'
  | 'rsi'
  | 'macd'
  | 'stochRsi';

/** Confluence signal engine-də iştirak edə bilən indikatorlar */
export type SignalIndicatorKey = 'rsi' | 'stochRsi' | 'macd' | 'superTrend' | 'heikinAshi';

export const SIGNAL_INDICATORS: { key: SignalIndicatorKey; label: string }[] = [
  { key: 'rsi', label: 'RSI' },
  { key: 'stochRsi', label: 'Stochastic RSI' },
  { key: 'macd', label: 'MACD' },
  { key: 'superTrend', label: 'Supertrend' },
  { key: 'heikinAshi', label: 'Heikin Ashi' },
];

export type SignalParticipation = Record<SignalIndicatorKey, boolean>;

/**
 * Data-driven confluence config: hansı indikatorlar BUY / SELL siqnalının
 * yaranmasında iştirak edir. Deaktiv indikator hesablamaya heç bir təsir etmir.
 */
export interface SignalEngineConfig {
  enabled: boolean;
  buy: SignalParticipation;
  sell: SignalParticipation;
}

export const DEFAULT_SIGNAL_CONFIG: SignalEngineConfig = {
  enabled: true,
  buy: { rsi: true, stochRsi: true, macd: true, superTrend: true, heikinAshi: true },
  sell: { rsi: true, stochRsi: true, macd: true, superTrend: true, heikinAshi: true },
};

export interface IndicatorSettings {
  candleMode: CandleMode;
  rsi: {
    period: number;
    oversold: number;
    overbought: number;
    enabled: boolean;
    panel: boolean;
  };
  macd: { fast: number; slow: number; signal: number; enabled: boolean; panel: boolean };
  volume: { enabled: boolean };
  stochRsi: {
    rsiPeriod: number;
    stochPeriod: number;
    kSmooth: number;
    dSmooth: number;
    oversold: number;
    overbought: number;
    enabled: boolean;
    panel: boolean;
  };
  superTrend: { period: number; multiplier: number; enabled: boolean };
  signals: SignalEngineConfig;
  /** Supply/Demand zone + formasiya analizi */
  analysis: { supplyZones: boolean; demandZones: boolean; patterns: boolean };
  /** Kitabxana indikatorları — registr açarına görə vəziyyət + parametrlər */
  studies: StudySettings;
}

/**
 * Qrafik BOŞ açılır — yalnız şamlar və həcm.
 *
 * Əvvəl RSI, MACD, Stoch, SuperTrend, zonalar, formasiyalar və siqnal
 * markerləri hamısı birdən açıq gəlirdi; ekran ilk baxışda oxunmaz olurdu.
 * İndi hər şey opsionaldır: istifadəçi Indicators / Signals menyusundan
 * özü seçir, seçim isə brauzerdə yadda qalır (loadChartSettings).
 */
export const DEFAULT_INDICATOR_SETTINGS: IndicatorSettings = {
  candleMode: 'normal',
  rsi: { period: 14, oversold: 30, overbought: 70, enabled: false, panel: true },
  macd: { fast: 12, slow: 26, signal: 9, enabled: false, panel: true },
  volume: { enabled: true },
  stochRsi: {
    rsiPeriod: 14, stochPeriod: 14, kSmooth: 3, dSmooth: 3,
    oversold: 20, overbought: 80, enabled: false, panel: true,
  },
  superTrend: { period: 10, multiplier: 3, enabled: false },
  signals: { ...DEFAULT_SIGNAL_CONFIG, enabled: false },
  analysis: { supplyZones: false, demandZones: false, patterns: false },
  studies: defaultStudySettings(),
};

const SETTINGS_STORAGE_KEY = 'chart:settings:v1';

/**
 * Yadda saxlanmış seçimi default-un ÜSTÜNƏ qoyur.
 *
 * Sahə-sahə birləşdirilir ki, sonradan əlavə olunan indikator və ya parametr
 * köhnə yaddaşda olmadığına görə itməsin — köhnə qeyd yeni sahələri sadəcə
 * default dəyərlə alır.
 */
export function loadChartSettings(): IndicatorSettings {
  const base = DEFAULT_INDICATOR_SETTINGS;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return base;
  }
  if (!raw) return base;

  try {
    const saved = JSON.parse(raw) as Partial<IndicatorSettings>;
    const studies: StudySettings = { ...base.studies };
    for (const [key, state] of Object.entries(saved.studies ?? {})) {
      if (!studies[key]) continue;
      studies[key] = {
        enabled: Boolean(state?.enabled),
        params: { ...studies[key].params, ...(state?.params ?? {}) },
      };
    }
    return {
      ...base,
      ...saved,
      rsi: { ...base.rsi, ...saved.rsi },
      macd: { ...base.macd, ...saved.macd },
      volume: { ...base.volume, ...saved.volume },
      stochRsi: { ...base.stochRsi, ...saved.stochRsi },
      superTrend: { ...base.superTrend, ...saved.superTrend },
      signals: {
        ...base.signals,
        ...saved.signals,
        buy: { ...base.signals.buy, ...saved.signals?.buy },
        sell: { ...base.signals.sell, ...saved.signals?.sell },
      },
      analysis: { ...base.analysis, ...saved.analysis },
      studies,
    };
  } catch {
    return base;
  }
}

export function saveChartSettings(settings: IndicatorSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* quota / private mode */
  }
}

export interface ChartThemeColors {
  background: string;
  text: string;
  grid: string;
  border: string;
  crosshair: string;
  upColor: string;
  downColor: string;
  lineColor: string;
  areaTop: string;
  areaBottom: string;
  volumeUp: string;
  volumeDown: string;
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
  lineColor: '#2962ff',
  areaTop: 'rgba(41,98,255,0.22)',
  areaBottom: 'rgba(41,98,255,0.02)',
  volumeUp: 'rgba(38,166,154,0.5)',
  volumeDown: 'rgba(239,83,80,0.5)',
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
