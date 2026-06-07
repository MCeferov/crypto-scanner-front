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
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[#21262d] bg-[#0d1117] flex-wrap">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: '#161b22', color: '#f0b90b', border: '1px solid #21262d' }}>
          {base.slice(0, 3)}
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#e6edf3]">{base}/USDT</h1>
          <p className="text-xs text-[#484f58]">Binance Spot · Real-time</p>
        </div>
      </div>

      {coin && (
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#484f58] mb-0.5">Price</div>
            <div className="font-mono text-xl font-bold text-[#e6edf3]">${formatPrice(coin.price)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#484f58] mb-0.5">24H Change</div>
            <div className="font-mono text-sm font-semibold" style={{ color: getChangeColor(coin.priceChange24h) }}>
              {formatPercent(coin.priceChange24h)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#484f58] mb-0.5">Volume 24H</div>
            <div className="font-mono text-sm text-[#8b949e]">{formatVolume(coin.volume24h)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#484f58] mb-0.5">Trend Score</div>
            <div className="font-mono text-sm font-bold" style={{ color: getTrendScoreColor(coin.trendScore) }}>
              {coin.trendScore}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#484f58] mb-0.5">AI Signal</div>
            <span className={`inline-block font-bold rounded px-2.5 py-1 text-xs ${classifySignal(coin.signal)}`}>
              {signalLabel(coin.signal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
