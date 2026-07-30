import React, { useMemo } from 'react';
import { useLocation } from 'wouter';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMarket, type CoinData } from '../../context/MarketContext';
import { useT } from '../../context/LocaleContext';
import { formatAssetPrice, formatPercent } from '../../utils/formatters';
import { isCryptoAsset } from '../../utils/assetHelpers';

function MoverRow({ coin, onOpen }: { coin: CoinData; onOpen: (c: CoinData) => void }) {
  const up = coin.priceChange24h >= 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(coin)}
      className="w-full flex items-center gap-3 px-3.5 py-2 text-left row-hover transition-colors"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
          {coin.baseAsset}
          <span className="font-normal ml-1.5 text-xs" style={{ color: 'var(--dim)' }}>{coin.name}</span>
        </span>
      </span>
      <span className="font-mono text-xs" style={{ color: 'var(--text)' }}>
        {formatAssetPrice(coin.price, coin.type)}
      </span>
      <span
        className="font-mono text-xs font-semibold w-18 text-right"
        style={{ color: up ? '#26a69a' : '#ef5350', minWidth: 64 }}
      >
        {formatPercent(coin.priceChange24h)}
      </span>
    </button>
  );
}

function MoversCard({
  title, icon, coins, onOpen,
}: {
  title: string; icon: React.ReactNode; coins: CoinData[]; onOpen: (c: CoinData) => void;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
          {title}
        </h3>
      </div>
      {coins.length === 0 ? (
        <div className="px-3.5 py-4 space-y-2">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-4 w-full" />)}
        </div>
      ) : (
        <div className="py-1">
          {coins.map(c => <MoverRow key={c.id} coin={c} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

/** Top gainers / losers over 24h — real data on the dashboard instead of a bare CTA. */
export function TopMovers() {
  const { coins } = useMarket();
  const [, setLocation] = useLocation();
  const t = useT();

  const { gainers, losers } = useMemo(() => {
    const pool = coins.filter(c => c.volume24h > 0);
    const sorted = [...pool].sort((a, b) => b.priceChange24h - a.priceChange24h);
    return { gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse() };
  }, [coins]);

  const openAsset = (coin: CoinData) => {
    if (isCryptoAsset(coin)) setLocation(`/coin/${coin.symbol}`);
    else setLocation(`/asset/${coin.type}/${coin.baseAsset}`);
  };

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <MoversCard
        title={t('dashboard.topGainers')}
        icon={<TrendingUp size={14} color="#26a69a" />}
        coins={gainers}
        onOpen={openAsset}
      />
      <MoversCard
        title={t('dashboard.topLosers')}
        icon={<TrendingDown size={14} color="#ef5350" />}
        coins={losers}
        onOpen={openAsset}
      />
    </div>
  );
}
