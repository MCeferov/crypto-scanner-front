import React, { useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useMarket, type SortKey, type RsiTf, type ExtraCol, type AnalysisTf,
  ALL_RSI_TFS, RSI_TF_SORT, ALL_EXTRA_COLS,
  ALL_ANALYSIS_TFS, ANALYSIS_TF_LABELS,
} from '../../context/MarketContext';
import { useT } from '../../context/LocaleContext';
import { HeatmapRow } from './HeatmapRow';

interface ColDef {
  id: string;
  sk: SortKey | null;
  label: string;
  sub?: string;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
  sticky?: boolean;
  stickyLeft?: number;
}

const RSI_TF_LABELS: Record<RsiTf, string> = { '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' };
const ROW_HEIGHT = 44;

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ color: 'var(--dim)', fontSize: 9 }}>⇅</span>;
  return <span style={{ color: '#f0b90b', fontSize: 9 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export function HeatmapTable() {
  const {
    filteredCoins, loading, sortKey, sortDir, handleSort,
    visibleRsiCols, toggleRsiCol, visibleExtraCols, toggleExtraCol,
    visibleAnalysisTfs, toggleAnalysisTf, showIndicatorColumns,
  } = useMarket();
  const t = useT();
  const parentRef = useRef<HTMLDivElement>(null);

  const staticLeft: ColDef[] = useMemo(() => [
    { id: 'rank', sk: null, label: t('table.rank'), align: 'center', minWidth: 38, sticky: true, stickyLeft: 0 },
    { id: 'asset', sk: 'symbol', label: t('table.asset'), align: 'left', minWidth: 150, sticky: true, stickyLeft: 38 },
    { id: 'price', sk: 'price', label: t('table.price'), align: 'right', minWidth: 100 },
  ], [t]);

  const quoteCols: ColDef[] = useMemo(() => [
    { id: 'change', sk: 'change24h', label: t('table.change24h'), sub: '%', align: 'right', minWidth: 72 },
    { id: 'volume', sk: null, label: t('table.volume'), sub: t('table.volumeSub'), align: 'center', minWidth: 76 },
  ], [t]);

  const extraColDefs: Record<ExtraCol, ColDef> = useMemo(() => ({
    macd:   { id: 'macd',   sk: 'macd',   label: t('columns.macd'),   sub: t('columns.macdHist'), align: 'center', minWidth: 68 },
    volume: { id: 'vol24h', sk: null, label: t('columns.volume'), sub: t('table.volumeSub'), align: 'center', minWidth: 76 },
    stoch:  { id: 'stoch',  sk: null,     label: t('columns.stoch'),  sub: t('columns.stochRsi'), align: 'center', minWidth: 62 },
    st:     { id: 'st',     sk: 'superTrend', label: t('columns.st'), sub: t('columns.stTrend'), align: 'center', minWidth: 58 },
    bb:     { id: 'bb',     sk: null,     label: t('columns.bb'),     sub: t('columns.bbPercent'), align: 'center', minWidth: 52 },
  }), [t]);

  const coreRightCols: ColDef[] = useMemo(() => [
    { id: 'trend',    sk: 'trendScore', label: t('columns.trend'),    sub: t('columns.trendScore'), align: 'center', minWidth: 80 },
    { id: 'mtf',      sk: null,         label: t('columns.mtf'),      sub: t('columns.mtfRange'), align: 'center', minWidth: 108 },
    { id: 'chartSig', sk: 'chartSignal', label: t('columns.chart'),   sub: t('columns.chartSignal'), align: 'center', minWidth: 64 },
    { id: 'research', sk: 'research',    label: t('columns.research'), sub: t('columns.researchSub'), align: 'center', minWidth: 72 },
    { id: 'ha',       sk: 'haSignal',   label: t('columns.ha'),       sub: '15m', align: 'center', minWidth: 44 },
    { id: 'zone',     sk: null,         label: t('columns.zone'),     sub: t('columns.zoneSub'), align: 'center', minWidth: 44 },
    { id: 'break',    sk: 'zoneBreakout', label: t('columns.break'),  sub: t('columns.breakDir'), align: 'center', minWidth: 68 },
    { id: 'sl',       sk: 'stopLoss',   label: t('columns.sl'), align: 'right',  minWidth: 72 },
    { id: 'tp',       sk: 'takeProfit', label: t('columns.tp'), align: 'right',  minWidth: 72 },
    { id: 'rr',       sk: 'riskReward', label: t('columns.rr'), align: 'center', minWidth: 44 },
    { id: 'setup',    sk: 'setup',      label: t('columns.setup'), sub: t('columns.setupFinal'), align: 'center', minWidth: 88 },
  ], [t]);

  const extraColToggleLabels: Record<ExtraCol, string> = useMemo(() => ({
    macd: t('columns.macd'),
    volume: t('columns.extraVol'),
    stoch: t('columns.stoch'),
    st: t('columns.st'),
    bb: t('columns.bb'),
  }), [t]);

  const extraColId = (col: ExtraCol): string => (col === 'volume' ? 'vol24h' : col);

  const rowVirtualizer = useVirtualizer({
    count: filteredCoins.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const allCols: ColDef[] = useMemo(() => {
    if (!showIndicatorColumns) {
      return [...staticLeft, ...quoteCols];
    }
    const rsiCols: ColDef[] = visibleRsiCols.map(tf => ({
      id: `rsi-${tf}`,
      sk: RSI_TF_SORT[tf] as SortKey,
      label: t('columns.rsi'),
      sub: RSI_TF_LABELS[tf],
      align: 'center' as const,
      minWidth: 60,
    }));
    const extraCols = ALL_EXTRA_COLS
      .filter(c => visibleExtraCols.includes(c))
      .map(c => ({ ...extraColDefs[c], id: extraColId(c) }));
    return [...staticLeft, ...quoteCols.filter(c => c.id !== 'volume'), ...rsiCols, ...extraCols, ...coreRightCols];
  }, [visibleRsiCols, visibleExtraCols, showIndicatorColumns, staticLeft, quoteCols, extraColDefs, coreRightCols, t]);

  const renderHeader = useCallback((col: ColDef) => {
    const isActive = col.sk !== null && sortKey === col.sk;
    const style: React.CSSProperties = {
      minWidth: col.minWidth,
      width: col.minWidth,
      textAlign: col.align || 'center',
      padding: '8px 8px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.02em',
      color: isActive ? '#f0b90b' : 'var(--muted)',
      cursor: col.sk ? 'pointer' : 'default',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
    };
    if (col.sticky) {
      style.position = 'sticky';
      style.left = col.stickyLeft;
      style.zIndex = 20;
    }
    const justify = col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start';
    return (
      <th key={col.id} style={style} onClick={() => col.sk && handleSort(col.sk)}>
        <div className={`flex items-center gap-1 ${justify}`}>
          <span>{col.label}</span>
          {col.sub && <span style={{ color: 'var(--dim)', fontWeight: 400, fontSize: 9 }}>{col.sub}</span>}
          {col.sk && <SortIcon active={isActive} dir={sortDir} />}
        </div>
      </th>
    );
  }, [sortKey, sortDir, handleSort]);

  const renderColToggles = () => {
    if (!showIndicatorColumns) return null;
    return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b flex-wrap"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] mr-1" style={{ color: 'var(--dim)' }}>{t('toolbar.rsi')}</span>
        {ALL_RSI_TFS.map(tf => {
          const on = visibleRsiCols.includes(tf);
          return (
            <button
              key={tf}
              onClick={() => toggleRsiCol(tf)}
              className="text-[10px] px-2 py-0.5 rounded font-semibold transition-all"
              style={{
                background: on ? 'rgba(240,185,11,.15)' : 'var(--elevated)',
                color: on ? '#f0b90b' : 'var(--dim)',
                border: `1px solid ${on ? 'rgba(240,185,11,.35)' : 'var(--border)'}`,
              }}
            >
              {RSI_TF_LABELS[tf]}
            </button>
          );
        })}
      </div>
      <div className="w-px h-4" style={{ background: 'var(--border)' }} />
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] mr-1" style={{ color: 'var(--dim)' }}>{t('toolbar.extra')}</span>
        {ALL_EXTRA_COLS.map(col => {
          const on = visibleExtraCols.includes(col);
          return (
            <button
              key={col}
              onClick={() => toggleExtraCol(col)}
              className="text-[10px] px-2 py-0.5 rounded font-semibold transition-all"
              style={{
                background: on ? 'rgba(100,116,139,.15)' : 'var(--elevated)',
                color: on ? 'var(--text)' : 'var(--dim)',
                border: `1px solid ${on ? 'var(--border-lite)' : 'var(--border)'}`,
              }}
            >
              {extraColToggleLabels[col]}
            </button>
          );
        })}
      </div>
      <div className="w-px h-4" style={{ background: 'var(--border)' }} />
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] mr-1" style={{ color: 'var(--dim)' }}>{t('toolbar.analysisTf')}</span>
        {ALL_ANALYSIS_TFS.map(tf => {
          const on = visibleAnalysisTfs.includes(tf);
          return (
            <button
              key={tf}
              onClick={() => toggleAnalysisTf(tf)}
              className="text-[10px] px-2 py-0.5 rounded font-semibold transition-all"
              style={{
                background: on ? 'rgba(38,166,154,.15)' : 'var(--elevated)',
                color: on ? '#26a69a' : 'var(--dim)',
                border: `1px solid ${on ? 'rgba(38,166,154,.35)' : 'var(--border)'}`,
              }}
            >
              {ANALYSIS_TF_LABELS[tf]}
            </button>
          );
        })}
      </div>
    </div>
    );
  };

  if (loading && filteredCoins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(240,185,11,.2)', borderTopColor: '#f0b90b' }} />
        <p className="text-sm" style={{ color: 'var(--dim)' }}>{t('home.loading')}</p>
      </div>
    );
  }

  const virtualRows   = rowVirtualizer.getVirtualItems();
  const totalHeight   = rowVirtualizer.getTotalSize();
  const paddingTop    = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {renderColToggles()}
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
        <table
          className="heatmap-table"
          style={{
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            width: allCols.reduce((sum, c) => sum + (c.minWidth ?? 60), 0),
            minWidth: '100%',
          }}
        >
          <colgroup>
            {allCols.map(col => (
              <col key={col.id} style={{ width: col.minWidth, minWidth: col.minWidth }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-30">
            <tr>{allCols.map(col => renderHeader(col))}</tr>
          </thead>
          <tbody>
            {filteredCoins.length === 0 && !loading ? (
              <tr>
                <td colSpan={allCols.length} className="text-center py-16">
                  <p className="text-sm" style={{ color: 'var(--dim)' }}>{t('home.noResults')}</p>
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr><td colSpan={allCols.length} style={{ height: paddingTop, padding: 0, border: 'none' }} /></tr>
                )}
                {virtualRows.map(vRow => {
                  const coin = filteredCoins[vRow.index];
                  return (
                    <HeatmapRow
                      key={coin.id}
                      coin={coin}
                      rank={vRow.index + 1}
                      visibleRsiCols={visibleRsiCols}
                      visibleExtraCols={visibleExtraCols}
                      visibleAnalysisTfs={visibleAnalysisTfs}
                      visibleColIds={allCols.map(c => c.id)}
                    />
                  );
                })}
                {paddingBottom > 0 && (
                  <tr><td colSpan={allCols.length} style={{ height: paddingBottom, padding: 0, border: 'none' }} /></tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
