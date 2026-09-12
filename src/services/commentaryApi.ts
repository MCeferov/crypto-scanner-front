/**
 * "Tanınan şəxslərin fikirləri" mənbəyi.
 *
 * Bu servis YALNIZ öz backend-imizə müraciət edir (apiUrl → API_BASE). Backend
 * lazım olan mənbələri (X/Twitter, kripto xəbər API-ləri, YouTube və s.) özü
 * yığır və normallaşdırıb göndərir — belə ki:
 *   • heç bir üçüncü-tərəf API açarı brauzerə düşmür (hamısı serverdə qalır),
 *   • CSP connect-src yalnız öz backend-imizi allowlist-də saxlayır,
 *   • rate-limit / keşləmə / aqreqasiya bir yerdə olur.
 *
 * Frontend HEÇ NƏ uydurmur: yalnız backend-in qaytardığı, real mənbəyə
 * linklənən elementləri göstərir. Mənbəsi (url) və ya müəllifi olmayan element
 * təhlükəsizlik/dürüstlük üçün atılır.
 */

import { apiUrl } from './apiBase';

export type CommentarySource = 'x' | 'news' | 'youtube' | 'reddit' | 'blog' | 'other';
export type CommentarySentiment = 'bullish' | 'bearish' | 'neutral';

export interface CommentaryItem {
  /** Sabit unikal id (dedupe + React key) */
  id: string;
  /** Fikrin müəllifi — real ad (məs. "Elon Musk") və ya nəşr adı */
  author: string;
  /** @handle / kanal / nəşr etiketi (opsional) */
  handle?: string;
  /** Hansı platformadan gəlir */
  source: CommentarySource;
  /** Mənbə etiketi (məs. "X", "CoinDesk") — yoxdursa source-dan törənir */
  sourceLabel?: string;
  /** Qısa başlıq (xəbər üçün) */
  title?: string;
  /** Fikrin mətni / xülasəsi — düz mətn kimi göstərilir (HTML deyil) */
  text: string;
  /** ORİJİNAL mənbəyə link — hər element yoxlanıla bilən olmalıdır */
  url: string;
  /** ISO tarix */
  publishedAt: string;
  /** Opsional meyl */
  sentiment?: CommentarySentiment;
}

export interface CommentaryResponse {
  items: CommentaryItem[];
}

const VALID_SOURCES: CommentarySource[] = ['x', 'news', 'youtube', 'reddit', 'blog', 'other'];
const VALID_SENTIMENTS: CommentarySentiment[] = ['bullish', 'bearish', 'neutral'];

/** Yalnız http(s) linklərə icazə — javascript:/data: kimi sxemlər rədd edilir */
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Naməlum JSON-u təhlükəsiz CommentaryItem-ə çevirir.
 * Müəllifi, mətni və ya KEÇƏRLİ mənbə linki olmayan element null qaytarır —
 * beləcə mənbəsiz/uydurma görünə biləcək heç nə göstərilmir.
 */
function parseItem(raw: unknown, index: number): CommentaryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const author = typeof r.author === 'string' ? r.author.trim() : '';
  const text = typeof r.text === 'string' ? r.text.trim()
    : typeof r.title === 'string' ? r.title.trim() : '';
  const url = r.url;

  if (!author || !text || !isSafeHttpUrl(url)) return null;

  const source = VALID_SOURCES.includes(r.source as CommentarySource)
    ? (r.source as CommentarySource) : 'other';
  const sentiment = VALID_SENTIMENTS.includes(r.sentiment as CommentarySentiment)
    ? (r.sentiment as CommentarySentiment) : undefined;

  const publishedAt = typeof r.publishedAt === 'string' && !Number.isNaN(Date.parse(r.publishedAt))
    ? r.publishedAt : '';

  return {
    id: typeof r.id === 'string' && r.id ? r.id : `${url}#${index}`,
    author,
    handle: typeof r.handle === 'string' ? r.handle.trim() : undefined,
    source,
    sourceLabel: typeof r.sourceLabel === 'string' ? r.sourceLabel.trim() : undefined,
    title: typeof r.title === 'string' ? r.title.trim() : undefined,
    text,
    url,
    publishedAt,
    sentiment,
  };
}

/**
 * Verilmiş aktiv üçün tanınan şəxslərin fikirlərini gətirir.
 * Backend hazır deyilsə və ya xəta olarsa boş massiv qaytarır — panel sadəcə
 * "məlumat yoxdur" göstərir, heç vaxt çökmür.
 */
export async function fetchCommentary(
  params: { symbol: string; name?: string; type?: string },
  signal?: AbortSignal,
): Promise<CommentaryItem[]> {
  const qs = new URLSearchParams({ symbol: params.symbol });
  if (params.name) qs.set('name', params.name);
  if (params.type) qs.set('type', params.type);

  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/commentary?${qs}`), { signal });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return [];
  }

  const rawItems = (json as CommentaryResponse)?.items;
  if (!Array.isArray(rawItems)) return [];

  const seen = new Set<string>();
  const out: CommentaryItem[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = parseItem(rawItems[i], i);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }

  // Ən yenilər əvvəldə
  out.sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
  return out;
}

const SOURCE_LABELS: Record<CommentarySource, string> = {
  x: 'X', news: 'Xəbər', youtube: 'YouTube', reddit: 'Reddit', blog: 'Bloq', other: 'Mənbə',
};

export function sourceLabelOf(item: CommentaryItem): string {
  return item.sourceLabel || SOURCE_LABELS[item.source];
}

/** Qısa nisbi vaxt — "3 saat əvvəl" kimi, AZ dilində */
export function timeAgoAz(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return 'indi';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'indicə';
  if (min < 60) return `${min} dəq əvvəl`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat əvvəl`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} gün əvvəl`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon} ay əvvəl`;
  return `${Math.floor(mon / 12)} il əvvəl`;
}
