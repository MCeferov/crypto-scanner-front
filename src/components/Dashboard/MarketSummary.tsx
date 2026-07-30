import React, { useMemo } from 'react';
import { useMarket } from '../../context/MarketContext';
import { useT } from '../../context/LocaleContext';
import { formatVolume, formatPercent } from '../../utils/formatters';
import { isCryptoAsset } from '../../utils/assetHelpers';

/**
 * Slim terminal-style stat: no per-card borders — the strip reads as one
 * ribbon with hairline dividers, like a TV market summary bar.
 */
function Stat({
  label, value, sub, color, divider,
}: {
  label: string; value: string; sub?: string; color?: string; accent?: boolean; divider?: boolean;
}) {
  return (
    <div
      className="flex flex-col justify-center px-4 py-2 min-w-[120px] shrink-0"
      style={divider ? { borderLeft: '1px solid var(--border)' } : undefined}
    >
      <span className="whitespace-nowrap" style={{ color: 'var(--dim)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span className="font-mono font-semibold mt-0.5 truncate" style={{ color: color || 'var(--text)', fontSize: 14 }}>
        {value}
        {sub && (
          <span className="font-normal ml-1.5" style={{ color: 'var(--dim)', fontSize: 10 }}>{sub}</span>
        )}
      </span>
    </div>
  );
}

export function MarketSummary({
  useAllPool = false,
  embedded = false,
}: {
  useAllPool?: boolean;
  /** Dashboard kartı içində — xarici border/padding yox */
  embedded?: boolean;
}) {
  const { coins, filteredCoins, assetCategory } = useMarket();
  const t = useT();

  const s = useMemo(() => {
    const pool = useAllPool || assetCategory === 'all' ? coins : filteredCoins;
    if (pool.length === 0) return null;

    const gainers = pool.filter(c => c.priceChange24h > 0).length;
    const losers = pool.filter(c => c.priceChange24h < 0).length;
    const avgChange = pool.reduce((a, c) => a + c.priceChange24h, 0) / pool.length;
    const topGainer = [...pool].sort((a, b) => b.priceChange24h - a.priceChange24h)[0];
    const topLoser = [...pool].sort((a, b) => a.priceChange24h - b.priceChange24h)[0];
    const totalVol = pool.reduce((a, c) => a + c.volume24h, 0);

    const crypto = pool.filter(isCryptoAsset);
    const withRsi = crypto.filter(c => c.rsi15m !== null);
    const avgRsi = withRsi.length > 0
      ? withRsi.reduce((a, c) => a + (c.rsi15m ?? 0), 0) / withRsi.length
      : null;

    const byType = {
      crypto: pool.filter(c => c.type === 'crypto').length,
      stock: pool.filter(c => c.type === 'stock').length,
      commodity: pool.filter(c => c.type === 'commodity').length,
      forex: pool.filter(c => c.type === 'forex').length,
    };

    return { pool: pool.length, gainers, losers, avgChange, topGainer, topLoser, totalVol, avgRsi, byType, cryptoCount: crypto.length };
  }, [coins, filteredCoins, assetCategory, useAllPool]);

  if (!s) {
    // Skeleton with the same footprint — returning null made the strip pop
    // in after load and shove the whole page down (visible CLS).
    return (
      <div
        className={embedded ? '' : 'border-b'}
        style={embedded ? undefined : { borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-stretch overflow-x-auto scrollbar-none max-w-[1920px] mx-auto">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col justify-center px-4 py-2 min-w-[120px] shrink-0"
              style={i > 0 ? { borderLeft: '1px solid var(--border)' } : undefined}
            >
              <div className="skeleton h-2.5 w-14 mb-1.5" />
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const changeColor = s.avgChange > 0 ? '#26a69a' : s.avgChange < 0 ? '#ef5350' : 'var(--muted)';

  const stats: { label: string; value: string; sub?: string; color?: string }[] = [
    {
      label: t('summary.assets'),
      value: `${s.pool}`,
      sub: useAllPool || assetCategory === 'all' ? t('summary.allCategories') : t(`category.${assetCategory}`),
    },
    {
      label: t('summary.avg24h'),
      value: formatPercent(s.avgChange),
      sub: t('summary.gainersLosers', { gainers: s.gainers, losers: s.losers }),
      color: changeColor,
    },
    ...(s.topGainer ? [{
      label: t('summary.topGainer'),
      value: s.topGainer.baseAsset,
      sub: formatPercent(s.topGainer.priceChange24h),
      color: '#26a69a',
    }] : []),
    ...(s.topLoser && s.topLoser.priceChange24h < 0 ? [{
      label: t('summary.topLoser'),
      value: s.topLoser.baseAsset,
      sub: formatPercent(s.topLoser.priceChange24h),
      color: '#ef5350',
    }] : []),
    ...(s.totalVol > 0 ? [{
      label: t('summary.volume24h'),
      value: formatVolume(s.totalVol),
      sub: t('summary.total'),
    }] : []),
    ...(s.avgRsi !== null && s.cryptoCount > 0 ? [{
      label: t('summary.cryptoRsi'),
      value: s.avgRsi.toFixed(1),
      sub: `${s.cryptoCount} ${t('summary.coins')}`,
      color: s.avgRsi < 40 ? '#26a69a' : s.avgRsi > 60 ? '#ef5350' : undefined,
    }] : []),
    ...(useAllPool || assetCategory === 'all' ? [{
      label: t('summary.categoryBreakdown'),
      value: `${s.byType.crypto}·${s.byType.stock}·${s.byType.commodity}·${s.byType.forex}`,
      sub: t('summary.categoryShort'),
    }] : []),
  ];

  return (
    <div
      className={embedded ? '' : 'border-b'}
      style={embedded ? undefined : { borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex items-stretch overflow-x-auto scrollbar-none max-w-[1920px] mx-auto">
        {stats.map((st, i) => (
          <Stat key={st.label} {...st} divider={i > 0} />
        ))}
      </div>
    </div>
  );
}
