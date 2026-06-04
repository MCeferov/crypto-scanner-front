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
    default: return 'NEUTRAL';
  }
}
