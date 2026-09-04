/**
 * İndikator kitabxanası.
 *
 * Buradakı hər indikator öz klassik, açıq dərc olunmuş düsturundan yazılıb
 * (Wilder, Lambert, Bollinger, Donchian, Keltner, Ichimoku, Parabolic SAR və
 * s.). Bunlar onilliklərdir dərsliklərdə dərc olunmuş ictimai düsturlardır —
 * heç bir platformanın xüsusi kodundan köçürülməyib, lisenziya məhdudiyyəti
 * yoxdur.
 *
 * Yeni indikator əlavə etmək üçün sadəcə STUDIES massivinə bir obyekt yaz —
 * qrafik və toolbar kodu registrdən oxuyur, heç nəyi adı ilə tanımır.
 */

import type { Kline } from '../../services/binanceApi';
import type { ChartThemeColors } from '../../types/chart';
import { toPoints, type StudyDef, type StudyPlot, type StudySettings } from './types';
import { NA, atr, ema, highest, lowest, rma, sma, stdev, trueRange } from './math';

const C = {
  fast: '#2962ff',
  mid: '#ff6d00',
  slow: '#ab47bc',
  band: '#787b86',
  bull: '#26a69a',
  bear: '#ef5350',
  neutral: '#7c4dff',
  accent: '#00bcd4',
} as const;

const ohlc = (k: Kline[]) => ({
  high: k.map(x => x.high),
  low: k.map(x => x.low),
  close: k.map(x => x.close),
});

/** Tipik qiymət (H+L+C)/3 — CCI, MFI, VWAP bunu istifadə edir */
const typicalPrice = (k: Kline[]) => k.map(x => (x.high + x.low + x.close) / 3);

// ─────────────────────────────── Overlay ───────────────────────────────

const emaStudy: StudyDef = {
  key: 'ema',
  label: 'EMA (3 xətt)',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'fast', label: 'Sürətli', min: 2, max: 400, default: 9 },
    { key: 'mid', label: 'Orta', min: 2, max: 400, default: 21 },
    { key: 'slow', label: 'Yavaş', min: 2, max: 400, default: 50 },
  ],
  compute(klines, p) {
    const closes = klines.map(k => k.close);
    const defs: [string, number, string][] = [
      ['fast', p.fast, C.fast],
      ['mid', p.mid, C.mid],
      ['slow', p.slow, C.slow],
    ];
    return defs.map(([id, len, color]) => ({
      id: `ema-${id}`,
      title: `EMA ${len}`,
      type: 'line' as const,
      color,
      lineWidth: 2 as const,
      data: toPoints(klines, ema(closes, len)),
    }));
  },
};

const smaStudy: StudyDef = {
  key: 'sma',
  label: 'SMA (3 xətt)',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'fast', label: 'Sürətli', min: 2, max: 400, default: 50 },
    { key: 'mid', label: 'Orta', min: 2, max: 400, default: 100 },
    { key: 'slow', label: 'Yavaş', min: 2, max: 400, default: 200 },
  ],
  compute(klines, p) {
    const closes = klines.map(k => k.close);
    const defs: [string, number, string][] = [
      ['fast', p.fast, C.fast],
      ['mid', p.mid, C.mid],
      ['slow', p.slow, C.slow],
    ];
    return defs.map(([id, len, color]) => ({
      id: `sma-${id}`,
      title: `SMA ${len}`,
      type: 'line' as const,
      color,
      lineWidth: 2 as const,
      data: toPoints(klines, sma(closes, len)),
    }));
  },
};

const bollingerStudy: StudyDef = {
  key: 'bollinger',
  label: 'Bollinger Bands',
  group: 'volatility',
  placement: 'overlay',
  params: [
    { key: 'period', label: 'Period', min: 2, max: 200, default: 20 },
    { key: 'mult', label: 'Kənarlaşma', min: 0.5, max: 5, step: 0.1, default: 2 },
  ],
  compute(klines, p) {
    const closes = klines.map(k => k.close);
    const basis = sma(closes, p.period);
    const dev = stdev(closes, p.period);
    const upper = basis.map((b, i) => (Number.isFinite(b) ? b + p.mult * dev[i] : NA));
    const lower = basis.map((b, i) => (Number.isFinite(b) ? b - p.mult * dev[i] : NA));
    return [
      { id: 'bb-upper', title: 'BB üst', type: 'line', color: C.band, lineWidth: 1, data: toPoints(klines, upper) },
      { id: 'bb-basis', title: 'BB orta', type: 'line', color: C.mid, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, basis) },
      { id: 'bb-lower', title: 'BB alt', type: 'line', color: C.band, lineWidth: 1, data: toPoints(klines, lower) },
    ];
  },
};

const keltnerStudy: StudyDef = {
  key: 'keltner',
  label: 'Keltner Channels',
  group: 'volatility',
  placement: 'overlay',
  params: [
    { key: 'period', label: 'EMA period', min: 2, max: 200, default: 20 },
    { key: 'atrPeriod', label: 'ATR period', min: 2, max: 100, default: 10 },
    { key: 'mult', label: 'Vuruq', min: 0.5, max: 5, step: 0.1, default: 2 },
  ],
  compute(klines, p) {
    const { high, low, close } = ohlc(klines);
    const basis = ema(close, p.period);
    const range = atr(high, low, close, p.atrPeriod);
    const band = (sign: 1 | -1) =>
      basis.map((b, i) =>
        Number.isFinite(b) && Number.isFinite(range[i]) ? b + sign * p.mult * range[i] : NA);
    return [
      { id: 'kc-upper', title: 'KC üst', type: 'line', color: C.accent, lineWidth: 1, data: toPoints(klines, band(1)) },
      { id: 'kc-basis', title: 'KC orta', type: 'line', color: C.accent, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, basis) },
      { id: 'kc-lower', title: 'KC alt', type: 'line', color: C.accent, lineWidth: 1, data: toPoints(klines, band(-1)) },
    ];
  },
};

const donchianStudy: StudyDef = {
  key: 'donchian',
  label: 'Donchian Channels',
  group: 'volatility',
  placement: 'overlay',
  params: [{ key: 'period', label: 'Period', min: 2, max: 300, default: 20 }],
  compute(klines, p) {
    const { high, low } = ohlc(klines);
    const upper = highest(high, p.period);
    const lower = lowest(low, p.period);
    const mid = upper.map((u, i) =>
      Number.isFinite(u) && Number.isFinite(lower[i]) ? (u + lower[i]) / 2 : NA);
    return [
      { id: 'dc-upper', title: 'DC üst', type: 'line', color: C.bull, lineWidth: 1, data: toPoints(klines, upper) },
      { id: 'dc-mid', title: 'DC orta', type: 'line', color: C.band, lineWidth: 1, lineStyle: 'dotted', data: toPoints(klines, mid) },
      { id: 'dc-lower', title: 'DC alt', type: 'line', color: C.bear, lineWidth: 1, data: toPoints(klines, lower) },
    ];
  },
};

const ichimokuStudy: StudyDef = {
  key: 'ichimoku',
  label: 'Ichimoku',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'tenkan', label: 'Tenkan', min: 2, max: 100, default: 9 },
    { key: 'kijun', label: 'Kijun', min: 2, max: 200, default: 26 },
    { key: 'senkou', label: 'Senkou B', min: 2, max: 400, default: 52 },
    { key: 'displacement', label: 'Sürüşmə', min: 1, max: 100, default: 26 },
  ],
  compute(klines, p) {
    const { high, low, close } = ohlc(klines);
    const midpoint = (len: number) => {
      const hi = highest(high, len);
      const lo = lowest(low, len);
      return hi.map((h, i) => (Number.isFinite(h) && Number.isFinite(lo[i]) ? (h + lo[i]) / 2 : NA));
    };
    const tenkan = midpoint(p.tenkan);
    const kijun = midpoint(p.kijun);
    const senkouA = tenkan.map((t, i) =>
      Number.isFinite(t) && Number.isFinite(kijun[i]) ? (t + kijun[i]) / 2 : NA);
    const senkouB = midpoint(p.senkou);
    const d = p.displacement;
    return [
      { id: 'ich-tenkan', title: 'Tenkan', type: 'line', color: C.fast, lineWidth: 1, data: toPoints(klines, tenkan) },
      { id: 'ich-kijun', title: 'Kijun', type: 'line', color: C.bear, lineWidth: 1, data: toPoints(klines, kijun) },
      { id: 'ich-senkou-a', title: 'Senkou A', type: 'line', color: C.bull, lineWidth: 1, data: toPoints(klines, senkouA, d) },
      { id: 'ich-senkou-b', title: 'Senkou B', type: 'line', color: C.slow, lineWidth: 1, data: toPoints(klines, senkouB, d) },
      { id: 'ich-chikou', title: 'Chikou', type: 'line', color: C.band, lineWidth: 1, lineStyle: 'dotted', data: toPoints(klines, close, -d) },
    ];
  },
};

const vwapStudy: StudyDef = {
  key: 'vwap',
  label: 'VWAP (sessiya)',
  group: 'volume',
  placement: 'overlay',
  needsVolume: true,
  params: [{ key: 'bands', label: 'σ bant', min: 0, max: 4, step: 0.5, default: 1 }],
  compute(klines, p) {
    const tp = typicalPrice(klines);
    const n = klines.length;
    const vwap = new Array<number>(n).fill(NA);
    const upper = new Array<number>(n).fill(NA);
    const lower = new Array<number>(n).fill(NA);

    let day = -1;
    let pv = 0;
    let pv2 = 0;
    let vol = 0;

    for (let i = 0; i < n; i++) {
      // UTC gün dəyişəndə sessiya sıfırlanır — klassik VWAP davranışı
      const d = Math.floor(klines[i].openTime / 86_400_000);
      if (d !== day) {
        day = d;
        pv = 0;
        pv2 = 0;
        vol = 0;
      }
      const v = klines[i].volume;
      if (v > 0) {
        pv += tp[i] * v;
        pv2 += tp[i] * tp[i] * v;
        vol += v;
      }
      if (vol <= 0) continue;

      const mean = pv / vol;
      vwap[i] = mean;
      if (p.bands > 0) {
        const variance = Math.max(0, pv2 / vol - mean * mean);
        const sd = Math.sqrt(variance) * p.bands;
        upper[i] = mean + sd;
        lower[i] = mean - sd;
      }
    }

    const plots: StudyPlot[] = [
      { id: 'vwap', title: 'VWAP', type: 'line', color: C.accent, lineWidth: 2, data: toPoints(klines, vwap) },
    ];
    if (p.bands > 0) {
      plots.push(
        { id: 'vwap-up', title: `VWAP +${p.bands}σ`, type: 'line', color: C.band, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, upper) },
        { id: 'vwap-dn', title: `VWAP -${p.bands}σ`, type: 'line', color: C.band, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, lower) },
      );
    }
    return plots;
  },
};

const psarStudy: StudyDef = {
  key: 'psar',
  label: 'Parabolic SAR',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'step', label: 'Addım', min: 0.001, max: 0.2, step: 0.001, default: 0.02 },
    { key: 'max', label: 'Maksimum', min: 0.01, max: 1, step: 0.01, default: 0.2 },
  ],
  compute(klines, p) {
    const n = klines.length;
    if (n < 3) return [];
    const out = new Array<number>(n).fill(NA);

    let bull = klines[1].close >= klines[0].close;
    let sar = bull ? klines[0].low : klines[0].high;
    let extreme = bull ? klines[1].high : klines[1].low;
    let accel = p.step;

    for (let i = 2; i < n; i++) {
      sar += accel * (extreme - sar);
      const prev = klines[i - 1];
      const prev2 = klines[i - 2];

      if (bull) {
        sar = Math.min(sar, prev.low, prev2.low);
        if (klines[i].low < sar) {
          bull = false;
          sar = extreme;
          extreme = klines[i].low;
          accel = p.step;
        } else if (klines[i].high > extreme) {
          extreme = klines[i].high;
          accel = Math.min(p.max, accel + p.step);
        }
      } else {
        sar = Math.max(sar, prev.high, prev2.high);
        if (klines[i].high > sar) {
          bull = true;
          sar = extreme;
          extreme = klines[i].high;
          accel = p.step;
        } else if (klines[i].low < extreme) {
          extreme = klines[i].low;
          accel = Math.min(p.max, accel + p.step);
        }
      }
      out[i] = sar;
    }

    return [{
      id: 'psar',
      title: 'PSAR',
      type: 'line',
      color: C.neutral,
      lineWidth: 1,
      pointsOnly: true,
      data: toPoints(klines, out),
    }];
  },
};

// ──────────────────────────── Ayrı paneldə ────────────────────────────

const adxStudy: StudyDef = {
  key: 'adx',
  label: 'ADX / DMI',
  group: 'momentum',
  placement: 'pane',
  paneHeight: 110,
  levels: [{ value: 25, color: 'rgba(150,150,150,0.5)', title: '25' }],
  params: [{ key: 'period', label: 'Period', min: 2, max: 100, default: 14 }],
  compute(klines, p) {
    const { high, low, close } = ohlc(klines);
    const n = klines.length;
    const plusDM = new Array<number>(n).fill(0);
    const minusDM = new Array<number>(n).fill(0);

    for (let i = 1; i < n; i++) {
      const up = high[i] - high[i - 1];
      const down = low[i - 1] - low[i];
      plusDM[i] = up > down && up > 0 ? up : 0;
      minusDM[i] = down > up && down > 0 ? down : 0;
    }

    const smTr = rma(trueRange(high, low, close), p.period);
    const smPlus = rma(plusDM, p.period);
    const smMinus = rma(minusDM, p.period);

    const diPlus = smPlus.map((v, i) =>
      Number.isFinite(v) && smTr[i] > 0 ? (100 * v) / smTr[i] : NA);
    const diMinus = smMinus.map((v, i) =>
      Number.isFinite(v) && smTr[i] > 0 ? (100 * v) / smTr[i] : NA);

    const dx = diPlus.map((v, i) => {
      const sum = v + diMinus[i];
      return Number.isFinite(v) && Number.isFinite(diMinus[i]) && sum > 0
        ? (100 * Math.abs(v - diMinus[i])) / sum
        : NA;
    });

    // rma() NaN qəbul etmir — warm-up hissəsi kəsilir, nəticə geri yerləşdirilir
    const firstValid = dx.findIndex(v => Number.isFinite(v));
    const adx = new Array<number>(n).fill(NA);
    if (firstValid >= 0) {
      const tail = rma(dx.slice(firstValid), p.period);
      for (let i = 0; i < tail.length; i++) adx[firstValid + i] = tail[i];
    }

    return [
      { id: 'adx', title: 'ADX', type: 'line', color: C.slow, lineWidth: 2, data: toPoints(klines, adx) },
      { id: 'di-plus', title: '+DI', type: 'line', color: C.bull, lineWidth: 1, data: toPoints(klines, diPlus) },
      { id: 'di-minus', title: '-DI', type: 'line', color: C.bear, lineWidth: 1, data: toPoints(klines, diMinus) },
    ];
  },
};

const cciStudy: StudyDef = {
  key: 'cci',
  label: 'CCI',
  group: 'momentum',
  placement: 'pane',
  paneHeight: 100,
  levels: [
    { value: 100, color: 'rgba(239,83,80,0.6)', title: '+100' },
    { value: -100, color: 'rgba(38,166,154,0.6)', title: '-100' },
  ],
  params: [{ key: 'period', label: 'Period', min: 2, max: 200, default: 20 }],
  compute(klines, p) {
    const tp = typicalPrice(klines);
    const avg = sma(tp, p.period);
    const out = new Array<number>(klines.length).fill(NA);
    for (let i = p.period - 1; i < tp.length; i++) {
      let dev = 0;
      for (let j = 0; j < p.period; j++) dev += Math.abs(tp[i - j] - avg[i]);
      dev /= p.period;
      out[i] = dev === 0 ? 0 : (tp[i] - avg[i]) / (0.015 * dev);
    }
    return [{
      id: 'cci', title: `CCI ${p.period}`, type: 'line',
      color: C.neutral, lineWidth: 2, data: toPoints(klines, out),
    }];
  },
};

const mfiStudy: StudyDef = {
  key: 'mfi',
  label: 'Money Flow Index',
  group: 'volume',
  placement: 'pane',
  paneHeight: 100,
  fixedRange: { min: 0, max: 100 },
  needsVolume: true,
  levels: [
    { value: 80, color: 'rgba(239,83,80,0.6)', title: '80' },
    { value: 20, color: 'rgba(38,166,154,0.6)', title: '20' },
  ],
  params: [{ key: 'period', label: 'Period', min: 2, max: 100, default: 14 }],
  compute(klines, p) {
    const tp = typicalPrice(klines);
    const out = new Array<number>(klines.length).fill(NA);
    for (let i = p.period; i < klines.length; i++) {
      let pos = 0;
      let neg = 0;
      for (let j = i - p.period + 1; j <= i; j++) {
        const flow = tp[j] * klines[j].volume;
        if (tp[j] > tp[j - 1]) pos += flow;
        else if (tp[j] < tp[j - 1]) neg += flow;
      }
      out[i] = neg === 0 ? (pos === 0 ? 50 : 100) : 100 - 100 / (1 + pos / neg);
    }
    return [{
      id: 'mfi', title: `MFI ${p.period}`, type: 'line',
      color: C.accent, lineWidth: 2, data: toPoints(klines, out),
    }];
  },
};

const williamsStudy: StudyDef = {
  key: 'williams',
  label: 'Williams %R',
  group: 'momentum',
  placement: 'pane',
  paneHeight: 100,
  fixedRange: { min: -100, max: 0 },
  levels: [
    { value: -20, color: 'rgba(239,83,80,0.6)', title: '-20' },
    { value: -80, color: 'rgba(38,166,154,0.6)', title: '-80' },
  ],
  params: [{ key: 'period', label: 'Period', min: 2, max: 200, default: 14 }],
  compute(klines, p) {
    const { high, low, close } = ohlc(klines);
    const hh = highest(high, p.period);
    const ll = lowest(low, p.period);
    const out = hh.map((h, i) => {
      if (!Number.isFinite(h) || !Number.isFinite(ll[i])) return NA;
      const range = h - ll[i];
      return range === 0 ? -50 : (-100 * (h - close[i])) / range;
    });
    return [{
      id: 'willr', title: `%R ${p.period}`, type: 'line',
      color: C.mid, lineWidth: 2, data: toPoints(klines, out),
    }];
  },
};

const obvStudy: StudyDef = {
  key: 'obv',
  label: 'On-Balance Volume',
  group: 'volume',
  placement: 'pane',
  paneHeight: 100,
  needsVolume: true,
  params: [{ key: 'smooth', label: 'Hamarlama (0 = yox)', min: 0, max: 100, default: 0 }],
  compute(klines, p) {
    const out = new Array<number>(klines.length).fill(NA);
    let acc = 0;
    for (let i = 0; i < klines.length; i++) {
      if (i > 0) {
        const diff = klines[i].close - klines[i - 1].close;
        acc += diff > 0 ? klines[i].volume : diff < 0 ? -klines[i].volume : 0;
      }
      out[i] = acc;
    }
    const plots: StudyPlot[] = [
      { id: 'obv', title: 'OBV', type: 'line', color: C.fast, lineWidth: 2, data: toPoints(klines, out) },
    ];
    if (p.smooth >= 2) {
      plots.push({
        id: 'obv-ma',
        title: `OBV MA ${p.smooth}`,
        type: 'line',
        color: C.mid,
        lineWidth: 1,
        data: toPoints(klines, ema(out, p.smooth)),
      });
    }
    return plots;
  },
};

const atrStudy: StudyDef = {
  key: 'atr',
  label: 'ATR',
  group: 'volatility',
  placement: 'pane',
  paneHeight: 90,
  params: [{ key: 'period', label: 'Period', min: 2, max: 100, default: 14 }],
  compute(klines, p) {
    const { high, low, close } = ohlc(klines);
    return [{
      id: 'atr',
      title: `ATR ${p.period}`,
      type: 'line',
      color: C.slow,
      lineWidth: 2,
      data: toPoints(klines, atr(high, low, close, p.period)),
    }];
  },
};

export const STUDIES: StudyDef[] = [
  emaStudy, smaStudy, ichimokuStudy, psarStudy,
  bollingerStudy, keltnerStudy, donchianStudy, atrStudy,
  adxStudy, cciStudy, williamsStudy,
  vwapStudy, mfiStudy, obvStudy,
];

export const STUDY_BY_KEY: Record<string, StudyDef> = Object.fromEntries(
  STUDIES.map(s => [s.key, s]),
);

export const STUDY_GROUP_LABELS: Record<string, string> = {
  trend: 'Trend',
  volatility: 'Volatillik',
  momentum: 'Momentum',
  volume: 'Həcm',
};

/** Başlanğıcda hamısı sönülü — istifadəçi özü seçir */
export function defaultStudySettings(): StudySettings {
  return Object.fromEntries(
    STUDIES.map(s => [
      s.key,
      {
        enabled: false,
        params: Object.fromEntries(s.params.map(p => [p.key, p.default])),
      },
    ]),
  );
}

/** Çatışmayan parametrləri default ilə doldurub hesablayır; xəta seriyanı boş edir */
export function computeStudy(
  def: StudyDef,
  klines: Kline[],
  params: Record<string, number>,
  theme: ChartThemeColors,
): StudyPlot[] {
  const full = {
    ...Object.fromEntries(def.params.map(p => [p.key, p.default])),
    ...params,
  };
  try {
    return def.compute(klines, full, theme).filter(plot => plot.data.length > 0);
  } catch {
    return [];
  }
}
