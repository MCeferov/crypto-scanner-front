/**
 * İndikator ("study") registrasiya modeli.
 *
 * Hər indikator bir StudyDef obyektidir: hansı panelə çəkilir, hansı
 * parametrləri var və klines-dən hansı xətləri çıxarır. Qrafik kodu heç bir
 * indikatoru adı ilə tanımır — sadəcə registrdən keçir. Yeni indikator əlavə
 * etmək = registrə bir obyekt yazmaq, qrafik/toolbar koduna toxunmadan.
 */

import type { UTCTimestamp } from 'lightweight-charts';
import type { Kline } from '../../services/binanceApi';
import type { ChartThemeColors } from '../../types/chart';

export type StudyPlacement = 'overlay' | 'pane';
export type StudyGroup = 'trend' | 'volatility' | 'momentum' | 'volume';

export interface StudyPoint {
  time: UTCTimestamp;
  value: number;
  /** Histoqram üçün şam-şam rəng */
  color?: string;
}

export interface StudyPlot {
  id: string;
  title: string;
  type: 'line' | 'histogram';
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  /** Xətt yox, yalnız nöqtələr (Parabolic SAR) */
  pointsOnly?: boolean;
  data: StudyPoint[];
}

export interface StudyLevel {
  value: number;
  color: string;
  title?: string;
}

export interface StudyParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  default: number;
}

export interface StudyDef {
  key: string;
  label: string;
  group: StudyGroup;
  placement: StudyPlacement;
  /** Ayrı paneldə yüksəklik (px) */
  paneHeight?: number;
  /** Sabit şkala — 0–100 osilatorları avtoskeyl ilə sıçramasın */
  fixedRange?: { min: number; max: number };
  /** Sabit səviyyə xətləri (OB/OS və s.) */
  levels?: StudyLevel[];
  /**
   * Həcm tələb edir. Yahoo forex kline-larında həcm həmişə 0-dır, ona görə
   * belə indikatorlar forex aktivlərində mənasızdır və UI-da bağlanır.
   */
  needsVolume?: boolean;
  params: StudyParam[];
  compute(klines: Kline[], p: Record<string, number>, theme: ChartThemeColors): StudyPlot[];
}

export interface StudyState {
  enabled: boolean;
  params: Record<string, number>;
}

export type StudySettings = Record<string, StudyState>;

/** Şam massivindən orta interval — gələcəyə proyeksiya üçün (Ichimoku) */
export function medianBarSpacing(klines: Kline[]): number {
  if (klines.length < 3) return 60_000;
  const gaps: number[] = [];
  for (let i = klines.length - 1; i > 0 && gaps.length < 20; i--) {
    const g = klines[i].openTime - klines[i - 1].openTime;
    if (g > 0) gaps.push(g);
  }
  if (gaps.length === 0) return 60_000;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * Aligned massivi qrafik nöqtələrinə çevirir.
 *
 * `shift > 0` seriyanı GƏLƏCƏYƏ sürüşdürür (Ichimoku buludu) — son şamdan
 * sonrakı vaxtlar bar intervalından ekstrapolyasiya olunur.
 * `shift < 0` keçmişə sürüşdürür (Chikou span).
 * NaN (warm-up) dəyərlər atılır.
 */
export function toPoints(
  klines: Kline[],
  values: number[],
  shift = 0,
): StudyPoint[] {
  const out: StudyPoint[] = [];
  const step = shift > 0 ? medianBarSpacing(klines) : 0;
  const lastOpen = klines.length ? klines[klines.length - 1].openTime : 0;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    const target = i + shift;
    if (target < 0) continue;

    const openTime = target < klines.length
      ? klines[target].openTime
      : lastOpen + (target - klines.length + 1) * step;

    out.push({ time: Math.floor(openTime / 1000) as UTCTimestamp, value: v });
  }
  return out;
}
