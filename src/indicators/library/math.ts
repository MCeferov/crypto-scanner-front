/**
 * Ortaq hesablama primitivləri — indikator kitabxanasının bütün modulları
 * bunları paylaşır ki, eyni düstur iki yerdə fərqli yazılmasın.
 *
 * Bütün funksiyalar giriş massivi ilə EYNİ uzunluqda nəticə qaytarır;
 * hesablana bilməyən (warm-up) mövqelər NaN olur. Seriya qurarkən NaN-lar
 * atılır, ona görə qrafikdə boşluq yox, sadəcə gec başlanğıc görünür.
 */

export const NA = NaN;

export function isNum(v: number): boolean {
  return Number.isFinite(v);
}

/** Sadə hərəkətli orta */
export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NA);
  if (period < 1) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Eksponensial hərəkətli orta — ilk dəyər SMA ilə toxumlanır */
export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NA);
  if (period < 1 || values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder-in hamarlaması (RMA) — ATR, ADX, RSI ailəsi bunu istifadə edir */
export function rma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NA);
  if (period < 1 || values.length < period) return out;
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (prev * (period - 1) + values[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** Çəkili hərəkətli orta */
export function wma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NA);
  if (period < 1) return out;
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let acc = 0;
    for (let j = 0; j < period; j++) acc += values[i - j] * (period - j);
    out[i] = acc / denom;
  }
  return out;
}

/** Hull hərəkətli orta */
export function hma(values: number[], period: number): number[] {
  const half = wma(values, Math.max(1, Math.round(period / 2)));
  const full = wma(values, period);
  const diff = values.map((_, i) =>
    isNum(half[i]) && isNum(full[i]) ? 2 * half[i] - full[i] : NA,
  );
  const clean = diff.map(v => (isNum(v) ? v : 0));
  const res = wma(clean, Math.max(1, Math.round(Math.sqrt(period))));
  return res.map((v, i) => (isNum(diff[i]) && isNum(v) ? v : NA));
}

export type MaType = 'sma' | 'ema' | 'wma' | 'hma' | 'rma';

export function movingAverage(values: number[], period: number, type: MaType): number[] {
  switch (type) {
    case 'ema': return ema(values, period);
    case 'wma': return wma(values, period);
    case 'hma': return hma(values, period);
    case 'rma': return rma(values, period);
    default: return sma(values, period);
  }
}

/** Sürüşən pəncərədə standart kənarlaşma (population, TradingView ilə eyni) */
export function stdev(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NA);
  const means = sma(values, period);
  for (let i = period - 1; i < values.length; i++) {
    let acc = 0;
    for (let j = 0; j < period; j++) {
      const d = values[i - j] - means[i];
      acc += d * d;
    }
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

/** Sürüşən pəncərədə maksimum / minimum */
export function highest(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NA);
  for (let i = period - 1; i < values.length; i++) {
    let m = -Infinity;
    for (let j = 0; j < period; j++) m = Math.max(m, values[i - j]);
    out[i] = m;
  }
  return out;
}

export function lowest(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NA);
  for (let i = period - 1; i < values.length; i++) {
    let m = Infinity;
    for (let j = 0; j < period; j++) m = Math.min(m, values[i - j]);
    out[i] = m;
  }
  return out;
}

/** True Range — ATR və Keltner üçün */
export function trueRange(high: number[], low: number[], close: number[]): number[] {
  const out = new Array<number>(high.length).fill(NA);
  for (let i = 0; i < high.length; i++) {
    if (i === 0) { out[i] = high[i] - low[i]; continue; }
    out[i] = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1]),
    );
  }
  return out;
}

/** Average True Range (Wilder) */
export function atr(high: number[], low: number[], close: number[], period: number): number[] {
  return rma(trueRange(high, low, close), period);
}

/** Wilder RSI — giriş ilə eyni uzunluqda, warm-up NaN */
export function rsi(values: number[], period: number): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(NA);
  if (period < 1 || n < period + 1) return out;

  const gains = new Array<number>(n).fill(0);
  const losses = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const ch = values[i] - values[i - 1];
    gains[i] = ch > 0 ? ch : 0;
    losses[i] = ch < 0 ? -ch : 0;
  }
  // i=0-da dəyişiklik yoxdur — Wilder ortalaması 1..period aralığından başlayır
  const ag = rma(gains.slice(1), period);
  const al = rma(losses.slice(1), period);
  for (let i = 0; i < ag.length; i++) {
    if (!isNum(ag[i]) || !isNum(al[i])) continue;
    // Tam düz seriya (nə qazanc, nə itki) neytraldır — 100 deyil
    out[i + 1] = al[i] === 0
      ? (ag[i] === 0 ? 50 : 100)
      : 100 - 100 / (1 + ag[i] / al[i]);
  }
  return out;
}

/** Commodity Channel Index — tipik qiymətin orta mütləq kənarlaşması ilə */
export function cci(typical: number[], period: number): number[] {
  const out = new Array<number>(typical.length).fill(NA);
  const avg = sma(typical, period);
  for (let i = period - 1; i < typical.length; i++) {
    let dev = 0;
    for (let j = 0; j < period; j++) dev += Math.abs(typical[i - j] - avg[i]);
    dev /= period;
    out[i] = dev === 0 ? 0 : (typical[i] - avg[i]) / (0.015 * dev);
  }
  return out;
}

/** Money Flow Index — həcmlə çəkilmiş RSI analoqu */
export function mfi(typical: number[], volume: number[], period: number): number[] {
  const out = new Array<number>(typical.length).fill(NA);
  for (let i = period; i < typical.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = typical[j] * volume[j];
      if (typical[j] > typical[j - 1]) pos += flow;
      else if (typical[j] < typical[j - 1]) neg += flow;
    }
    out[i] = neg === 0 ? (pos === 0 ? 50 : 100) : 100 - 100 / (1 + pos / neg);
  }
  return out;
}

/** Wilder DMI/ADX — +DI, -DI və ADX */
export function dmi(
  high: number[],
  low: number[],
  close: number[],
  period: number,
): { adx: number[]; diPlus: number[]; diMinus: number[] } {
  const n = high.length;
  const plusDM = new Array<number>(n).fill(0);
  const minusDM = new Array<number>(n).fill(0);

  for (let i = 1; i < n; i++) {
    const up = high[i] - high[i - 1];
    const down = low[i - 1] - low[i];
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
  }

  const smTr = rma(trueRange(high, low, close), period);
  const diPlus = rma(plusDM, period).map((v, i) => (isNum(v) && smTr[i] > 0 ? (100 * v) / smTr[i] : NA));
  const diMinus = rma(minusDM, period).map((v, i) => (isNum(v) && smTr[i] > 0 ? (100 * v) / smTr[i] : NA));

  const dx = diPlus.map((v, i) => {
    const sum = v + diMinus[i];
    return isNum(v) && isNum(diMinus[i]) && sum > 0 ? (100 * Math.abs(v - diMinus[i])) / sum : NA;
  });

  // rma() NaN qəbul etmir — warm-up kəsilir, nəticə öz yerinə qaytarılır
  const adx = new Array<number>(n).fill(NA);
  const firstValid = dx.findIndex(isNum);
  if (firstValid >= 0) {
    const tail = rma(dx.slice(firstValid), period);
    for (let i = 0; i < tail.length; i++) adx[firstValid + i] = tail[i];
  }

  return { adx, diPlus, diMinus };
}
