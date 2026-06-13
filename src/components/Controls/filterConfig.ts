import type { FilterKey } from '../../context/MarketContext';

export interface FilterDef {
  key: FilterKey;
  label: string;
  color?: string;
  group: 'default' | 'optional';
}

export const FILTER_DEFS: FilterDef[] = [
  { key: 'all',        label: 'All',         group: 'default' },
  { key: 'setupBuy',   label: 'Setup Buy',   color: '#26a69a', group: 'default' },
  { key: 'setupSell',  label: 'Setup Sell',  color: '#ef5350', group: 'default' },
  { key: 'oversold',   label: 'RSI < 30',    color: '#26a69a', group: 'default' },
  { key: 'overbought', label: 'RSI > 70',    color: '#ef5350', group: 'default' },
  { key: 'topGainers', label: '↑ Gainers',   color: '#26a69a', group: 'default' },
  { key: 'topLosers',  label: '↓ Losers',    color: '#ef5350', group: 'default' },

  { key: 'highVolume',     label: 'Top Volume',  color: '#f0b90b', group: 'optional' },
  { key: 'strongBuy',      label: 'AI Buy',      color: '#26a69a', group: 'optional' },
  { key: 'strongSell',     label: 'AI Sell',     color: '#ef5350', group: 'optional' },
  { key: 'chartBuy',       label: 'Chart Buy',   color: '#26a69a', group: 'optional' },
  { key: 'chartSell',      label: 'Chart Sell',  color: '#ef5350', group: 'optional' },
  { key: 'researchBuy',    label: 'Bazar AL',    color: '#26a69a', group: 'optional' },
  { key: 'researchSell',   label: 'Bazar SAT',   color: '#ef5350', group: 'optional' },
  { key: 'zoneBuy',        label: 'S/D Buy',     color: '#26a69a', group: 'optional' },
  { key: 'zoneSell',       label: 'S/D Sell',    color: '#ef5350', group: 'optional' },
  { key: 'zoneBreakLong',  label: '↑ Break',     color: '#26a69a', group: 'optional' },
  { key: 'zoneBreakShort', label: '↓ Break',     color: '#ef5350', group: 'optional' },
  { key: 'haBuy',          label: 'HA Buy',      color: '#26a69a', group: 'optional' },
  { key: 'haSell',         label: 'HA Sell',     color: '#ef5350', group: 'optional' },
  { key: 'setupStrongBuy', label: 'S BUY',       color: '#26a69a', group: 'optional' },
  { key: 'setupStrongSell',label: 'S SELL',      color: '#ef5350', group: 'optional' },
  { key: 'candlesMature',  label: '≥3 Şam',      color: '#f0b90b', group: 'optional' },
  { key: 'candlesFresh',   label: 'Təzə ≤2',     color: '#f0b90b', group: 'optional' },
  { key: 'syncStrong',     label: 'Sinxron ✓',   color: '#f0b90b', group: 'optional' },
];

export const DEFAULT_FILTER_KEYS = FILTER_DEFS.filter(f => f.group === 'default').map(f => f.key);
export const OPTIONAL_FILTER_KEYS = FILTER_DEFS.filter(f => f.group === 'optional').map(f => f.key);

export function getFilterDef(key: FilterKey): FilterDef | undefined {
  return FILTER_DEFS.find(f => f.key === key);
}
