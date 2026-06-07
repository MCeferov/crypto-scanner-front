import React, { memo } from 'react';
import { useLocation } from 'wouter';
import type { CoinData, RsiTf } from '../../context/MarketContext';
import { RSICell } from './RSICell';
import { formatPrice, formatVolume, formatSymbol, classifySignal, signalLabel } from '../../utils/formatters';
import { getTrendScoreColor } from '../../utils/colors';

const RSI_KEY: Record<RsiTf, keyof CoinData> = {
  '15m': 'rsi15m',
  '1h':  'rsi1h',
  '4h':  'rsi4h',
  '1d':  'rsi1d',
};

interface HeatmapRowProps {
  coin: CoinData;
  rank: number;
  visibleRsiCols: RsiTf[];
}

function SkeletonCell({ w = 40 }: { w?: number }) {
  return (
    <td className="px-2 py-2 text-center">
      <div className="skeleton h-4 mx-auto rounded" style={{ width: w }} />
    </td>
  );
}

export const HeatmapRow = memo(function HeatmapRow({ coin, rank, visibleRsiCols }: HeatmapRowProps) {
  const [, setLocation] = useLocation();
  const even      = rank % 2 === 0;
  const rowBg     = even ? 'var(--bg)' : 'var(--surface)';
  const flashClass = coin.flashUp ? 'flash-up' : coin.flashDown ? 'flash-down' : '';

  return (
    <tr
      className={`transition-colors hover:bg-white/[0.04] cursor-pointer ${flashClass}`}
      style={{ background: rowBg, height: 44 }}
      onClick={() => setLocation(`/coin/${coin.symbol}`)}
    >
      {/* Rank */}
      <td className="px-2 py-2 text-center sticky left-0 z-10" style={{ background: rowBg, minWidth: 38, width: 38 }}>
        <span className="text-[11px]" style={{ color: 'var(--dim)' }}>{rank}</span>
      </td>

      {/* Asset */}
      <td className="px-3 py-2 sticky z-10" style={{ background: rowBg, left: 38, minWidth: 110, width: 110 }}>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[8px]"
            style={{ background: 'var(--elevated)', color: '#f0b90b' }}
          >
            {formatSymbol(coin.symbol).slice(0, 3)}
          </div>
          <div>
            <div className="font-semibold text-xs" style={{ color: 'var(--text)' }}>{formatSymbol(coin.symbol)}</div>
            <div className="text-[10px]" style={{ color: 'var(--dim)' }}>USDT</div>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="px-3 py-2 text-right" style={{ minWidth: 100 }}>
        <span className="font-mono font-semibold text-xs" style={{ color: 'var(--text)' }}>
          ${formatPrice(coin.price)}
        </span>
      </td>

      {/* Dynamic RSI columns */}
      {visibleRsiCols.map(tf => (
        <RSICell
          key={tf}
          value={coin[RSI_KEY[tf]] as number | null}
          loaded={coin.indicatorsLoaded}
        />
      ))}

      {/* MACD */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={52} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 68 }}>
          {coin.macdHistogram !== null ? (
            <span className="font-mono text-[11px]" style={{ color: coin.macdHistogram > 0 ? '#26a69a' : '#ef5350' }}>
              {coin.macdHistogram > 0 ? '▲' : '▼'} {Math.abs(coin.macdHistogram).toFixed(4)}
            </span>
          ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
        </td>
      )}

      {/* Volume */}
      <td className="px-2 py-2 text-right" style={{ minWidth: 76 }}>
        <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
          {formatVolume(coin.volume24h)}
        </span>
      </td>

      {/* ATR % */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={36} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 54 }}>
          <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
            {coin.atrPercent !== null ? `${coin.atrPercent.toFixed(2)}%` : '—'}
          </span>
        </td>
      )}

      {/* Stoch RSI */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={44} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 62 }}>
          {coin.stochRsiK !== null ? (
            <span className="font-mono text-[11px]" style={{
              color: coin.stochRsiK > 80 ? '#ef5350' : coin.stochRsiK < 20 ? '#26a69a' : 'var(--muted)',
            }}>
              {coin.stochRsiK.toFixed(1)}
            </span>
          ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
        </td>
      )}

      {/* SuperTrend */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={40} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 58 }}>
          {coin.superTrend !== null ? (
            <span
              className="inline-block font-bold rounded px-1.5 py-0.5 text-[10px]"
              style={{
                color: coin.superTrend === 1 ? '#26a69a' : '#ef5350',
                background: coin.superTrend === 1 ? 'rgba(38,166,154,.10)' : 'rgba(239,83,80,.10)',
                border: `1px solid ${coin.superTrend === 1 ? 'rgba(38,166,154,.25)' : 'rgba(239,83,80,.25)'}`,
              }}
            >
              {coin.superTrend === 1 ? '▲' : '▼'}
            </span>
          ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
        </td>
      )}

      {/* BB %B */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={32} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 52 }}>
          {coin.bbPercent !== null ? (
            <span className="font-mono text-[11px]" style={{
              color: coin.bbPercent > 0.8 ? '#ef5350' : coin.bbPercent < 0.2 ? '#26a69a' : 'var(--muted)',
            }}>
              {(coin.bbPercent * 100).toFixed(0)}%
            </span>
          ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
        </td>
      )}

      {/* Trend Score */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={56} /> : (
        <td className="px-3 py-2" style={{ minWidth: 88 }}>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[13px]" style={{ color: getTrendScoreColor(coin.trendScore) }}>
              {coin.trendScore}
            </span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: 'var(--border)' }}>
              <div className="h-full rounded-full" style={{
                width: `${coin.trendScore}%`,
                background: coin.trendScore >= 60 ? '#26a69a' : coin.trendScore >= 40 ? '#f0b90b' : '#ef5350',
              }} />
            </div>
          </div>
        </td>
      )}

      {/* Signal */}
      {!coin.indicatorsLoaded ? <SkeletonCell w={60} /> : (
        <td className="px-2 py-2 text-center" style={{ minWidth: 88 }}>
          <span
            className={`inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap ${classifySignal(coin.signal)}`}
            title={coin.signalReasons.join(' · ')}
          >
            {signalLabel(coin.signal)}
          </span>
        </td>
      )}
    </tr>
  );
}, (prev, next) =>
  prev.coin.price         === next.coin.price         &&
  prev.coin.rsi15m        === next.coin.rsi15m        &&
  prev.coin.rsi1h         === next.coin.rsi1h         &&
  prev.coin.rsi4h         === next.coin.rsi4h         &&
  prev.coin.rsi1d         === next.coin.rsi1d         &&
  prev.coin.macdHistogram === next.coin.macdHistogram &&
  prev.coin.volume24h     === next.coin.volume24h     &&
  prev.coin.atrPercent    === next.coin.atrPercent    &&
  prev.coin.stochRsiK     === next.coin.stochRsiK     &&
  prev.coin.bbPercent     === next.coin.bbPercent     &&
  prev.coin.indicatorsLoaded === next.coin.indicatorsLoaded &&
  prev.coin.trendScore    === next.coin.trendScore    &&
  prev.coin.signal        === next.coin.signal        &&
  prev.coin.superTrend    === next.coin.superTrend    &&
  prev.coin.flashUp       === next.coin.flashUp       &&
  prev.coin.flashDown     === next.coin.flashDown     &&
  prev.rank               === next.rank               &&
  prev.visibleRsiCols.join() === next.visibleRsiCols.join()
);
