import React from 'react';
import type { CoinData } from '../../context/MarketContext';
import { formatPrice, formatPercent, formatVolume, formatSymbol, classifySignal, signalLabel } from '../../utils/formatters';
import { getChangeColor, getTrendScoreColor } from '../../utils/colors';

interface CoinHeaderProps {
  coin: CoinData | null;
  symbol: string;
}

export function CoinHeader({ coin, symbol }: CoinHeaderProps) {
  const base = formatSymbol(symbol);

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 border-b flex-wrap"
      style={{ borderColor: 'var(--chart-border)', background: 'var(--chart-bg)' }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: 'var(--chart-surface)', color: '#f0b90b', border: '1px solid var(--chart-border)' }}
        >
          {base.slice(0, 3)}
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--chart-text-bright)' }}>{base}/USDT</h1>
          <p className="text-xs" style={{ color: 'var(--chart-text-dim)' }}>Binance Spot · Real-time</p>
        </div>
      </div>

      {coin && (
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>Price</div>
            <div className="font-mono text-xl font-bold" style={{ color: 'var(--chart-text-bright)' }}>${formatPrice(coin.price)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>24H Change</div>
            <div className="font-mono text-sm font-semibold" style={{ color: getChangeColor(coin.priceChange24h) }}>
              {formatPercent(coin.priceChange24h)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>Volume 24H</div>
            <div className="font-mono text-sm" style={{ color: 'var(--chart-text)' }}>{formatVolume(coin.volume24h)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>Trend Score</div>
            <div className="font-mono text-sm font-bold" style={{ color: getTrendScoreColor(coin.trendScore) }}>
              {coin.trendScore}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chart-text-dim)' }}>AI Signal</div>
            <span className={`inline-block font-bold rounded px-2.5 py-1 text-xs ${classifySignal(coin.signal)}`}>
              {signalLabel(coin.signal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
