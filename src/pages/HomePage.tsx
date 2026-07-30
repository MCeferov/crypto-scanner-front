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

      {/* Compact command band: title + tabs + search in one row */}
      <section
        className="border-b px-4 py-2.5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="max-w-[1920px] mx-auto flex items-center gap-4 flex-wrap">
          <div className="min-w-0 mr-2">
            <h1 className="text-sm sm:text-base font-bold tracking-tight leading-tight" style={{ color: 'var(--text)' }}>
              {t('home.title')}
            </h1>
            <p className="text-[11px] leading-tight hidden sm:block" style={{ color: 'var(--dim)' }}>
              {t('home.subtitle')}
            </p>
          </div>
          <CategoryTabs />
          <div className="flex-1" />
          <SearchBox />
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
