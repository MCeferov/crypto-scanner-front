import React, { memo } from 'react';
import type { CoinData } from '../../context/MarketContext';
import { RSICell } from './RSICell';
import { formatPrice, formatVolume, formatPercent, formatSymbol, formatRSI, classifySignal, signalLabel, formatNumber } from '../../utils/formatters';
import { getChangeColor, getTrendScoreColor, getEMAPositionColor } from '../../utils/colors';

interface HeatmapRowProps {
  coin: CoinData;
  rank: number;
}

export const HeatmapRow = memo(function HeatmapRow({ coin, rank }: HeatmapRowProps) {
  const rowBg = rank % 2 === 0 ? 'hsl(222,20%,8.5%)' : 'hsl(222,20%,7.5%)';

  const flashClass = coin.flashUp ? 'flash-up' : coin.flashDown ? 'flash-down' : '';

  return (
    <tr
      className={`transition-colors hover:bg-white/[0.03] group ${flashClass}`}
      style={{ background: rowBg }}
    >
      {/* Rank */}
      <td className="px-2 py-2 text-center sticky left-0 z-10" style={{ background: rowBg, minWidth: 38 }}>
        <span className="text-xs" style={{ color: '#4a4f5c' }}>{rank}</span>
      </td>

      {/* Symbol */}
      <td className="px-3 py-2 sticky left-[38px] z-10" style={{ background: rowBg, minWidth: 100 }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'hsl(222,15%,18%)', color: '#f0b90b', fontSize: 9 }}>
            {formatSymbol(coin.symbol).slice(0, 3)}
          </div>
          <div>
            <div className="font-semibold text-xs" style={{ color: '#e6e8ec' }}>{formatSymbol(coin.symbol)}</div>
            <div className="text-[10px]" style={{ color: '#4a4f5c' }}>USDT</div>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="px-3 py-2 text-right" style={{ minWidth: 100 }}>
        <span className="font-mono text-xs font-semibold" style={{ color: '#e6e8ec' }}>
          ${formatPrice(coin.price)}
        </span>
      </td>

      {/* 1H % */}
      <td className="px-2 py-2 text-right" style={{ minWidth: 72 }}>
        <span className="font-mono text-xs" style={{ color: getChangeColor(coin.priceChange1h) }}>
          {formatPercent(coin.priceChange1h)}
        </span>
      </td>

      {/* 24H % */}
      <td className="px-2 py-2 text-right" style={{ minWidth: 72 }}>
        <span className="font-mono text-xs font-semibold" style={{ color: getChangeColor(coin.priceChange24h) }}>
          {formatPercent(coin.priceChange24h)}
        </span>
      </td>

      {/* Volume */}
      <td className="px-2 py-2 text-right" style={{ minWidth: 80 }}>
        <span className="font-mono text-xs" style={{ color: '#8b949e' }}>
          {formatVolume(coin.volume24h)}
        </span>
      </td>

      {/* RSI 15m */}
      <RSICell value={coin.rsi15m} loaded={coin.indicatorsLoaded} />

      {/* RSI 1H */}
      <RSICell value={coin.rsi1h} loaded={coin.indicatorsLoaded} />

      {/* RSI 4H */}
      <RSICell value={coin.rsi4h} loaded={coin.indicatorsLoaded} />

      {/* RSI 1D */}
      <RSICell value={coin.rsi1d} loaded={coin.indicatorsLoaded} />

      {/* EMA 20 */}
      <td className="px-2 py-2 text-center" style={{ minWidth: 60 }}>
        {coin.indicatorsLoaded ? (
          <span className="font-mono text-xs" style={{ color: getEMAPositionColor(coin.price, coin.ema20) }}>
            {coin.ema20 !== null ? (coin.price > coin.ema20 ? '▲' : '▼') : '—'}
          </span>
        ) : <div className="skeleton h-4 w-8 mx-auto rounded" />}
      </td>

      {/* EMA 50 */}
      <td className="px-2 py-2 text-center" style={{ minWidth: 60 }}>
        {coin.indicatorsLoaded ? (
          <span className="font-mono text-xs" style={{ color: getEMAPositionColor(coin.price, coin.ema50) }}>
            {coin.ema50 !== null ? (coin.price > coin.ema50 ? '▲' : '▼') : '—'}
          </span>
        ) : <div className="skeleton h-4 w-8 mx-auto rounded" />}
      </td>

      {/* EMA 200 */}
      <td className="px-2 py-2 text-center" style={{ minWidth: 60 }}>
        {coin.indicatorsLoaded ? (
          <span className="font-mono text-xs" style={{ color: getEMAPositionColor(coin.price, coin.ema200) }}>
            {coin.ema200 !== null ? (coin.price > coin.ema200 ? '▲' : '▼') : '—'}
          </span>
        ) : <div className="skeleton h-4 w-8 mx-auto rounded" />}
      </td>

      {/* MACD */}
      <td className="px-2 py-2 text-center" style={{ minWidth: 72 }}>
        {coin.indicatorsLoaded ? (
          <span className="font-mono text-xs" style={{ color: (coin.macdHistogram ?? 0) > 0 ? '#0ecb81' : '#f6465d' }}>
            {coin.macdHistogram !== null ? ((coin.macdHistogram > 0 ? '+' : '') + coin.macdHistogram.toFixed(4)) : '—'}
          </span>
        ) : <div className="skeleton h-4 w-12 mx-auto rounded" />}
      </td>

      {/* BB% */}
      <td className="px-2 py-2 text-center" style={{ minWidth: 60 }}>
        {coin.indicatorsLoaded ? (
          <span className="font-mono text-xs" style={{
            color: coin.bbPercent !== null
              ? coin.bbPercent > 0.8 ? '#f6465d' : coin.bbPercent < 0.2 ? '#0ecb81' : '#8b949e'
              : '#4a4f5c'
          }}>
            {coin.bbPercent !== null ? `${(coin.bbPercent * 100).toFixed(0)}%` : '—'}
          </span>
        ) : <div className="skeleton h-4 w-8 mx-auto rounded" />}
      </td>

      {/* ATR% */}
      <td className="px-2 py-2 text-center" style={{ minWidth: 60 }}>
        {coin.indicatorsLoaded ? (
          <span className="font-mono text-xs" style={{ color: '#8b949e' }}>
            {coin.atrPercent !== null ? `${coin.atrPercent.toFixed(2)}%` : '—'}
          </span>
        ) : <div className="skeleton h-4 w-10 mx-auto rounded" />}
      </td>

      {/* Stoch RSI */}
      <td className="px-2 py-2 text-center" style={{ minWidth: 72 }}>
        {coin.indicatorsLoaded ? (
          <div className="flex flex-col items-center gap-0.5">
            {coin.stochRsiK !== null ? (
              <>
                <span className="font-mono text-[10px]" style={{
                  color: coin.stochRsiK > 80 ? '#f6465d' : coin.stochRsiK < 20 ? '#0ecb81' : '#8b949e'
                }}>
                  K:{coin.stochRsiK.toFixed(1)}
                </span>
                {coin.stochRsiD !== null && (
                  <span className="font-mono text-[10px]" style={{ color: '#4a4f5c' }}>
                    D:{coin.stochRsiD.toFixed(1)}
                  </span>
                )}
              </>
            ) : <span style={{ color: '#4a4f5c', fontSize: 12 }}>—</span>}
          </div>
        ) : <div className="skeleton h-8 w-12 mx-auto rounded" />}
      </td>

      {/* Trend Score */}
      <td className="px-3 py-2" style={{ minWidth: 100 }}>
        {coin.indicatorsLoaded ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs font-mono" style={{ color: getTrendScoreColor(coin.trendScore) }}>
                {coin.trendScore}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(222,15%,17%)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${coin.trendScore}%`,
                  background: coin.trendScore >= 65 ? '#0ecb81'
                    : coin.trendScore >= 50 ? '#36b37e'
                    : coin.trendScore >= 35 ? '#f3a52f'
                    : '#f6465d',
                }}
              />
            </div>
          </div>
        ) : <div className="skeleton h-6 w-16 mx-auto rounded" />}
      </td>

      {/* Signal */}
      <td className="px-2 py-2 text-center" style={{ minWidth: 100 }}>
        {coin.indicatorsLoaded ? (
          <span
            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${classifySignal(coin.signal)}`}
            title={coin.signalReasons.join(', ')}
          >
            {signalLabel(coin.signal)}
          </span>
        ) : <div className="skeleton h-5 w-16 mx-auto rounded" />}
      </td>
    </tr>
  );
}, (prev, next) => {
  return (
    prev.coin.price === next.coin.price &&
    prev.coin.rsi1h === next.coin.rsi1h &&
    prev.coin.rsi15m === next.coin.rsi15m &&
    prev.coin.rsi4h === next.coin.rsi4h &&
    prev.coin.rsi1d === next.coin.rsi1d &&
    prev.coin.indicatorsLoaded === next.coin.indicatorsLoaded &&
    prev.coin.trendScore === next.coin.trendScore &&
    prev.coin.signal === next.coin.signal &&
    prev.coin.flashUp === next.coin.flashUp &&
    prev.coin.flashDown === next.coin.flashDown &&
    prev.coin.priceChange24h === next.coin.priceChange24h &&
    prev.rank === next.rank
  );
});
