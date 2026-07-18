import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useMarket, type CoinData } from '../../context/MarketContext';
import { useT } from '../../context/LocaleContext';
import { matchesSearch, isCryptoAsset } from '../../utils/assetHelpers';
import { formatAssetPrice, formatPercent } from '../../utils/formatters';
import { TYPE_COLORS } from '../../types/asset';

const MAX_RESULTS = 12;

export function DashboardSearch() {
  const { coins } = useMarket();
  const [, setLocation] = useLocation();
  const t = useT();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as CoinData[];
    return coins.filter(c => matchesSearch(c, q)).slice(0, MAX_RESULTS);
  }, [coins, query]);

  const openAsset = (coin: CoinData) => {
    if (isCryptoAsset(coin)) {
      setLocation(`/coin/${coin.symbol}`);
    } else {
      setLocation(`/asset/${coin.type}/${coin.baseAsset}`);
    }
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ color: 'var(--muted)' }}
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('dashboard.searchPlaceholder')}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color,box-shadow]"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            boxShadow: query ? '0 0 0 3px rgba(240,185,11,0.12)' : 'none',
            borderColor: query ? 'rgba(240,185,11,0.45)' : 'var(--border)',
          }}
          aria-label={t('dashboard.searchPlaceholder')}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 rounded"
            style={{ color: 'var(--muted)' }}
            aria-label="Clear"
          >
            ✕
          </button>
        )}
      </div>

      {query.trim() && (
        <div
          className="absolute z-30 mt-2 w-full rounded-xl border overflow-hidden"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
          }}
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
              {t('dashboard.searchEmpty')}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map(coin => {
                const typeStyle = TYPE_COLORS[coin.type];
                const up = coin.priceChange24h >= 0;
                return (
                  <li key={coin.id}>
                    <button
                      type="button"
                      onClick={() => openAsset(coin)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          color: typeStyle.text,
                          background: typeStyle.bg,
                          border: `1px solid ${typeStyle.border}`,
                        }}
                      >
                        {t(`assetType.${coin.type}`)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                          {coin.baseAsset}
                          <span className="font-normal ml-1.5" style={{ color: 'var(--dim)' }}>
                            {coin.name}
                          </span>
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block font-mono text-xs" style={{ color: 'var(--text)' }}>
                          {formatAssetPrice(coin.price, coin.type)}
                        </span>
                        <span
                          className="block font-mono text-[10px]"
                          style={{ color: up ? '#26a69a' : '#ef5350' }}
                        >
                          {formatPercent(coin.priceChange24h)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {results.length > 0 && (
            <p
              className="px-3.5 py-2 text-[10px] border-t"
              style={{ color: 'var(--dim)', borderColor: 'var(--border)' }}
            >
              {t('dashboard.searchHint', { count: results.length })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
