import React from 'react';
import { useTradingChart } from '../../hooks/useTradingChart';
import { ChartToolbar } from './ChartToolbar';
import type { ChartAsset, ChartTimeframe } from '../../types/chart';
import type { AssetType } from '../../types/asset';
import type { Kline } from '../../services/binanceApi';

interface TradingChartProps {
  symbol: string;
  type?: AssetType;
  initialTimeframe?: ChartTimeframe;
  onKlinesLoaded?: (interval: string, klines: Kline[]) => void;
}

export function TradingChart({
  symbol,
  type = 'crypto',
  initialTimeframe = '1h',
  onKlinesLoaded,
}: TradingChartProps) {
  const asset: ChartAsset = { symbol, type };
  const {
    containerRef,
    timeframe, setTimeframe, settings, toggleIndicator, togglePanel, updateSettings,
    loading, error,
  } = useTradingChart(asset, initialTimeframe, onKlinesLoaded);

  const sourceLabel = type === 'crypto' ? 'Binance real-time data' : 'Yahoo Finance data';

  return (
    <div
      className="flex flex-col h-full rounded-lg border overflow-hidden"
      style={{ background: 'var(--chart-bg)', borderColor: 'var(--chart-border)' }}
    >
      <ChartToolbar
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        settings={settings}
        onToggleIndicator={toggleIndicator}
        onTogglePanel={togglePanel}
        onUpdateSettings={updateSettings}
      />

      <div className="relative flex-1 min-h-[500px]">
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--chart-bg) 80%, transparent)' }}
          >
            <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(240,185,11,0.2)', borderTopColor: '#f0b90b' }} />
          </div>
        )}
        {error && (
          <div className="absolute top-2 left-2 z-10 px-3 py-1.5 rounded text-xs text-red-400 bg-red-500/10 border border-red-500/20">
            {error}
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>

      <div
        className="px-3 py-1.5 border-t text-[10px]"
        style={{ borderColor: 'var(--chart-border)', color: 'var(--chart-text-dim)' }}
      >
        Charts by{' '}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
          style={{ color: 'var(--chart-text)' }}
        >
          TradingView
        </a>
        {' '}· {sourceLabel}
      </div>
    </div>
  );
}
