import React from 'react';
import { useMarket, type FilterKey } from '../../context/MarketContext';

const FILTERS: { key: FilterKey; label: string; color?: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'oversold',   label: 'RSI < 30',    color: '#26a69a' },
  { key: 'overbought', label: 'RSI > 70',    color: '#ef5350' },
  { key: 'highVolume', label: 'Top Volume',  color: '#f0b90b' },
  { key: 'topGainers', label: '↑ Gainers',   color: '#26a69a' },
  { key: 'topLosers',  label: '↓ Losers',    color: '#ef5350' },
  { key: 'strongBuy',  label: 'Buy Signals', color: '#26a69a' },
  { key: 'strongSell', label: 'Sell Signals',color: '#ef5350' },
];

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function FilterControls() {
  const { filter, setFilter } = useMarket();

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {FILTERS.map(f => {
        const active = filter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="text-xs px-3 py-1.5 rounded-md transition-all"
            style={{
              background: active
                ? f.color ? `rgba(${hexToRgb(f.color)},0.12)` : 'var(--elevated)'
                : 'var(--surface)',
              color: active ? (f.color || 'var(--text)') : 'var(--muted)',
              border: `1px solid ${active
                ? f.color ? `rgba(${hexToRgb(f.color)},0.30)` : 'var(--border-lite)'
                : 'var(--border)'}`,
              fontWeight: active ? 600 : 400,
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
