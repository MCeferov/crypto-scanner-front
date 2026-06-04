import React from 'react';
import { useMarket } from '../../context/MarketContext';

export function SearchBox() {
  const { searchQuery, setSearchQuery } = useMarket();

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#8b949e' }}>
        🔍
      </div>
      <input
        type="search"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search BTC, ETH, SOL..."
        className="pl-8 pr-3 py-2 rounded-lg text-sm w-52 outline-none transition-all"
        style={{
          background: 'hsl(222,20%,11%)',
          border: '1px solid hsl(222,15%,20%)',
          color: '#e6e8ec',
        }}
        onFocus={e => (e.target.style.borderColor = 'rgba(240,185,11,0.5)')}
        onBlur={e => (e.target.style.borderColor = 'hsl(222,15%,20%)')}
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: '#8b949e' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
