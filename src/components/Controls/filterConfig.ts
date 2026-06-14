import type { FilterKey } from '../../context/MarketContext';

export interface FilterDef {
  key: FilterKey;
  labelKey: string;
  color?: string;
  group: 'default' | 'optional';
}

export const FILTER_DEFS: FilterDef[] = [
  { key: 'all',        labelKey: 'filter.all',         group: 'default' },
  { key: 'setupBuy',   labelKey: 'filter.setupBuy',    color: '#26a69a', group: 'default' },
  { key: 'setupSell',  labelKey: 'filter.setupSell',   color: '#ef5350', group: 'default' },
  { key: 'oversold',   labelKey: 'filter.oversold',    color: '#26a69a', group: 'default' },
  { key: 'overbought', labelKey: 'filter.overbought',  color: '#ef5350', group: 'default' },
  { key: 'topGainers', labelKey: 'filter.topGainers',  color: '#26a69a', group: 'default' },
  { key: 'topLosers',  labelKey: 'filter.topLosers',   color: '#ef5350', group: 'default' },

  { key: 'highVolume',     labelKey: 'filter.highVolume',     color: '#f0b90b', group: 'optional' },
  { key: 'strongBuy',      labelKey: 'filter.strongBuy',      color: '#26a69a', group: 'optional' },
  { key: 'strongSell',     labelKey: 'filter.strongSell',     color: '#ef5350', group: 'optional' },
  { key: 'chartBuy',       labelKey: 'filter.chartBuy',       color: '#26a69a', group: 'optional' },
  { key: 'chartSell',      labelKey: 'filter.chartSell',      color: '#ef5350', group: 'optional' },
  { key: 'researchBuy',    labelKey: 'filter.researchBuy',    color: '#26a69a', group: 'optional' },
  { key: 'researchSell',   labelKey: 'filter.researchSell',   color: '#ef5350', group: 'optional' },
  { key: 'zoneBuy',        labelKey: 'filter.zoneBuy',        color: '#26a69a', group: 'optional' },
  { key: 'zoneSell',       labelKey: 'filter.zoneSell',       color: '#ef5350', group: 'optional' },
  { key: 'zoneBreakLong',  labelKey: 'filter.zoneBreakLong',  color: '#26a69a', group: 'optional' },
  { key: 'zoneBreakShort', labelKey: 'filter.zoneBreakShort', color: '#ef5350', group: 'optional' },
  { key: 'haBuy',          labelKey: 'filter.haBuy',          color: '#26a69a', group: 'optional' },
  { key: 'haSell',         labelKey: 'filter.haSell',         color: '#ef5350', group: 'optional' },
  { key: 'setupStrongBuy', labelKey: 'filter.setupStrongBuy', color: '#26a69a', group: 'optional' },
  { key: 'setupStrongSell',labelKey: 'filter.setupStrongSell',color: '#ef5350', group: 'optional' },
  { key: 'candlesMature',  labelKey: 'filter.candlesMature',  color: '#f0b90b', group: 'optional' },
  { key: 'candlesFresh',   labelKey: 'filter.candlesFresh',   color: '#f0b90b', group: 'optional' },
  { key: 'syncStrong',     labelKey: 'filter.syncStrong',     color: '#f0b90b', group: 'optional' },
];

export const DEFAULT_FILTER_KEYS = FILTER_DEFS.filter(f => f.group === 'default').map(f => f.key);
export const OPTIONAL_FILTER_KEYS = FILTER_DEFS.filter(f => f.group === 'optional').map(f => f.key);

export function getFilterDef(key: FilterKey): FilterDef | undefined {
  return FILTER_DEFS.find(f => f.key === key);
}
