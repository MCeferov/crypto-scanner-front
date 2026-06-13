export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.01) return price.toFixed(5);
  if (price >= 0.0001) return price.toFixed(6);
  return price.toFixed(8);
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatRSI(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(1);
}

export function formatIndicator(value: number | null, decimals = 2): string {
  if (value === null) return '—';
  return value.toFixed(decimals);
}

export function formatNumber(value: number | null, decimals = 2): string {
  if (value === null) return '—';
  return value.toFixed(decimals);
}

export function formatSymbol(symbol: string): string {
  return symbol.replace('USDT', '');
}

export function formatTrendScore(score: number): string {
  return score.toFixed(0);
}

export function classifyRSI(rsi: number | null): string {
  if (rsi === null) return 'rsi-neutral';
  if (rsi < 30) return 'rsi-strong-oversold';
  if (rsi < 40) return 'rsi-oversold';
  if (rsi < 60) return 'rsi-neutral';
  if (rsi < 70) return 'rsi-overbought';
  return 'rsi-strong-overbought';
}

export function classifySignal(signal: string): string {
  switch (signal) {
    case 'STRONG_BUY': return 'signal-strong-buy';
    case 'BUY': return 'signal-buy';
    case 'SELL': return 'signal-sell';
    case 'STRONG_SELL': return 'signal-strong-sell';
    default: return 'signal-neutral';
  }
}

export function signalLabel(signal: string): string {
  switch (signal) {
    case 'STRONG_BUY': return 'STRONG BUY';
    case 'BUY': return 'BUY';
    case 'SELL': return 'SELL';
    case 'STRONG_SELL': return 'STRONG SELL';
    case 'ZONE_STRONG_BUY': return 'S/B BUY';
    case 'ZONE_BUY': return 'ZONE BUY';
    case 'ZONE_SELL': return 'ZONE SELL';
    case 'ZONE_STRONG_SELL': return 'S/D SELL';
    case 'ZONE_NEUTRAL': return '—';
    default: return 'NEUTRAL';
  }
}

export function classifyZoneSignal(signal: string): string {
  switch (signal) {
    case 'ZONE_STRONG_BUY': return 'signal-strong-buy';
    case 'ZONE_BUY': return 'signal-buy';
    case 'ZONE_SELL': return 'signal-sell';
    case 'ZONE_STRONG_SELL': return 'signal-strong-sell';
    default: return 'signal-neutral';
  }
}

export function classifyZoneBreakout(signal: string): string {
  switch (signal) {
    case 'STRONG_LONG': return 'signal-strong-buy';
    case 'LONG': return 'signal-buy';
    case 'SHORT': return 'signal-sell';
    case 'STRONG_SHORT': return 'signal-strong-sell';
    default: return 'signal-neutral';
  }
}

export function zoneBreakoutLabel(signal: string): string {
  switch (signal) {
    case 'STRONG_LONG': return '↑ STRONG';
    case 'LONG': return '↑ LONG';
    case 'SHORT': return '↓ SHORT';
    case 'STRONG_SHORT': return '↓ STRONG';
    default: return '—';
  }
}

export function haTrendLabel(trend: number, consecutive: number): string {
  if (trend === 1) return `▲${consecutive}`;
  if (trend === -1) return `▼${consecutive}`;
  return '—';
}

export function classifyHaTrend(trend: number): string {
  if (trend === 1) return 'signal-buy';
  if (trend === -1) return 'signal-sell';
  return 'signal-neutral';
}

export function setupDisplayLabel(label: string, conviction: number): string {
  if (label === '—' || conviction === 0) return '—';
  return label;
}

export function unifiedSetupLabel(signal: string): string {
  switch (signal) {
    case 'STRONG_BUY': return 'S BUY';
    case 'BUY': return 'BUY';
    case 'SELL': return 'SELL';
    case 'STRONG_SELL': return 'S SELL';
    default: return '—';
  }
}

export function zonePositionLabel(position: string | null): string {
  switch (position) {
    case 'at_demand': return 'D';
    case 'at_supply': return 'S';
    case 'near_demand': return '↓D';
    case 'near_supply': return '↑S';
    case 'between': return 'M';
    default: return '—';
  }
}

export function mtfDirShort(dir: string): string {
  if (dir === 'BUY') return 'B';
  if (dir === 'SELL') return 'S';
  return '—';
}

export function classifyMtfDir(dir: string): string {
  if (dir === 'BUY') return 'signal-buy';
  if (dir === 'SELL') return 'signal-sell';
  return 'signal-neutral';
}

export function chartSignalLabel(signal: string): string {
  if (signal === 'BUY') return 'BUY';
  if (signal === 'SELL') return 'SELL';
  return '—';
}

export function classifyResearchSignal(signal: string): string {
  switch (signal) {
    case 'BUY': return 'signal-buy';
    case 'SELL': return 'signal-sell';
    case 'HOLD': return 'signal-neutral';
    default: return 'signal-neutral';
  }
}
