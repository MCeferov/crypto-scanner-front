import React from 'react';
import { getRSIColor, getRSIBg } from '../../utils/colors';
import { formatRSI } from '../../utils/formatters';

interface RSICellProps {
  value: number | null;
  loaded: boolean;
}

export const RSICell = React.memo(function RSICell({ value, loaded }: RSICellProps) {
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
        <span style={{ color: '#4a4f5c', fontSize: 12 }}>—</span>
      </td>
    );
  }

  const label = value < 30 ? 'OS' : value > 70 ? 'OB' : '';

  return (
    <td className="px-2 py-2 text-center" style={{ minWidth: 60 }}>
      <div
        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-xs font-semibold gap-0.5"
        style={{
          background: getRSIBg(value),
          color: getRSIColor(value),
          minWidth: 46,
        }}
      >
        {formatRSI(value)}
        {label && (
          <span className="text-[9px] font-bold opacity-80">{label}</span>
        )}
      </div>
    </td>
  );
});
