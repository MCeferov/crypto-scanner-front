import type { Kline } from '../../services/binanceApi';
import type { SignalDir } from '../signalLatch';
import { toPoints, type StudyDef, type StudyPlot } from './types';
import {
  NA, atr, cci, dmi, ema, isNum, mfi, rsi, sma, trueRange,
} from './math';

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

const fin = (v: number) => Number.isFinite(v);
const zeros = (n: number): SignalDir[] => new Array<SignalDir>(n).fill(0);

const ohlc = (k: Kline[]) => ({
  high: k.map(x => x.high),
  low: k.map(x => x.low),
  close: k.map(x => x.close),
});

const hlc3 = (k: Kline[]) => k.map(x => (x.high + x.low + x.close) / 3);

/**
 * ema()/sma() NaN qəbul etmir — zəncirvari hamarlamada warm-up hissəsi kəsilir
 * və nəticə öz mövqeyinə qaytarılır. Pine-dakı `ta.ema(ta.rsi(...))` davranışı.
 */
function chain(values: number[], period: number, kind: 'ema' | 'sma' = 'ema'): number[] {
  const out = new Array<number>(values.length).fill(NA);
  const first = values.findIndex(isNum);
  if (first < 0) return out;
  const f = kind === 'ema' ? ema : sma;
  const tail = f(values.slice(first), period);
  for (let i = 0; i < tail.length; i++) out[first + i] = tail[i];
  return out;
}

/** Davamlı vəziyyəti (a > b) trigger massivinə çevirir */
function relation(a: number[], b: number[]): SignalDir[] {
  const out = zeros(a.length);
  for (let i = 0; i < a.length; i++) {
    if (!fin(a[i]) || !fin(b[i])) continue;
    out[i] = a[i] > b[i] ? 1 : a[i] < b[i] ? -1 : 0;
  }
  return out;
}

// ══════════════════════════ UT Bot (ATR trailing stop) ══════════════════════

/**
 * Stop qiymətdən `keyValue × ATR` qədər aralıda sürünür və yalnız trend
 * istiqamətində hərəkət edir. Qiymət stop-u kəsəndə tərəf dəyişir.
 */
function calcUtBot(k: Kline[], keyValue: number, atrPeriod: number): number[] {
  const { high, low, close } = ohlc(k);
  const a = atr(high, low, close, atrPeriod);
  const out = new Array<number>(k.length).fill(NA);
  let prev = NaN;

  for (let i = 0; i < k.length; i++) {
    if (!fin(a[i])) continue;
    const nLoss = keyValue * a[i];
    const src = close[i];
    const srcPrev = i > 0 ? close[i - 1] : src;

    if (!fin(prev)) {
      // Pine `nz(stop[1], 0)` sıfırdan başlayır; qiymət müsbət olduğu üçün bu,
      // həmişə ilk şamda `src − nLoss` verir — birbaşa onunla toxumlayırıq.
      prev = src - nLoss;
      out[i] = prev;
      continue;
    }

    let st: number;
    if (src > prev && srcPrev > prev) st = Math.max(prev, src - nLoss);
    else if (src < prev && srcPrev < prev) st = Math.min(prev, src + nLoss);
    else st = src > prev ? src - nLoss : src + nLoss;

    out[i] = st;
    prev = st;
  }
  return out;
}

const utBotStudy: StudyDef = {
  key: 'utBot',
  label: 'UT Bot (ATR trailing stop)',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'keyValue', label: 'Həssaslıq (a)', min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: 'atrPeriod', label: 'ATR period', min: 2, max: 100, default: 10 },
  ],
  signalNote: 'Bağlanış trailing stop-un üstündə = AL, altında = SAT',
  compute(klines, p) {
    return [{
      id: 'utbot',
      title: `UT Bot ${p.keyValue}×${p.atrPeriod}`,
      type: 'line',
      color: C.neutral,
      lineWidth: 2,
      data: toPoints(klines, calcUtBot(klines, p.keyValue, p.atrPeriod)),
    }];
  },
  signal(klines, p) {
    // Stop bull fazada həmişə qiymətin altında, bear fazada üstündə qalır —
    // ona görə münasibət orijinaldakı `pos` dəyişəni ilə eynidir.
    return relation(klines.map(x => x.close), calcUtBot(klines, p.keyValue, p.atrPeriod));
  },
};

// ══════════════════════ Range Filter ailəsi ═════════════════════════════════

/** smoothrng: |Δqiymət|-in ikiqat hamarlanmış ortası × vuruq */
function smoothRange(values: number[], period: number, mult: number): number[] {
  const n = values.length;
  const chg = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) chg[i] = Math.abs(values[i] - values[i - 1]);
  const avrng = ema(chg, period);
  return chain(avrng, period * 2 - 1).map(v => (fin(v) ? v * mult : NA));
}

/**
 * rngfilt: qiymət filtrdən `r` qədər uzaqlaşmayana kimi filtr yerində qalır.
 * upward/downward sayğacları filtrin istiqamətini saxlayır, CondIni isə son
 * verilmiş siqnalı — bu, layihənin latch siyasəti ilə eynidir.
 */
function rangeFilterCore(src: number[], smrng: number[]) {
  const n = src.length;
  const filt = new Array<number>(n).fill(NA);
  const dirs = zeros(n);
  let prev = NaN;
  let up = 0;
  let dn = 0;
  let cond: SignalDir = 0;

  for (let i = 0; i < n; i++) {
    if (!fin(smrng[i])) continue;
    const x = src[i];
    const r = smrng[i];

    let f: number;
    if (!fin(prev)) {
      f = x;
    } else if (x > prev) {
      f = x - r < prev ? prev : x - r;
    } else {
      f = x + r > prev ? prev : x + r;
    }

    if (fin(prev)) {
      if (f > prev) { up += 1; dn = 0; }
      else if (f < prev) { dn += 1; up = 0; }
    }

    filt[i] = f;
    // Orijinaldakı iki budaq (`src > src[1]` və `src < src[1]`) eyni nəticəni
    // verir, ona görə şərt sadələşdirilib: qiymət filtrin hansı tərəfindədir.
    if (x > f && up > 0) cond = 1;
    else if (x < f && dn > 0) cond = -1;
    dirs[i] = cond;
    prev = f;
  }
  return { filt, dirs };
}

function rangeFilterPlots(
  klines: Kline[],
  filt: number[],
  smrng: number[],
  tag: string,
): StudyPlot[] {
  const hband = filt.map((v, i) => (fin(v) && fin(smrng[i]) ? v + smrng[i] : NA));
  const lband = filt.map((v, i) => (fin(v) && fin(smrng[i]) ? v - smrng[i] : NA));
  return [
    { id: `${tag}-high`, title: 'Üst hədəf', type: 'line', color: C.bull, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, hband) },
    { id: `${tag}-filt`, title: 'Filtr', type: 'line', color: C.mid, lineWidth: 2, data: toPoints(klines, filt) },
    { id: `${tag}-low`, title: 'Alt hədəf', type: 'line', color: C.bear, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, lband) },
  ];
}

const rangeFilterStudy: StudyDef = {
  key: 'rangeFilter',
  label: 'Range Filter (Buy/Sell)',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'period', label: 'Sampling period', min: 2, max: 400, default: 100 },
    { key: 'mult', label: 'Range vuruq', min: 0.1, max: 10, step: 0.1, default: 3 },
  ],
  signalNote: 'Qiymət filtrin üstündə və filtr qalxırsa = AL, altında və enirsə = SAT',
  compute(klines, p) {
    const src = klines.map(x => x.close);
    const smrng = smoothRange(src, p.period, p.mult);
    return rangeFilterPlots(klines, rangeFilterCore(src, smrng).filt, smrng, 'rf');
  },
  signal(klines, p) {
    const src = klines.map(x => x.close);
    return rangeFilterCore(src, smoothRange(src, p.period, p.mult)).dirs;
  },
};

/** Twin: sürətli və yavaş diapazonun ORTASI filtri idarə edir */
function twinRange(src: number[], p: Record<string, number>): number[] {
  const a = smoothRange(src, p.fastPeriod, p.fastMult);
  const b = smoothRange(src, p.slowPeriod, p.slowMult);
  return a.map((v, i) => (fin(v) && fin(b[i]) ? (v + b[i]) / 2 : NA));
}

const twinRangeStudy: StudyDef = {
  key: 'twinRange',
  label: 'Twin Range Filter',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'fastPeriod', label: 'Sürətli period', min: 2, max: 400, default: 27 },
    { key: 'fastMult', label: 'Sürətli vuruq', min: 0.1, max: 10, step: 0.1, default: 1.6 },
    { key: 'slowPeriod', label: 'Yavaş period', min: 2, max: 400, default: 55 },
    { key: 'slowMult', label: 'Yavaş vuruq', min: 0.1, max: 10, step: 0.1, default: 2 },
  ],
  signalNote: 'İki diapazonun ortası ilə qurulan filtr: qiymət üstündə = AL, altında = SAT',
  compute(klines, p) {
    const src = klines.map(x => x.close);
    const smrng = twinRange(src, p);
    return rangeFilterPlots(klines, rangeFilterCore(src, smrng).filt, smrng, 'trf');
  },
  signal(klines, p) {
    const src = klines.map(x => x.close);
    return rangeFilterCore(src, twinRange(src, p)).dirs;
  },
};

// ══════════════════════════════ QQE ═════════════════════════════════════════

/**
 * QQE: hamarlanmış RSI (RsiMa) + onun öz "ATR"-indən qurulan trailing bant.
 * Wilders_Period = RSI period × 2 − 1 (müəllifin orijinal seçimi).
 */
function calcQqe(closes: number[], rsiPeriod: number, sf: number, factor: number) {
  const n = closes.length;
  const rsiMa = chain(rsi(closes, rsiPeriod), sf);

  const atrRsi = new Array<number>(n).fill(NA);
  for (let i = 1; i < n; i++) {
    if (fin(rsiMa[i]) && fin(rsiMa[i - 1])) atrRsi[i] = Math.abs(rsiMa[i - 1] - rsiMa[i]);
  }

  const wilders = rsiPeriod * 2 - 1;
  const dar = chain(chain(atrRsi, wilders), wilders).map(v => (fin(v) ? v * factor : NA));

  const longband = new Array<number>(n).fill(NA);
  const shortband = new Array<number>(n).fill(NA);
  const tl = new Array<number>(n).fill(NA);
  const dirs = zeros(n);
  let trend: SignalDir = 1;

  const at = (arr: number[], i: number) => (i >= 0 && fin(arr[i]) ? arr[i] : 0);

  for (let i = 1; i < n; i++) {
    if (!fin(rsiMa[i]) || !fin(dar[i]) || !fin(rsiMa[i - 1])) continue;

    const newLong = rsiMa[i] - dar[i];
    const newShort = rsiMa[i] + dar[i];
    const prevLong = at(longband, i - 1);
    const prevShort = at(shortband, i - 1);

    longband[i] = rsiMa[i - 1] > prevLong && rsiMa[i] > prevLong
      ? Math.max(prevLong, newLong) : newLong;
    shortband[i] = rsiMa[i - 1] < prevShort && rsiMa[i] < prevShort
      ? Math.min(prevShort, newShort) : newShort;

    // Pine `cross(a, b)` istiqamətdən asılı deyil — işarə dəyişməsinə baxırıq
    const crossedShort = (rsiMa[i] - at(shortband, i - 1)) * (rsiMa[i - 1] - at(shortband, i - 2)) < 0;
    const crossedLong = (at(longband, i - 1) - rsiMa[i]) * (at(longband, i - 2) - rsiMa[i - 1]) < 0;
    if (crossedShort) trend = 1;
    else if (crossedLong) trend = -1;

    tl[i] = trend === 1 ? longband[i] : shortband[i];
    dirs[i] = trend;
  }

  return { rsiMa, tl, dirs };
}

const qqeStudy: StudyDef = {
  key: 'qqe',
  label: 'QQE siqnalları',
  group: 'momentum',
  placement: 'pane',
  paneHeight: 120,
  fixedRange: { min: 0, max: 100 },
  levels: [
    { value: 70, color: '#ef5350', title: 'OB' },
    { value: 50, color: '#787b86' },
    { value: 30, color: '#26a69a', title: 'OS' },
  ],
  params: [
    { key: 'rsiPeriod', label: 'RSI period', min: 2, max: 100, default: 14 },
    { key: 'smooth', label: 'RSI hamarlama', min: 1, max: 50, default: 5 },
    { key: 'factor', label: 'QQE faktoru', min: 0.5, max: 10, step: 0.001, default: 4.238 },
  ],
  signalNote: 'Hamarlanmış RSI trailing bandı yuxarı kəsir = AL, aşağı kəsir = SAT',
  compute(klines, p) {
    const { rsiMa, tl } = calcQqe(klines.map(x => x.close), p.rsiPeriod, p.smooth, p.factor);
    return [
      { id: 'qqe-rsi', title: 'RSI MA', type: 'line', color: C.fast, lineWidth: 2, data: toPoints(klines, rsiMa) },
      { id: 'qqe-tl', title: 'QQE TL', type: 'line', color: C.mid, lineWidth: 1, data: toPoints(klines, tl) },
    ];
  },
  signal(klines, p) {
    return calcQqe(klines.map(x => x.close), p.rsiPeriod, p.smooth, p.factor).dirs;
  },
};

// ═══════════════════════════ AlphaTrend ═════════════════════════════════════

/**
 * AlphaTrend: MFI (həcm varsa) və ya RSI 50-dən yuxarıdırsa dayaq xətti
 * `low − ATR×k`, əks halda müqavimət xətti `high + ATR×k` izlənir.
 * ATR burada Wilder deyil, TR-in SADƏ ortasıdır (müəllifin seçimi).
 */
function calcAlphaTrend(k: Kline[], coeff: number, period: number, forceRsi: boolean): number[] {
  const { high, low, close } = ohlc(k);
  const atrSma = sma(trueRange(high, low, close), period);
  const volumes = k.map(x => x.volume ?? 0);
  const hasVolume = volumes.some(v => v > 0);
  // Həcmsiz aktivdə (forex) MFI mənasızdır — müəllifin "no volume data"
  // rejimi kimi avtomatik RSI-yə keçirik.
  const momentum = forceRsi || !hasVolume ? rsi(close, period) : mfi(hlc3(k), volumes, period);

  const out = new Array<number>(k.length).fill(NA);
  let prev = NaN;

  for (let i = 0; i < k.length; i++) {
    if (!fin(atrSma[i]) || !fin(momentum[i])) continue;
    const upT = low[i] - atrSma[i] * coeff;
    const downT = high[i] + atrSma[i] * coeff;

    if (!fin(prev)) {
      // Orijinal `nz(AlphaTrend[1])` = 0 ilə başlayır və bear şamda xətti
      // sıfıra yapışdırır; biz ilk hesablanan dəyərlə toxumlayırıq.
      prev = momentum[i] >= 50 ? upT : downT;
      out[i] = prev;
      continue;
    }

    prev = momentum[i] >= 50
      ? (upT < prev ? prev : upT)
      : (downT > prev ? prev : downT);
    out[i] = prev;
  }
  return out;
}

const alphaTrendStudy: StudyDef = {
  key: 'alphaTrend',
  label: 'AlphaTrend',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'coeff', label: 'Vuruq', min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: 'period', label: 'Period', min: 2, max: 100, default: 14 },
    { key: 'forceRsi', label: 'MFI əvəzinə RSI (0/1)', min: 0, max: 1, default: 0 },
  ],
  signalNote: 'AlphaTrend 2 şam əvvəlki dəyərindən yuxarıdır = AL, aşağıdır = SAT',
  compute(klines, p) {
    const at = calcAlphaTrend(klines, p.coeff, p.period, p.forceRsi >= 0.5);
    const lagged = at.map((_, i) => (i >= 2 ? at[i - 2] : NA));
    return [
      { id: 'at-line', title: 'AlphaTrend', type: 'line', color: C.fast, lineWidth: 2, data: toPoints(klines, at) },
      { id: 'at-lag', title: 'AlphaTrend[2]', type: 'line', color: C.bear, lineWidth: 1, data: toPoints(klines, lagged) },
    ];
  },
  signal(klines, p) {
    const at = calcAlphaTrend(klines, p.coeff, p.period, p.forceRsi >= 0.5);
    const out = zeros(klines.length);
    for (let i = 2; i < at.length; i++) {
      if (!fin(at[i]) || !fin(at[i - 2])) continue;
      out[i] = at[i] > at[i - 2] ? 1 : at[i] < at[i - 2] ? -1 : 0;
    }
    return out;
  },
};

// ═══════════════════════════ RSI Bands ══════════════════════════════════════

/**
 * RSI Bands: "RSI dəqiq 70 (və ya 30) olması üçün qiymət NƏ QƏDƏR olmalıdır"
 * sualının cavabı. Wilder ortalamaları tərsinə həll olunur, nəticə qiymət
 * şkalasında iki xətt verir — qiymət üst xəttin üstündədirsə RSI > 70 deməkdir.
 */
function calcRsiBands(closes: number[], length: number, ob: number, os: number) {
  const n = closes.length;
  const up = new Array<number>(n).fill(0);
  const dn = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const ch = closes[i] - closes[i - 1];
    up[i] = ch > 0 ? ch : 0;
    dn[i] = ch < 0 ? -ch : 0;
  }

  // ep = 2×length − 1 EMA-sı Wilder RMA(length) ilə eynidir (müəllifin yazılışı)
  const ep = 2 * length - 1;
  const auc = ema(up, ep);
  const adc = ema(dn, ep);

  const upper = new Array<number>(n).fill(NA);
  const lower = new Array<number>(n).fill(NA);

  for (let i = 0; i < n; i++) {
    if (!fin(auc[i]) || !fin(adc[i])) continue;
    const band = (level: number) => {
      const x = (length - 1) * (adc[i] * level / (100 - level) - auc[i]);
      return x >= 0 ? closes[i] + x : closes[i] + x * (100 - level) / level;
    };
    upper[i] = band(ob);
    lower[i] = band(os);
  }
  return { upper, lower };
}

const rsiBandsStudy: StudyDef = {
  key: 'rsiBands',
  label: 'RSI Bands',
  group: 'momentum',
  placement: 'overlay',
  params: [
    { key: 'length', label: 'RSI period', min: 2, max: 100, default: 14 },
    { key: 'overbought', label: 'Overbought', min: 51, max: 99, default: 70 },
    { key: 'oversold', label: 'Oversold', min: 1, max: 49, default: 30 },
  ],
  signalNote: 'Bağlanış alt bandın altında (RSI < oversold) = AL, üst bandın üstündə = SAT',
  compute(klines, p) {
    const closes = klines.map(x => x.close);
    const { upper, lower } = calcRsiBands(closes, p.length, p.overbought, p.oversold);
    const mid = upper.map((v, i) => (fin(v) && fin(lower[i]) ? (v + lower[i]) / 2 : NA));
    return [
      { id: 'rsib-up', title: `RSI ${p.overbought}`, type: 'line', color: C.bear, lineWidth: 1, data: toPoints(klines, upper) },
      { id: 'rsib-mid', title: 'Orta', type: 'line', color: C.band, lineWidth: 1, lineStyle: 'dotted', data: toPoints(klines, mid) },
      { id: 'rsib-low', title: `RSI ${p.oversold}`, type: 'line', color: C.bull, lineWidth: 1, data: toPoints(klines, lower) },
    ];
  },
  signal(klines, p) {
    const closes = klines.map(x => x.close);
    const { upper, lower } = calcRsiBands(closes, p.length, p.overbought, p.oversold);
    const out = zeros(klines.length);
    for (let i = 0; i < closes.length; i++) {
      if (fin(lower[i]) && closes[i] < lower[i]) out[i] = 1;
      else if (fin(upper[i]) && closes[i] > upper[i]) out[i] = -1;
    }
    return out;
  },
};

// ═══════════════════ Trendlines with Breaks (pivot əsaslı) ══════════════════

/** values[p] öz ətrafındakı ±len şamın ekstremumudursa pivotdur */
function isPivot(values: number[], p: number, len: number, kind: 'high' | 'low'): boolean {
  if (p - len < 0 || p + len >= values.length) return false;
  for (let j = p - len; j <= p + len; j++) {
    if (j === p) continue;
    if (kind === 'high' ? values[j] > values[p] : values[j] < values[p]) return false;
  }
  return true;
}

/**
 * Pivot təsdiqlənən şamda xətt həmin pivotun qiymətinə "bərkidilir" və hər
 * yeni şamda ATR-dən götürülən meyllə uzadılır. Pivot yalnız `length` şam
 * sonra təsdiqləndiyi üçün heç bir gələcək məlumat istifadə olunmur.
 */
function calcTrendlines(k: Kline[], length: number, mult: number) {
  const { high, low, close } = ohlc(k);
  const a = atr(high, low, close, length);
  const n = k.length;
  const upper = new Array<number>(n).fill(NA);
  const lower = new Array<number>(n).fill(NA);
  const dirs = zeros(n);

  let up = NaN;
  let dn = NaN;
  let slopeUp = 0;
  let slopeDn = 0;

  for (let i = 0; i < n; i++) {
    const p = i - length;
    const slope = fin(a[i]) ? (a[i] / length) * mult : 0;

    if (p >= 0 && isPivot(high, p, length, 'high')) {
      up = high[p];
      slopeUp = slope;
    } else if (fin(up)) {
      up -= slopeUp;
    }

    if (p >= 0 && isPivot(low, p, length, 'low')) {
      dn = low[p];
      slopeDn = slope;
    } else if (fin(dn)) {
      dn += slopeDn;
    }

    upper[i] = up;
    lower[i] = dn;

    // Qırılma trigger-dir: latch onu əks qırılmaya qədər saxlayır
    if (fin(up) && close[i] > up) dirs[i] = 1;
    else if (fin(dn) && close[i] < dn) dirs[i] = -1;
  }
  return { upper, lower, dirs };
}

const trendlineStudy: StudyDef = {
  key: 'trendlineBreaks',
  label: 'Trendlines with Breaks',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'length', label: 'Pivot uzunluğu', min: 2, max: 100, default: 14 },
    { key: 'mult', label: 'Meyl vuruğu', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  signalNote: 'Enən müqavimət xətti yuxarı qırılırsa = AL, qalxan dayaq xətti aşağı qırılırsa = SAT',
  compute(klines, p) {
    const { upper, lower } = calcTrendlines(klines, p.length, p.mult);
    return [
      { id: 'tl-up', title: 'Müqavimət', type: 'line', color: C.bear, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, upper) },
      { id: 'tl-dn', title: 'Dayaq', type: 'line', color: C.bull, lineWidth: 1, lineStyle: 'dashed', data: toPoints(klines, lower) },
    ];
  },
  signal(klines, p) {
    return calcTrendlines(klines, p.length, p.mult).dirs;
  },
};

// ══════════════ Lorentzian Classification (ANN / kNN) ═══════════════════════

/** Sabit diapazonu 0–1-ə sıxır (ml.rescale) */
function rescale01(values: number[], oldMin: number, oldMax: number): number[] {
  const span = Math.max(oldMax - oldMin, 1e-10);
  return values.map(v => (fin(v) ? (v - oldMin) / span : NA));
}

/**
 * ml.normalize — indiyə qədər görülmüş min/max ilə 0–1 (yalnız keçmiş
 * məlumat istifadə olunur, ona görə prefiks-sabitdir).
 */
function normalizeRunning(values: number[]): number[] {
  let lo = Infinity;
  let hi = -Infinity;
  return values.map(v => {
    if (!fin(v)) return NA;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
    return (v - lo) / Math.max(hi - lo, 1e-10);
  });
}

/** ml.n_wt — WaveTrend (Lambert CI → EMA → SMA fərqi) normallaşdırılmış */
function nWt(src: number[], n1: number, n2: number): number[] {
  const ema1 = chain(ema(src, n1), 1);
  const absDiff = src.map((v, i) => (fin(ema1[i]) ? Math.abs(v - ema1[i]) : NA));
  const ema2 = chain(absDiff, n1);
  const ci = src.map((v, i) =>
    fin(ema1[i]) && fin(ema2[i]) && ema2[i] !== 0 ? (v - ema1[i]) / (0.015 * ema2[i]) : NA);
  const wt1 = chain(ci, n2);
  const wt2 = chain(wt1, 4, 'sma');
  return normalizeRunning(wt1.map((v, i) => (fin(v) && fin(wt2[i]) ? v - wt2[i] : NA)));
}

interface LorentzianOpts {
  neighbors: number;
  maxBars: number;
  useVolatility: boolean;
  useAdx: boolean;
  adxThreshold: number;
}

/**
 * Model: cari şamın 5 ölçülü "xüsusiyyət vektoru" tarixdəki şamlarla
 * Lorentzian məsafəsi (Σ log(1+|Δ|)) ilə müqayisə olunur; ən yaxın k qonşunun
 * etiketləri toplanır. Etiket = həmin şamda BİTMİŞ 4 şamlıq hərəkətin
 * istiqaməti (müəllifdəki `src[4] vs src[0]`), yəni gələcəyə baxılmır.
 *
 * ANN döngüsü orijinaldakı kimidir: `i % 4` şərti 4-ə bölünən indeksləri
 * ATLAYIR (müəllifin kodunda məhz belədir) və qonşu sayı dolanda hədd
 * məsafəsi siyahının 3/4 mövqeyindəki dəyərə qaldırılır.
 */
function calcLorentzian(k: Kline[], opts: LorentzianOpts) {
  const n = k.length;
  const { high, low, close } = ohlc(k);
  const typical = hlc3(k);

  const f1 = rescale01(chain(rsi(close, 14), 1), 0, 100);
  const f2 = nWt(typical, 10, 11);
  const f3 = normalizeRunning(chain(cci(close, 20), 1));
  const f4 = rescale01(dmi(high, low, close, 20).adx, 0, 100);
  const f5 = rescale01(chain(rsi(close, 9), 1), 0, 100);
  const features = [f1, f2, f3, f4, f5];

  // Etiket: 4 şam əvvəlki qiymətlə müqayisə (müəllifin işarə konvensiyası)
  const label = new Array<number>(n).fill(0);
  for (let i = 4; i < n; i++) {
    label[i] = close[i - 4] < close[i] ? -1 : close[i - 4] > close[i] ? 1 : 0;
  }

  // Filtrlər
  const recentAtr = atr(high, low, close, 1);
  const historicAtr = atr(high, low, close, 10);
  const adxSeries = dmi(high, low, close, 14).adx;

  const prediction = new Array<number>(n).fill(NA);
  const dirs = zeros(n);

  const ready = (i: number) => features.every(f => fin(f[i]));
  const firstReady = (() => {
    for (let i = 0; i < n; i++) if (ready(i)) return i;
    return n;
  })();

  const distances: number[] = [];
  const preds: number[] = [];
  const cutoff = Math.round((opts.neighbors * 3) / 4);

  for (let i = firstReady; i < n; i++) {
    if (!ready(i)) continue;

    distances.length = 0;
    preds.length = 0;
    let lastDistance = -1;
    const limit = Math.min(opts.maxBars - 1, i);

    for (let j = 0; j <= limit; j++) {
      if (j % 4 === 0 || !ready(j)) continue;
      let d = 0;
      for (let f = 0; f < features.length; f++) {
        d += Math.log(1 + Math.abs(features[f][i] - features[f][j]));
      }
      if (d < lastDistance) continue;

      lastDistance = d;
      distances.push(d);
      preds.push(label[j]);
      if (preds.length > opts.neighbors) {
        lastDistance = distances[Math.min(cutoff, distances.length - 1)];
        distances.shift();
        preds.shift();
      }
    }

    let sum = 0;
    for (const v of preds) sum += v;
    prediction[i] = sum;

    const volatilityOk = !opts.useVolatility
      || (fin(recentAtr[i]) && fin(historicAtr[i]) && recentAtr[i] > historicAtr[i]);
    const adxOk = !opts.useAdx || (fin(adxSeries[i]) && adxSeries[i] > opts.adxThreshold);

    if (sum > 0 && volatilityOk && adxOk) dirs[i] = 1;
    else if (sum < 0 && volatilityOk && adxOk) dirs[i] = -1;
  }

  return { prediction, dirs };
}

const lorentzianStudy: StudyDef = {
  key: 'lorentzian',
  label: 'Lorentzian Classification (ML)',
  group: 'momentum',
  placement: 'pane',
  paneHeight: 110,
  params: [
    { key: 'neighbors', label: 'Qonşu sayı (k)', min: 1, max: 20, default: 8 },
    { key: 'maxBars', label: 'Maksimum tarix', min: 100, max: 3000, step: 100, default: 1000 },
    { key: 'useVolatility', label: 'Volatillik filtri (0/1)', min: 0, max: 1, default: 1 },
    { key: 'useAdx', label: 'ADX filtri (0/1)', min: 0, max: 1, default: 0 },
    { key: 'adxThreshold', label: 'ADX həddi', min: 0, max: 60, default: 20 },
  ],
  signalNote: 'k ən yaxın tarixi şamın etiket cəmi müsbətdirsə = AL, mənfidirsə = SAT (filtrlər keçərsə)',
  compute(klines, p) {
    const { prediction } = calcLorentzian(klines, {
      neighbors: p.neighbors,
      maxBars: p.maxBars,
      useVolatility: p.useVolatility >= 0.5,
      useAdx: p.useAdx >= 0.5,
      adxThreshold: p.adxThreshold,
    });
    const data = toPoints(klines, prediction).map(pt => ({
      ...pt,
      color: pt.value > 0 ? C.bull : pt.value < 0 ? C.bear : C.band,
    }));
    return [{ id: 'lc-pred', title: 'Proqnoz', type: 'histogram', color: C.accent, data }];
  },
  signal(klines, p) {
    return calcLorentzian(klines, {
      neighbors: p.neighbors,
      maxBars: p.maxBars,
      useVolatility: p.useVolatility >= 0.5,
      useAdx: p.useAdx >= 0.5,
      adxThreshold: p.adxThreshold,
    }).dirs;
  },
};

// ═══════════════ MA Stack — "10 indikator bir yerdə" overlay ════════════════

/**
 * Efmus tipli overlay dəsti: EMA 20/55/75 + SMA 50/100/200 + həftəlik pivot.
 * Orijinal skript qapalı mənbədir — burada yalnız müəllifin açıq şəkildə
 * sadaladığı KOMPONENTLƏR klassik düsturlarla qurulub.
 *
 * Həftəlik pivot ƏVVƏLKİ tam həftənin H/L/C-sindən hesablanır, ona görə
 * cari həftə ərzində dəyişmir (repaint yoxdur).
 */
function weeklyPivot(k: Kline[]): number[] {
  const out = new Array<number>(k.length).fill(NA);
  const weekOf = (ms: number) => Math.floor((ms + 3 * 86_400_000) / (7 * 86_400_000));

  let current = weekOf(k[0]?.openTime ?? 0);
  let high = -Infinity;
  let low = Infinity;
  let close = NA;
  let pivot = NA;

  for (let i = 0; i < k.length; i++) {
    const w = weekOf(k[i].openTime);
    if (w !== current) {
      if (fin(close)) pivot = (high + low + close) / 3;
      current = w;
      high = -Infinity;
      low = Infinity;
    }
    high = Math.max(high, k[i].high);
    low = Math.min(low, k[i].low);
    close = k[i].close;
    out[i] = pivot;
  }
  return out;
}

const maStackStudy: StudyDef = {
  key: 'maStack',
  label: 'MA Stack (10-in-1 overlay)',
  group: 'trend',
  placement: 'overlay',
  params: [
    { key: 'ema1', label: 'EMA sürətli', min: 2, max: 400, default: 20 },
    { key: 'ema2', label: 'EMA orta', min: 2, max: 400, default: 55 },
    { key: 'ema3', label: 'EMA yavaş', min: 2, max: 400, default: 75 },
    { key: 'sma1', label: 'SMA orta', min: 2, max: 400, default: 50 },
    { key: 'sma2', label: 'SMA yavaş', min: 2, max: 400, default: 100 },
    { key: 'sma3', label: 'SMA trend', min: 2, max: 400, default: 200 },
    { key: 'pivot', label: 'Həftəlik pivot (0/1)', min: 0, max: 1, default: 1 },
  ],
  signalNote: 'Qiymət SMA 200-ün üstündə + sürətli EMA yavaşın üstündə = AL, tam əksi = SAT',
  compute(klines, p) {
    const closes = klines.map(x => x.close);
    const defs: Array<[string, number[], string, number]> = [
      [`EMA ${p.ema1}`, ema(closes, p.ema1), C.fast, 2],
      [`EMA ${p.ema2}`, ema(closes, p.ema2), C.mid, 1],
      [`EMA ${p.ema3}`, ema(closes, p.ema3), C.slow, 1],
      [`SMA ${p.sma1}`, sma(closes, p.sma1), C.accent, 1],
      [`SMA ${p.sma2}`, sma(closes, p.sma2), C.band, 1],
      [`SMA ${p.sma3}`, sma(closes, p.sma3), C.neutral, 2],
    ];
    const plots: StudyPlot[] = defs.map(([title, values, color, width], i) => ({
      id: `mas-${i}`,
      title,
      type: 'line' as const,
      color,
      lineWidth: width as 1 | 2,
      data: toPoints(klines, values),
    }));

    if (p.pivot >= 0.5) {
      plots.push({
        id: 'mas-pivot',
        title: 'Həftəlik pivot',
        type: 'line',
        color: C.bull,
        lineWidth: 1,
        lineStyle: 'dashed',
        data: toPoints(klines, weeklyPivot(klines)),
      });
    }
    return plots;
  },
  signal(klines, p) {
    const closes = klines.map(x => x.close);
    const fastMa = ema(closes, p.ema1);
    const slowMa = ema(closes, p.ema3);
    const trend = sma(closes, p.sma3);
    const out = zeros(klines.length);

    // Üç EMA-nın TAM sıralanmasını tələb etmək triggeri həddən nadir edirdi —
    // latch onda bütöv bir trendi köhnə istiqamətdə keçirirdi. İki şərt
    // (uzunmüddətli trend + sürətli/yavaş EMA) kifayət qədər seçicidir.
    for (let i = 0; i < closes.length; i++) {
      if (!fin(fastMa[i]) || !fin(slowMa[i]) || !fin(trend[i])) continue;
      if (closes[i] > trend[i] && fastMa[i] > slowMa[i]) out[i] = 1;
      else if (closes[i] < trend[i] && fastMa[i] < slowMa[i]) out[i] = -1;
    }
    return out;
  },
};

export const PRO_STUDIES: StudyDef[] = [
  utBotStudy, rangeFilterStudy, twinRangeStudy, alphaTrendStudy, trendlineStudy,
  maStackStudy, qqeStudy, rsiBandsStudy, lorentzianStudy,
];
