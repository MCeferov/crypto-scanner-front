import type { Kline } from '../services/binanceApi';

/**
 * Detail Page chart üçün Supply/Demand zone detection.
 *
 * Heatmap-dəki analyzeSupplyDemand-dən fərqli olaraq bu detektor zonaları
 * time-anchor ilə qaytarır (rendering rectangle üçün) və no-look-ahead
 * qaydası ilə işləyir:
 *  - Pivot yalnız PIVOT_RIGHT bar sonra təsdiqlənir — təsdiqdən əvvəl zone yoxdur
 *  - Displacement yoxlaması pivot ilə təsdiq nöqtəsi arasındakı barlardan istifadə edir
 *  - Forming candle caller tərəfindən kənarlaşdırılır (yalnız closed klines)
 *  - Sonradan qırılan (close ilə keçilən) zone silinir — köhnəlmiş zonalar görünmür
 */
export interface ChartZone {
  type: 'supply' | 'demand';
  top: number;
  bottom: number;
  /** Zone-un formalaşdığı pivot barın vaxtı (saniyə) — rectangle buradan başlayır */
  startTime: number;
  /**
   * Zone-un qırıldığı barın vaxtı (saniyə); null = hələ aktivdir və sağ kənara
   * qədər uzanır. Tarixi (qırılmış) zonalar bu vaxtda bitir — geriyə scroll
   * edəndə həmin dövrün zonaları görünsün deyə saxlanılır.
   */
  endTime: number | null;
  strength: number;
  touches: number;
}

export interface ChartZoneConfig {
  /** Pivot üçün sol/sağ baxış pəncərəsi (bar) */
  pivotLeft: number;
  pivotRight: number;
  /** Pivotdan minimum impulsiv uzaqlaşma (ATR misli) */
  minDisplacementAtr: number;
  /** Hər tərəf üçün maksimum AKTİV (qırılmamış) zone sayı */
  maxActiveZonesPerSide: number;
  /** Hər tərəf üçün maksimum TARİXİ (qırılmış) zone sayı */
  maxHistoricalZonesPerSide: number;
  /** Yalnız son N bar içindəki pivotlar nəzərə alınır */
  lookbackBars: number;
}

export const DEFAULT_ZONE_CONFIG: ChartZoneConfig = {
  pivotLeft: 5,
  pivotRight: 5,
  minDisplacementAtr: 0.6,
  maxActiveZonesPerSide: 5,
  maxHistoricalZonesPerSide: 40,
  lookbackBars: 3000,
};

function atr14(klines: Kline[]): number {
  const period = 14;
  if (klines.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const pc = klines[i - 1].close;
    trs.push(Math.max(
      klines[i].high - klines[i].low,
      Math.abs(klines[i].high - pc),
      Math.abs(klines[i].low - pc),
    ));
  }
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

function isPivotHigh(klines: Kline[], i: number, left: number, right: number): boolean {
  for (let j = 1; j <= left; j++) {
    if (klines[i].high <= klines[i - j].high) return false;
  }
  for (let j = 1; j <= right; j++) {
    if (klines[i].high <= klines[i + j].high) return false;
  }
  return true;
}

function isPivotLow(klines: Kline[], i: number, left: number, right: number): boolean {
  for (let j = 1; j <= left; j++) {
    if (klines[i].low >= klines[i - j].low) return false;
  }
  for (let j = 1; j <= right; j++) {
    if (klines[i].low >= klines[i + j].low) return false;
  }
  return true;
}

interface Candidate extends ChartZone {
  pivotIndex: number;
  confirmedIndex: number;
}

/** Pivot ilə təsdiq arasındakı barlarda impulsiv uzaqlaşma (ATR ilə) */
function displacementAtr(
  klines: Kline[],
  pivotIdx: number,
  confirmIdx: number,
  atr: number,
  type: 'supply' | 'demand',
): number {
  if (atr <= 0) return 0;
  let extreme = type === 'supply' ? Infinity : -Infinity;
  for (let j = pivotIdx + 1; j <= confirmIdx; j++) {
    if (type === 'supply') extreme = Math.min(extreme, klines[j].low);
    else extreme = Math.max(extreme, klines[j].high);
  }
  const move = type === 'supply'
    ? klines[pivotIdx].high - extreme
    : extreme - klines[pivotIdx].low;
  return move / atr;
}

function avgVolume(klines: Kline[]): number {
  if (klines.length === 0) return 0;
  return klines.reduce((s, k) => s + k.volume, 0) / klines.length;
}

export function detectChartZones(
  klines: Kline[],
  config: ChartZoneConfig = DEFAULT_ZONE_CONFIG,
): ChartZone[] {
  const {
    pivotLeft, pivotRight, minDisplacementAtr,
    maxActiveZonesPerSide, maxHistoricalZonesPerSide, lookbackBars,
  } = config;
  const n = klines.length;
  if (n < pivotLeft + pivotRight + 20) return [];

  const atr = atr14(klines);
  const volAvg = avgVolume(klines.slice(-Math.min(n, 200)));
  const startIdx = Math.max(pivotLeft, n - lookbackBars);

  const candidates: Candidate[] = [];

  // Son pivotRight bar hələ təsdiqlənməyib — onlarda zone yaranmır (no look-ahead)
  for (let i = startIdx; i < n - pivotRight; i++) {
    const k = klines[i];
    const bodyTop = Math.max(k.open, k.close);
    const bodyBottom = Math.min(k.open, k.close);
    const minThickness = atr > 0 ? atr * 0.25 : k.close * 0.002;

    if (isPivotHigh(klines, i, pivotLeft, pivotRight)) {
      const disp = displacementAtr(klines, i, i + pivotRight, atr, 'supply');
      if (disp >= minDisplacementAtr) {
        const top = k.high;
        const bottom = Math.min(bodyTop, top - minThickness);
        const volBoost = volAvg > 0 && k.volume > volAvg * 1.2 ? 1 : 0;
        candidates.push({
          type: 'supply',
          top,
          bottom,
          startTime: Math.floor(k.openTime / 1000),
          endTime: null,
          strength: disp + volBoost,
          touches: 0,
          pivotIndex: i,
          confirmedIndex: i + pivotRight,
        });
      }
    }

    if (isPivotLow(klines, i, pivotLeft, pivotRight)) {
      const disp = displacementAtr(klines, i, i + pivotRight, atr, 'demand');
      if (disp >= minDisplacementAtr) {
        const bottom = k.low;
        const top = Math.max(bodyBottom, bottom + minThickness);
        const volBoost = volAvg > 0 && k.volume > volAvg * 1.2 ? 1 : 0;
        candidates.push({
          type: 'demand',
          top,
          bottom,
          startTime: Math.floor(k.openTime / 1000),
          endTime: null,
          strength: disp + volBoost,
          touches: 0,
          pivotIndex: i,
          confirmedIndex: i + pivotRight,
        });
      }
    }
  }

  // Qırılma (invalidation) + toxunma (retest) sayı — təsdiqdən sonrakı barlarla.
  // Qırılan zone atılmır: endTime alır və tarixi zone kimi saxlanılır ki,
  // geriyə scroll edəndə həmin dövrün S/D səviyyələri görünsün.
  const evaluated: Candidate[] = [];
  for (const z of candidates) {
    let endTime: number | null = null;
    let touches = 0;
    for (let j = z.confirmedIndex + 1; j < n; j++) {
      const bar = klines[j];
      if (z.type === 'supply') {
        if (bar.close > z.top) { endTime = Math.floor(bar.openTime / 1000); break; }
        if (bar.high >= z.bottom && bar.high <= z.top) touches++;
      } else {
        if (bar.close < z.bottom) { endTime = Math.floor(bar.openTime / 1000); break; }
        if (bar.low <= z.top && bar.low >= z.bottom) touches++;
      }
    }
    evaluated.push({ ...z, endTime, touches, strength: z.strength + Math.min(2, touches * 0.5) });
  }

  /** İki zone-un aktiv pəncərəsi zamanca kəsişirmi (null endTime = sonsuz) */
  const timeOverlap = (a: Candidate, b: Candidate): boolean => {
    const aEnd = a.endTime ?? Infinity;
    const bEnd = b.endTime ?? Infinity;
    return a.startTime <= bEnd && b.startTime <= aEnd;
  };

  // Üst-üstə düşən eyni tip zonaları birləşdir — yalnız eyni dövrə aiddirsə.
  // Fərqli dövrlərdə eyni qiymət səviyyəsi ayrı zone kimi qalmalıdır.
  const merged: Candidate[] = [];
  const sorted = [...evaluated].sort((a, b) => b.strength - a.strength);
  for (const z of sorted) {
    const overlap = merged.find(m =>
      m.type === z.type && z.bottom <= m.top && z.top >= m.bottom && timeOverlap(m, z),
    );
    if (overlap) {
      overlap.strength += z.strength * 0.3;
      overlap.touches += z.touches;
      overlap.startTime = Math.min(overlap.startTime, z.startTime);
      overlap.endTime = overlap.endTime === null || z.endTime === null
        ? null
        : Math.max(overlap.endTime, z.endTime);
    } else {
      merged.push({ ...z });
    }
  }

  // Aktiv və tarixi zonalar ayrıca limitlənir — ən yenilər saxlanılır
  const byNewest = (a: Candidate, b: Candidate) => b.startTime - a.startTime;
  const pick = (type: 'supply' | 'demand') => {
    const all = merged.filter(z => z.type === type);
    return [
      ...all.filter(z => z.endTime === null).sort(byNewest).slice(0, maxActiveZonesPerSide),
      ...all.filter(z => z.endTime !== null).sort(byNewest).slice(0, maxHistoricalZonesPerSide),
    ];
  };

  return [...pick('supply'), ...pick('demand')]
    .map(({ pivotIndex: _p, confirmedIndex: _c, ...zone }) => zone);
}
