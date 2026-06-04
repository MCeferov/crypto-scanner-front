import React, { useCallback } from 'react';
import { useMarket, type SortKey } from '../../context/MarketContext';
import { HeatmapRow } from './HeatmapRow';

interface ColDef {
  key: SortKey;
  label: string;
  sub?: string;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
  sticky?: boolean;
  stickyLeft?: number;
}

const COLUMNS: ColDef[] = [
  { key: 'symbol', label: '#', align: 'center', minWidth: 38, sticky: true, stickyLeft: 0 },
  { key: 'symbol', label: 'Asset', align: 'left', minWidth: 100, sticky: true, stickyLeft: 38 },
  { key: 'price', label: 'Price', align: 'right', minWidth: 100 },
  { key: 'change1h', label: '1H %', align: 'right', minWidth: 72 },
  { key: 'change24h', label: '24H %', align: 'right', minWidth: 72 },
  { key: 'volume', label: 'Volume', sub: '24h', align: 'right', minWidth: 80 },
  { key: 'rsi15m', label: 'RSI', sub: '15m', align: 'center', minWidth: 60 },
  { key: 'rsi1h', label: 'RSI', sub: '1H', align: 'center', minWidth: 60 },
  { key: 'rsi4h', label: 'RSI', sub: '4H', align: 'center', minWidth: 60 },
  { key: 'rsi1d', label: 'RSI', sub: '1D', align: 'center', minWidth: 60 },
  { key: 'ema20', label: 'EMA', sub: '20', align: 'center', minWidth: 60 },
  { key: 'ema50', label: 'EMA', sub: '50', align: 'center', minWidth: 60 },
  { key: 'ema200', label: 'EMA', sub: '200', align: 'center', minWidth: 60 },
  { key: 'macd', label: 'MACD', sub: 'hist', align: 'center', minWidth: 72 },
  { key: 'signal', label: 'BB%', align: 'center', minWidth: 60 },
  { key: 'signal', label: 'ATR%', align: 'center', minWidth: 60 },
  { key: 'signal', label: 'StochRSI', sub: 'K/D', align: 'center', minWidth: 72 },
  { key: 'trendScore', label: 'Trend', sub: 'Score', align: 'center', minWidth: 100 },
  { key: 'signal', label: 'Signal', align: 'center', minWidth: 100 },
];

// Real sort keys for each column index
const SORT_KEYS: (SortKey | null)[] = [
  null, 'symbol', 'price', 'change1h', 'change24h', 'volume',
  'rsi15m', 'rsi1h', 'rsi4h', 'rsi1d',
  'ema20', 'ema50', 'ema200',
  'macd',
  null, null, null,
  'trendScore',
  'signal',
];

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ color: '#3a3f4c', fontSize: 10 }}>⇅</span>;
  return <span style={{ color: '#f0b90b', fontSize: 10 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export function HeatmapTable() {
  const { filteredCoins, loading, sortKey, sortDir, handleSort } = useMarket();

  const renderHeader = useCallback((col: ColDef, idx: number) => {
    const sk = SORT_KEYS[idx];
    const isActive = sk !== null && sortKey === sk;
    const canSort = sk !== null;

    const style: React.CSSProperties = {
      minWidth: col.minWidth,
      textAlign: col.align || 'center',
      padding: '8px 8px',
      fontSize: 11,
      fontWeight: 600,
      color: isActive ? '#f0b90b' : '#8b949e',
      cursor: canSort ? 'pointer' : 'default',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      background: 'hsl(222,20%,9%)',
      borderBottom: '1px solid hsl(222,15%,17%)',
    };

    if (col.sticky) {
      style.position = 'sticky';
      style.left = col.stickyLeft;
      style.zIndex = 20;
    }

    return (
      <th
        key={`${col.key}-${idx}`}
        style={style}
        onClick={() => canSort && handleSort(sk!)}
      >
        <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{col.label}</span>
          {col.sub && <span style={{ color: '#4a4f5c', fontWeight: 400, fontSize: 9 }}>{col.sub}</span>}
          {canSort && <SortIcon active={isActive} dir={sortDir} />}
        </div>
      </th>
    );
  }, [sortKey, sortDir, handleSort]);

  if (loading && filteredCoins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(240,185,11,0.3)', borderTopColor: '#f0b90b' }} />
        <p className="text-sm" style={{ color: '#8b949e' }}>Loading market data from Binance...</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
      <table className="w-full heatmap-table" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {COLUMNS.map((col, idx) => renderHeader(col, idx))}
          </tr>
        </thead>
        <tbody>
          {filteredCoins.map((coin, idx) => (
            <HeatmapRow key={coin.symbol} coin={coin} rank={idx + 1} />
          ))}
          {filteredCoins.length === 0 && !loading && (
            <tr>
              <td colSpan={COLUMNS.length} className="text-center py-16">
                <p className="text-sm" style={{ color: '#8b949e' }}>No coins match your filters</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
