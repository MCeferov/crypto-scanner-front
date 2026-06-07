import React from 'react';
import { useTradingChart } from '../../hooks/useTradingChart';
import { ChartToolbar } from './ChartToolbar';

interface TradingChartProps {
  symbol: string;
}

export function TradingChart({ symbol }: TradingChartProps) {
  const {
    containerRef,
    timeframe, setTimeframe, settings, toggleIndicator, togglePanel, updateSettings,
    loading, error,
  } = useTradingChart(symbol);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-[#21262d] overflow-hidden">
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d1117]/80">
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

      <div className="px-3 py-1.5 border-t border-[#21262d] text-[10px] text-[#484f58]">
        Charts by{' '}
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="text-[#8b949e] hover:text-[#e6edf3]">
          TradingView
        </a>
        {' '}· Binance real-time data
      </div>
    </div>
  );
}
