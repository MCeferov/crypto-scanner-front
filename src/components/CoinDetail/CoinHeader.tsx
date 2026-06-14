import React from 'react';
import type { CoinData } from '../../context/MarketContext';
import {
  formatPrice, formatPercent, formatVolume, formatAssetPrice,
  classifySignal, signalLabel,
} from '../../utils/formatters';
import { getChangeColor, getTrendScoreColor } from '../../utils/colors';
import { TYPE_COLORS } from '../../types/asset';
import { useT } from '../../context/LocaleContext';

interface CoinHeaderProps {
  coin: CoinData | null;
  symbol: string;
}

export function CoinHeader({ coin, symbol }: CoinHeaderProps) {
  const t = useT();
  const type = coin?.type ?? 'crypto';
  const style = TYPE_COLORS[type];
  const displayName = coin?.baseAsset ?? symbol.replace(/USDT$/, '');
  const subtitle = type === 'crypto'
    ? 'Binance Spot · Real-time'
    : coin?.name ?? type;

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 border-b flex-wrap"
      style={{ borderColor: 'var(--chart-border)', background: 'var(--chart-bg)' }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
        >
          {displayName.slice(0, 3)}
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--chart-text-bright)' }}>
            {type === 'crypto' ? `${displayName}/USDT` : displayName}
          </h1>
          <p className="text-xs" style={{ color: 'var(--chart-text-dim)' }}>
            {subtitle} · {t(`assetType.${type}`)}
          </p>
        </div>
      </div>

      {coin && (
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>
              {t('detail.price')}
            </div>
            <div className="font-mono text-xl font-bold" style={{ color: 'var(--chart-text-bright)' }}>
              {type === 'crypto' ? `$${formatPrice(coin.price)}` : formatAssetPrice(coin.price, type)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>
              {t('detail.change24h')}
            </div>
            <div className="font-mono text-sm font-semibold" style={{ color: getChangeColor(coin.priceChange24h) }}>
              {formatPercent(coin.priceChange24h)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>
              {t('detail.volume24h')}
            </div>
            <div className="font-mono text-sm" style={{ color: 'var(--chart-text)' }}>{formatVolume(coin.volume24h)}</div>
          </div>
          {coin.indicatorsLoaded && (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>
                  {t('table.trend')}
                </div>
                <div className="font-mono text-sm font-bold" style={{ color: getTrendScoreColor(coin.trendScore) }}>
                  {coin.trendScore}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>
                  AI
                </div>
                <span className={`inline-block font-bold rounded px-2.5 py-1 text-xs ${classifySignal(coin.signal)}`}>
                  {signalLabel(coin.signal)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
