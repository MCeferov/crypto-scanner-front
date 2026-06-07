import React, { useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMarket, type SortKey, type RsiTf, ALL_RSI_TFS, RSI_TF_SORT } from '../../context/MarketContext';
import { HeatmapRow } from './HeatmapRow';

interface ColDef {
  sk: SortKey | null;
  label: string;
  sub?: string;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
  sticky?: boolean;
  stickyLeft?: number;
}

const STATIC_LEFT: ColDef[] = [
  { sk: null,         label: '#',      align: 'center', minWidth: 38,  sticky: true, stickyLeft: 0  },
  { sk: 'symbol',     label: 'Asset',  align: 'left',   minWidth: 110, sticky: true, stickyLeft: 38 },
  { sk: 'price',      label: 'Price',  align: 'right',  minWidth: 100 },
];

const STATIC_RIGHT: ColDef[] = [
  { sk: 'macd',       label: 'MACD',   sub: 'hist',   align: 'center', minWidth: 68 },
  { sk: 'volume',     label: 'Volume', sub: '24h',    align: 'right',  minWidth: 76 },
  { sk: null,         label: 'ATR',    sub: '%',      align: 'center', minWidth: 54 },
  { sk: null,         label: 'Stoch',  sub: 'RSI',    align: 'center', minWidth: 62 },
  { sk: 'superTrend', label: 'ST',     sub: 'trend',  align: 'center', minWidth: 58 },
  { sk: null,         label: 'BB',     sub: '%B',     align: 'center', minWidth: 52 },
  { sk: 'trendScore', label: 'Trend',  sub: 'Score',  align: 'center', minWidth: 88 },
  { sk: 'signal',     label: 'Signal', align: 'center', minWidth: 88 },
];

const RSI_TF_LABELS: Record<RsiTf, string> = { '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' };

const ROW_HEIGHT = 44;

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ color: 'var(--dim)', fontSize: 9 }}>⇅</span>;
  return <span style={{ color: '#f0b90b', fontSize: 9 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export function HeatmapTable() {
  const { filteredCoins, loading, sortKey, sortDir, handleSort, visibleRsiCols, toggleRsiCol } = useMarket();
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredCoins.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const allCols: ColDef[] = [
    ...STATIC_LEFT,
    ...visibleRsiCols.map(tf => ({
      sk: RSI_TF_SORT[tf] as SortKey,
      label: 'RSI',
      sub: RSI_TF_LABELS[tf],
      align: 'center' as const,
      minWidth: 60,
    })),
    ...STATIC_RIGHT,
  ];

  const renderHeader = useCallback((col: ColDef, idx: number) => {
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
      <th key={`${col.label}-${col.sub ?? idx}`} style={style} onClick={() => col.sk && handleSort(col.sk)}>
        <div className={`flex items-center gap-1 ${justify}`}>
          <span>{col.label}</span>
          {col.sub && <span style={{ color: 'var(--dim)', fontWeight: 400, fontSize: 9 }}>{col.sub}</span>}
          {col.sk && <SortIcon active={isActive} dir={sortDir} />}
        </div>
      </th>
    );
  }, [sortKey, sortDir, handleSort]);

  /* RSI column toggles */
  const renderRsiToggles = () => (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[11px] mr-1" style={{ color: 'var(--dim)' }}>RSI columns:</span>
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
      {renderRsiToggles()}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: 'calc(100vh - 270px)' }}
      >
        <table className="w-full heatmap-table" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-30">
            <tr>{allCols.map((col, idx) => renderHeader(col, idx))}</tr>
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
