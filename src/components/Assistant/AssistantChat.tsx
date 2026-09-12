import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { MessageCircle, X, Send, Sparkles, RotateCcw } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { streamChat, ChatError, type ChatMessage } from '../../services/chatApi';

/** Söhbət route dəyişsə də itməsin deyə App kökündə qurulur */
interface UiMessage extends ChatMessage {
  id: string;
  pending?: boolean;
  error?: boolean;
}

const SUGGESTIONS = [
  'Bu səhifə nə işə yarayır?',
  'RSI siqnalı necə işləyir?',
  'Supertrend nə üçün istifadə olunur?',
  '"Tanınan fikirlər" bölməsi nədir?',
];

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** /coin/DOGEUSDT → DOGE kimi açıq aktivi route-dan çıxarır */
function symbolFromPath(path: string): string | undefined {
  const coin = path.match(/^\/coin\/([^/]+)/);
  if (coin) return decodeURIComponent(coin[1]).replace(/USDT$/i, '').toUpperCase();
  const asset = path.match(/^\/asset\/[^/]+\/([^/]+)/);
  if (asset) return decodeURIComponent(asset[1]).toUpperCase();
  return undefined;
}

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const [location] = useLocation();
  const { locale } = useLocale();
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const send = useCallback((text: string) => {
    const content = text.trim();
    if (!content || busy) return;

    const history = messages
      .filter(m => !m.error)
      .map(({ role, content: c }) => ({ role, content: c }));
    const userMsg: UiMessage = { id: uid(), role: 'user', content };
    const assistantId = uid();

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', pending: true },
    ]);
    setInput('');
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const append = (piece: string) =>
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: m.content + piece, pending: false } : m,
      ));

    streamChat([...history, { role: 'user', content }], {
      path: location,
      symbol: symbolFromPath(location),
      locale,
    }, { onDelta: append, signal: ctrl.signal })
      .then(full => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                pending: false,
                content: full || m.content
                  || 'Cavab ala bilmədim. Sualı başqa cür ifadə edin.',
              }
            : m,
        ));
      })
      .catch(err => {
        if (ctrl.signal.aborted) return;
        const msg = err instanceof ChatError
          ? err.message
          : 'Nəsə səhv getdi. Bir az sonra yenidən cəhd edin.';
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, pending: false, error: true, content: msg } : m,
        ));
      })
      .finally(() => {
        if (abortRef.current === ctrl) abortRef.current = null;
        setBusy(false);
      });
  }, [busy, messages, location, locale]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setMessages([]);
    setInput('');
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* Üzən düymə */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Köməkçini bağla' : 'AI köməkçi'}
        className="fixed bottom-4 right-4 z-[60] w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 8px 24px rgba(41,98,255,.35)' }}
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      {open && (
        <div
          className="fixed bottom-20 right-4 z-[60] flex flex-col rounded-2xl border overflow-hidden"
          style={{
            width: 'min(380px, calc(100vw - 2rem))',
            height: 'min(560px, calc(100vh - 7rem))',
            background: 'var(--surface)',
            borderColor: 'var(--chart-border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          {/* Başlıq */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--chart-border)' }}
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Sparkles size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI Köməkçi</div>
              <div className="text-[10px]" style={{ color: 'var(--muted)' }}>Sistem və terminlər barədə soruşun</div>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                title="Söhbəti təmizlə"
                className="p-1.5 rounded-md transition-colors hover:opacity-80"
                style={{ color: 'var(--muted)' }}
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>

          {/* Mesajlar */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed px-1" style={{ color: 'var(--muted)' }}>
                  Salam! Bu sistemdə hansısa tab, bölmə və ya indikator barədə sual verə bilərsiniz.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="text-left text-xs px-3 py-2 rounded-lg border transition-colors row-hover"
                      style={{ borderColor: 'var(--chart-border)', color: 'var(--text)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words"
                    style={
                      m.role === 'user'
                        ? { background: 'var(--accent)', color: '#fff' }
                        : {
                            background: 'var(--chart-surface)',
                            color: m.error ? '#ef5350' : 'var(--text)',
                            border: '1px solid var(--chart-border)',
                          }
                    }
                  >
                    {m.content || (m.pending ? '…' : '')}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Giriş */}
          <div className="border-t p-2.5 shrink-0" style={{ borderColor: 'var(--chart-border)' }}>
            <div
              className="flex items-end gap-2 rounded-xl border px-2.5 py-1.5"
              style={{ borderColor: 'var(--chart-border)', background: 'var(--chart-bg)' }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Sualınızı yazın…"
                className="flex-1 bg-transparent resize-none outline-none text-xs py-1 max-h-24"
                style={{ color: 'var(--text)' }}
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={!input.trim() || busy}
                aria-label="Göndər"
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-[10px] mt-1.5 px-1" style={{ color: 'var(--dim)' }}>
              AI səhv edə bilər — vacib qərarları yoxlayın.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
