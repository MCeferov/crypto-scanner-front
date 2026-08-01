import type { Kline } from '../services/binanceApi';

/**
 * Klassik qrafik formasiyalarının avtomatik aşkarlanması.
 *
 * Bütün formasiyalar YALNIZ təsdiqdən (neckline/sərhəd qırılmasından) sonra
 * qaytarılır və təsdiq həmişə bağlanmış şam üzərində yoxlanılır. Formasiyanı
 * quran pivotlar da öz sağ pəncərəsi ilə təsdiqlənmiş olmalıdır — beləliklə
 * no repaint / no look-ahead qaydası pozulmur.
 */

export type PatternKind =
  | 'DOUBLE_TOP'
  | 'DOUBLE_BOTTOM'
  | 'TRIPLE_TOP'
  | 'TRIPLE_BOTTOM'
  | 'HEAD_SHOULDERS'
  | 'INV_HEAD_SHOULDERS'
  | 'ASC_TRIANGLE'
  | 'DESC_TRIANGLE'
  | 'SYM_TRIANGLE'
  | 'RISING_WEDGE'
  | 'FALLING_WEDGE';

export const PATTERN_LABELS: Record<PatternKind, string> = {
  DOUBLE_TOP: 'Double Top',
  DOUBLE_BOTTOM: 'Double Bottom',
  TRIPLE_TOP: 'Triple Top',
  TRIPLE_BOTTOM: 'Triple Bottom',
  HEAD_SHOULDERS: 'Head & Shoulders',
  INV_HEAD_SHOULDERS: 'Inverse H&S',
  ASC_TRIANGLE: 'Ascending Triangle',
  DESC_TRIANGLE: 'Descending Triangle',
  SYM_TRIANGLE: 'Symmetrical Triangle',
  RISING_WEDGE: 'Rising Wedge',
  FALLING_WEDGE: 'Falling Wedge',
};

export interface PatternPoint {
  /** Bar açılış vaxtı (saniyə) */
  time: number;
  price: number;
}

export interface ChartPattern {
  kind: PatternKind;
  label: string;
  direction: 'bullish' | 'bearish';
  /** Formasiyanın konturu — pivotlar ardıcıllıqla */
  outline: PatternPoint[];
  /** Neckline / sərhəd xətti (2 nöqtə) */
  guide: PatternPoint[] | null;
  /** Təsdiq (breakout) barının vaxtı */
  confirmTime: number;
  /** Ox işarəsinin bağlandığı qiymət (bullish → bar low, bearish → bar high) */
  arrowPrice: number;
  /** Ölçülmüş hədəf (measured move) */
  target: number | null;
}

export interface PatternConfig {
  pivotLeft: number;
  pivotRight: number;
  /** Bərabər sayılan zirvələr arasında maksimum fərq (ATR misli) */
  equalTolAtr: number;
  /** Formasiyanın maksimum eni (bar) */
  maxPatternBars: number;
  /** Təsdiq üçün maksimum gözləmə (bar) */
  maxConfirmBars: number;
  /** Qaytarılan maksimum formasiya sayı (ən yenilər) */
  maxPatterns: number;
  lookbackBars: number;
}

export const DEFAULT_PATTERN_CONFIG: PatternConfig = {
  pivotLeft: 4,
  pivotRight: 4,
  equalTolAtr: 1.0,
  maxPatternBars: 160,
  maxConfirmBars: 40,
  maxPatterns: 8,
  lookbackBars: 3000,
};

interface Pivot {
  index: number;
  price: number;
  type: 'high' | 'low';
  time: number;
}

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

function findPivots(klines: Kline[], left: number, right: number, from: number): Pivot[] {
  const out: Pivot[] = [];
  for (let i = Math.max(left, from); i < klines.length - right; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= left && (isHigh || isLow); j++) {
      if (klines[i].high <= klines[i - j].high) isHigh = false;
      if (klines[i].low >= klines[i - j].low) isLow = false;
    }
    for (let j = 1; j <= right && (isHigh || isLow); j++) {
      if (klines[i].high <= klines[i + j].high) isHigh = false;
      if (klines[i].low >= klines[i + j].low) isLow = false;
    }
    const time = Math.floor(klines[i].openTime / 1000);
    if (isHigh) out.push({ index: i, price: klines[i].high, type: 'high', time });
    else if (isLow) out.push({ index: i, price: klines[i].low, type: 'low', time });
  }
  return out;
}

/** Növbələşən zigzag: ardıcıl eyni tipli pivotlardan ən ekstremi saxlanılır */
function buildZigZag(pivots: Pivot[]): Pivot[] {
  const out: Pivot[] = [];
  for (const p of pivots) {
    const last = out[out.length - 1];
    if (!last) { out.push(p); continue; }
    if (last.type === p.type) {
      const better = p.type === 'high' ? p.price > last.price : p.price < last.price;
      if (better) out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
}

function lineAt(a: { index: number; price: number }, b: { index: number; price: number }, index: number): number {
  if (b.index === a.index) return a.price;
  const slope = (b.price - a.price) / (b.index - a.index);
  return a.price + slope * (index - a.index);
}

/**
 * Səviyyənin aşağı/yuxarı qırıldığı ilk bağlanmış şamı tapır.
 * `startIdx` formasiyanın son pivotunun TƏSDİQ barından sonra başlayır.
 */
function findBreak(
  klines: Kline[],
  startIdx: number,
  maxBars: number,
  level: (index: number) => number,
  side: 'below' | 'above',
): number | null {
  const end = Math.min(klines.length - 1, startIdx + maxBars);
  for (let j = startIdx; j <= end; j++) {
    const lv = level(j);
    if (side === 'below' && klines[j].close < lv) return j;
    if (side === 'above' && klines[j].close > lv) return j;
  }
  return null;
}

interface Ctx {
  klines: Kline[];
  zz: Pivot[];
  atr: number;
  cfg: PatternConfig;
}

function mkPattern(
  ctx: Ctx,
  kind: PatternKind,
  direction: 'bullish' | 'bearish',
  outlinePivots: Pivot[],
  guide: PatternPoint[] | null,
  confirmIdx: number,
  target: number | null,
): ChartPattern {
  const bar = ctx.klines[confirmIdx];
  return {
    kind,
    label: PATTERN_LABELS[kind],
    direction,
    outline: outlinePivots.map(p => ({ time: p.time, price: p.price })),
    guide,
    confirmTime: Math.floor(bar.openTime / 1000),
    arrowPrice: direction === 'bullish' ? bar.low : bar.high,
    target,
  };
}

/** İki qiymət ATR toleransı daxilində bərabərdirmi */
function nearlyEqual(a: number, b: number, atr: number, tolAtr: number): boolean {
  const tol = atr > 0 ? atr * tolAtr : Math.abs(a) * 0.015;
  return Math.abs(a - b) <= tol;
}

// ── Reversal formasiyaları ────────────────────────────────────────────────

function detectDoubleAndTriple(ctx: Ctx): ChartPattern[] {
  const { zz, klines, atr, cfg } = ctx;
  const out: ChartPattern[] = [];

  for (let i = 0; i + 2 < zz.length; i++) {
    // Double: [P1, V, P2] → P1,P2 eyni tip ekstremum, V aralarında
    const p1 = zz[i];
    const v = zz[i + 1];
    const p2 = zz[i + 2];
    if (p1.type === v.type || v.type === p2.type) continue;
    if (p2.index - p1.index > cfg.maxPatternBars) continue;
    if (!nearlyEqual(p1.price, p2.price, atr, cfg.equalTolAtr)) continue;

    const depth = Math.abs(p1.price - v.price);
    if (atr > 0 && depth < atr * 1.2) continue;

    const searchFrom = p2.index + cfg.pivotRight + 1;
    if (searchFrom >= klines.length) continue;

    // Triple: [P1, V1, P2, V2, P3]
    const v2 = zz[i + 3];
    const p3 = zz[i + 4];
    const isTriple = !!(v2 && p3
      && p3.type === p1.type
      && nearlyEqual(p3.price, p1.price, atr, cfg.equalTolAtr)
      && nearlyEqual(v2.price, v.price, atr, cfg.equalTolAtr * 1.5)
      && p3.index - p1.index <= cfg.maxPatternBars);

    if (p1.type === 'high') {
      const necklinePivot = isTriple ? (v.price < v2!.price ? v : v2!) : v;
      const last = isTriple ? p3! : p2;
      const from = last.index + cfg.pivotRight + 1;
      if (from >= klines.length) continue;
      const brk = findBreak(klines, from, cfg.maxConfirmBars, () => necklinePivot.price, 'below');
      if (brk === null) continue;
      const height = last.price - necklinePivot.price;
      out.push(mkPattern(
        ctx,
        isTriple ? 'TRIPLE_TOP' : 'DOUBLE_TOP',
        'bearish',
        isTriple ? [p1, v, p2, v2!, p3!] : [p1, v, p2],
        [
          { time: necklinePivot.time, price: necklinePivot.price },
          { time: Math.floor(klines[brk].openTime / 1000), price: necklinePivot.price },
        ],
        brk,
        necklinePivot.price - height,
      ));
      if (isTriple) i += 2;
    } else {
      const necklinePivot = isTriple ? (v.price > v2!.price ? v : v2!) : v;
      const last = isTriple ? p3! : p2;
      const from = last.index + cfg.pivotRight + 1;
      if (from >= klines.length) continue;
      const brk = findBreak(klines, from, cfg.maxConfirmBars, () => necklinePivot.price, 'above');
      if (brk === null) continue;
      const height = necklinePivot.price - last.price;
      out.push(mkPattern(
        ctx,
        isTriple ? 'TRIPLE_BOTTOM' : 'DOUBLE_BOTTOM',
        'bullish',
        isTriple ? [p1, v, p2, v2!, p3!] : [p1, v, p2],
        [
          { time: necklinePivot.time, price: necklinePivot.price },
          { time: Math.floor(klines[brk].openTime / 1000), price: necklinePivot.price },
        ],
        brk,
        necklinePivot.price + height,
      ));
      if (isTriple) i += 2;
    }
  }

  return out;
}

function detectHeadShoulders(ctx: Ctx): ChartPattern[] {
  const { zz, klines, atr, cfg } = ctx;
  const out: ChartPattern[] = [];

  for (let i = 0; i + 4 < zz.length; i++) {
    const ls = zz[i];
    const t1 = zz[i + 1];
    const head = zz[i + 2];
    const t2 = zz[i + 3];
    const rs = zz[i + 4];
    if (ls.type !== head.type || head.type !== rs.type) continue;
    if (t1.type === ls.type || t2.type === ls.type) continue;
    if (rs.index - ls.index > cfg.maxPatternBars) continue;

    const bearish = ls.type === 'high';

    if (bearish) {
      if (!(head.price > ls.price && head.price > rs.price)) continue;
      if (atr > 0 && head.price - Math.max(ls.price, rs.price) < atr * 0.8) continue;
    } else {
      if (!(head.price < ls.price && head.price < rs.price)) continue;
      if (atr > 0 && Math.min(ls.price, rs.price) - head.price < atr * 0.8) continue;
    }
    // Çiyinlər təxminən bərabər
    if (!nearlyEqual(ls.price, rs.price, atr, cfg.equalTolAtr * 1.6)) continue;

    const from = rs.index + cfg.pivotRight + 1;
    if (from >= klines.length) continue;
    const neckline = (idx: number) => lineAt(t1, t2, idx);
    const brk = findBreak(klines, from, cfg.maxConfirmBars, neckline, bearish ? 'below' : 'above');
    if (brk === null) continue;

    const necklineAtHead = neckline(head.index);
    const height = Math.abs(head.price - necklineAtHead);
    const necklineAtBreak = neckline(brk);

    out.push(mkPattern(
      ctx,
      bearish ? 'HEAD_SHOULDERS' : 'INV_HEAD_SHOULDERS',
      bearish ? 'bearish' : 'bullish',
      [ls, t1, head, t2, rs],
      [
        { time: t1.time, price: t1.price },
        { time: Math.floor(klines[brk].openTime / 1000), price: necklineAtBreak },
      ],
      brk,
      bearish ? necklineAtBreak - height : necklineAtBreak + height,
    ));
    i += 2;
  }

  return out;
}

// ── Triangle / Wedge ──────────────────────────────────────────────────────

/** Normallaşdırılmış meyl: bar başına faiz dəyişmə */
function normSlope(a: Pivot, b: Pivot): number {
  const bars = b.index - a.index;
  if (bars <= 0 || a.price === 0) return 0;
  return ((b.price - a.price) / a.price) / bars;
}

function detectTrianglesAndWedges(ctx: Ctx): ChartPattern[] {
  const { zz, klines, cfg } = ctx;
  const out: ChartPattern[] = [];
  const FLAT = 0.0004; // bar başına ~0.04% — "üfüqi" sayılır

  for (let i = 0; i + 4 < zz.length; i++) {
    const win = zz.slice(i, i + 5);
    const highs = win.filter(p => p.type === 'high');
    const lows = win.filter(p => p.type === 'low');
    if (highs.length < 2 || lows.length < 2) continue;

    const h1 = highs[0];
    const h2 = highs[highs.length - 1];
    const l1 = lows[0];
    const l2 = lows[lows.length - 1];
    const last = win[win.length - 1];
    if (last.index - win[0].index > cfg.maxPatternBars) continue;

    const sHigh = normSlope(h1, h2);
    const sLow = normSlope(l1, l2);

    const startRange = Math.abs(lineAt(h1, h2, win[0].index) - lineAt(l1, l2, win[0].index));
    const endRange = Math.abs(lineAt(h1, h2, last.index) - lineAt(l1, l2, last.index));
    const converging = endRange < startRange * 0.75 && endRange > 0;
    if (!converging) continue;

    let kind: PatternKind | null = null;
    let direction: 'bullish' | 'bearish' | null = null;
    let side: 'above' | 'below' | null = null;

    if (Math.abs(sHigh) <= FLAT && sLow > FLAT) {
      kind = 'ASC_TRIANGLE'; direction = 'bullish'; side = 'above';
    } else if (Math.abs(sLow) <= FLAT && sHigh < -FLAT) {
      kind = 'DESC_TRIANGLE'; direction = 'bearish'; side = 'below';
    } else if (sHigh > FLAT && sLow > FLAT && sLow > sHigh) {
      kind = 'RISING_WEDGE'; direction = 'bearish'; side = 'below';
    } else if (sHigh < -FLAT && sLow < -FLAT && sHigh < sLow) {
      kind = 'FALLING_WEDGE'; direction = 'bullish'; side = 'above';
    } else if (sHigh < -FLAT && sLow > FLAT) {
      kind = 'SYM_TRIANGLE'; direction = null; side = null;
    }
    if (!kind) continue;

    const from = last.index + cfg.pivotRight + 1;
    if (from >= klines.length) continue;

    let brk: number | null = null;
    if (kind === 'SYM_TRIANGLE') {
      const up = findBreak(klines, from, cfg.maxConfirmBars, idx => lineAt(h1, h2, idx), 'above');
      const down = findBreak(klines, from, cfg.maxConfirmBars, idx => lineAt(l1, l2, idx), 'below');
      if (up === null && down === null) continue;
      if (down === null || (up !== null && up <= down)) { brk = up; direction = 'bullish'; side = 'above'; }
      else { brk = down; direction = 'bearish'; side = 'below'; }
    } else {
      const level = side === 'above'
        ? (idx: number) => lineAt(h1, h2, idx)
        : (idx: number) => lineAt(l1, l2, idx);
      brk = findBreak(klines, from, cfg.maxConfirmBars, level, side!);
    }
    if (brk === null || !direction) continue;

    const height = Math.abs(lineAt(h1, h2, win[0].index) - lineAt(l1, l2, win[0].index));
    const breakLevel = side === 'above' ? lineAt(h1, h2, brk) : lineAt(l1, l2, brk);

    out.push(mkPattern(
      ctx,
      kind,
      direction,
      win,
      [
        { time: h1.time, price: h1.price },
        { time: h2.time, price: h2.price },
      ],
      brk,
      direction === 'bullish' ? breakLevel + height : breakLevel - height,
    ));
    i += 2;
  }

  return out;
}

export function detectChartPatterns(
  klines: Kline[],
  config: PatternConfig = DEFAULT_PATTERN_CONFIG,
): ChartPattern[] {
  const n = klines.length;
  if (n < config.pivotLeft + config.pivotRight + 40) return [];

  const from = Math.max(0, n - config.lookbackBars);
  const pivots = findPivots(klines, config.pivotLeft, config.pivotRight, from);
  const zz = buildZigZag(pivots);
  if (zz.length < 3) return [];

  const ctx: Ctx = { klines, zz, atr: atr14(klines), cfg: config };

  const all = [
    ...detectHeadShoulders(ctx),
    ...detectDoubleAndTriple(ctx),
    ...detectTrianglesAndWedges(ctx),
  ];

  // Eyni təsdiq barına düşən təkrarları at (H&S prioritetlidir — əvvəl gəlir)
  const seen = new Set<number>();
  const deduped: ChartPattern[] = [];
  for (const p of all.sort((a, b) => b.confirmTime - a.confirmTime)) {
    if (seen.has(p.confirmTime)) continue;
    seen.add(p.confirmTime);
    deduped.push(p);
  }

  return deduped.slice(0, config.maxPatterns);
}
