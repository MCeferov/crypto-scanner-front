/**
 * Qırılma radarı — "hansı aktivdə indicə dəstək/dirənc xətti qırıldı?"
 *
 * Bu modul siqnal vermir, XƏBƏR verir: bazarda baş vermiş struktur hadisəsini
 * (yatay səviyyənin qırılması və ya ona yaxınlaşma) vaxtı ilə birlikdə
 * qaytarır ki, UI "1 saat əvvəl qızılda dəstək qırıldı" kimi göstərə bilsin.
 *
 * Səviyyələr necə qurulur:
 *   1) Təsdiqlənmiş pivot high/low tapılır (sağda və solda PIVOT_BARS şam).
 *      Pivot yalnız sağ tərəfdəki şamlar bağlandıqdan SONRA mövcud sayılır —
 *      ona görə hər pivotun `confirmedAt` indeksi var.
 *   2) Bir-birinə tolerans qədər yaxın pivotlar bir səviyyəyə yığılır;
 *      toxunuş sayı səviyyənin gücüdür. Ən azı MIN_TOUCHES toxunuş tələb
 *      olunur — bir dəfəlik iynə "xətt" sayılmır.
 *   3) Qırılma: şam səviyyənin o tayında BAĞLANIR, əvvəlki şam isə bu
 *      tayda idi. Səviyyə həmin şamdan ƏVVƏL təsdiqlənmiş olmalıdır.
 *
 * QAYDA (bütün siqnal modulları ilə eyni): heç bir hesablama gələcəyə
 * baxmır və forming (bağlanmamış) şam qiymətləndirilmir.
 */

import type { Kline } from '../services/binanceApi';

export type BreakoutKind =
  | 'resistance_break'
  | 'support_break'
  | 'near_resistance'
  | 'near_support';

export interface BreakoutEvent {
  kind: BreakoutKind;
  /** Qırılan / yaxınlaşılan səviyyənin qiyməti */
  level: number;
  /** Hadisə şamının bağlanış vaxtı (ms) — "1 saat əvvəl" bundan hesablanır */
  atMs: number;
  /** Hadisədən bəri neçə BAĞLANMIŞ şam keçib (0 = ən son bağlanan şam) */
  barsAgo: number;
  /** Cari qiymətin səviyyəyə faiz məsafəsi (işarəsiz) */
  distancePct: number;
  /** Səviyyəyə neçə pivot toxunub — nə qədər çoxdursa, xətt bir o qədər güclü */
  touches: number;
  /** Qırılma şamında həcm son 20 şamın ortasından yuxarı idi */
  volumeConfirmed: boolean;
  /** Qırılmadan sonra səviyyə geri test edilib və tutub */
  retest: boolean;
  /** Hadisənin hesablandığı timeframe — UI etiketi üçün */
  tf: string;
}

interface Level {
  price: number;
  touches: number;
  /** Səviyyənin mövcud sayıldığı ilk şam indeksi */
  confirmedAt: number;
}

/** Pivotun hər iki tərəfində tələb olunan şam sayı */
const PIVOT_BARS = 3;
/** Səviyyə sayılmaq üçün minimum toxunuş */
const MIN_TOUCHES = 2;
/** Neçə bağlanmış şam geriyə baxılır — bundan köhnə qırılma "xəbər" deyil */
const MAX_BARS_AGO = 48;
/** Həcm təsdiqi həddi — orta həcmin bu qədər misli */
const VOLUME_CONFIRM_MULT = 1.3;

/** Səviyyə toleransı: ATR-in payı, ATR yoxdursa qiymətin faizi */
function tolerance(price: number, atr: number | null): number {
  if (atr !== null && atr > 0) return atr * 0.35;
  return price * 0.0015;
}

/**
 * Təsdiqlənmiş pivotlar — `upper` true olduqda pivot high, əks halda low.
 * Qaytarılan `confirmedAt` = pivotun bilinə bildiyi ilk şam indeksi.
 */
function findPivots(klines: Kline[], upper: boolean): { value: number; confirmedAt: number }[] {
  const out: { value: number; confirmedAt: number }[] = [];

  for (let i = PIVOT_BARS; i < klines.length - PIVOT_BARS; i++) {
    const v = upper ? klines[i].high : klines[i].low;
    let isPivot = true;

    for (let j = 1; j <= PIVOT_BARS; j++) {
      const left = upper ? klines[i - j].high : klines[i - j].low;
      const right = upper ? klines[i + j].high : klines[i + j].low;
      // Solda ciddi, sağda bərabərliyə icazə — yatay ikili zirvələr itməsin
      if (upper ? (v <= left || v < right) : (v >= left || v > right)) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) out.push({ value: v, confirmedAt: i + PIVOT_BARS });
  }

  return out;
}

/**
 * Yaxın pivotları bir səviyyəyə yığır.
 * Səviyyə MIN_TOUCHES-inci toxunuş təsdiqlənəndə mövcud sayılır — ona görə
 * `confirmedAt` həmin toxunuşun təsdiq indeksidir, birincinin yox.
 */
function clusterLevels(
  pivots: { value: number; confirmedAt: number }[],
  tol: number,
): Level[] {
  if (pivots.length === 0) return [];

  const sorted = [...pivots].sort((a, b) => a.value - b.value);
  const groups: { value: number; confirmedAt: number }[][] = [];

  for (const p of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(p.value - last[0].value) <= tol) last.push(p);
    else groups.push([p]);
  }

  return groups
    .filter(g => g.length >= MIN_TOUCHES)
    .map(g => {
      const confirms = g.map(p => p.confirmedAt).sort((a, b) => a - b);
      return {
        price: g.reduce((s, p) => s + p.value, 0) / g.length,
        touches: g.length,
        confirmedAt: confirms[MIN_TOUCHES - 1],
      };
    });
}

/** Qırılma şamında həcm son 20 şamın ortasından yuxarıdırmı */
function volumeSpike(klines: Kline[], i: number): boolean {
  const from = Math.max(0, i - 20);
  if (i - from < 5) return false;
  let sum = 0;
  for (let j = from; j < i; j++) sum += klines[j].volume ?? 0;
  const avg = sum / (i - from);
  return avg > 0 && (klines[i].volume ?? 0) > avg * VOLUME_CONFIRM_MULT;
}

/**
 * Qırılmadan sonra səviyyə geri test olunubmu.
 * Dirənc qırılıbsa: sonrakı şamlardan biri səviyyəyə enib, amma ondan
 * yuxarıda bağlanıb (səviyyə indi dəstək kimi tutur) — və əksi.
 */
function hadRetest(klines: Kline[], breakIdx: number, level: number, tol: number, up: boolean): boolean {
  for (let i = breakIdx + 1; i < klines.length; i++) {
    const k = klines[i];
    if (up) {
      if (k.low <= level + tol && k.close > level) return true;
    } else if (k.high >= level - tol && k.close < level) {
      return true;
    }
  }
  return false;
}

export interface BreakoutInput {
  klines: Kline[];
  price: number;
  atr: number | null;
  tf: string;
  /** Bağlanmamış şamı kənarda saxlamaq üçün */
  nowMs?: number;
}

/**
 * Ən son struktur hadisəsini qaytarır: əvvəlcə real qırılma axtarılır,
 * tapılmasa qiymətin yaxınlaşdığı səviyyə "qırılmaya yaxın" kimi verilir.
 * Hadisə yoxdursa null.
 */
export function detectBreakoutEvent({
  klines,
  price,
  atr,
  tf,
  nowMs = Date.now(),
}: BreakoutInput): BreakoutEvent | null {
  // Yalnız bağlanmış şamlar — forming şam nə qırılma verə bilər, nə də yaş
  const closed = klines.filter(k => k.closeTime <= nowMs);
  if (closed.length < PIVOT_BARS * 2 + MIN_TOUCHES * 2 || price <= 0) return null;

  const tol = tolerance(price, atr);
  if (!(tol > 0)) return null;

  const resistances = clusterLevels(findPivots(closed, true), tol);
  const supports = clusterLevels(findPivots(closed, false), tol);
  if (resistances.length === 0 && supports.length === 0) return null;

  const last = closed.length - 1;
  const oldest = Math.max(1, last - MAX_BARS_AGO + 1);
  // Qərarlı bağlanış tələbi — səviyyənin üstündən sadəcə sürtünmə qırılma deyil
  const margin = tol * 0.25;

  for (let i = last; i >= oldest; i--) {
    const prev = closed[i - 1].close;
    const cur = closed[i].close;

    // Eyni şamda hər iki tərəf ola bilməz; yuxarı qırılma əvvəl yoxlanır
    const upLevel = resistances
      .filter(l => l.confirmedAt < i && prev <= l.price && cur > l.price + margin)
      .sort((a, b) => b.price - a.price)[0];

    const downLevel = supports
      .filter(l => l.confirmedAt < i && prev >= l.price && cur < l.price - margin)
      .sort((a, b) => a.price - b.price)[0];

    const hit = upLevel ?? downLevel;
    if (!hit) continue;

    const up = hit === upLevel;
    return {
      kind: up ? 'resistance_break' : 'support_break',
      level: hit.price,
      atMs: closed[i].closeTime,
      barsAgo: last - i,
      distancePct: Math.abs((price - hit.price) / hit.price) * 100,
      touches: hit.touches,
      volumeConfirmed: volumeSpike(closed, i),
      retest: hadRetest(closed, i, hit.price, tol, up),
      tf,
    };
  }

  // Qırılma yoxdur — qiymət hansı səviyyəyə sıxılıb?
  const nearBand = Math.max(tol * 2, price * 0.004);

  const above = resistances
    .filter(l => l.price > price && l.price - price <= nearBand)
    .sort((a, b) => a.price - b.price)[0];
  const below = supports
    .filter(l => l.price < price && price - l.price <= nearBand)
    .sort((a, b) => b.price - a.price)[0];

  // İkisi də yaxındırsa daha yaxını götür
  const near = above && below
    ? (above.price - price <= price - below.price ? above : below)
    : (above ?? below);
  if (!near) return null;

  return {
    kind: near === above ? 'near_resistance' : 'near_support',
    level: near.price,
    atMs: closed[last].closeTime,
    barsAgo: 0,
    distancePct: Math.abs((price - near.price) / near.price) * 100,
    touches: near.touches,
    volumeConfirmed: false,
    retest: false,
    tf,
  };
}
