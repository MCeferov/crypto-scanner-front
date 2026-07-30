import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
} from 'lightweight-charts';
import type { Kline } from '../services/binanceApi';
import { getChartKlines, CHART_KLINE_LIMIT } from '../services/klineBatchApi';
import { ChartKlineWebSocket } from '../services/chartWebSocket';
import {
  CHART_TIMEFRAMES,
  DEFAULT_INDICATOR_SETTINGS,
  getChartTheme,
  type ChartAsset,
  type ChartThemeColors,
  type ChartTimeframe,
  type IndicatorSettings,
} from '../types/chart';
import { computeAllChartSeries, displayKlinesForCandles, klinesToCloseLine, toChartTime } from '../utils/chartSeries';

/** TradingView-style OHLCV legend payload (crosshair-follow, falls back to last bar). */
export interface ChartLegend {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  changePct: number;
}

type MainSeries = ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'>;

function buildChartOptions(theme: ChartThemeColors) {
  return {
    layout: {
      background: { color: theme.background },
      textColor: theme.text,
      fontFamily: "'Inter', sans-serif",
      fontSize: 11,
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: theme.crosshair, width: 1 as const, style: 2 },
      horzLine: { color: theme.crosshair, width: 1 as const, style: 2 },
    },
    rightPriceScale: { borderColor: theme.border },
    timeScale: {
      borderColor: theme.border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 8,
      barSpacing: 8,
      minBarSpacing: 2,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  };
}

const PANE_HEIGHTS = { main: 380, rsi: 100, macd: 100, stoch: 100 };

export function useTradingChart(
  asset: ChartAsset,
  initialTimeframe: ChartTimeframe = '1h',
  onKlinesLoaded?: (interval: string, klines: Kline[]) => void,
) {
  const { symbol, type } = asset;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const chartTheme = getChartTheme(isDark);
  const chartThemeRef = useRef(chartTheme);
  chartThemeRef.current = chartTheme;

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<MainSeries | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const stSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const stochKRef = useRef<ISeriesApi<'Line'> | null>(null);
  const stochDRef = useRef<ISeriesApi<'Line'> | null>(null);

  const paneMapRef = useRef<{ rsi: number; macd: number; stoch: number }>({ rsi: -1, macd: -1, stoch: -1 });

  const wsRef = useRef<ChartKlineWebSocket | null>(null);
  const klinesRef = useRef<Kline[]>([]);
  const settingsRef = useRef<IndicatorSettings>(DEFAULT_INDICATOR_SETTINGS);

  const [timeframe, setTimeframe] = useState<ChartTimeframe>(initialTimeframe);
  const [settings, setSettings] = useState<IndicatorSettings>(DEFAULT_INDICATOR_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legend, setLegend] = useState<ChartLegend | null>(null);
  const [logScale, setLogScale] = useState(false);
  const hoveringRef = useRef(false);

  settingsRef.current = settings;

  const legendFromKline = useCallback((k: Kline | undefined): ChartLegend | null => {
    if (!k) return null;
    return {
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume ?? null,
      changePct: k.open > 0 ? ((k.close - k.open) / k.open) * 100 : 0,
    };
  }, []);

  const getBinanceInterval = useCallback((tf: ChartTimeframe) => {
    return CHART_TIMEFRAMES.find(t => t.key === tf)?.binance ?? '1h';
  }, []);

  const removeSeriesSafe = useCallback((chart: IChartApi, ref: { current: ISeriesApi<'Line'> | ISeriesApi<'Histogram'> | ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null }) => {
    if (ref.current) {
      try { chart.removeSeries(ref.current); } catch { /* */ }
      ref.current = null;
    }
  }, []);

  const clearIndicatorPanes = useCallback((chart: IChartApi) => {
    while (chart.panes().length > 1) {
      try { chart.removePane(chart.panes().length - 1); } catch { break; }
    }
    paneMapRef.current = { rsi: -1, macd: -1, stoch: -1 };
  }, []);

  const addIndicatorPane = useCallback((chart: IChartApi, key: 'rsi' | 'macd' | 'stoch'): number => {
    const pane = chart.addPane();
    const idx = pane.paneIndex();
    paneMapRef.current[key] = idx;
    pane.setHeight(PANE_HEIGHTS[key]);
    return idx;
  }, []);

  const applySeries = useCallback((klines: Kline[], s: IndicatorSettings) => {
    const chart = chartRef.current;
    if (!chart || klines.length === 0) return;

    const theme = chartThemeRef.current;
    const series = computeAllChartSeries(klines, s);

    // --- Pane 0: Main chart (candles / heikin ashi / line / area) ---
    removeSeriesSafe(chart, candleSeriesRef);
    if (s.candleMode === 'line') {
      const line = chart.addSeries(LineSeries, {
        color: theme.lineColor,
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      }, 0);
      line.setData(klinesToCloseLine(klines));
      candleSeriesRef.current = line;
    } else if (s.candleMode === 'area') {
      const area = chart.addSeries(AreaSeries, {
        lineColor: theme.lineColor,
        lineWidth: 2,
        topColor: theme.areaTop,
        bottomColor: theme.areaBottom,
      }, 0);
      area.setData(klinesToCloseLine(klines));
      candleSeriesRef.current = area;
    } else {
      const candle = chart.addSeries(CandlestickSeries, {
        upColor: theme.upColor,
        downColor: theme.downColor,
        borderVisible: false,
        wickUpColor: theme.upColor,
        wickDownColor: theme.downColor,
      }, 0);
      candle.setData(series.candles);
      candleSeriesRef.current = candle;
    }

    if (!hoveringRef.current) {
      const src = displayKlinesForCandles(klines, s.candleMode);
      setLegend(legendFromKline(src[src.length - 1]));
    }

    removeSeriesSafe(chart, volumeSeriesRef);
    if (s.volume.enabled && series.volume.length) {
      volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
        priceScaleId: 'volume',
        priceFormat: { type: 'volume' },
      }, 0);
      volumeSeriesRef.current.setData(series.volume);
      chart.priceScale('volume', 0).applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    }

    [bbUpperRef, bbMiddleRef, bbLowerRef].forEach(ref => removeSeriesSafe(chart, ref));
    if (s.bollingerBands.enabled) {
      bbUpperRef.current = chart.addSeries(LineSeries, { color: theme.bbUpper, lineWidth: 1, title: 'BB Upper' }, 0);
      bbMiddleRef.current = chart.addSeries(LineSeries, { color: theme.bbMiddle, lineWidth: 1, title: 'BB Mid' }, 0);
      bbLowerRef.current = chart.addSeries(LineSeries, { color: theme.bbLower, lineWidth: 1, title: 'BB Lower' }, 0);
      bbUpperRef.current.setData(series.bb.upper);
      bbMiddleRef.current.setData(series.bb.middle);
      bbLowerRef.current.setData(series.bb.lower);
    }

    removeSeriesSafe(chart, stSeriesRef);
    if (s.superTrend.enabled && series.superTrend.length) {
      stSeriesRef.current = chart.addSeries(LineSeries, { color: theme.stBull, lineWidth: 2, title: 'SuperTrend' }, 0);
      stSeriesRef.current.setData(series.superTrend.map(p => ({ time: p.time, value: p.value })));
    }

    chart.panes()[0]?.setHeight(PANE_HEIGHTS.main);

    // Rebuild indicator panes from scratch
    removeSeriesSafe(chart, rsiSeriesRef);
    [macdHistRef, macdLineRef, macdSignalRef].forEach(ref => removeSeriesSafe(chart, ref));
    [stochKRef, stochDRef].forEach(ref => removeSeriesSafe(chart, ref));
    clearIndicatorPanes(chart);

    if (s.rsi.enabled && s.rsi.panel && series.rsi.length) {
      const idx = addIndicatorPane(chart, 'rsi');
      rsiSeriesRef.current = chart.addSeries(LineSeries, {
        color: theme.rsi, lineWidth: 2, title: 'RSI',
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      }, idx);
      rsiSeriesRef.current.setData(series.rsi);
      rsiSeriesRef.current.createPriceLine({
        price: s.rsi.overbought, color: 'rgba(239,83,80,0.7)', lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `OB ${s.rsi.overbought}`,
      });
      rsiSeriesRef.current.createPriceLine({
        price: s.rsi.oversold, color: 'rgba(38,166,154,0.7)', lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `OS ${s.rsi.oversold}`,
      });
      rsiSeriesRef.current.createPriceLine({
        price: 50, color: 'rgba(150,150,150,0.35)', lineWidth: 1,
        lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '',
      });
    }

    if (s.macd.enabled && s.macd.panel && series.macd.histogram.length) {
      const idx = addIndicatorPane(chart, 'macd');
      macdHistRef.current = chart.addSeries(HistogramSeries, { title: 'MACD Hist' }, idx);
      macdHistRef.current.setData(series.macd.histogram);
      macdLineRef.current = chart.addSeries(LineSeries, { color: theme.macd, lineWidth: 1, title: 'MACD' }, idx);
      macdLineRef.current.setData(series.macd.macd);
      macdSignalRef.current = chart.addSeries(LineSeries, { color: theme.macdSignal, lineWidth: 1, title: 'Signal' }, idx);
      macdSignalRef.current.setData(series.macd.signal);
    }

    if (s.stochRsi.enabled && s.stochRsi.panel && series.stochRsi.k.length) {
      const idx = addIndicatorPane(chart, 'stoch');
      stochKRef.current = chart.addSeries(LineSeries, {
        color: theme.stochK, lineWidth: 2, title: 'Stoch K',
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      }, idx);
      stochKRef.current.setData(series.stochRsi.k);
      stochKRef.current.createPriceLine({
        price: s.stochRsi.overbought, color: 'rgba(239,83,80,0.7)', lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `OB ${s.stochRsi.overbought}`,
      });
      stochKRef.current.createPriceLine({
        price: s.stochRsi.oversold, color: 'rgba(38,166,154,0.7)', lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `OS ${s.stochRsi.oversold}`,
      });
      stochDRef.current = chart.addSeries(LineSeries, { color: theme.stochD, lineWidth: 1, title: 'Stoch D' }, idx);
      stochDRef.current.setData(series.stochRsi.d);
    }

    chart.timeScale().fitContent();
  }, [removeSeriesSafe, clearIndicatorPanes, addIndicatorPane, legendFromKline]);

  const onKlinesLoadedRef = useRef(onKlinesLoaded);
  onKlinesLoadedRef.current = onKlinesLoaded;

  const loadData = useCallback(async (sym: string, assetType: ChartAsset['type'], tf: ChartTimeframe, s: IndicatorSettings) => {
    setLoading(true);
    setError(null);
    try {
      const interval = getBinanceInterval(tf);
      const klines = await getChartKlines(assetType, sym, interval, CHART_KLINE_LIMIT);
      // Own copy — the fetched array is handed to onKlinesLoaded (and cached
      // upstream); realtime updates must not mutate it behind the cache's back.
      klinesRef.current = [...klines];
      applySeries(klines, s);
      onKlinesLoadedRef.current?.(interval, klines);
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
      setLoading(false);
    }
  }, [applySeries, getBinanceInterval]);

  const handleRealtimeKline = useCallback((kline: Kline, isClosed: boolean) => {
    const candle = candleSeriesRef.current;
    if (!candle) return;

    const klines = klinesRef.current;
    const last = klines[klines.length - 1];
    if (last && last.openTime === kline.openTime) {
      klines[klines.length - 1] = kline;
    } else if (isClosed) {
      klines.push(kline);
      if (klines.length > CHART_KLINE_LIMIT) klines.shift();
    } else if (!last || last.openTime !== kline.openTime) {
      klines.push(kline);
      // This (new in-progress candle) is the branch that actually runs once
      // per bar — without trimming here the array grows without bound.
      if (klines.length > CHART_KLINE_LIMIT) klines.shift();
    }

    const s = settingsRef.current;
    const display = displayKlinesForCandles(klines, s.candleMode);
    const bar = display[display.length - 1];
    if (!bar) return;

    const time = toChartTime(bar.openTime);
    if (s.candleMode === 'line' || s.candleMode === 'area') {
      (candle as ISeriesApi<'Line'>).update({ time, value: bar.close });
    } else {
      (candle as ISeriesApi<'Candlestick'>).update({ time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    }
    if (!hoveringRef.current) setLegend(legendFromKline(bar));

    if (volumeSeriesRef.current) {
      const theme = chartThemeRef.current;
      volumeSeriesRef.current.update({
        time,
        value: bar.volume,
        color: bar.close >= bar.open ? theme.volumeUp : theme.volumeDown,
      });
    }

    if (isClosed) {
      applySeries(klines, s);
    }
  }, [applySeries]);

  useEffect(() => {
    if (!containerRef.current) return;

    const initialTheme = getChartTheme(document.documentElement.classList.contains('dark'));
    const chart = createChart(containerRef.current, {
      ...buildChartOptions(initialTheme),
      width: containerRef.current.clientWidth,
      height: 680,
      autoSize: true,
    });
    chartRef.current = chart;
    chart.panes()[0]?.setHeight(PANE_HEIGHTS.main);

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    // TradingView-style legend: follow the crosshair, fall back to last bar.
    const onCrosshair = (param: MouseEventParams) => {
      const main = candleSeriesRef.current;
      if (!main) return;
      if (!param.time || !param.point) {
        hoveringRef.current = false;
        const s = settingsRef.current;
        const src = displayKlinesForCandles(klinesRef.current, s.candleMode);
        setLegend(legendFromKline(src[src.length - 1]));
        return;
      }
      hoveringRef.current = true;
      const sd = param.seriesData.get(main) as
        | { open?: number; high?: number; low?: number; close?: number; value?: number }
        | undefined;
      if (!sd) return;
      if (sd.open != null && sd.close != null) {
        setLegend({
          open: sd.open,
          high: sd.high ?? sd.close,
          low: sd.low ?? sd.close,
          close: sd.close,
          volume: null,
          changePct: sd.open > 0 ? ((sd.close - sd.open) / sd.open) * 100 : 0,
        });
      } else if (sd.value != null) {
        setLegend({ open: sd.value, high: sd.value, low: sd.value, close: sd.value, volume: null, changePct: 0 });
      }
    };
    chart.subscribeCrosshairMove(onCrosshair);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      paneMapRef.current = { rsi: -1, macd: -1, stoch: -1 };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log price scale (TradingView "log" toggle)
  useEffect(() => {
    chartRef.current?.priceScale('right').applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [logScale]);

  /** Download the current chart as PNG. */
  const takeScreenshot = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      const canvas = chart.takeScreenshot();
      const link = document.createElement('a');
      link.download = `${symbol}-${timeframe}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { /* screenshot unsupported */ }
  }, [symbol, timeframe]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.applyOptions(buildChartOptions(chartTheme));
    if (klinesRef.current.length > 0) {
      applySeries(klinesRef.current, settingsRef.current);
    }
  }, [isDark, chartTheme, applySeries]);

  useEffect(() => {
    if (!symbol) return;
    loadData(symbol, type, timeframe, settingsRef.current);
    // `settings` is deliberately NOT a dependency: toggling an indicator is a
    // pure client-side redraw — refetching 3000 candles per toggle blanked
    // the chart and hammered the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, type, timeframe, loadData]);

  useEffect(() => {
    if (klinesRef.current.length > 0) {
      applySeries(klinesRef.current, settings);
    }
  }, [settings, applySeries]);

  useEffect(() => {
    if (!symbol || type !== 'crypto') {
      wsRef.current?.destroy();
      wsRef.current = null;
      return;
    }
    wsRef.current?.destroy();
    const ws = new ChartKlineWebSocket(symbol, getBinanceInterval(timeframe), handleRealtimeKline);
    ws.connect();
    wsRef.current = ws;
    return () => { ws.destroy(); wsRef.current = null; };
  }, [symbol, type, timeframe, getBinanceInterval, handleRealtimeKline]);

  const toggleIndicator = useCallback((key: keyof IndicatorSettings) => {
    setSettings(prev => {
      const next = { ...prev };
      if (key === 'volume') next.volume = { ...prev.volume, enabled: !prev.volume.enabled };
      else if (key === 'bollingerBands') next.bollingerBands = { ...prev.bollingerBands, enabled: !prev.bollingerBands.enabled };
      else if (key === 'superTrend') next.superTrend = { ...prev.superTrend, enabled: !prev.superTrend.enabled };
      else if (key === 'rsi') next.rsi = { ...prev.rsi, enabled: !prev.rsi.enabled };
      else if (key === 'macd') next.macd = { ...prev.macd, enabled: !prev.macd.enabled };
      else if (key === 'stochRsi') next.stochRsi = { ...prev.stochRsi, enabled: !prev.stochRsi.enabled };
      return next;
    });
  }, []);

  const togglePanel = useCallback((key: 'rsi' | 'macd' | 'stochRsi') => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], panel: !prev[key].panel },
    }));
  }, []);

  const updateSettings = useCallback((partial: Partial<IndicatorSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  }, []);

  return {
    containerRef,
    timeframe,
    setTimeframe,
    settings,
    toggleIndicator,
    togglePanel,
    updateSettings,
    loading,
    error,
    legend,
    logScale,
    setLogScale,
    takeScreenshot,
  };
}
