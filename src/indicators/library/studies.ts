/**
 * İndikator kitabxanası.
 *
 * Buradakı hər indikator öz klassik, açıq dərc olunmuş düsturundan yazılıb
 * (Wilder, Lambert, Bollinger, Donchian, Keltner, Ichimoku, Parabolic SAR və
 * s.). Bunlar onilliklərdir dərsliklərdə dərc olunmuş ictimai düsturlardır —
 * heç bir platformanın xüsusi kodundan köçürülməyib, lisenziya məhdudiyyəti
 * yoxdur.
 *
 * Quruluş — hər indikator üç hissədən ibarətdir:
 *   1) calc*()  — təmiz riyaziyyat, xam massivlər qaytarır
 *   2) compute() — həmin massivlərdən qrafik xətləri
 *   3) signal()  — HƏMİN massivlərdən siqnal istiqaməti
 *
 * 2 və 3 eyni calc*() nəticəsindən qidalanır, ona görə qrafikdə gördüyün
 * rəqəmlə siqnalın istifadə etdiyi rəqəm eyni olmağa məcburdur — biri
 * dəyişəndə digəri arxada qala bilmir.
 *
 * Yeni indikator əlavə etmək üçün STUDIES massivinə bir obyekt yaz.
 */

import type { Kline } from '../../services/binanceApi';
import type { ChartThemeColors } from '../../types/chart';
import type { SignalDir } from '../signalLatch';
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

const fin = (v: number) => Number.isFinite(v);
const zeros = (n: number): SignalDir[] => new Array<SignalDir>(n).fill(0);

/**
 * İki xəttin nisbətindən davamlı vəziyyət (a > b = AL).
 * Warm-up mövqeləri 0 qalır ki, latch erkən yanlış siqnal verməsin.
 */
function crossState(a: number[], b: number[]): SignalDir[] {
  const out = zeros(a.length);
  for (let i = 0; i < a.length; i++) {
    if (!fin(a[i]) || !fin(b[i])) continue;
    out[i] = a[i] > b[i] ? 1 : a[i] < b[i] ? -1 : 0;
  }
  return out;
}

/**
 * Bant kənarına toxunma — RSI oversold/overbought məntiqi ilə eyni:
 * alt bandın altı AL trigger-i, üst bandın üstü SAT trigger-i.
 */
function bandTouch(close: number[], upper: number[], lower: number[]): SignalDir[] {
  const out = zeros(close.length);
  for (let i = 0; i < close.length; i++) {
    if (fin(lower[i]) && close[i] < lower[i]) out[i] = 1;
    else if (fin(upper[i]) && close[i] > upper[i]) out[i] = -1;
  }
  return out;
}

/** Osilatorun həddləri kəsməsi (RSI tipli) */
function thresholdCross(values: number[], buyBelow: number, sellAbove: number): SignalDir[] {
  const out = zeros(values.length);
  for (let i = 0; i < values.length; i++) {
    if (!fin(values[i])) continue;
    if (values[i] < buyBelow) out[i] = 1;
    else if (values[i] > sellAbove) out[i] = -1;
  }
  return out;
}

// ══════════════════════════ Təmiz riyaziyyat ══════════════════════════

function calcMultiMa(
  closes: number[],
  lens: [number, number, number],
  kind: 'ema' | 'sma',
): [number[], number[], number[]] {
  const f = kind === 'ema' ? ema : sma;
  return [f(closes, lens[0]), f(closes, lens[1]), f(closes, lens[2])];
}

function calcBollinger(closes: number[], period: number, mult: number) {
  const basis = sma(closes, period);
  const dev = stdev(closes, period);
  return {
    basis,
    upper: basis.map((b, i) => (fin(b) ? b + mult * dev[i] : NA)),
    lower: basis.map((b, i) => (fin(b) ? b - mult * dev[i] : NA)),
  };
}

function calcKeltner(k: Kline[], period: number, atrPeriod: number, mult: number) {
  const { high, low, close } = ohlc(k);
  const basis = ema(close, period);
  const range = atr(high, low, close, atrPeriod);
  const band = (sign: 1 | -1) =>
    basis.map((b, i) => (fin(b) && fin(range[i]) ? b + sign * mult * range[i] : NA));
  return { basis, upper: band(1), lower: band(-1) };
}

function calcDonchian(k: Kline[], period: number) {
  const { high, low } = ohlc(k);
  const upper = highest(high, period);
  const lower = lowest(low, period);
  return {
    upper,
    lower,
    mid: upper.map((u, i) => (fin(u) && fin(lower[i]) ? (u + lower[i]) / 2 : NA)),
  };
}

function calcIchimoku(k: Kline[], tenkanLen: number, kijunLen: number, senkouLen: number) {
  const { high, low } = ohlc(k);
  const midpoint = (len: number) => {
    const hi = highest(high, len);
    const lo = lowest(low, len);
    return hi.map((h, i) => (fin(h) && fin(lo[i]) ? (h + lo[i]) / 2 : NA));
  };
  const tenkan = midpoint(tenkanLen);
  const kijun = midpoint(kijunLen);
  return {
    tenkan,
    kijun,
    /** XAM senkou — i-ci şamda hesablanır, qrafikdə i+displacement-də görünür */
    senkouA: tenkan.map((t, i) => (fin(t) && fin(kijun[i]) ? (t + kijun[i]) / 2 : NA)),
    senkouB: midpoint(senkouLen),
  };
}

function calcParabolicSar(k: Kline[], step: number, max: number): number[] {
  const n = k.length;
  const out = new Array<number>(n).fill(NA);
  if (n < 3) return out;

  let bull = k[1].close >= k[0].close;
  let sar = bull ? k[0].low : k[0].high;
  let extreme = bull ? k[1].high : k[1].low;
  let accel = step;

  for (let i = 2; i < n; i++) {
    sar += accel * (extreme - sar);
    const prev = k[i - 1];
    const prev2 = k[i - 2];

    if (bull) {
      sar = Math.min(sar, prev.low, prev2.low);
      if (k[i].low < sar) {
        bull = false;
        sar = extreme;
        extreme = k[i].low;
        accel = step;
      } else if (k[i].high > extreme) {
        extreme = k[i].high;
        accel = Math.min(max, accel + step);
      }
    } else {
      sar = Math.max(sar, prev.high, prev2.high);
      if (k[i].high > sar) {
        bull = true;
        sar = extreme;
        extreme = k[i].high;
        accel = step;
      } else if (k[i].low < extreme) {
        extreme = k[i].low;
        accel = Math.min(max, accel + step);
      }
    }
    out[i] = sar;
  }
  return out;
}

function calcDmi(k: Kline[], period: number) {
  const { high, low, close } = ohlc(k);
  const n = k.length;
  const plusDM = new Array<number>(n).fill(0);
  const minusDM = new Array<number>(n).fill(0);

  for (let i = 1; i < n; i++) {
    const up = high[i] - high[i - 1];
    const down = low[i - 1] - low[i];
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
  }

  const smTr = rma(trueRange(high, low, close), period);
  const diPlus = rma(plusDM, period).map((v, i) => (fin(v) && smTr[i] > 0 ? (100 * v) / smTr[i] : NA));
  const diMinus = rma(minusDM, period).map((v, i) => (fin(v) && smTr[i] > 0 ? (100 * v) / smTr[i] : NA));

  const dx = diPlus.map((v, i) => {
    const sum = v + diMinus[i];
    return fin(v) && fin(diMinus[i]) && sum > 0 ? (100 * Math.abs(v - diMinus[i])) / sum : NA;
  });

  // rma() NaN qəbul etmir — warm-up kəsilir, nəticə öz yerinə qaytarılır
  const adx = new Array<number>(n).fill(NA);
  const firstValid = dx.findIndex(fin);
  if (firstValid >= 0) {
    const tail = rma(dx.slice(firstValid), period);
    for (let i = 0; i < tail.length; i++) adx[firstValid + i] = tail[i];
  }

  return { adx, diPlus, diMinus };
}

function calcCci(k: Kline[], period: number): number[] {
  const tp = typicalPrice(k);
  const avg = sma(tp, period);
  const out = new Array<number>(k.length).fill(NA);
  for (let i = period - 1; i < tp.length; i++) {
    let dev = 0;
    for (let j = 0; j < period; j++) dev += Math.abs(tp[i - j] - avg[i]);
    dev /= period;
    out[i] = dev === 0 ? 0 : (tp[i] - avg[i]) / (0.015 * dev);
  }
  return out;
}

function calcMfi(k: Kline[], period: number): number[] {
  const tp = typicalPrice(k);
  const out = new Array<number>(k.length).fill(NA);
  for (let i = period; i < k.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = tp[j] * k[j].volume;
      if (tp[j] > tp[j - 1]) pos += flow;
      else if (tp[j] < tp[j - 1]) neg += flow;
    }
    out[i] = neg === 0 ? (pos === 0 ? 50 : 100) : 100 - 100 / (1 + pos / neg);
  }
  return out;
}

function calcWilliamsR(k: Kline[], period: number): number[] {
  const { high, low, close } = ohlc(k);
  const hh = highest(high, period);
  const ll = lowest(low, period);
  return hh.map((h, i) => {
    if (!fin(h) || !fin(ll[i])) return NA;
    const range = h - ll[i];
    return range === 0 ? -50 : (-100 * (h - close[i])) / range;
  });
}

function calcObv(k: Kline[]): number[] {
  const out = new Array<number>(k.length).fill(NA);
  let acc = 0;
  for (let i = 0; i < k.length; i++) {
    if (i > 0) {
      const diff = k[i].close - k[i - 1].close;
      acc += diff > 0 ? k[i].volume : diff < 0 ? -k[i].volume : 0;
    }
    out[i] = acc;
  }
  return out;
}

/** Sessiya VWAP — hər UTC günü sıfırlanır (klassik davranış) */
function calcSessionVwap(k: Kline[], bandMult: number) {
  const tp = typicalPrice(k);
  const n = k.length;
  const vwap = new Array<number>(n).fill(NA);
  const upper = new Array<number>(n).fill(NA);
  const lower = new Array<number>(n).fill(NA);

  let day = -1;
  let pv = 0;
  let pv2 = 0;
  let vol = 0;

  for (let i = 0; i < n; i++) {
    const d = Math.floor(k[i].openTime / 86_400_000);
    if (d !== day) {
      day = d;
      pv = 0;
      pv2 = 0;
      vol = 0;
    }
    const v = k[i].volume;
    if (v > 0) {
      pv += tp[i] * v;
      pv2 += tp[i] * tp[i] * v;
      vol += v;
    }
    if (vol <= 0) continue;

    const mean = pv / vol;
    vwap[i] = mean;
    if (bandMult > 0) {
      const sd = Math.sqrt(Math.max(0, pv2 / vol - mean * mean)) * bandMult;
      upper[i] = mean + sd;
      lower[i] = mean - sd;
    }
  }
  return { vwap, upper, lower };
}

// ══════════════════════════ Overlay indikatorlar ══════════════════════════

const maParams = (f: number, m: number, s: number) => [
  { key: 'fast', label: 'Sürətli', min: 2, max: 400, default: f },
  { key: 'mid', label: 'Orta', min: 2, max: 400, default: m },
  { key: 'slow', label: 'Yavaş', min: 2, max: 400, default: s },
];

function maPlots(klines: Kline[], lines: [number[], number[], number[]], lens: number[], tag: string): StudyPlot[] {
  const colors = [C.fast, C.mid, C.slow];
  return lines.map((values, i) => ({
    id: `${tag}-${i}`,
    title: `${tag.toUpperCase()} ${lens[i]}`,
    type: 'line' as const,
    color: colors[i],
    lineWidth: 2 as const,
    data: toPoints(klines, values),
  }));
}

const emaStudy: StudyDef = {
  key: 'ema',
  label: 'EMA (3 xətt)',
  group: 'trend',
  placement: 'overlay',
  params: maParams(9, 21, 50),
  signalNote: 'Sürətli EMA yavaş EMA-nın üstündə = AL, altında = SAT',
  compute(klines, p) {
    const closes = klines.map(k => k.close);
    const lens: [number, number, number] = [p.fast, p.mid, p.slow];
    return maPlots(klines, calcMultiMa(closes, lens, 'ema'), lens, 'ema');
  },
  signal(klines, p) {
    const closes = klines.map(k => k.close);
    return crossState(ema(closes, p.fast), ema(closes, p.slow));
  },
};

const smaStudy: StudyDef = {
  key: 'sma',
  label: 'SMA (3 xətt)',
  group: 'trend',
  placement: 'overlay',
  params: maParams(50, 100, 200),
  signalNote: 'Sürətli SMA yavaş SMA-nın üstündə = AL, altında = SAT',
  compute(klines, p) {
    const closes = klines.map(k => k.close);
    const lens: [number, number, number] = [p.fast, p.mid, p.slow];
    return maPlots(klines, calcMultiMa(closes, lens, 'sma'), lens, 'sma');
  },
  signal(klines, p) {
    const closes = klines.map(k => k.close);
    return crossState(sma(closes, p.fast), sma(closes, p.slow));
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
  signalNote: 'Bağlanış alt bandın altında = AL, üst bandın üstündə = SAT (orta qayıdış)',
  compute(klines, p) {
    const { basis, upper, lower } = calcBollinger(klines.map(k => k.close), p.period, p.mult);
    return [
      { id: 'bb-upper', title: 'BB üst', type: 'line', color: C.band, lineWidth: 1, data: toPoints(klines, upper) },
      { id: 'bb-basis', title: 'BB orta', type: 'line', color: C.mid, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, basis) },
      { id: 'bb-lower', title: 'BB alt', type: 'line', color: C.band, lineWidth: 1, data: toPoints(klines, lower) },
    ];
  },
  signal(klines, p) {
    const closes = klines.map(k => k.close);
    const { upper, lower } = calcBollinger(closes, p.period, p.mult);
    return bandTouch(closes, upper, lower);
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
  signalNote: 'Bağlanış alt kanalın altında = AL, üst kanalın üstündə = SAT',
  compute(klines, p) {
    const { basis, upper, lower } = calcKeltner(klines, p.period, p.atrPeriod, p.mult);
    return [
      { id: 'kc-upper', title: 'KC üst', type: 'line', color: C.accent, lineWidth: 1, data: toPoints(klines, upper) },
      { id: 'kc-basis', title: 'KC orta', type: 'line', color: C.accent, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, basis) },
      { id: 'kc-lower', title: 'KC alt', type: 'line', color: C.accent, lineWidth: 1, data: toPoints(klines, lower) },
    ];
  },
  signal(klines, p) {
    const { upper, lower } = calcKeltner(klines, p.period, p.atrPeriod, p.mult);
    return bandTouch(klines.map(k => k.close), upper, lower);
  },
};

const donchianStudy: StudyDef = {
  key: 'donchian',
  label: 'Donchian Channels',
  group: 'volatility',
  placement: 'overlay',
  params: [{ key: 'period', label: 'Period', min: 2, max: 300, default: 20 }],
  signalNote: 'Bağlanış ƏVVƏLKİ şamın kanalını yuxarı qırırsa = AL, aşağı qırırsa = SAT (Turtle)',
  compute(klines, p) {
    const { upper, lower, mid } = calcDonchian(klines, p.period);
    return [
      { id: 'dc-upper', title: 'DC üst', type: 'line', color: C.bull, lineWidth: 1, data: toPoints(klines, upper) },
      { id: 'dc-mid', title: 'DC orta', type: 'line', color: C.band, lineWidth: 1, lineStyle: 'dotted', data: toPoints(klines, mid) },
      { id: 'dc-lower', title: 'DC alt', type: 'line', color: C.bear, lineWidth: 1, data: toPoints(klines, lower) },
    ];
  },
  signal(klines, p) {
    // Cari şamın kanalı öz high/low-unu ehtiva edir — qırılma yalnız ƏVVƏLKİ
    // şamın kanalına qarşı ölçülə bilər, əks halda heç vaxt trigger olmaz.
    const { upper, lower } = calcDonchian(klines, p.period);
    const out = zeros(klines.length);
    for (let i = 1; i < klines.length; i++) {
      const c = klines[i].close;
      if (fin(upper[i - 1]) && c > upper[i - 1]) out[i] = 1;
      else if (fin(lower[i - 1]) && c < lower[i - 1]) out[i] = -1;
    }
    return out;
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
  signalNote: 'Qiymət buludun üstündə + Tenkan > Kijun = AL; buludun altında + Tenkan < Kijun = SAT',
  compute(klines, p) {
    const { tenkan, kijun, senkouA, senkouB } = calcIchimoku(klines, p.tenkan, p.kijun, p.senkou);
    const closes = klines.map(k => k.close);
    const d = p.displacement;
    return [
      { id: 'ich-tenkan', title: 'Tenkan', type: 'line', color: C.fast, lineWidth: 1, data: toPoints(klines, tenkan) },
      { id: 'ich-kijun', title: 'Kijun', type: 'line', color: C.bear, lineWidth: 1, data: toPoints(klines, kijun) },
      { id: 'ich-senkou-a', title: 'Senkou A', type: 'line', color: C.bull, lineWidth: 1, data: toPoints(klines, senkouA, d) },
      { id: 'ich-senkou-b', title: 'Senkou B', type: 'line', color: C.slow, lineWidth: 1, data: toPoints(klines, senkouB, d) },
      { id: 'ich-chikou', title: 'Chikou', type: 'line', color: C.band, lineWidth: 1, lineStyle: 'dotted', data: toPoints(klines, closes, -d) },
    ];
  },
  signal(klines, p) {
    const { tenkan, kijun, senkouA, senkouB } = calcIchimoku(klines, p.tenkan, p.kijun, p.senkou);
    const out = zeros(klines.length);
    const d = p.displacement;

    for (let i = 0; i < klines.length; i++) {
      // i-ci şamda GÖRÜNƏN bulud i-d şamında hesablanıb. senkouA[i] istifadə
      // etmək gələcəyə baxmaq olardı — siqnal repaint edərdi.
      const src = i - d;
      if (src < 0) continue;
      const a = senkouA[src];
      const b = senkouB[src];
      if (!fin(a) || !fin(b) || !fin(tenkan[i]) || !fin(kijun[i])) continue;

      const top = Math.max(a, b);
      const bottom = Math.min(a, b);
      const c = klines[i].close;
      if (c > top && tenkan[i] > kijun[i]) out[i] = 1;
      else if (c < bottom && tenkan[i] < kijun[i]) out[i] = -1;
    }
    // Chikou span siqnalda İŞTİRAK ETMİR: onu qiymətlə müqayisə etmək
    // d şam gələcək məlumat tələb edir, yəni real vaxtda mövcud deyil.
    return out;
  },
};

const vwapStudy: StudyDef = {
  key: 'vwap',
  label: 'VWAP (sessiya)',
  group: 'volume',
  placement: 'overlay',
  needsVolume: true,
  params: [{ key: 'bands', label: 'σ bant', min: 0, max: 4, step: 0.5, default: 1 }],
  signalNote: 'Bağlanış VWAP-ın üstündə = AL, altında = SAT',
  compute(klines, p) {
    const { vwap, upper, lower } = calcSessionVwap(klines, p.bands);
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
  signal(klines, p) {
    const { vwap } = calcSessionVwap(klines, p.bands);
    return crossState(klines.map(k => k.close), vwap);
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
  signalNote: 'SAR nöqtəsi qiymətin altında = AL, üstündə = SAT',
  compute(klines, p) {
    const data = toPoints(klines, calcParabolicSar(klines, p.step, p.max));
    if (data.length === 0) return [];
    return [{
      id: 'psar',
      title: 'PSAR',
      type: 'line',
      color: C.neutral,
      lineWidth: 1,
      pointsOnly: true,
      data,
    }];
  },
  signal(klines, p) {
    const sar = calcParabolicSar(klines, p.step, p.max);
    const out = zeros(klines.length);
    for (let i = 0; i < klines.length; i++) {
      if (!fin(sar[i])) continue;
      out[i] = sar[i] < klines[i].close ? 1 : sar[i] > klines[i].close ? -1 : 0;
    }
    return out;
  },
};

// ══════════════════════════ Panel indikatorları ══════════════════════════

const adxStudy: StudyDef = {
  key: 'adx',
  label: 'ADX / DMI',
  group: 'momentum',
  placement: 'pane',
  paneHeight: 110,
  levels: [{ value: 25, color: 'rgba(150,150,150,0.5)', title: '25' }],
  params: [
    { key: 'period', label: 'Period', min: 2, max: 100, default: 14 },
    { key: 'minAdx', label: 'Min ADX', min: 0, max: 60, default: 20 },
  ],
  signalNote: 'ADX ≥ həddi olduqda: +DI > −DI = AL, −DI > +DI = SAT (ADX-in özü istiqamət vermir)',
  compute(klines, p) {
    const { adx, diPlus, diMinus } = calcDmi(klines, p.period);
    return [
      { id: 'adx', title: 'ADX', type: 'line', color: C.slow, lineWidth: 2, data: toPoints(klines, adx) },
      { id: 'di-plus', title: '+DI', type: 'line', color: C.bull, lineWidth: 1, data: toPoints(klines, diPlus) },
      { id: 'di-minus', title: '-DI', type: 'line', color: C.bear, lineWidth: 1, data: toPoints(klines, diMinus) },
    ];
  },
  signal(klines, p) {
    const { adx, diPlus, diMinus } = calcDmi(klines, p.period);
    const out = zeros(klines.length);
    for (let i = 0; i < klines.length; i++) {
      // ADX trendin GÜCÜdür, istiqaməti yox — filtr kimi işlədilir,
      // istiqamət yalnız DI cütündən gəlir.
      if (!fin(adx[i]) || adx[i] < p.minAdx) continue;
      if (!fin(diPlus[i]) || !fin(diMinus[i])) continue;
      out[i] = diPlus[i] > diMinus[i] ? 1 : diPlus[i] < diMinus[i] ? -1 : 0;
    }
    return out;
  },
};

const cciStudy: StudyDef = {
  key: 'cci',
  label: 'CCI',
  group: 'momentum',
  placement: 'pane',
  paneHeight: 100,
  levels: [
    { value: 100, color: 'rgba(38,166,154,0.6)', title: '+100' },
    { value: -100, color: 'rgba(239,83,80,0.6)', title: '-100' },
  ],
  params: [{ key: 'period', label: 'Period', min: 2, max: 200, default: 20 }],
  signalNote: 'CCI > +100 = AL, < −100 = SAT (Lambert-in orijinal trend interpretasiyası)',
  compute(klines, p) {
    return [{
      id: 'cci',
      title: `CCI ${p.period}`,
      type: 'line',
      color: C.neutral,
      lineWidth: 2,
      data: toPoints(klines, calcCci(klines, p.period)),
    }];
  },
  signal(klines, p) {
    // DİQQƏT: Lambert-in orijinal qaydası TREND ardıcıllığıdır — +100-ün
    // üstü güclü yüksəliş başlanğıcı sayılır, "overbought satış" DEYİL.
    // Bollinger/RSI-dəki orta-qayıdış məntiqinin ƏKSİDİR, qəsdən belədir.
    const values = calcCci(klines, p.period);
    const out = zeros(values.length);
    for (let i = 0; i < values.length; i++) {
      if (!fin(values[i])) continue;
      if (values[i] > 100) out[i] = 1;
      else if (values[i] < -100) out[i] = -1;
    }
    return out;
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
  params: [
    { key: 'period', label: 'Period', min: 2, max: 100, default: 14 },
    { key: 'oversold', label: 'Oversold', min: 1, max: 49, default: 20 },
    { key: 'overbought', label: 'Overbought', min: 51, max: 99, default: 80 },
  ],
  signalNote: 'MFI oversold həddinin altında = AL, overbought həddinin üstündə = SAT',
  compute(klines, p) {
    return [{
      id: 'mfi',
      title: `MFI ${p.period}`,
      type: 'line',
      color: C.accent,
      lineWidth: 2,
      data: toPoints(klines, calcMfi(klines, p.period)),
    }];
  },
  signal(klines, p) {
    return thresholdCross(calcMfi(klines, p.period), p.oversold, p.overbought);
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
  params: [
    { key: 'period', label: 'Period', min: 2, max: 200, default: 14 },
    { key: 'oversold', label: 'Oversold', min: -99, max: -51, default: -80 },
    { key: 'overbought', label: 'Overbought', min: -49, max: -1, default: -20 },
  ],
  signalNote: '%R oversold həddinin altında = AL, overbought həddinin üstündə = SAT',
  compute(klines, p) {
    return [{
      id: 'willr',
      title: `%R ${p.period}`,
      type: 'line',
      color: C.mid,
      lineWidth: 2,
      data: toPoints(klines, calcWilliamsR(klines, p.period)),
    }];
  },
  signal(klines, p) {
    return thresholdCross(calcWilliamsR(klines, p.period), p.oversold, p.overbought);
  },
};

const obvStudy: StudyDef = {
  key: 'obv',
  label: 'On-Balance Volume',
  group: 'volume',
  placement: 'pane',
  paneHeight: 100,
  needsVolume: true,
  params: [
    { key: 'smooth', label: 'Hamarlama (0 = yox)', min: 0, max: 100, default: 0 },
    { key: 'signalMa', label: 'Siqnal MA', min: 2, max: 200, default: 20 },
  ],
  signalNote: 'OBV öz siqnal MA-sının üstündə = AL, altında = SAT',
  compute(klines, p) {
    const obv = calcObv(klines);
    const plots: StudyPlot[] = [
      { id: 'obv', title: 'OBV', type: 'line', color: C.fast, lineWidth: 2, data: toPoints(klines, obv) },
    ];
    if (p.smooth >= 2) {
      plots.push({
        id: 'obv-ma',
        title: `OBV MA ${p.smooth}`,
        type: 'line',
        color: C.mid,
        lineWidth: 1,
        data: toPoints(klines, ema(obv, p.smooth)),
      });
    }
    return plots;
  },
  signal(klines, p) {
    // Siqnal MA display "smooth" parametrindən ASILI DEYİL — smooth 0 olanda
    // da (yəni MA çəkilməyəndə) siqnal işləməlidir.
    const obv = calcObv(klines);
    return crossState(obv, ema(obv, p.signalMa));
  },
};

const atrStudy: StudyDef = {
  key: 'atr',
  label: 'ATR',
  group: 'volatility',
  placement: 'pane',
  paneHeight: 90,
  params: [{ key: 'period', label: 'Period', min: 2, max: 100, default: 14 }],
  // signal() QƏSDƏN yoxdur: ATR sırf volatillik ölçüsüdür, istiqaməti yoxdur.
  // Ona "AL/SAT" mənası vermək uydurma olardı, ona görə siqnal siyahısında
  // ümumiyyətlə görünmür.
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

/** Siqnal mühərrikində iştirak edə bilən indikatorlar */
export const SIGNAL_STUDIES: StudyDef[] = STUDIES.filter(d => typeof d.signal === 'function');

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

/** Çatışmayan parametrləri default ilə doldurur */
export function studyParams(def: StudyDef, params?: Record<string, number>): Record<string, number> {
  return {
    ...Object.fromEntries(def.params.map(p => [p.key, p.default])),
    ...params,
  };
}

/** Qrafik xətləri; xəta baş verərsə seriya boş qalır, qrafik çökmür */
export function computeStudy(
  def: StudyDef,
  klines: Kline[],
  params: Record<string, number>,
  theme: ChartThemeColors,
): StudyPlot[] {
  try {
    return def.compute(klines, studyParams(def, params), theme).filter(plot => plot.data.length > 0);
  } catch {
    return [];
  }
}

/**
 * Siqnal trigger massivi — həmişə klines ilə eyni uzunluqda.
 * Xəta və ya signal() olmaması halında hamısı 0 (trigger yoxdur).
 */
export function computeStudySignal(
  def: StudyDef,
  klines: Kline[],
  params: Record<string, number>,
): SignalDir[] {
  if (!def.signal) return zeros(klines.length);
  try {
    const dirs = def.signal(klines, studyParams(def, params));
    if (dirs.length === klines.length) return dirs;
    // Uzunluq uyuşmursa sona hizala — qısa massiv warm-up boşluğu deməkdir
    const out = zeros(klines.length);
    const offset = klines.length - dirs.length;
    for (let i = 0; i < dirs.length; i++) {
      if (offset + i >= 0) out[offset + i] = dirs[i];
    }
    return out;
  } catch {
    return zeros(klines.length);
  }
}
