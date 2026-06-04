import React, { useCallback } from 'react';
import { useMarket, type SortKey } from '../../context/MarketContext';
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

const COLUMNS: ColDef[] = [
  { sk: null,          label: '#',         align: 'center', minWidth: 38,  sticky: true, stickyLeft: 0  },
  { sk: 'symbol',      label: 'Asset',     align: 'left',   minWidth: 104, sticky: true, stickyLeft: 38 },
  { sk: 'price',       label: 'Price',     align: 'right',  minWidth: 100 },
  { sk: 'change1h',    label: '1H',        align: 'right',  minWidth: 68  },
  { sk: 'change24h',   label: '24H',       align: 'right',  minWidth: 68  },
  { sk: 'volume',      label: 'Volume',    sub: '24h',      align: 'right',  minWidth: 80  },
  { sk: 'rsi15m',      label: 'RSI',       sub: '15m',      align: 'center', minWidth: 60  },
  { sk: 'rsi1h',       label: 'RSI',       sub: '1H',       align: 'center', minWidth: 60  },
  { sk: 'rsi4h',       label: 'RSI',       sub: '4H',       align: 'center', minWidth: 60  },
  { sk: 'rsi1d',       label: 'RSI',       sub: '1D',       align: 'center', minWidth: 60  },
  { sk: 'macd',        label: 'MACD',      sub: 'hist',     align: 'center', minWidth: 72  },
  { sk: null,          label: 'BB',        sub: '%B',       align: 'center', minWidth: 58  },
  { sk: null,          label: 'ATR',       sub: '%',        align: 'center', minWidth: 58  },
  { sk: null,          label: 'Stoch',     sub: 'K/D',      align: 'center', minWidth: 70  },
  { sk: 'superTrend',  label: 'ST',        sub: 'trend',    align: 'center', minWidth: 62  },
  { sk: 'trendScore',  label: 'Trend',     sub: 'Score',    align: 'center', minWidth: 96  },
  { sk: 'signal',      label: 'Signal',    align: 'center', minWidth: 96  },
];

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ color: '#2e3340', fontSize: 9 }}>⇅</span>;
  return <span style={{ color: '#f0b90b', fontSize: 9 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export function HeatmapTable() {
  const { filteredCoins, loading, sortKey, sortDir, handleSort } = useMarket();

  const renderHeader = useCallback((col: ColDef, idx: number) => {
    const isActive = col.sk !== null && sortKey === col.sk;

    const style: React.CSSProperties = {
      minWidth: col.minWidth,
      textAlign: col.align || 'center',
      padding: '7px 8px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.02em',
      color: isActive ? '#f0b90b' : '#6b7280',
      cursor: col.sk ? 'pointer' : 'default',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      background: 'hsl(222,20%,8%)',
      borderBottom: '1px solid hsl(222,15%,14%)',
    };

    if (col.sticky) {
      style.position = 'sticky';
      style.left = col.stickyLeft;
      style.zIndex = 20;
    }

    const justify = col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start';

    return (
      <th key={idx} style={style} onClick={() => col.sk && handleSort(col.sk)}>
        <div className={`flex items-center gap-1 ${justify}`}>
          <span>{col.label}</span>
          {col.sub && <span style={{ color: '#3a3f4c', fontWeight: 400, fontSize: 9 }}>{col.sub}</span>}
          {col.sk && <SortIcon active={isActive} dir={sortDir} />}
        </div>
      </th>
    );
  }, [sortKey, sortDir, handleSort]);

  if (loading && filteredCoins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(240,185,11,0.25)', borderTopColor: '#f0b90b' }} />
        <p className="text-sm" style={{ color: '#6b7280' }}>Loading market data…</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 272px)', overflowY: 'auto' }}>
      <table className="w-full heatmap-table" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>{COLUMNS.map((col, idx) => renderHeader(col, idx))}</tr>
        </thead>
        <tbody>
          {filteredCoins.map((coin, idx) => (
            <HeatmapRow key={coin.symbol} coin={coin} rank={idx + 1} />
          ))}
          {filteredCoins.length === 0 && !loading && (
            <tr>
              <td colSpan={COLUMNS.length} className="text-center py-16">
                <p className="text-sm" style={{ color: '#6b7280' }}>No coins match your filters</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
