import React, { useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useMarket, type SortKey, type RsiTf, type ExtraCol, type AnalysisTf,
  ALL_RSI_TFS, RSI_TF_SORT, ALL_EXTRA_COLS, EXTRA_COL_LABELS,
  ALL_ANALYSIS_TFS, ANALYSIS_TF_LABELS,
} from '../../context/MarketContext';
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

const STATIC_LEFT: ColDef[] = [
  { id: 'rank',     sk: null,     label: '#',     align: 'center', minWidth: 38,  sticky: true, stickyLeft: 0  },
  { id: 'asset',    sk: 'symbol', label: 'Asset', align: 'left',   minWidth: 110, sticky: true, stickyLeft: 38 },
  { id: 'price',    sk: 'price',  label: 'Price', align: 'right',  minWidth: 100 },
];

const EXTRA_COL_DEFS: Record<ExtraCol, ColDef> = {
  macd:   { id: 'macd',   sk: 'macd',   label: 'MACD',   sub: 'hist', align: 'center', minWidth: 68 },
  volume: { id: 'volume', sk: 'volume', label: 'Volume', sub: '24h',  align: 'right',  minWidth: 76 },
  atr:    { id: 'atr',    sk: null,     label: 'ATR',    sub: '%',    align: 'center', minWidth: 54 },
  stoch:  { id: 'stoch',  sk: null,     label: 'Stoch',  sub: 'RSI',  align: 'center', minWidth: 62 },
  st:     { id: 'st',     sk: 'superTrend', label: 'ST', sub: 'trend', align: 'center', minWidth: 58 },
  bb:     { id: 'bb',     sk: null,     label: 'BB',     sub: '%B',   align: 'center', minWidth: 52 },
};

const CORE_RIGHT: ColDef[] = [
  { id: 'trend',    sk: 'trendScore', label: 'Trend', sub: 'Score', align: 'center', minWidth: 80 },
  { id: 'mtf',      sk: null,         label: 'TF',    sub: '15·30·1H·4H', align: 'center', minWidth: 108 },
  { id: 'chartSig', sk: 'chartSignal', label: 'Chart', sub: 'Signal', align: 'center', minWidth: 64 },
  { id: 'research', sk: 'research', label: 'Bazar', sub: 'Araşdırma', align: 'center', minWidth: 72 },
  { id: 'ha',       sk: 'haSignal',   label: 'HA',    sub: '15m',   align: 'center', minWidth: 44 },
  { id: 'zone',     sk: null,         label: 'Zone',  sub: 'S/D',   align: 'center', minWidth: 44 },
  { id: 'break',    sk: 'zoneBreakout', label: 'Break', sub: 'Dir', align: 'center', minWidth: 68 },
  { id: 'sl',       sk: 'stopLoss',   label: 'SL',    align: 'right',  minWidth: 72 },
  { id: 'tp',       sk: 'takeProfit', label: 'TP',    align: 'right',  minWidth: 72 },
  { id: 'rr',       sk: 'riskReward', label: 'R:R',   align: 'center', minWidth: 44 },
  { id: 'setup',    sk: 'setup',      label: 'Setup', sub: 'Yekun', align: 'center', minWidth: 88 },
];

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
    visibleAnalysisTfs, toggleAnalysisTf,
  } = useMarket();
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredCoins.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const allCols: ColDef[] = useMemo(() => {
    const rsiCols: ColDef[] = visibleRsiCols.map(tf => ({
      id: `rsi-${tf}`,
      sk: RSI_TF_SORT[tf] as SortKey,
      label: 'RSI',
      sub: RSI_TF_LABELS[tf],
      align: 'center' as const,
      minWidth: 60,
    }));
    const extraCols = ALL_EXTRA_COLS
      .filter(c => visibleExtraCols.includes(c))
      .map(c => EXTRA_COL_DEFS[c]);
    return [...STATIC_LEFT, ...rsiCols, ...extraCols, ...CORE_RIGHT];
  }, [visibleRsiCols, visibleExtraCols]);

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

  const renderColToggles = () => (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b flex-wrap"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] mr-1" style={{ color: 'var(--dim)' }}>RSI:</span>
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
        <span className="text-[11px] mr-1" style={{ color: 'var(--dim)' }}>Extra:</span>
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
              {EXTRA_COL_LABELS[col]}
            </button>
          );
        })}
      </div>
      <div className="w-px h-4" style={{ background: 'var(--border)' }} />
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] mr-1" style={{ color: 'var(--dim)' }}>Analiz TF:</span>
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

  if (loading && filteredCoins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(240,185,11,.2)', borderTopColor: '#f0b90b' }} />
        <p className="text-sm" style={{ color: 'var(--dim)' }}>Market data yüklənir…</p>
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
        <table className="w-full heatmap-table" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-30">
            <tr>{allCols.map(col => renderHeader(col))}</tr>
          </thead>
          <tbody>
            {filteredCoins.length === 0 && !loading ? (
              <tr>
                <td colSpan={allCols.length} className="text-center py-16">
                  <p className="text-sm" style={{ color: 'var(--dim)' }}>Filtrə uyğun coin tapılmadı</p>
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
                      key={coin.symbol}
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
