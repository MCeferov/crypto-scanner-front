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
      {/* Sticky Header */}
      <Header />

      {/* Market Summary */}
      <MarketSummary />

      {/* Divider */}
      <div style={{ height: 1, background: 'hsl(222,15%,12%)' }} />

      {/* Controls */}
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'hsl(222,20%,7.2%)', borderBottom: '1px solid hsl(222,15%,12%)' }}
      >
        <FilterControls />
        <div className="flex items-center gap-3">
          <span style={{ color: '#374151', fontSize: 11 }}>
            {filteredCoins.length} / {coins.length}
          </span>
          <SearchBox />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-lg text-sm"
          style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: '#f87171' }}>
          ⚠ {error}
        </div>
      )}

      {/* RSI Legend */}
      <div className="px-4 py-2 flex items-center gap-5 flex-wrap"
        style={{ borderBottom: '1px solid hsl(222,15%,11%)' }}>
        <span style={{ color: '#374151', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>RSI</span>
        {[
          { range: '< 30', color: '#0ecb81', bg: 'rgba(14,203,129,0.1)' },
          { range: '30–40', color: '#36b37e', bg: 'rgba(54,179,126,0.08)' },
          { range: '40–60', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
          { range: '60–70', color: '#f3a52f', bg: 'rgba(243,165,47,0.08)' },
          { range: '> 70',  color: '#f6465d', bg: 'rgba(246,70,93,0.1)' },
        ].map(item => (
          <div key={item.range} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.bg, border: `1px solid ${item.color}40` }} />
            <span style={{ color: item.color, fontSize: 10 }}>{item.range}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 ml-4">
          <span style={{ color: '#374151', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>ST</span>
          <div className="flex items-center gap-1">
            <span style={{ color: '#0ecb81', fontSize: 10 }}>▲ Bullish</span>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ color: '#f6465d', fontSize: 10 }}>▼ Bearish</span>
          </div>
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="px-4 pb-4">
        <HeatmapTable />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 text-center" style={{ borderTop: '1px solid hsl(222,15%,11%)' }}>
        <p style={{ color: '#1f2937', fontSize: 11 }}>
          Data: Binance Public API · RSI period 14 · SuperTrend (10, 3) · Real-time WebSocket · Not financial advice
        </p>
      </div>
    </div>
  );
}
