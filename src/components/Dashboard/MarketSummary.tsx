import React, { useMemo } from 'react';
import { useMarket } from '../../context/MarketContext';
import { formatVolume, formatRSI, formatPercent, formatSymbol } from '../../utils/formatters';
import { getChangeColor, getTrendScoreColor } from '../../utils/colors';

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg px-4 py-3 flex-1 min-w-[140px]"
      style={{ background: 'hsl(222,20%,11%)', border: '1px solid hsl(222,15%,17%)' }}>
      <div className="text-xs mb-1" style={{ color: '#8b949e' }}>{label}</div>
      <div className="font-bold text-sm truncate" style={{ color: color || '#e6e8ec' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5 truncate" style={{ color: '#8b949e' }}>{sub}</div>}
    </div>
  );
}

export function MarketSummary() {
  const { coins } = useMarket();

  const summary = useMemo(() => {
    if (coins.length === 0) return null;
    const loaded = coins.filter(c => c.indicatorsLoaded);
    const avgRsi = loaded.length > 0
      ? loaded.filter(c => c.rsi1h !== null).reduce((s, c) => s + (c.rsi1h ?? 0), 0) / loaded.filter(c => c.rsi1h !== null).length
      : 0;
    const avgTrend = loaded.length > 0
      ? loaded.reduce((s, c) => s + c.trendScore, 0) / loaded.length
      : 50;
    const byVolume = [...coins].sort((a, b) => b.volume24h - a.volume24h);
    const topVolume = byVolume[0];
    const byTrend = [...loaded].sort((a, b) => b.trendScore - a.trendScore);
    const strongest = byTrend[0];
    const weakest = byTrend[byTrend.length - 1];
    const oversold = loaded.filter(c => c.rsi1h !== null && c.rsi1h < 30).length;
    const overbought = loaded.filter(c => c.rsi1h !== null && c.rsi1h > 70).length;
    const strongBuys = loaded.filter(c => c.signal === 'STRONG_BUY').length;
    const strongSells = loaded.filter(c => c.signal === 'STRONG_SELL').length;
    const totalVol = coins.reduce((s, c) => s + c.volume24h, 0);
    return { avgRsi, avgTrend, topVolume, strongest, weakest, oversold, overbought, strongBuys, strongSells, totalVol };
  }, [coins]);

  if (!summary) return null;

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <StatCard
          label="Total Coins"
          value={`${coins.length}`}
          sub={`${coins.filter(c => c.indicatorsLoaded).length} loaded`}
        />
        <StatCard
          label="Avg RSI (1H)"
          value={formatRSI(summary.avgRsi)}
          sub={summary.avgRsi < 40 ? 'Market Oversold' : summary.avgRsi > 60 ? 'Market Overbought' : 'Neutral'}
          color={summary.avgRsi < 30 ? '#0ecb81' : summary.avgRsi > 70 ? '#f6465d' : summary.avgRsi < 40 ? '#36b37e' : summary.avgRsi > 60 ? '#f3a52f' : '#e6e8ec'}
        />
        <StatCard
          label="Avg Trend Score"
          value={summary.avgTrend.toFixed(0)}
          sub="Market momentum"
          color={getTrendScoreColor(summary.avgTrend)}
        />
        <StatCard
          label="24H Volume"
          value={formatVolume(summary.totalVol)}
          sub={summary.topVolume ? `Top: ${formatSymbol(summary.topVolume.symbol)}` : ''}
        />
        <StatCard
          label="Oversold / Overbought"
          value={`${summary.oversold} / ${summary.overbought}`}
          sub="RSI 1H <30 / >70"
          color={summary.oversold > summary.overbought ? '#0ecb81' : summary.overbought > summary.oversold ? '#f6465d' : '#e6e8ec'}
        />
        <StatCard
          label="Signals"
          value={`${summary.strongBuys} Buy / ${summary.strongSells} Sell`}
          sub="Strong signals"
          color={summary.strongBuys > summary.strongSells ? '#0ecb81' : '#f6465d'}
        />
        {summary.strongest && (
          <StatCard
            label="Strongest"
            value={formatSymbol(summary.strongest.symbol)}
            sub={`Score: ${summary.strongest.trendScore}`}
            color="#0ecb81"
          />
        )}
        {summary.weakest && (
          <StatCard
            label="Weakest"
            value={formatSymbol(summary.weakest.symbol)}
            sub={`Score: ${summary.weakest.trendScore}`}
            color="#f6465d"
          />
        )}
      </div>
    </div>
  );
}
