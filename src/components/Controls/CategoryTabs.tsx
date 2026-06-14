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

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Asset categories">
      {TABS.map(tab => {
        const active = assetCategory === tab;
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={active}
            onClick={() => setAssetCategory(tab)}
            className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-150"
            style={{
              background: active ? 'rgba(240,185,11,.15)' : 'var(--elevated)',
              color: active ? '#f0b90b' : 'var(--muted)',
              border: `1px solid ${active ? 'rgba(240,185,11,.4)' : 'var(--border)'}`,
            }}
          >
            {t(`category.${tab}`)}
            <span className="ml-1.5 font-mono text-[10px] opacity-70">{counts[tab]}</span>
          </button>
        );
      })}
    </div>
  );
}
