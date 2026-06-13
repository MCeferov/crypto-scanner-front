import React from 'react';
import { isFreshSignal } from '../../indicators/signalAge';

interface CandleAgeProps {
  candles: number;
  className?: string;
}

/** Siqnal yanında şam sayı — 1-2 şam sarı (təzə/yeni flip) */
export function CandleAge({ candles, className = '' }: CandleAgeProps) {
  if (!candles || candles <= 0) return null;
  const fresh = isFreshSignal(candles);
  return (
    <span
      className={`text-[8px] font-mono ml-0.5 align-super ${className}`}
      style={{ color: fresh ? '#f0b90b' : 'var(--dim)', opacity: fresh ? 1 : 0.75 }}
      title={fresh ? `Yeni siqnal (${candles} şam) — flip riski` : `${candles} şamdır bu siqnaldadır`}
    >
      {candles}
    </span>
  );
}
