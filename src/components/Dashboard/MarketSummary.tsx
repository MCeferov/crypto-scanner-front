import React, { useMemo } from 'react';
import { useMarket } from '../../context/MarketContext';
import { useT } from '../../context/LocaleContext';
import { formatVolume, formatPercent } from '../../utils/formatters';
import { isCryptoAsset } from '../../utils/assetHelpers';

function Stat({
  label, value, sub, color, accent,
}: {
  label: string; value: string; sub?: string; color?: string; accent?: boolean;
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-xl px-4 py-3 min-w-[110px] flex-1"
      style={{
        background: accent ? 'var(--surface)' : 'var(--bg)',
        border: `1px solid ${accent ? 'var(--border-lite)' : 'var(--border)'}`,
      }}
    >
      <span style={{ color: 'var(--dim)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span className="font-mono font-bold mt-1 truncate" style={{ color: color || 'var(--text)', fontSize: 14 }}>
        {value}
      </span>
      {sub && <span className="truncate mt-0.5" style={{ color: 'var(--dim)', fontSize: 10 }}>{sub}</span>}
    </div>
  );
}

export function MarketSummary() {
  const { coins, filteredCoins, assetCategory } = useMarket();
  const t = useT();

  const s = useMemo(() => {
    const pool = assetCategory === 'all' ? coins : filteredCoins;
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
  }, [coins, filteredCoins, assetCategory]);

  if (!s) return null;

  const changeColor = s.avgChange > 0 ? '#26a69a' : s.avgChange < 0 ? '#ef5350' : 'var(--muted)';

  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none max-w-[1920px] mx-auto">
        <Stat
          label={t('summary.assets')}
          value={`${s.pool}`}
          sub={assetCategory === 'all' ? t('summary.allCategories') : t(`category.${assetCategory}`)}
          accent
        />
        <Stat
          label={t('summary.avg24h')}
          value={formatPercent(s.avgChange)}
          sub={t('summary.gainersLosers', { gainers: s.gainers, losers: s.losers })}
          color={changeColor}
          accent
        />
        {s.topGainer && (
          <Stat
            label={t('summary.topGainer')}
            value={s.topGainer.baseAsset}
            sub={formatPercent(s.topGainer.priceChange24h)}
            color="#26a69a"
          />
        )}
        {s.topLoser && s.topLoser.priceChange24h < 0 && (
          <Stat
            label={t('summary.topLoser')}
            value={s.topLoser.baseAsset}
            sub={formatPercent(s.topLoser.priceChange24h)}
            color="#ef5350"
          />
        )}
        {s.totalVol > 0 && (
          <Stat label={t('summary.volume24h')} value={formatVolume(s.totalVol)} sub={t('summary.total')} />
        )}
        {s.avgRsi !== null && s.cryptoCount > 0 && (
          <Stat
            label={t('summary.cryptoRsi')}
            value={s.avgRsi.toFixed(1)}
            sub={`${s.cryptoCount} ${t('summary.coins')}`}
            color={s.avgRsi < 40 ? '#26a69a' : s.avgRsi > 60 ? '#ef5350' : 'var(--muted)'}
          />
        )}
        {assetCategory === 'all' && (
          <Stat
            label={t('summary.categoryBreakdown')}
            value={`${s.byType.crypto}·${s.byType.stock}·${s.byType.commodity}·${s.byType.forex}`}
            sub={t('summary.categoryShort')}
          />
        )}
      </div>
    </div>
  );
}
