export function getRSIColor(rsi: number | null): string {
  if (rsi === null) return '#4a4f5c';
  if (rsi < 30) return '#0ecb81';
  if (rsi < 40) return '#36b37e';
  if (rsi < 60) return '#8b949e';
  if (rsi < 70) return '#f3a52f';
  return '#f6465d';
}

export function getRSIBg(rsi: number | null): string {
  if (rsi === null) return 'rgba(74,79,92,0.12)';
  if (rsi < 30) return 'rgba(14,203,129,0.18)';
  if (rsi < 40) return 'rgba(54,179,126,0.14)';
  if (rsi < 60) return 'rgba(74,79,92,0.12)';
  if (rsi < 70) return 'rgba(243,165,47,0.16)';
  return 'rgba(246,70,93,0.18)';
}

export function getChangeColor(value: number): string {
  if (value > 0) return '#0ecb81';
  if (value < 0) return '#f6465d';
  return '#8b949e';
}

export function getTrendScoreColor(score: number): string {
  if (score >= 75) return '#0ecb81';
  if (score >= 60) return '#36b37e';
  if (score >= 45) return '#f3a52f';
  if (score >= 30) return '#f6855d';
  return '#f6465d';
}

export function getSignalColor(signal: string): string {
  switch (signal) {
    case 'STRONG_BUY': return '#0ecb81';
    case 'BUY': return '#36b37e';
    case 'SELL': return '#f3a52f';
    case 'STRONG_SELL': return '#f6465d';
    default: return '#8b949e';
  }
}

export function getEMAPositionColor(price: number, ema: number | null): string {
  if (ema === null) return '#8b949e';
  return price > ema ? '#0ecb81' : '#f6465d';
}
