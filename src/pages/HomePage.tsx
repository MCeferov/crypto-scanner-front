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
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Header />

      <MarketSummary />

      <div
        className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        <FilterControls />
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono" style={{ color: 'var(--dim)' }}>
            {filteredCoins.length} / {coins.length}
          </span>
          <SearchBox />
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-lg text-sm border"
          style={{ background: 'rgba(239,83,80,.08)', borderColor: 'rgba(239,83,80,.2)', color: '#ef5350' }}>
          {error}
        </div>
      )}

      <div className="px-4 py-3">
        <HeatmapTable />
      </div>

      <div className="px-4 py-3 text-center border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[11px]" style={{ color: 'var(--dim)' }}>
          Binance Public API · Real-time WebSocket · Coin üzərinə klik edin · Maliyyə tövsiyəsi deyil
        </p>
      </div>
    </div>
  );
}
