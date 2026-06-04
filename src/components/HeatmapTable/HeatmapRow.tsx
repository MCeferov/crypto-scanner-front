import React, { memo } from 'react';
import type { CoinData } from '../../context/MarketContext';
import { RSICell } from './RSICell';
import { formatPrice, formatVolume, formatPercent, formatSymbol, classifySignal, signalLabel } from '../../utils/formatters';
import { getChangeColor, getTrendScoreColor } from '../../utils/colors';

interface HeatmapRowProps {
  coin: CoinData;
  rank: number;
}

function SkeletonCell({ w = 40 }: { w?: number }) {
  return <td className="px-2 py-2 text-center"><div className="skeleton h-4 mx-auto rounded" style={{ width: w }} /></td>;
}

export const HeatmapRow = memo(function HeatmapRow({ coin, rank }: HeatmapRowProps) {
  const even = rank % 2 === 0;
  const rowBg = even ? 'hsl(222,20%,8.2%)' : 'hsl(222,20%,7.4%)';
  const flashClass = coin.flashUp ? 'flash-up' : coin.flashDown ? 'flash-down' : '';

  return (
    <tr className={`transition-colors hover:bg-white/[0.025] ${flashClass}`} style={{ background: rowBg }}>

      {/* # */}
      <td className="px-2 py-2 text-center sticky left-0 z-10" style={{ background: rowBg, minWidth: 38 }}>
        <span style={{ color: '#3a3f4c', fontSize: 11 }}>{rank}</span>
      </td>

      {/* Asset */}
      <td className="px-3 py-2 sticky z-10" style={{ background: rowBg, left: 38, minWidth: 104 }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold"
            style={{ background: 'hsl(222,15%,16%)', color: '#f0b90b', fontSize: 8 }}>
            {formatSymbol(coin.symbol).slice(0, 3)}
          </div>
          <div>
            <div className="font-semibold" style={{ color: '#d1d5db', fontSize: 12 }}>{formatSymbol(coin.symbol)}</div>
            <div style={{ color: '#374151', fontSize: 10 }}>USDT</div>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="px-3 py-2 text-right" style={{ minWidth: 100 }}>
        <span className="font-mono font-semibold" style={{ color: '#e5e7eb', fontSize: 12 }}>
          ${formatPrice(coin.price)}
        </span>
      </td>

      {/* 1H % */}
      <td className="px-2 py-2 text-right" style={{ minWidth: 68 }}>
        <span className="font-mono" style={{ color: getChangeColor(coin.priceChange1h), fontSize: 11 }}>
          {formatPercent(coin.priceChange1h)}
        </span>
      </td>

      {/* 24H % */}
      <td className="px-2 py-2 text-right" style={{ minWidth: 68 }}>
        <span className="font-mono font-semibold" style={{ color: getChangeColor(coin.priceChange24h), fontSize: 11 }}>
          {formatPercent(coin.priceChange24h)}
        </span>
      </td>

      {/* Volume */}
      <td className="px-2 py-2 text-right" style={{ minWidth: 80 }}>
        <span className="font-mono" style={{ color: '#6b7280', fontSize: 11 }}>
          {formatVolume(coin.volume24h)}
        </span>
      </td>

      {/* RSI 15m / 1H / 4H / 1D */}
      <RSICell value={coin.rsi15m} loaded={coin.indicatorsLoaded} />
      <RSICell value={coin.rsi1h}  loaded={coin.indicatorsLoaded} />
      <RSICell value={coin.rsi4h}  loaded={coin.indicatorsLoaded} />
      <RSICell value={coin.rsi1d}  loaded={coin.indicatorsLoaded} />

      {/* MACD histogram */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={52} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 72 }}>
          {coin.macdHistogram !== null ? (
            <span className="font-mono" style={{
              color: coin.macdHistogram > 0 ? '#0ecb81' : '#f6465d',
              fontSize: 11,
            }}>
              {coin.macdHistogram > 0 ? '▲' : '▼'} {Math.abs(coin.macdHistogram).toFixed(4)}
            </span>
          ) : <span style={{ color: '#374151', fontSize: 12 }}>—</span>}
        </td>
      )}

      {/* BB %B */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={32} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 58 }}>
          {coin.bbPercent !== null ? (
            <span className="font-mono" style={{
              fontSize: 11,
              color: coin.bbPercent > 0.8 ? '#f6465d' : coin.bbPercent < 0.2 ? '#0ecb81' : '#6b7280',
            }}>
              {(coin.bbPercent * 100).toFixed(0)}%
            </span>
          ) : <span style={{ color: '#374151', fontSize: 12 }}>—</span>}
        </td>
      )}

      {/* ATR % */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={36} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 58 }}>
          <span className="font-mono" style={{ color: '#6b7280', fontSize: 11 }}>
            {coin.atrPercent !== null ? `${coin.atrPercent.toFixed(2)}%` : '—'}
          </span>
        </td>
      )}

      {/* Stochastic RSI K/D */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={44} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 70 }}>
          {coin.stochRsiK !== null ? (
            <div className="flex flex-col items-center" style={{ gap: 2 }}>
              <span className="font-mono" style={{
                fontSize: 10,
                color: coin.stochRsiK > 80 ? '#f6465d' : coin.stochRsiK < 20 ? '#0ecb81' : '#6b7280',
              }}>
                {coin.stochRsiK.toFixed(1)}
              </span>
              {coin.stochRsiD !== null && (
                <span className="font-mono" style={{ fontSize: 9, color: '#374151' }}>
                  {coin.stochRsiD.toFixed(1)}
                </span>
              )}
            </div>
          ) : <span style={{ color: '#374151', fontSize: 12 }}>—</span>}
        </td>
      )}

      {/* SuperTrend */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={40} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 62 }}>
          {coin.superTrend !== null ? (
            <span
              className="inline-block font-bold rounded px-1.5 py-0.5"
              style={{
                fontSize: 10,
                color: coin.superTrend === 1 ? '#0ecb81' : '#f6465d',
                background: coin.superTrend === 1 ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
                border: `1px solid ${coin.superTrend === 1 ? 'rgba(14,203,129,0.25)' : 'rgba(246,70,93,0.25)'}`,
              }}
            >
              {coin.superTrend === 1 ? '▲ BULL' : '▼ BEAR'}
            </span>
          ) : <span style={{ color: '#374151', fontSize: 12 }}>—</span>}
        </td>
      )}

      {/* Trend Score */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={56} /> : (
        <td className="px-3 py-2" style={{ minWidth: 96 }}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold" style={{ fontSize: 13, color: getTrendScoreColor(coin.trendScore) }}>
                {coin.trendScore}
              </span>
              <span style={{ fontSize: 9, color: '#374151' }}>
                {coin.trendScore >= 60 ? 'BULL' : coin.trendScore <= 40 ? 'BEAR' : 'NEU'}
              </span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'hsl(222,15%,14%)' }}>
              <div className="h-full rounded-full" style={{
                width: `${coin.trendScore}%`,
                background: coin.trendScore >= 60 ? '#0ecb81' : coin.trendScore >= 40 ? '#f3a52f' : '#f6465d',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        </td>
      )}

      {/* Signal */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={60} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 96 }}>
          <span
            className={`inline-block font-bold rounded px-2 py-0.5 ${classifySignal(coin.signal)}`}
            style={{ fontSize: 10, whiteSpace: 'nowrap' }}
            title={coin.signalReasons.join(' · ')}
          >
            {signalLabel(coin.signal)}
          </span>
        </td>
      )}
    </tr>
  );
}, (prev, next) =>
  prev.coin.price === next.coin.price &&
  prev.coin.rsi1h === next.coin.rsi1h &&
  prev.coin.rsi15m === next.coin.rsi15m &&
  prev.coin.rsi4h === next.coin.rsi4h &&
  prev.coin.rsi1d === next.coin.rsi1d &&
  prev.coin.indicatorsLoaded === next.coin.indicatorsLoaded &&
  prev.coin.trendScore === next.coin.trendScore &&
  prev.coin.signal === next.coin.signal &&
  prev.coin.superTrend === next.coin.superTrend &&
  prev.coin.flashUp === next.coin.flashUp &&
  prev.coin.flashDown === next.coin.flashDown &&
  prev.coin.priceChange24h === next.coin.priceChange24h &&
  prev.rank === next.rank
);
