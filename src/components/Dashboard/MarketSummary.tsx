import React, { useMemo } from 'react';
import { useMarket } from '../../context/MarketContext';
import { formatVolume, formatSymbol } from '../../utils/formatters';
import { getTrendScoreColor } from '../../utils/colors';

function Stat({
  label, value, sub, color, accent,
}: {
  label: string; value: string; sub?: string; color?: string; accent?: boolean;
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-lg px-4 py-3"
      style={{
        background: accent ? 'var(--surface)' : 'var(--bg)',
        border: `1px solid ${accent ? 'var(--border-lite)' : 'var(--border)'}`,
        minWidth: 120,
        flex: '1 1 0',
      }}
    >
      <span style={{ color: 'var(--dim)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span className="font-mono font-bold mt-1 truncate" style={{ color: color || 'var(--text)', fontSize: 14 }}>
        {value}
      </span>
      {sub && <span className="truncate mt-0.5" style={{ color: 'var(--dim)', fontSize: 10 }}>{sub}</span>}
    </div>
  );
}

export function MarketSummary() {
  const { coins } = useMarket();

  const s = useMemo(() => {
    if (coins.length === 0) return null;
    const loaded = coins.filter(c => c.indicatorsLoaded);
    const withRsi = loaded.filter(c => c.rsi15m !== null);
    const avgRsi = withRsi.length > 0
      ? withRsi.reduce((a, c) => a + (c.rsi15m ?? 0), 0) / withRsi.length
      : null;
    const avgScore = loaded.length > 0
      ? Math.round(loaded.reduce((a, c) => a + c.trendScore, 0) / loaded.length)
      : 50;
    const totalVol = coins.reduce((a, c) => a + c.volume24h, 0);
    const oversold   = withRsi.filter(c => (c.rsi15m ?? 50) < 30).length;
    const overbought = withRsi.filter(c => (c.rsi15m ?? 50) > 70).length;
    const bulls = loaded.filter(c => c.superTrend === 1).length;
    const bears = loaded.filter(c => c.superTrend === -1).length;
    const topVolume = [...coins].sort((a, b) => b.volume24h - a.volume24h)[0];
    const topScore = [...loaded].sort((a, b) => b.trendScore - a.trendScore)[0];

    return { avgRsi, avgScore, totalVol, oversold, overbought, bulls, bears, topVolume, topScore, loaded: loaded.length, total: coins.length };
  }, [coins]);

  if (!s) return null;

  const rsiColor = s.avgRsi === null ? '#6b7280'
    : s.avgRsi < 30 ? '#0ecb81' : s.avgRsi < 40 ? '#36b37e'
    : s.avgRsi > 70 ? '#f6465d' : s.avgRsi > 60 ? '#f3a52f' : '#9ca3af';

  const bullRatio = s.bulls + s.bears > 0 ? s.bulls / (s.bulls + s.bears) : 0.5;

  return (
    <div className="px-4 py-3">
      <div className="flex gap-2 flex-wrap">
        <Stat
          label="Pairs"
          value={`${s.total}`}
          sub={`${s.loaded} loaded`}
        />
        <Stat
          label="Avg RSI · 15m"
          value={s.avgRsi !== null ? s.avgRsi.toFixed(1) : '—'}
          sub={s.avgRsi === null ? '' : s.avgRsi < 40 ? 'Market oversold' : s.avgRsi > 60 ? 'Market overbought' : 'Neutral zone'}
          color={rsiColor}
          accent
        />
        <Stat
          label="Avg Trend Score"
          value={`${s.avgScore}`}
          sub={s.avgScore >= 60 ? 'Bullish momentum' : s.avgScore <= 40 ? 'Bearish momentum' : 'Neutral'}
          color={getTrendScoreColor(s.avgScore)}
          accent
        />
        <Stat
          label="24H Volume"
          value={formatVolume(s.totalVol)}
          sub={s.topVolume ? `Top: ${formatSymbol(s.topVolume.symbol)}` : ''}
        />
        <Stat
          label="RSI Zones"
          value={`${s.oversold} / ${s.overbought}`}
          sub="Oversold / Overbought"
          color={s.oversold > s.overbought ? '#0ecb81' : s.overbought > s.oversold ? '#f6465d' : '#9ca3af'}
        />
        <Stat
          label="SuperTrend"
          value={`${s.bulls}▲ · ${s.bears}▼`}
          sub={`${Math.round(bullRatio * 100)}% bullish`}
          color={bullRatio > 0.5 ? '#0ecb81' : bullRatio < 0.5 ? '#f6465d' : '#9ca3af'}
          accent
        />
        {s.topScore && (
          <Stat
            label="Top Score"
            value={formatSymbol(s.topScore.symbol)}
            sub={`Score ${s.topScore.trendScore}`}
            color="#0ecb81"
          />
        )}
      </div>
    </div>
  );
}
