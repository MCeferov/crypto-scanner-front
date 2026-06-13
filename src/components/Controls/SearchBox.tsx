import React from 'react';
import { useMarket } from '../../context/MarketContext';

export function SearchBox() {
  const { searchQuery, setSearchQuery } = useMarket();

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>
        🔍
      </div>
      <input
        type="search"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search BTC, ETH, SOL..."
        className="pl-8 pr-8 py-2 rounded-lg text-sm w-52 outline-none transition-all"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(240,185,11,0.5)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: 'var(--muted)' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
