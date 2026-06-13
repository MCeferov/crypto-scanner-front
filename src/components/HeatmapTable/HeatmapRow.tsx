import React, { memo } from 'react';
import { useLocation } from 'wouter';
import type { CoinData, RsiTf, ExtraCol } from '../../context/MarketContext';
import { RSICell } from './RSICell';
import {
  formatPrice, formatVolume, formatSymbol,
  classifySignal, classifyZoneBreakout, classifyHaTrend,
  zoneBreakoutLabel, zonePositionLabel, haTrendLabel,
  mtfDirShort, classifyMtfDir, chartSignalLabel,
} from '../../utils/formatters';
import { getTrendScoreColor } from '../../utils/colors';

const MTF_COLS: { id: string; key: keyof CoinData; label: string }[] = [
  { id: 'mtf15', key: 'mtf15m', label: '15m' },
  { id: 'mtf30', key: 'mtf30m', label: '30m' },
  { id: 'mtf1h', key: 'mtf1h',  label: '1H' },
  { id: 'mtf4h', key: 'mtf4h',  label: '4H' },
];

const RSI_KEY: Record<RsiTf, keyof CoinData> = {
  '15m': 'rsi15m', '1h': 'rsi1h', '4h': 'rsi4h', '1d': 'rsi1d',
};

interface HeatmapRowProps {
  coin: CoinData;
  rank: number;
  visibleRsiCols: RsiTf[];
  visibleExtraCols: ExtraCol[];
  visibleColIds: string[];
}

function SkeletonCell({ w = 40 }: { w?: number }) {
  return (
    <td className="px-2 py-2 text-center">
      <div className="skeleton h-4 mx-auto rounded" style={{ width: w }} />
    </td>
  );
}

function has(cols: string[], id: string) {
  return cols.includes(id);
}

export const HeatmapRow = memo(function HeatmapRow({
  coin, rank, visibleRsiCols, visibleExtraCols, visibleColIds,
}: HeatmapRowProps) {
  const [, setLocation] = useLocation();
  const even = rank % 2 === 0;
  const rowBg = even ? 'var(--bg)' : 'var(--surface)';
  const flashClass = coin.flashUp ? 'flash-up' : coin.flashDown ? 'flash-down' : '';
  const loaded = coin.indicatorsLoaded;

  const setupTooltip = [
    ...coin.setupReasons,
    coin.setupConviction > 0 ? `Conviction: ${coin.setupConviction}` : '',
    `HA: ${coin.haReasons.join(', ')}`,
    `Zone: ${coin.zoneBreakoutReasons.join(', ')}`,
  ].filter(Boolean).join(' · ');

  return (
    <tr
      className={`transition-colors hover:bg-white/[0.04] cursor-pointer ${flashClass}`}
      style={{ background: rowBg, height: 44 }}
      onClick={() => setLocation(`/coin/${coin.symbol}`)}
    >
      {has(visibleColIds, 'rank') && (
        <td className="px-2 py-2 text-center sticky left-0 z-10" style={{ background: rowBg, minWidth: 38, width: 38 }}>
          <span className="text-[11px]" style={{ color: 'var(--dim)' }}>{rank}</span>
        </td>
      )}

      {has(visibleColIds, 'asset') && (
        <td className="px-3 py-2 sticky z-10" style={{ background: rowBg, left: 38, minWidth: 110, width: 110 }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[8px]"
              style={{ background: 'var(--elevated)', color: '#f0b90b' }}>
              {formatSymbol(coin.symbol).slice(0, 3)}
            </div>
            <div>
              <div className="font-semibold text-xs" style={{ color: 'var(--text)' }}>{formatSymbol(coin.symbol)}</div>
              <div className="text-[10px]" style={{ color: 'var(--dim)' }}>USDT</div>
            </div>
          </div>
        </td>
      )}

      {has(visibleColIds, 'price') && (
        <td className="px-3 py-2 text-right" style={{ minWidth: 100 }}>
          <span className="font-mono font-semibold text-xs" style={{ color: 'var(--text)' }}>
            ${formatPrice(coin.price)}
          </span>
        </td>
      )}

      {visibleRsiCols.map(tf => (
        <RSICell key={tf} value={coin[RSI_KEY[tf]] as number | null} loaded={loaded} />
      ))}

      {visibleExtraCols.includes('macd') && (
        !loaded ? <SkeletonCell w={52} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 68 }}>
            {coin.macdHistogram !== null ? (
              <span className="font-mono text-[11px]" style={{ color: coin.macdHistogram > 0 ? '#26a69a' : '#ef5350' }}>
                {coin.macdHistogram > 0 ? '▲' : '▼'} {Math.abs(coin.macdHistogram).toFixed(4)}
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        )
      )}

      {visibleExtraCols.includes('volume') && (
        <td className="px-2 py-2 text-right" style={{ minWidth: 76 }}>
          <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{formatVolume(coin.volume24h)}</span>
        </td>
      )}

      {visibleExtraCols.includes('atr') && (
        !loaded ? <SkeletonCell w={36} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 54 }}>
            <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
              {coin.atrPercent !== null ? `${coin.atrPercent.toFixed(2)}%` : '—'}
            </span>
          </td>
        )
      )}

      {visibleExtraCols.includes('stoch') && (
        !loaded ? <SkeletonCell w={44} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 62 }}>
            {coin.stochRsiK !== null ? (
              <span className="font-mono text-[11px]" style={{
                color: coin.stochRsiK > 80 ? '#ef5350' : coin.stochRsiK < 20 ? '#26a69a' : 'var(--muted)',
              }}>{coin.stochRsiK.toFixed(1)}</span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        )
      )}

      {visibleExtraCols.includes('st') && (
        !loaded ? <SkeletonCell w={40} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 58 }}>
            {coin.superTrend !== null ? (
              <span className="inline-block font-bold rounded px-1.5 py-0.5 text-[10px]"
                style={{
                  color: coin.superTrend === 1 ? '#26a69a' : '#ef5350',
                  background: coin.superTrend === 1 ? 'rgba(38,166,154,.10)' : 'rgba(239,83,80,.10)',
                  border: `1px solid ${coin.superTrend === 1 ? 'rgba(38,166,154,.25)' : 'rgba(239,83,80,.25)'}`,
                }}>{coin.superTrend === 1 ? '▲' : '▼'}</span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        )
      )}

      {visibleExtraCols.includes('bb') && (
        !loaded ? <SkeletonCell w={32} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 52 }}>
            {coin.bbPercent !== null ? (
              <span className="font-mono text-[11px]" style={{
                color: coin.bbPercent > 0.8 ? '#ef5350' : coin.bbPercent < 0.2 ? '#26a69a' : 'var(--muted)',
              }}>{(coin.bbPercent * 100).toFixed(0)}%</span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        )
      )}

      {has(visibleColIds, 'trend') && (
        !loaded ? <SkeletonCell w={56} /> : (
          <td className="px-3 py-2" style={{ minWidth: 80 }}>
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
        )
      )}

      {has(visibleColIds, 'mtf') && (
        !loaded ? <SkeletonCell w={88} /> : (
          <td className="px-1 py-2 text-center" style={{ minWidth: 108 }}>
            <div className="flex items-center justify-center gap-0.5" title={coin.chartSignalReasons.join('\n')}>
              {MTF_COLS.map(col => {
                const dir = coin[col.key] as string;
                return (
                  <span
                    key={col.id}
                    className={`inline-block font-bold rounded px-1 py-0.5 text-[9px] font-mono leading-none ${classifyMtfDir(dir)}`}
                    title={`${col.label}: ${dir}`}
                  >
                    {col.label.replace('m', '')}{mtfDirShort(dir)}
                  </span>
                );
              })}
            </div>
          </td>
        )
      )}

      {has(visibleColIds, 'chartSig') && (
        !loaded ? <SkeletonCell w={44} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 64 }}>
            {coin.chartSignal !== 'NEUTRAL' ? (
              <span
                className={`inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap ${classifySignal(coin.chartSignal)}`}
                title={coin.chartSignalReasons.join('\n')}
              >
                {chartSignalLabel(coin.chartSignal)}
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        )
      )}

      {has(visibleColIds, 'ha') && (
        !loaded ? <SkeletonCell w={32} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 44 }}>
            {coin.haTrend !== 0 ? (
              <span
                className={`inline-block font-bold rounded px-1.5 py-0.5 text-[10px] font-mono ${classifyHaTrend(coin.haTrend)}`}
                title={coin.haReasons.join(' · ')}
              >
                {haTrendLabel(coin.haTrend, coin.haConsecutive)}
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        )
      )}

      {has(visibleColIds, 'zone') && (
        !loaded ? <SkeletonCell w={28} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 44 }}>
            <span className="inline-block font-bold rounded px-1.5 py-0.5 text-[10px]"
              title={coin.zoneSignalReasons.join(' · ') || 'No zone data'}
              style={{
                color: coin.zonePosition === 'at_demand' || coin.zonePosition === 'near_demand' ? '#26a69a'
                  : coin.zonePosition === 'at_supply' || coin.zonePosition === 'near_supply' ? '#ef5350'
                  : coin.zonePosition === 'between' ? '#f0b90b' : 'var(--dim)',
                background: coin.zonePosition === 'at_demand' || coin.zonePosition === 'near_demand' ? 'rgba(38,166,154,.10)'
                  : coin.zonePosition === 'at_supply' || coin.zonePosition === 'near_supply' ? 'rgba(239,83,80,.10)'
                  : coin.zonePosition === 'between' ? 'rgba(240,185,11,.08)' : 'transparent',
                border: `1px solid ${
                  coin.zonePosition === 'at_demand' || coin.zonePosition === 'near_demand' ? 'rgba(38,166,154,.25)'
                  : coin.zonePosition === 'at_supply' || coin.zonePosition === 'near_supply' ? 'rgba(239,83,80,.25)'
                  : coin.zonePosition === 'between' ? 'rgba(240,185,11,.25)' : 'var(--border)'}`,
              }}>
              {zonePositionLabel(coin.zonePosition)}
            </span>
          </td>
        )
      )}

      {has(visibleColIds, 'break') && (
        !loaded ? <SkeletonCell w={56} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 68 }}>
            {coin.zoneBreakoutSignal !== 'NEUTRAL' ? (
              <span className={`inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap ${classifyZoneBreakout(coin.zoneBreakoutSignal)}`}
                title={coin.zoneBreakoutReasons.join(' · ')}>
                {zoneBreakoutLabel(coin.zoneBreakoutSignal)}
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        )
      )}

      {has(visibleColIds, 'sl') && (
        !loaded ? <SkeletonCell w={52} /> : (
          <td className="px-2 py-2 text-right" style={{ minWidth: 72 }}>
            <span className="font-mono text-[11px]" style={{ color: coin.stopLoss ? '#ef5350' : 'var(--dim)' }}>
              {coin.stopLoss ? `$${formatPrice(coin.stopLoss)}` : '—'}
            </span>
          </td>
        )
      )}

      {has(visibleColIds, 'tp') && (
        !loaded ? <SkeletonCell w={52} /> : (
          <td className="px-2 py-2 text-right" style={{ minWidth: 72 }}>
            <span className="font-mono text-[11px]" style={{ color: coin.takeProfit ? '#26a69a' : 'var(--dim)' }}>
              {coin.takeProfit ? `$${formatPrice(coin.takeProfit)}` : '—'}
            </span>
          </td>
        )
      )}

      {has(visibleColIds, 'rr') && (
        !loaded ? <SkeletonCell w={32} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 44 }}>
            <span className="font-mono text-[11px]" style={{
              color: coin.riskReward && coin.riskReward >= 2 ? '#26a69a'
                : coin.riskReward && coin.riskReward >= 1.5 ? '#f0b90b' : 'var(--dim)',
            }}>
              {coin.riskReward !== null ? `${coin.riskReward.toFixed(1)}` : '—'}
            </span>
          </td>
        )
      )}

      {has(visibleColIds, 'setup') && (
        !loaded ? <SkeletonCell w={60} /> : (
          <td className="px-2 py-2 text-center" style={{ minWidth: 88 }}>
            {coin.setupSignal !== 'NEUTRAL' ? (
              <span
                className={`inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap ${classifySignal(coin.setupSignal)}`}
                title={setupTooltip}
              >
                {coin.setupLabel}
                {coin.setupConviction > 0 && (
                  <span className="opacity-60 ml-1">{coin.setupConviction}</span>
                )}
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        )
      )}
    </tr>
  );
}, (prev, next) =>
  prev.coin.price === next.coin.price &&
  prev.coin.rsi15m === next.coin.rsi15m &&
  prev.coin.rsi1h === next.coin.rsi1h &&
  prev.coin.rsi4h === next.coin.rsi4h &&
  prev.coin.rsi1d === next.coin.rsi1d &&
  prev.coin.macdHistogram === next.coin.macdHistogram &&
  prev.coin.volume24h === next.coin.volume24h &&
  prev.coin.atrPercent === next.coin.atrPercent &&
  prev.coin.stochRsiK === next.coin.stochRsiK &&
  prev.coin.bbPercent === next.coin.bbPercent &&
  prev.coin.indicatorsLoaded === next.coin.indicatorsLoaded &&
  prev.coin.trendScore === next.coin.trendScore &&
  prev.coin.mtf15m === next.coin.mtf15m &&
  prev.coin.mtf30m === next.coin.mtf30m &&
  prev.coin.mtf1h === next.coin.mtf1h &&
  prev.coin.mtf4h === next.coin.mtf4h &&
  prev.coin.chartSignal === next.coin.chartSignal &&
  prev.coin.haTrend === next.coin.haTrend &&
  prev.coin.haConsecutive === next.coin.haConsecutive &&
  prev.coin.setupSignal === next.coin.setupSignal &&
  prev.coin.zoneBreakoutSignal === next.coin.zoneBreakoutSignal &&
  prev.coin.zonePosition === next.coin.zonePosition &&
  prev.coin.stopLoss === next.coin.stopLoss &&
  prev.coin.takeProfit === next.coin.takeProfit &&
  prev.coin.riskReward === next.coin.riskReward &&
  prev.coin.superTrend === next.coin.superTrend &&
  prev.coin.flashUp === next.coin.flashUp &&
  prev.coin.flashDown === next.coin.flashDown &&
  prev.rank === next.rank &&
  prev.visibleRsiCols.join() === next.visibleRsiCols.join() &&
  prev.visibleExtraCols.join() === next.visibleExtraCols.join() &&
  prev.visibleColIds.join() === next.visibleColIds.join()
);
