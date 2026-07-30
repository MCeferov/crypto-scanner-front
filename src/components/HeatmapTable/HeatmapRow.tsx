import React, { memo, useCallback } from 'react';
import { Star } from 'lucide-react';
import { useLocation } from 'wouter';
import type { CoinData, RsiTf, ExtraCol, AnalysisTf } from '../../context/MarketContext';
import { RSICell } from './RSICell';
import { CandleAge } from './CandleAge';
import {
  formatPrice, formatPercent, formatVolume, formatAssetPrice,
  classifySignal, classifyZoneBreakout, classifyHaTrend,
  zoneBreakoutLabel, haTrendLabel,
  mtfDirShort, classifyMtfDir, chartSignalLabel, classifyResearchSignal,
} from '../../utils/formatters';
import { TYPE_COLORS } from '../../types/asset';
import { isCryptoAsset } from '../../utils/assetHelpers';
import { useT } from '../../context/LocaleContext';
import { getTrendScoreColor } from '../../utils/colors';
import { classifyVolume } from '../../indicators/volumeConfirmation';

const MTF_COLS: { id: string; key: keyof CoinData; ageKey: keyof CoinData; label: string; tf: AnalysisTf }[] = [
  { id: 'mtf1m',  key: 'mtf1m',  ageKey: 'mtf1mCandles',  label: '1m',  tf: '1m' },
  { id: 'mtf5m',  key: 'mtf5m',  ageKey: 'mtf5mCandles',  label: '5m',  tf: '5m' },
  { id: 'mtf15',  key: 'mtf15m', ageKey: 'mtf15mCandles', label: '15m', tf: '15m' },
  { id: 'mtf30',  key: 'mtf30m', ageKey: 'mtf30mCandles', label: '30m', tf: '30m' },
  { id: 'mtf1h',  key: 'mtf1h',  ageKey: 'mtf1hCandles',  label: '1H',  tf: '1h' },
  { id: 'mtf4h',  key: 'mtf4h',  ageKey: 'mtf4hCandles',  label: '4H',  tf: '4h' },
];

const RSI_KEY: Record<RsiTf, keyof CoinData> = {
  '1m': 'rsi1m', '5m': 'rsi5m', '15m': 'rsi15m', '1h': 'rsi1h', '4h': 'rsi4h', '1d': 'rsi1d',
};

interface HeatmapRowProps {
  coin: CoinData;
  rank: number;
  visibleRsiCols: RsiTf[];
  visibleExtraCols: ExtraCol[];
  visibleAnalysisTfs: AnalysisTf[];
  visibleColIds: string[];
  rowHeight: number;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

function SkeletonCell({ w = 40 }: { w?: number }) {
  return (
    <td className="px-2 py-2 text-center">
      <div className="skeleton h-4 mx-auto rounded" style={{ width: w }} />
    </td>
  );
}

function VolumeConfirmCell({
  colId, coin, loaded, activeRsiTf, t,
}: {
  colId: string;
  coin: CoinData;
  loaded: boolean;
  activeRsiTf: RsiTf;
  t: (key: string) => string;
}) {
  if (!loaded) return <SkeletonCell key={colId} w={44} />;

  const { status, reason, buyPct } = classifyVolume(
    activeRsiTf,
    coin.volBuyRatios[activeRsiTf],
  );

  if (status === 'neutral') {
    return (
      <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 76 }}>
        <span
          className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold font-mono"
          title={reason}
          style={{ color: 'var(--muted)', background: 'var(--elevated)', border: '1px solid var(--border)' }}
        >
          {buyPct != null ? `${buyPct}%` : t('table.volumeNeutral')}
        </span>
      </td>
    );
  }

  if (status === 'nodata') {
    return (
      <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 76 }}>
        <span
          className="inline-block rounded px-2 py-0.5 text-[10px] font-bold"
          title={reason}
          style={{
            color: '#f3a52f',
            background: 'rgba(243,165,47,.08)',
            border: '1px dashed rgba(243,165,47,.45)',
          }}
        >
          {t('table.volumeNoData')}
        </span>
      </td>
    );
  }

  const real = status === 'real';
  return (
    <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 76 }}>
      <span
        className="inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap font-mono"
        title={reason}
        style={{
          color: real ? '#26a69a' : '#ef5350',
          background: real ? 'rgba(38,166,154,.12)' : 'rgba(239,83,80,.12)',
          border: `1px solid ${real ? 'rgba(38,166,154,.3)' : 'rgba(239,83,80,.3)'}`,
        }}
      >
        {real ? t('table.volumeReal') : t('table.volumeFake')}
        {buyPct != null ? ` ${buyPct}%` : ''}
      </span>
    </td>
  );
}

export const HeatmapRow = memo(function HeatmapRow({
  coin, rank, visibleAnalysisTfs, visibleColIds, rowHeight, isFavorite, onToggleFavorite,
}: HeatmapRowProps) {
  const [, setLocation] = useLocation();
  const t = useT();
  // Uniform surface + 1px separators (CSS) — zebra fought with hover/flash
  // backgrounds and read as visual noise across 20+ columns.
  const rowBg = 'var(--surface)';
  const flashClass = coin.flashUp ? 'flash-up' : coin.flashDown ? 'flash-down' : '';
  const loaded = coin.indicatorsLoaded;
  const typeStyle = TYPE_COLORS[coin.type];
  const activeRsiTf = (visibleColIds.find(id => id.startsWith('rsi-'))?.slice(4) as RsiTf) ?? '1m';

  const handleClick = () => {
    if (isCryptoAsset(coin)) {
      setLocation(`/coin/${coin.symbol}`);
    } else {
      setLocation(`/asset/${coin.type}/${coin.baseAsset}`);
    }
  };

  const setupTooltip = [
    coin.syncStatus !== 'WEAK' || coin.syncScore > 0
      ? `Sinxron: ${coin.syncStatus} (${coin.syncScore}%)` : '',
    coin.syncLeader !== '—' ? `Lider: ${coin.syncLeader} — ${coin.syncLeaderCandles} şam` : '',
    coin.setupCandles > 0 ? `Setup: ${coin.setupCandles} şamdır (min. aktiv müddət)` : '',
    coin.setupCandles <= 2 && coin.setupSignal !== 'NEUTRAL' ? '⚠ Yeni setup — 2 şamdan az' : '',
    coin.syncStatus === 'MISMATCH' ? '⚠ İndikatorlar sinxron deyil — setup zəiflədildi' : '',
    coin.reversalRisk !== 'NONE' ? `⚠ Flip risk: ${coin.reversalRisk} (${coin.mtfAlignment})` : '',
    ...coin.syncReasons.slice(0, 4),
    ...coin.reversalReasons,
    '---',
    ...coin.setupReasons,
  ].filter(Boolean).join('\n');

  const renderCell = useCallback((colId: string): React.ReactNode => {
    switch (colId) {
      case 'fav':
        return (
          <td key={colId} className="text-center sticky left-0 z-10" style={{ background: rowBg, minWidth: 30, width: 30, padding: 0 }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(coin.id); }}
              aria-label={isFavorite ? 'Remove from watchlist' : 'Add to watchlist'}
              className="p-1.5 transition-colors hover:opacity-100"
              style={{ color: isFavorite ? '#f3a52f' : 'var(--dim)', opacity: isFavorite ? 1 : 0.55 }}
            >
              <Star size={13} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </td>
        );

      case 'rank':
        return (
          <td key={colId} className="px-2 py-2 text-center sticky z-10" style={{ background: rowBg, left: 30, minWidth: 38, width: 38 }}>
            <span className="text-[11px]" style={{ color: 'var(--dim)' }}>{rank}</span>
          </td>
        );

      case 'asset':
        return (
          <td key={colId} className="px-3 py-2 sticky z-10" style={{ background: rowBg, left: 68, minWidth: 150, width: 150 }}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px]"
                style={{ background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}` }}>
                {coin.baseAsset.slice(0, 3)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs truncate" style={{ color: 'var(--text)' }}>
                  {coin.baseAsset}
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] truncate" style={{ color: 'var(--dim)' }}>{coin.name}</span>
                  <span
                    className="text-[10px] px-1 py-px rounded font-semibold shrink-0"
                    style={{ background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}` }}
                  >
                    {t(`assetType.${coin.type}`)}
                  </span>
                </div>
              </div>
            </div>
          </td>
        );

      case 'price':
        return (
          <td key={colId} className="px-3 py-2 text-right" style={{ minWidth: 100 }}>
            <span className="font-mono font-semibold text-xs" style={{ color: 'var(--text)' }}>
              {formatAssetPrice(coin.price, coin.type)}
            </span>
          </td>
        );

      case 'change':
        return (
          <td key={colId} className="px-2 py-2 text-right" style={{ minWidth: 72 }}>
            <span
              className="font-mono text-[11px] font-semibold"
              style={{ color: coin.priceChange24h > 0 ? '#26a69a' : coin.priceChange24h < 0 ? '#ef5350' : 'var(--muted)' }}
            >
              {formatPercent(coin.priceChange24h)}
            </span>
          </td>
        );

      case 'volume':
        return (
          <td key={colId} className="px-2 py-2 text-right" style={{ minWidth: 76 }}>
            <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
              {formatVolume(coin.volume24h)}
            </span>
          </td>
        );

      case 'vol24h':
        return <VolumeConfirmCell key={colId} colId={colId} coin={coin} loaded={loaded} activeRsiTf={activeRsiTf} t={t} />;

      case 'macd':
        return !loaded ? <SkeletonCell key={colId} w={52} /> : (
          <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 68 }}>
            {coin.macdHistogram !== null ? (
              <span className="font-mono text-[11px]" style={{ color: coin.macdHistogram > 0 ? '#26a69a' : '#ef5350' }}>
                {coin.macdHistogram > 0 ? '▲' : '▼'} {Math.abs(coin.macdHistogram).toFixed(4)}
                <CandleAge candles={coin.macdCandles} />
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        );

      case 'stoch':
        return !loaded ? <SkeletonCell key={colId} w={44} /> : (
          <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 62 }}>
            {coin.stochRsiK !== null ? (
              <span className="font-mono text-[11px]" style={{
                color: coin.stochRsiK > 80 ? '#ef5350' : coin.stochRsiK < 20 ? '#26a69a' : 'var(--muted)',
              }}>{coin.stochRsiK.toFixed(1)}<CandleAge candles={coin.stochCandles} /></span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        );

      case 'st':
        return !loaded ? <SkeletonCell key={colId} w={40} /> : (
          <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 58 }}>
            {coin.superTrend !== null ? (
              <span className="inline-block font-bold rounded px-1.5 py-0.5 text-[10px]"
                style={{
                  color: coin.superTrend === 1 ? '#26a69a' : '#ef5350',
                  background: coin.superTrend === 1 ? 'rgba(38,166,154,.10)' : 'rgba(239,83,80,.10)',
                  border: `1px solid ${coin.superTrend === 1 ? 'rgba(38,166,154,.25)' : 'rgba(239,83,80,.25)'}`,
                }}>{coin.superTrend === 1 ? '▲' : '▼'}<CandleAge candles={coin.stCandles} /></span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        );

      case 'trend':
        return !loaded ? <SkeletonCell key={colId} w={56} /> : (
          <td key={colId} className="px-3 py-2" style={{ minWidth: 80 }}>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[13px]" style={{ color: getTrendScoreColor(coin.trendScore) }}>
                {coin.trendScore}
              </span>
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${coin.trendScore}%`,
                  background: coin.trendScore >= 60 ? '#26a69a' : coin.trendScore >= 40 ? '#f3a52f' : '#ef5350',
                }} />
              </div>
            </div>
          </td>
        );

      case 'mtf':
        return !loaded ? <SkeletonCell key={colId} w={88} /> : (
          <td key={colId} className="px-1 py-2 text-center" style={{ minWidth: 108 }}>
            <div className="flex items-center justify-center gap-0.5" title={[
              coin.mtfAlignment === 'CONFLICT' ? '⚠ TF ziddiyyəti — flip riski' : '',
              coin.mtfAlignment === 'MIXED' ? 'TF qarışıq' : '',
              ...coin.chartSignalReasons,
            ].filter(Boolean).join('\n')}>
              {MTF_COLS.filter(col => visibleAnalysisTfs.includes(col.tf)).map(col => {
                const dir = coin[col.key] as string;
                const candles = coin[col.ageKey] as number;
                return (
                  <span
                    key={col.id}
                    className={`inline-block font-bold rounded px-1 py-0.5 text-[10px] font-mono leading-none ${classifyMtfDir(dir)}`}
                    title={`${col.label}: ${dir}${candles ? ` — ${candles} şam` : ''}`}
                  >
                    {col.label.replace('m', '')}{mtfDirShort(dir)}
                    <CandleAge candles={dir !== 'NEUTRAL' ? candles : 0} />
                  </span>
                );
              })}
            </div>
          </td>
        );

      case 'chartSig':
        return !loaded ? <SkeletonCell key={colId} w={44} /> : (
          <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 64 }}>
            {coin.chartSignal !== 'NEUTRAL' ? (
              <span
                className={`inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap ${classifySignal(coin.chartSignal)}`}
                title={coin.chartSignalReasons.join('\n')}
              >
                {chartSignalLabel(coin.chartSignal)}
                <CandleAge candles={coin.chartCandles} />
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        );

      case 'research':
        return !loaded ? <SkeletonCell key={colId} w={56} /> : (
          <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 72 }}>
            {coin.researchSignal !== 'NEUTRAL' ? (
              <span
                className={`inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap ${classifyResearchSignal(coin.researchSignal)}`}
                title={coin.researchReasons.join('\n')}
              >
                {coin.researchLabel}
                <CandleAge candles={coin.chartCandles} />
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        );

      case 'ha':
        return !loaded ? <SkeletonCell key={colId} w={32} /> : (
          <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 44 }}>
            {coin.haTrend !== 0 ? (
              <span
                className={`inline-block font-bold rounded px-1.5 py-0.5 text-[10px] font-mono ${classifyHaTrend(coin.haTrend)}`}
                title={coin.haReasons.join(' · ')}
              >
                {haTrendLabel(coin.haTrend, coin.haConsecutive)}
                <CandleAge candles={coin.haCandles} />
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        );

      case 'zone':
        return !loaded ? <SkeletonCell key={colId} w={72} /> : (
          <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 88 }}>
            <div className="flex flex-col items-center gap-0.5 leading-tight" title={coin.zoneSignalReasons.join('\n')}>
              {coin.demandZonePrice !== null ? (
                <span className="font-mono text-[10px] font-semibold" style={{ color: '#26a69a' }}>
                  D {formatPrice(coin.demandZonePrice)}
                </span>
              ) : (
                <span className="text-[10px]" style={{ color: 'var(--dim)' }}>D —</span>
              )}
              {coin.supplyZonePrice !== null ? (
                <span className="font-mono text-[10px] font-semibold" style={{ color: '#ef5350' }}>
                  S {formatPrice(coin.supplyZonePrice)}
                </span>
              ) : (
                <span className="text-[10px]" style={{ color: 'var(--dim)' }}>S —</span>
              )}
              <CandleAge candles={coin.zoneCandles} />
            </div>
          </td>
        );

      case 'break':
        return !loaded ? <SkeletonCell key={colId} w={56} /> : (
          <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 68 }}>
            {coin.zoneBreakoutSignal !== 'NEUTRAL' ? (
              <span className={`inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap ${classifyZoneBreakout(coin.zoneBreakoutSignal)}`}
                title={coin.zoneBreakoutReasons.join(' · ')}>
                {zoneBreakoutLabel(coin.zoneBreakoutSignal)}
                <CandleAge candles={coin.zoneCandles} />
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        );

      case 'sl':
        return !loaded ? <SkeletonCell key={colId} w={52} /> : (
          <td key={colId} className="px-2 py-2 text-right" style={{ minWidth: 72 }}>
            <span
              className="font-mono text-[11px]"
              style={{ color: coin.stopLoss ? '#ef5350' : 'var(--dim)' }}
              title={coin.riskRewardNote || 'SL = demand/supply zona + ATR buffer'}
            >
              {coin.stopLoss ? `$${formatPrice(coin.stopLoss)}` : '—'}
            </span>
          </td>
        );

      case 'tp':
        return !loaded ? <SkeletonCell key={colId} w={52} /> : (
          <td key={colId} className="px-2 py-2 text-right" style={{ minWidth: 72 }}>
            <span
              className="font-mono text-[11px]"
              style={{ color: coin.takeProfit ? '#26a69a' : 'var(--dim)' }}
              title={coin.riskRewardNote || 'TP = əks zona və ya 2.5×ATR'}
            >
              {coin.takeProfit ? `$${formatPrice(coin.takeProfit)}` : '—'}
            </span>
          </td>
        );

      case 'setup':
        return !loaded ? <SkeletonCell key={colId} w={60} /> : (
          <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 88 }}>
            {coin.setupSignal !== 'NEUTRAL' ? (
              <span
                className={`inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap ${classifySignal(coin.setupSignal)}`}
                title={[
                  coin.confidence > 0 ? `Confidence: ${coin.confidence}%` : '',
                  ...coin.confidenceReasons.slice(0, 4),
                  setupTooltip,
                ].filter(Boolean).join('\n')}
              >
                {coin.reversalRisk === 'HIGH' && <span className="mr-0.5">⚠</span>}
                {coin.setupLabel}
                <CandleAge candles={coin.setupCandles} />
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--dim)' }}>—</span>}
          </td>
        );

      default:
        if (colId.startsWith('rsi-')) {
          const tf = colId.slice(4) as RsiTf;
          return <RSICell key={colId} value={coin[RSI_KEY[tf]] as number | null} loaded={loaded} />;
        }
        return null;
    }
  }, [coin, loaded, rank, rowBg, setupTooltip, t, typeStyle, visibleAnalysisTfs, activeRsiTf, isFavorite, onToggleFavorite]);

  return (
    <tr
      className={`transition-colors row-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2962ff] focus-visible:-outline-offset-2 ${flashClass}`}
      style={{ background: rowBg, height: rowHeight }}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={coin.name}
    >
      {visibleColIds.map(colId => renderCell(colId))}
    </tr>
  );
}, (prev, next) =>
  // Coins are updated immutably (changed coins get new objects, untouched
  // ones keep their reference), so reference equality is both cheaper and
  // safer than the old 50-field list, which silently omitted rendered fields
  // (candle ages, reversal risk, tooltips) and let cells go stale.
  prev.coin === next.coin &&
  prev.rank === next.rank &&
  prev.rowHeight === next.rowHeight &&
  prev.isFavorite === next.isFavorite &&
  prev.visibleRsiCols.join() === next.visibleRsiCols.join() &&
  prev.visibleExtraCols.join() === next.visibleExtraCols.join() &&
  prev.visibleAnalysisTfs.join() === next.visibleAnalysisTfs.join() &&
  prev.visibleColIds.join() === next.visibleColIds.join()
);
