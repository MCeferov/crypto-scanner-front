import React, { useCallback, useRef, useState } from 'react';
import { useTradingChart } from '../../hooks/useTradingChart';
import { ChartToolbar } from './ChartToolbar';
import { DrawingToolbar } from './drawing/DrawingToolbar';
import { DrawingLayer, type DrawingLayerHandle } from './drawing/DrawingLayer';
import type { DrawingTool } from './drawing/drawingTypes';
import type { ChartAsset, ChartTimeframe } from '../../types/chart';
import type { AssetType } from '../../types/asset';
import type { Kline } from '../../services/binanceApi';
import { formatAssetPrice } from '../../utils/formatters';

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
    legend, stInfo, zones, patterns, logScale, setLogScale, takeScreenshot,
    chartRef, mainSeriesRef, klinesRef, stDataRef,
  } = useTradingChart(asset, initialTimeframe, onKlinesLoaded);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const drawingLayerRef = useRef<DrawingLayerHandle>(null);

  const [drawTool, setDrawTool] = useState<DrawingTool>('none');
  const [magnet, setMagnet] = useState(true);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [hasSelection, setHasSelection] = useState(false);

  const handleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const spacing = ts.options().barSpacing;
    ts.applyOptions({ barSpacing: Math.max(0.5, Math.min(60, spacing * factor)) });
  }, [chartRef]);

  const sourceLabel = type === 'crypto' ? 'Binance real-time data' : 'Yahoo Finance data';
  const up = legend ? legend.changePct >= 0 : true;
  const showOhlc = legend && settings.candleMode !== 'line' && settings.candleMode !== 'area';

  return (
    <div
      ref={wrapperRef}
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
        logScale={logScale}
        onToggleLogScale={() => setLogScale(v => !v)}
        onScreenshot={takeScreenshot}
        onFullscreen={handleFullscreen}
      />

      <div className="flex flex-1 min-h-[500px]">
        {/* TradingView-style drawing toolbar */}
        <DrawingToolbar
          tool={drawTool}
          onToolChange={setDrawTool}
          magnet={magnet}
          onToggleMagnet={() => setMagnet(v => !v)}
          drawingsVisible={drawingsVisible}
          onToggleVisible={() => setDrawingsVisible(v => !v)}
          hasSelection={hasSelection}
          onDeleteSelected={() => drawingLayerRef.current?.deleteSelected()}
          onClearAll={() => drawingLayerRef.current?.clearAll()}
          onZoomIn={() => zoomBy(1.25)}
          onZoomOut={() => zoomBy(0.8)}
        />

        <div className="relative flex-1">
          {/* TradingView-style OHLC legend */}
          {legend && (
            <div
              className="absolute top-2 left-2 z-20 flex flex-col gap-1 pointer-events-none select-none"
            >
              <div
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono flex-wrap"
                style={{
                  background: 'color-mix(in srgb, var(--chart-bg) 78%, transparent)',
                  color: 'var(--chart-text)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <span className="font-sans font-semibold" style={{ color: 'var(--chart-text-bright)' }}>
                  {symbol}
                </span>
                <span style={{ color: 'var(--chart-text-dim)' }}>·</span>
                <span className="font-sans">{timeframe.toUpperCase()}</span>
                {showOhlc ? (
                  <>
                    <span>O <b style={{ color: 'var(--chart-text-bright)' }}>{formatAssetPrice(legend.open, type)}</b></span>
                    <span>H <b style={{ color: 'var(--chart-text-bright)' }}>{formatAssetPrice(legend.high, type)}</b></span>
                    <span>L <b style={{ color: 'var(--chart-text-bright)' }}>{formatAssetPrice(legend.low, type)}</b></span>
                    <span>C <b style={{ color: up ? '#26a69a' : '#ef5350' }}>{formatAssetPrice(legend.close, type)}</b></span>
                    <span style={{ color: up ? '#26a69a' : '#ef5350' }}>
                      {up ? '+' : ''}{legend.changePct.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span><b style={{ color: 'var(--chart-text-bright)' }}>{formatAssetPrice(legend.close, type)}</b></span>
                )}
              </div>

              {/* Supertrend legend — TradingView reference */}
              {settings.superTrend.enabled && stInfo && (
                <div
                  className="flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-mono w-fit"
                  style={{
                    background: 'color-mix(in srgb, var(--chart-bg) 78%, transparent)',
                    color: 'var(--chart-text)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <span className="font-sans">
                    Supertrend {settings.superTrend.period} {settings.superTrend.multiplier}
                  </span>
                  <b style={{ color: stInfo.trend === 1 ? '#26a69a' : '#ef5350' }}>
                    {formatAssetPrice(stInfo.value, type)}
                  </b>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--chart-bg) 80%, transparent)' }}
            >
              <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--accent-ring)', borderTopColor: 'var(--accent)' }} />
            </div>
          )}
          {error && (
            <div
              className="absolute top-2 left-2 z-20 px-3 py-1.5 rounded text-xs border"
              style={{ color: '#ef5350', background: 'rgba(239,83,80,.10)', borderColor: 'rgba(239,83,80,.25)' }}
            >
              {error}
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />

          {/* Drawing + Supply/Demand zone overlay */}
          <DrawingLayer
            key={`${symbol}:${timeframe}`}
            ref={drawingLayerRef}
            chartRef={chartRef}
            seriesRef={mainSeriesRef}
            klinesRef={klinesRef}
            stDataRef={stDataRef}
            zones={zones}
            patterns={patterns}
            tool={drawTool}
            onToolFinished={() => setDrawTool('none')}
            magnet={magnet}
            drawingsVisible={drawingsVisible}
            onSelectionChange={setHasSelection}
          />
        </div>
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
