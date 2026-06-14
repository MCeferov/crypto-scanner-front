import React from 'react';
import { Header } from '../components/Layout/Header';
import { MarketSummary } from '../components/Dashboard/MarketSummary';
import { SearchBox } from '../components/Controls/SearchBox';
import { CategoryTabs } from '../components/Controls/CategoryTabs';
import { FilterControls } from '../components/Controls/FilterControls';
import { HeatmapTable } from '../components/HeatmapTable/HeatmapTable';
import { useMarket } from '../context/MarketContext';
import { useT } from '../context/LocaleContext';

export function HomePage() {
  const { filteredCoins, coins, error, showIndicatorColumns } = useMarket();
  const t = useT();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header />

      <section
        className="border-b px-4 pt-4 pb-3"
        style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)' }}
      >
        <div className="max-w-[1920px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                {t('home.title')}
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--dim)' }}>{t('home.subtitle')}</p>
            </div>
            <SearchBox />
          </div>
          <CategoryTabs />
        </div>
      </section>

      <MarketSummary />

      {showIndicatorColumns && (
        <div
          className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <FilterControls />
          <span className="text-[11px] font-mono" style={{ color: 'var(--dim)' }}>
            {t('home.assetCount', { filtered: filteredCoins.length, total: coins.length })}
          </span>
        </div>
      )}

      {!showIndicatorColumns && (
        <div className="px-4 py-2 flex justify-end border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[11px] font-mono" style={{ color: 'var(--dim)' }}>
            {t('home.assetCount', { filtered: filteredCoins.length, total: coins.length })}
          </span>
        </div>
      )}

      {error && (
        <div
          className="mx-4 mt-3 px-4 py-2.5 rounded-lg text-sm border"
          style={{ background: 'rgba(239,83,80,.08)', borderColor: 'rgba(239,83,80,.2)', color: '#ef5350' }}
        >
          {error}
        </div>
      )}

      <main className="flex-1 px-4 py-3 max-w-[1920px] mx-auto w-full">
        <HeatmapTable />
      </main>

      <footer className="px-4 py-3 text-center border-t mt-auto" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[11px]" style={{ color: 'var(--dim)' }}>{t('home.disclaimer')}</p>
      </footer>
    </div>
  );
}
