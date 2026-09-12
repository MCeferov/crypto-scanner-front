import React, { useEffect, useState } from 'react';
import { ExternalLink, MessageSquareQuote } from 'lucide-react';
import type { CoinData } from '../../context/MarketContext';
import {
  fetchCommentary,
  sourceLabelOf,
  timeAgoAz,
  type CommentaryItem,
  type CommentarySentiment,
} from '../../services/commentaryApi';

interface NotableVoicesProps {
  coin: CoinData;
}

const SENTIMENT_COLOR: Record<CommentarySentiment, string> = {
  bullish: '#26a69a',
  bearish: '#ef5350',
  neutral: 'var(--chart-text-dim)',
};

/** Müəllif adından təsadüfi olmayan rəng — remote avatar yükləmədən (CSP təmiz) */
function initialAvatar(author: string): { letter: string; bg: string } {
  const letter = author.trim().charAt(0).toUpperCase() || '?';
  let hash = 0;
  for (let i = 0; i < author.length; i++) hash = (hash * 31 + author.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return { letter, bg: `hsl(${hue} 55% 45%)` };
}

function VoiceCard({ item }: { item: CommentaryItem }) {
  const avatar = initialAvatar(item.author);
  const when = timeAgoAz(item.publishedAt);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg p-2.5 transition-colors row-hover"
      style={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-border)' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
          style={{ background: avatar.bg }}
          aria-hidden
        >
          {avatar.letter}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold truncate" style={{ color: 'var(--chart-text-bright)' }}>
              {item.author}
            </span>
            {item.sentiment && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: SENTIMENT_COLOR[item.sentiment] }}
                title={item.sentiment}
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--chart-text-dim)' }}>
            <span
              className="px-1 py-px rounded"
              style={{ background: 'var(--chart-border)', color: 'var(--chart-text)' }}
            >
              {sourceLabelOf(item)}
            </span>
            {item.handle && <span className="truncate">{item.handle}</span>}
            {when && <span className="shrink-0">· {when}</span>}
          </div>
        </div>
        <ExternalLink size={12} className="shrink-0" style={{ color: 'var(--chart-text-dim)' }} />
      </div>

      {item.title && (
        <p className="text-[11px] font-semibold mb-0.5 line-clamp-2" style={{ color: 'var(--chart-text-bright)' }}>
          {item.title}
        </p>
      )}
      <p className="text-[11px] leading-relaxed line-clamp-4" style={{ color: 'var(--chart-text)' }}>
        {item.text}
      </p>
    </a>
  );
}

/**
 * Detail page paneli: bu aktiv barədə tanınan şəxslərin / mənbələrin son
 * fikirləri. Məlumat backend-dən gəlir (mənbə-agnostik). Frontend heç nə
 * uydurmur — boş cavabda "məlumat yoxdur" göstərir.
 */
export function NotableVoices({ coin }: NotableVoicesProps) {
  const [items, setItems] = useState<CommentaryItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const symbol = coin.baseAsset || coin.symbol;
  const name = coin.name;
  const type = coin.type;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setItems(null);
    fetchCommentary({ symbol, name, type }, ctrl.signal)
      .then(res => {
        if (!ctrl.signal.aborted) setItems(res);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [symbol, name, type]);

  return (
    <div className="p-4 border-b" style={{ borderColor: 'var(--chart-border)' }}>
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
        style={{ color: 'var(--chart-text-dim)' }}
      >
        <MessageSquareQuote size={13} />
        Tanınan fikirlər
      </h3>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map(item => <VoiceCard key={item.id} item={item} />)}
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--chart-text-dim)' }}>
          {symbol} barədə tanınan şəxslərdən son fikir tapılmadı.
        </p>
      )}
    </div>
  );
}
