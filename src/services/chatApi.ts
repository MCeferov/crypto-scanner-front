/**
 * AI köməkçi ilə söhbət — backend proxy üzərindən.
 *
 * LLM açarı HEÇ VAXT brauzerə düşmür: frontend yalnız öz backend-imizə
 * (apiUrl → API_BASE) POST edir, backend isə Claude-a müraciət edir və app-ın
 * necə işlədiyini izah edən sistem promptunu özü saxlayır.
 *
 * İki cavab formatı dəstəklənir, backend hansını versə:
 *   • SSE axını (text/event-stream): `data: {"delta":"..."}` ... `data: {"done":true}`
 *   • Sadə JSON: `{ "reply": "..." }`
 * Axın varsa mətn tədricən gəlir (onDelta), yoxsa bir dəfəyə.
 */

import { apiUrl } from './apiBase';
import { getStoredToken } from './authApi';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  /** Cari route — "bu səhifə nə edir" suallarına kontekst verir */
  path?: string;
  /** Açıq olan aktiv (varsa) — məs. DOGE */
  symbol?: string;
  /** UI dili */
  locale?: string;
}

export class ChatError extends Error {}

interface StreamOptions {
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

/** SSE `data:` sətrini emal edir; true qaytararsa axın bitib */
function handleSseData(payload: string, onDelta: (t: string) => void): boolean {
  const trimmed = payload.trim();
  if (!trimmed || trimmed === '[DONE]') return trimmed === '[DONE]';
  try {
    const msg = JSON.parse(trimmed) as { delta?: string; text?: string; done?: boolean; error?: string };
    if (msg.error) throw new ChatError(msg.error);
    if (msg.done) return true;
    const piece = msg.delta ?? msg.text;
    if (piece) onDelta(piece);
  } catch (err) {
    if (err instanceof ChatError) throw err;
    // Parse oluna bilməyən data sətri — xam mətn kimi göstər
    onDelta(payload);
  }
  return false;
}

export async function streamChat(
  messages: ChatMessage[],
  context: ChatContext,
  { onDelta, signal }: StreamOptions,
): Promise<string> {
  // Auth token-i əlavə et ki, backend chat-ı istifadəçi başına rate-limit edə
  // bilsin və anonim sui-istifadənin (pullu LLM proxy) qarşısını alsın.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, context }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ChatError('Köməkçiyə qoşulmaq alınmadı. İnternet bağlantısını yoxlayın.');
  }

  if (!res.ok) {
    // Backend-in daxili xətasını istifadəçiyə sızdırma — təhlükəsiz mesaj
    throw new ChatError(
      res.status === 429
        ? 'Çox sayda sorğu göndərildi. Bir az sonra yenidən cəhd edin.'
        : 'Köməkçi hazırda cavab verə bilmir. Bir az sonra yenidən cəhd edin.',
    );
  }

  const contentType = res.headers.get('content-type') ?? '';

  // ── Sadə JSON cavabı ──
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => null) as { reply?: string } | null;
    const reply = data?.reply ?? '';
    if (reply) onDelta(reply);
    return reply;
  }

  // ── Axın (SSE və ya düz mətn) ──
  if (!res.body) {
    const text = await res.text().catch(() => '');
    if (text) onDelta(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  const isSse = contentType.includes('text/event-stream');

  const collect = (piece: string) => { full += piece; onDelta(piece); };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      if (!isSse) {
        // Düz mətn axını — gələn hər parçanı əlavə et
        collect(buffer);
        buffer = '';
        continue;
      }

      // SSE: tam "event" blokları \n\n ilə ayrılır
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          if (handleSseData(line.slice(5), collect)) return full;
        }
      }
    }
    // Qalıq SSE data
    if (isSse && buffer.startsWith('data:')) handleSseData(buffer.slice(5), collect);
  } finally {
    reader.releaseLock();
  }

  return full;
}
