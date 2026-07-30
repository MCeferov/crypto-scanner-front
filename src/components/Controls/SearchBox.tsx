import React from 'react';
import { Search } from 'lucide-react';
import { useMarket } from '../../context/MarketContext';
import { useT } from '../../context/LocaleContext';

export function SearchBox() {
  const { searchQuery, setSearchQuery } = useMarket();
  const t = useT();

  return (
    <div className="relative">
      <Search
        aria-hidden
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--muted)' }}
      />
      <input
        type="search"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        className="pl-8 pr-8 py-2 rounded-lg text-sm w-52 outline-none transition-all focus:border-[rgba(41,98,255,0.55)] focus:shadow-[0_0_0_3px_rgba(41,98,255,0.14)]"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: 'var(--muted)' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
