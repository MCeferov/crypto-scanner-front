import React from 'react';
import { useMarket, type FilterKey } from '../../context/MarketContext';

const FILTERS: { key: FilterKey; label: string; color?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'oversold', label: 'RSI < 30', color: '#0ecb81' },
  { key: 'overbought', label: 'RSI > 70', color: '#f6465d' },
  { key: 'highVolume', label: 'Top Volume', color: '#f0b90b' },
  { key: 'topGainers', label: '↑ Gainers', color: '#0ecb81' },
  { key: 'topLosers', label: '↓ Losers', color: '#f6465d' },
  { key: 'strongBuy', label: '🟢 Buy Signals', color: '#0ecb81' },
  { key: 'strongSell', label: '🔴 Sell Signals', color: '#f6465d' },
];

export function FilterControls() {
  const { filter, setFilter, rsiTimeframe, setRsiTimeframe } = useMarket();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* RSI Timeframe selector */}
      <div className="flex items-center gap-1 mr-2">
        <span className="text-xs mr-1" style={{ color: '#8b949e' }}>RSI:</span>
        {(['15m', '1h', '4h', '1d'] as const).map(tf => (
          <button
            key={tf}
            onClick={() => setRsiTimeframe(tf)}
            className="text-xs px-2 py-1 rounded transition-all"
            style={{
              background: rsiTimeframe === tf ? 'rgba(240,185,11,0.15)' : 'hsl(222,20%,11%)',
              color: rsiTimeframe === tf ? '#f0b90b' : '#8b949e',
              border: `1px solid ${rsiTimeframe === tf ? 'rgba(240,185,11,0.3)' : 'hsl(222,15%,18%)'}`,
              fontWeight: rsiTimeframe === tf ? 600 : 400,
            }}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 mx-1" style={{ background: 'hsl(222,15%,20%)' }} />

      {/* Filter buttons */}
      {FILTERS.map(f => (
        <button
          key={f.key}
          onClick={() => setFilter(f.key)}
          className="text-xs px-3 py-1 rounded-md transition-all"
          style={{
            background: filter === f.key
              ? f.color ? `rgba(${hexToRgb(f.color)}, 0.12)` : 'hsl(222,15%,20%)'
              : 'hsl(222,20%,11%)',
            color: filter === f.key ? (f.color || '#e6e8ec') : '#8b949e',
            border: `1px solid ${filter === f.key ? (f.color ? `rgba(${hexToRgb(f.color)}, 0.3)` : 'hsl(222,15%,25%)') : 'hsl(222,15%,18%)'}`,
            fontWeight: filter === f.key ? 600 : 400,
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
