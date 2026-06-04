import React from 'react';
import { Header } from '../components/Layout/Header';
import { MarketSummary } from '../components/Dashboard/MarketSummary';
import { SearchBox } from '../components/Controls/SearchBox';
import { FilterControls } from '../components/Controls/FilterControls';
import { HeatmapTable } from '../components/HeatmapTable/HeatmapTable';
import { useMarket } from '../context/MarketContext';

export function HomePage() {
  const { filteredCoins, coins, error } = useMarket();

  return (
    <div className="min-h-screen" style={{ background: 'hsl(222,20%,7%)' }}>
      <Header />

      {/* Market Summary */}
      <MarketSummary />

      {/* Divider */}
      <div style={{ borderBottom: '1px solid hsl(222,15%,14%)' }} />

      {/* Controls Bar */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'hsl(222,20%,7.5%)', borderBottom: '1px solid hsl(222,15%,14%)' }}>
        <FilterControls />
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#4a4f5c' }}>
            {filteredCoins.length} of {coins.length} pairs
          </span>
          <SearchBox />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)', color: '#f6465d' }}>
          ⚠ {error}
        </div>
      )}

      {/* RSI Legend */}
      <div className="px-4 pt-2 pb-1 flex items-center gap-4 flex-wrap">
        <span className="text-xs" style={{ color: '#4a4f5c' }}>RSI:</span>
        {[
          { label: '< 30 Oversold', color: '#0ecb81', bg: 'rgba(14,203,129,0.12)' },
          { label: '30–40', color: '#36b37e', bg: 'rgba(54,179,126,0.1)' },
          { label: '40–60 Neutral', color: '#8b949e', bg: 'rgba(74,79,92,0.1)' },
          { label: '60–70', color: '#f3a52f', bg: 'rgba(243,165,47,0.1)' },
          { label: '> 70 Overbought', color: '#f6465d', bg: 'rgba(246,70,93,0.12)' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: item.bg, border: `1px solid ${item.color}33` }} />
            <span className="text-xs" style={{ color: item.color }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="px-4 pb-4">
        <HeatmapTable />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 text-center" style={{ borderTop: '1px solid hsl(222,15%,14%)' }}>
        <p className="text-xs" style={{ color: '#3a3f4c' }}>
          Data from Binance Public API · RSI period 14 · Real-time via WebSocket · Not financial advice
        </p>
      </div>
    </div>
  );
}
