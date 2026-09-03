import React from 'react';
import { getRSIColor, getRSIBg } from '../../utils/colors';
import { formatRSI } from '../../utils/formatters';
import type { RsiDir } from '../../indicators/rsiState';

interface RSICellProps {
  value: number | null;
  loaded: boolean;
  /**
   * Qüvvədə olan RSI siqnalı (latch). RSI xəttdən geri qayıtsa da bu
   * göstərici əks xətt kəsilənə qədər dəyişmir — MACD kimi.
   */
  dir?: RsiDir;
}

const BUY_COLOR = '#26a69a';
const SELL_COLOR = '#ef5350';

export const RSICell = React.memo(function RSICell({ value, loaded, dir = 0 }: RSICellProps) {
  if (!loaded) {
    return (
      <td className="px-2 py-2 text-center" style={{ minWidth: 60 }}>
        <div className="skeleton h-5 w-12 mx-auto rounded" />
      </td>
    );
  }

  if (value === null) {
    return (
      <td className="px-2 py-2 text-center" style={{ minWidth: 60 }}>
        <span style={{ color: 'var(--dim)', fontSize: 12 }}>—</span>
      </td>
    );
  }

  // Zonada olduqda OS/OB, əks halda qüvvədə qalan latch istiqaməti
  const zoneLabel = value < 25 ? 'OS' : value > 75 ? 'OB' : '';
  const latchLabel = dir === 1 ? '▲' : dir === -1 ? '▼' : '';

  return (
    <td className="px-2 py-2 text-center" style={{ minWidth: 60 }}>
      <div
        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-xs font-semibold gap-0.5"
        style={{
          background: getRSIBg(value),
          color: getRSIColor(value),
          minWidth: 46,
        }}
        title={
          dir === 1 ? 'RSI siqnalı: AL — SAT xətti kəsilənə qədər qüvvədə'
          : dir === -1 ? 'RSI siqnalı: SAT — AL xətti kəsilənə qədər qüvvədə'
          : 'RSI siqnalı yoxdur'
        }
      >
        {formatRSI(value)}
        {zoneLabel && (
          <span className="text-[10px] font-bold opacity-80">{zoneLabel}</span>
        )}
        {!zoneLabel && latchLabel && (
          <span
            className="text-[10px] font-bold"
            style={{ color: dir === 1 ? BUY_COLOR : SELL_COLOR }}
          >
            {latchLabel}
          </span>
        )}
      </div>
    </td>
  );
});
