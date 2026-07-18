import React, { memo, useCallback } from 'react';
import { useLocation } from 'wouter';
import type { CoinData, RsiTf, ExtraCol, AnalysisTf } from '../../context/MarketContext';
import { RSICell } from './RSICell';
import { CandleAge } from './CandleAge';
import {
  formatPrice, formatPercent, formatAssetPrice,
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

  const rsiValue = coin[RSI_KEY[activeRsiTf]] as number | null;
  const { status, reason } = classifyVolume(
    activeRsiTf,
    rsiValue,
    coin.volBuyRatios[activeRsiTf],
  );

  if (status === 'neutral') {
    return (
      <td key={colId} className="px-2 py-2 text-center" style={{ minWidth: 76 }}>
        <span
          className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold"
          title={reason}
          style={{ color: 'var(--muted)', background: 'var(--elevated)', border: '1px solid var(--border)' }}
        >
          {t('table.volumeNeutral')}
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
            color: '#f0b90b',
            background: 'rgba(240,185,11,.08)',
            border: '1px dashed rgba(240,185,11,.45)',
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
        className="inline-block font-bold rounded px-2 py-0.5 text-[10px] whitespace-nowrap"
        title={reason}
        style={{
          color: real ? '#26a69a' : '#ef5350',
          background: real ? 'rgba(38,166,154,.12)' : 'rgba(239,83,80,.12)',
          border: `1px solid ${real ? 'rgba(38,166,154,.3)' : 'rgba(239,83,80,.3)'}`,
        }}
      >
        {real ? t('table.volumeReal') : t('table.volumeFake')}
      </span>
    </td>
  );
}

export const HeatmapRow = memo(function HeatmapRow({
  coin, rank, visibleAnalysisTfs, visibleColIds,
}: HeatmapRowProps) {
  const [, setLocation] = useLocation();
  const t = useT();
  const even = rank % 2 === 0;
  const rowBg = even ? 'var(--bg)' : 'var(--surface)';
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
      case 'rank':
        return (
          <td key={colId} className="px-2 py-2 text-center sticky left-0 z-10" style={{ background: rowBg, minWidth: 38, width: 38 }}>
            <span className="text-[11px]" style={{ color: 'var(--dim)' }}>{rank}</span>
          </td>
        );

      case 'asset':
        return (
          <td key={colId} className="px-3 py-2 sticky z-10" style={{ background: rowBg, left: 38, minWidth: 150, width: 150 }}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-[9px]"
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
                    className="text-[8px] px-1 py-px rounded font-semibold shrink-0"
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
                  background: coin.trendScore >= 60 ? '#26a69a' : coin.trendScore >= 40 ? '#f0b90b' : '#ef5350',
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
                    className={`inline-block font-bold rounded px-1 py-0.5 text-[9px] font-mono leading-none ${classifyMtfDir(dir)}`}
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
  }, [coin, loaded, rank, rowBg, setupTooltip, t, typeStyle, visibleAnalysisTfs, activeRsiTf]);

  return (
    <tr
      className={`transition-colors hover:bg-white/[0.04] cursor-pointer ${flashClass}`}
      style={{ background: rowBg, height: 44 }}
      onClick={handleClick}
    >
      {visibleColIds.map(colId => renderCell(colId))}
    </tr>
  );
}, (prev, next) =>
  prev.coin.price === next.coin.price &&
  prev.coin.priceChange24h === next.coin.priceChange24h &&
  prev.coin.name === next.coin.name &&
  prev.coin.type === next.coin.type &&
  prev.coin.rsi1m === next.coin.rsi1m &&
  prev.coin.rsi5m === next.coin.rsi5m &&
  prev.coin.rsi15m === next.coin.rsi15m &&
  prev.coin.rsi1h === next.coin.rsi1h &&
  prev.coin.rsi4h === next.coin.rsi4h &&
  prev.coin.rsi1d === next.coin.rsi1d &&
  prev.coin.macdHistogram === next.coin.macdHistogram &&
  prev.coin.volume24h === next.coin.volume24h &&
  prev.coin.atrPercent === next.coin.atrPercent &&
  prev.coin.stochRsiK === next.coin.stochRsiK &&
  prev.coin.indicatorsLoaded === next.coin.indicatorsLoaded &&
  prev.coin.trendScore === next.coin.trendScore &&
  prev.coin.mtf1m === next.coin.mtf1m &&
  prev.coin.mtf5m === next.coin.mtf5m &&
  prev.coin.mtf15m === next.coin.mtf15m &&
  prev.coin.mtf30m === next.coin.mtf30m &&
  prev.coin.mtf1h === next.coin.mtf1h &&
  prev.coin.mtf4h === next.coin.mtf4h &&
  prev.coin.chartSignal === next.coin.chartSignal &&
  prev.coin.researchSignal === next.coin.researchSignal &&
  prev.coin.researchLabel === next.coin.researchLabel &&
  prev.coin.haTrend === next.coin.haTrend &&
  prev.coin.haConsecutive === next.coin.haConsecutive &&
  prev.coin.setupSignal === next.coin.setupSignal &&
  prev.coin.setupLabel === next.coin.setupLabel &&
  prev.coin.confidence === next.coin.confidence &&
  prev.coin.zoneBreakoutSignal === next.coin.zoneBreakoutSignal &&
  prev.coin.zonePosition === next.coin.zonePosition &&
  prev.coin.demandZonePrice === next.coin.demandZonePrice &&
  prev.coin.supplyZonePrice === next.coin.supplyZonePrice &&
  prev.coin.stopLoss === next.coin.stopLoss &&
  prev.coin.takeProfit === next.coin.takeProfit &&
  prev.coin.superTrend === next.coin.superTrend &&
  prev.coin.macdCandles === next.coin.macdCandles &&
  prev.coin.stCandles === next.coin.stCandles &&
  prev.coin.volumeGate === next.coin.volumeGate &&
  prev.coin.volBuyRatios['1m'] === next.coin.volBuyRatios['1m'] &&
  prev.coin.volBuyRatios['5m'] === next.coin.volBuyRatios['5m'] &&
  prev.coin.volBuyRatios['15m'] === next.coin.volBuyRatios['15m'] &&
  prev.coin.volBuyRatios['1h'] === next.coin.volBuyRatios['1h'] &&
  prev.coin.flashUp === next.coin.flashUp &&
  prev.coin.flashDown === next.coin.flashDown &&
  prev.rank === next.rank &&
  prev.visibleRsiCols.join() === next.visibleRsiCols.join() &&
  prev.visibleExtraCols.join() === next.visibleExtraCols.join() &&
  prev.visibleAnalysisTfs.join() === next.visibleAnalysisTfs.join() &&
  prev.visibleColIds.join() === next.visibleColIds.join()
);
