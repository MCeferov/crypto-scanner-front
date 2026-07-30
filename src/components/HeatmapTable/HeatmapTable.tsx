import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Star, Columns3, Rows3, Rows4, Check } from 'lucide-react';
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

const RSI_TF_LABELS: Record<RsiTf, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D',
};

/** Small chip used inside the Columns popover. */
function ColChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] px-2 py-1 rounded font-medium transition-colors"
      style={{
        background: on ? 'var(--accent-soft)' : 'var(--elevated)',
        color: on ? 'var(--accent)' : 'var(--muted)',
        border: `1px solid ${on ? 'var(--accent-border)' : 'var(--border)'}`,
      }}
    >
      {label}
    </button>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ color: 'var(--dim)', fontSize: 10 }}>⇅</span>;
  return <span style={{ color: 'var(--accent)', fontSize: 10 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export function HeatmapTable() {
  const {
    filteredCoins, loading, sortKey, sortDir, handleSort,
    visibleRsiCols, toggleRsiCol, visibleExtraCols, toggleExtraCol,
    visibleAnalysisTfs, toggleAnalysisTf, showIndicatorColumns,
    favorites, toggleFavorite, showOnlyFavorites, setShowOnlyFavorites,
    density, setDensity,
  } = useMarket();
  const t = useT();
  const parentRef = useRef<HTMLDivElement>(null);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colsOpen) return;
    const handler = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colsOpen]);

  const rowHeight = density === 'compact' ? 36 : 44;

  const staticLeft: ColDef[] = useMemo(() => [
    { id: 'fav', sk: null, label: '', align: 'center', minWidth: 30, sticky: true, stickyLeft: 0 },
    { id: 'rank', sk: null, label: t('table.rank'), align: 'center', minWidth: 38, sticky: true, stickyLeft: 30 },
    { id: 'asset', sk: 'symbol', label: t('table.asset'), align: 'left', minWidth: 150, sticky: true, stickyLeft: 68 },
    { id: 'price', sk: 'price', label: t('table.price'), align: 'right', minWidth: 100 },
  ], [t]);

  const quoteCols: ColDef[] = useMemo(() => [
    { id: 'change', sk: 'change24h', label: t('table.change24h'), sub: '%', align: 'right', minWidth: 72 },
    { id: 'volume', sk: 'volume', label: t('table.volume'), sub: '24h', align: 'right', minWidth: 76 },
  ], [t]);

  const extraColDefs: Record<ExtraCol, ColDef> = useMemo(() => ({
    macd:     { id: 'macd',     sk: 'macd',         label: t('columns.macd'),     sub: t('columns.macdHist'), align: 'center', minWidth: 68 },
    volume:   { id: 'vol24h',   sk: null,           label: t('columns.volume'),   sub: t('table.volumeSub'), align: 'center', minWidth: 76 },
    stoch:    { id: 'stoch',    sk: null,           label: t('columns.stoch'),    sub: t('columns.stochRsi'), align: 'center', minWidth: 62 },
    st:       { id: 'st',       sk: 'superTrend',   label: t('columns.st'),       sub: t('columns.stTrend'), align: 'center', minWidth: 58 },
    research: { id: 'research', sk: 'research',     label: t('columns.research'), sub: t('columns.researchSub'), align: 'center', minWidth: 72 },
    ha:       { id: 'ha',       sk: 'haSignal',     label: t('columns.ha'),       sub: 'TF', align: 'center', minWidth: 44 },
    zone:     { id: 'zone',     sk: null,           label: t('columns.zone'),     sub: 'D / S', align: 'center', minWidth: 88 },
    break:    { id: 'break',    sk: 'zoneBreakout', label: t('columns.break'),    sub: t('columns.breakDir'), align: 'center', minWidth: 68 },
    sl:       { id: 'sl',       sk: 'stopLoss',     label: t('columns.sl'),       sub: 'S/D+ATR', align: 'right', minWidth: 72 },
    tp:       { id: 'tp',       sk: 'takeProfit',   label: t('columns.tp'),       sub: 'Zone/ATR', align: 'right', minWidth: 72 },
  }), [t]);

  const coreRightCols: ColDef[] = useMemo(() => {
    const mtfWidth = Math.max(72, 18 + visibleAnalysisTfs.length * 22);
    return [
      { id: 'trend',    sk: 'trendScore',  label: t('columns.trend'),  sub: t('columns.trendScore'), align: 'center', minWidth: 80 },
      { id: 'mtf',      sk: null,          label: t('columns.mtf'),    sub: 'TF', align: 'center', minWidth: mtfWidth },
      { id: 'chartSig', sk: 'chartSignal', label: t('columns.chart'),  sub: t('columns.chartSignal'), align: 'center', minWidth: 64 },
      { id: 'setup',    sk: 'setup',       label: t('columns.setup'),  sub: t('columns.setupFinal'), align: 'center', minWidth: 88 },
    ];
  }, [t, visibleAnalysisTfs.length]);

  const extraColToggleLabels: Record<ExtraCol, string> = useMemo(() => ({
    macd: t('columns.macd'),
    volume: t('columns.extraVol'),
    stoch: t('columns.stoch'),
    st: t('columns.st'),
    research: t('columns.research'),
    ha: t('columns.ha'),
    zone: t('columns.zone'),
    break: t('columns.break'),
    sl: t('columns.sl'),
    tp: t('columns.tp'),
  }), [t]);

  const extraColId = (col: ExtraCol): string => (col === 'volume' ? 'vol24h' : col);

  const rowVirtualizer = useVirtualizer({
    count: filteredCoins.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  useEffect(() => {
    rowVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeight]);

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
    return [...staticLeft, ...quoteCols, ...rsiCols, ...extraCols, ...coreRightCols];
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
      color: isActive ? 'var(--accent)' : 'var(--muted)',
      cursor: col.sk ? 'pointer' : 'default',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      background: 'var(--elevated)',
      borderBottom: '2px solid var(--border)',
    };
    if (col.sticky) {
      style.position = 'sticky';
      style.left = col.stickyLeft;
      // Above the plain header cells (z-30 via .heatmap-table thead th) AND
      // the sticky body cells (z-10).
      style.zIndex = 40;
    }
    const justify = col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start';
    return (
      <th key={col.id} style={style} onClick={() => col.sk && handleSort(col.sk)}>
        <div className={`flex items-center gap-1 ${justify}`}>
          <span>{col.label}</span>
          {col.sub && <span style={{ color: 'var(--dim)', fontWeight: 400, fontSize: 10 }}>{col.sub}</span>}
          {col.sk && <SortIcon active={isActive} dir={sortDir} />}
        </div>
      </th>
    );
  }, [sortKey, sortDir, handleSort]);

  /**
   * Professional control bar: watchlist filter + density on the left,
   * a single "Columns" popover on the right — replaces the old three-group
   * wall of 19 tiny chips that wrapped to three rows.
   */
  const renderControlBar = () => {
    if (!showIndicatorColumns) return null;
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <button
          type="button"
          onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors"
          style={{
            background: showOnlyFavorites ? 'var(--accent-soft)' : 'transparent',
            color: showOnlyFavorites ? 'var(--accent)' : 'var(--muted)',
            border: `1px solid ${showOnlyFavorites ? 'var(--accent-border)' : 'var(--border)'}`,
          }}
          title={t('table.watchlist')}
        >
          <Star size={13} fill={showOnlyFavorites ? 'currentColor' : 'none'} />
          {t('table.watchlist')}
          {favorites.size > 0 && (
            <span className="font-mono text-[10px] opacity-70">{favorites.size}</span>
          )}
        </button>

        <span className="w-px h-5" style={{ background: 'var(--border)' }} />

        <div className="flex items-center rounded-md border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => setDensity('comfortable')}
            className="p-1.5 transition-colors"
            title={t('table.comfortable')}
            style={{
              background: density === 'comfortable' ? 'var(--accent-soft)' : 'transparent',
              color: density === 'comfortable' ? 'var(--accent)' : 'var(--dim)',
            }}
          >
            <Rows3 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setDensity('compact')}
            className="p-1.5 transition-colors"
            title={t('table.compact')}
            style={{
              background: density === 'compact' ? 'var(--accent-soft)' : 'transparent',
              color: density === 'compact' ? 'var(--accent)' : 'var(--dim)',
            }}
          >
            <Rows4 size={14} />
          </button>
        </div>

        <span className="flex-1" />

        <div className="relative" ref={colsRef}>
          <button
            type="button"
            onClick={() => setColsOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors"
            style={{
              background: colsOpen ? 'var(--accent-soft)' : 'transparent',
              color: colsOpen ? 'var(--accent)' : 'var(--muted)',
              border: `1px solid ${colsOpen ? 'var(--accent-border)' : 'var(--border)'}`,
            }}
          >
            <Columns3 size={13} />
            {t('table.columns')}
          </button>

          {colsOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 z-50 rounded-lg border p-3 w-[320px]"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--dim)' }}>
                {t('toolbar.rsi')}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {ALL_RSI_TFS.map(tf => (
                  <ColChip key={tf} on={visibleRsiCols.includes(tf)} label={RSI_TF_LABELS[tf]} onClick={() => toggleRsiCol(tf)} />
                ))}
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--dim)' }}>
                {t('toolbar.extra')}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {ALL_EXTRA_COLS.map(col => (
                  <ColChip
                    key={col}
                    on={visibleExtraCols.includes(col)}
                    label={extraColToggleLabels[col]}
                    onClick={() => toggleExtraCol(col)}
                  />
                ))}
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--dim)' }}>
                {t('toolbar.analysisTf')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ANALYSIS_TFS.map(tf => (
                  <ColChip
                    key={tf}
                    on={visibleAnalysisTfs.includes(tf)}
                    label={ANALYSIS_TF_LABELS[tf]}
                    onClick={() => toggleAnalysisTf(tf)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && filteredCoins.length === 0) {
    // Skeleton rows in the real layout — a centered spinner swapped to a
    // 1400px table was a hard layout jump.
    return (
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--elevated)' }}>
          <div className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--accent-ring)', borderTopColor: 'var(--accent)' }} />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('home.loading')}</p>
        </div>
        <div style={{ background: 'var(--surface)' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4" style={{ height: 44, borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton h-3 w-6" />
              <div className="skeleton h-6 w-6 rounded-full" />
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-3 w-16 ml-auto" />
              <div className="skeleton h-3 w-14" />
              <div className="skeleton h-5 w-12 rounded" />
              <div className="skeleton h-5 w-12 rounded hidden sm:block" />
              <div className="skeleton h-5 w-16 rounded hidden md:block" />
              <div className="skeleton h-5 w-14 rounded hidden lg:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const virtualRows   = rowVirtualizer.getVirtualItems();
  const totalHeight   = rowVirtualizer.getTotalSize();
  const paddingTop    = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {renderControlBar()}
      {/* Fixed 270px assumed the desktop chrome height; on mobile the stack
          above is far taller, producing double scrollbars. Keep a sane floor. */}
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: 'max(420px, calc(100vh - 270px))' }}>
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
                      rowHeight={rowHeight}
                      isFavorite={favorites.has(coin.id)}
                      onToggleFavorite={toggleFavorite}
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
