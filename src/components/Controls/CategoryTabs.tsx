import React from 'react';
import { useMarket } from '../../context/MarketContext';
import { useT } from '../../context/LocaleContext';
import type { AssetCategory } from '../../types/asset';

const TABS: AssetCategory[] = ['all', 'crypto', 'stock', 'commodity', 'forex'];

export function CategoryTabs() {
  const { assetCategory, setAssetCategory, coins } = useMarket();
  const t = useT();

  const counts = React.useMemo(() => {
    let crypto = 0, stock = 0, commodity = 0, forex = 0;
    for (const a of coins) {
      if (a.type === 'crypto') crypto++;
      else if (a.type === 'stock') stock++;
      else if (a.type === 'commodity') commodity++;
      else if (a.type === 'forex') forex++;
    }
    return { all: coins.length, crypto, stock, commodity, forex };
  }, [coins]);

  // Segmented control — one container, flat buttons; reads as a single
  // professional widget instead of five floating pills.
  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg overflow-x-auto scrollbar-none"
      role="tablist"
      aria-label="Asset categories"
      style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}
    >
      {TABS.map(tab => {
        const active = assetCategory === tab;
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={active}
            onClick={() => setAssetCategory(tab)}
            className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap"
            style={{
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--muted)',
              boxShadow: active ? '0 1px 3px rgba(15,23,42,.12)' : 'none',
              fontWeight: active ? 600 : 500,
            }}
          >
            {t(`category.${tab}`)}
            <span className="ml-1.5 font-mono text-[10px]" style={{ color: active ? 'var(--accent)' : 'var(--dim)' }}>
              {counts[tab]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
