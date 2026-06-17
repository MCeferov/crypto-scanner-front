import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import type { Kline } from '../services/binanceApi';
import { getChartKlines, INDICATOR_KLINE_LIMIT } from '../services/klineBatchApi';
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
import { computeAllChartSeries, toChartTime } from '../utils/chartSeries';

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

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
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

  settingsRef.current = settings;

  const getBinanceInterval = useCallback((tf: ChartTimeframe) => {
    return CHART_TIMEFRAMES.find(t => t.key === tf)?.binance ?? '1h';
  }, []);

  const removeSeriesSafe = useCallback((chart: IChartApi, ref: { current: ISeriesApi<'Line'> | ISeriesApi<'Histogram'> | ISeriesApi<'Candlestick'> | null }) => {
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

    // --- Pane 0: Main chart ---
    removeSeriesSafe(chart, candleSeriesRef);
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: theme.upColor,
      downColor: theme.downColor,
      borderVisible: false,
      wickUpColor: theme.upColor,
      wickDownColor: theme.downColor,
    }, 0);
    candleSeriesRef.current.setData(series.candles);

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
      rsiSeriesRef.current = chart.addSeries(LineSeries, { color: theme.rsi, lineWidth: 2, title: 'RSI' }, idx);
      rsiSeriesRef.current.setData(series.rsi);
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
      stochKRef.current = chart.addSeries(LineSeries, { color: theme.stochK, lineWidth: 2, title: 'Stoch K' }, idx);
      stochKRef.current.setData(series.stochRsi.k);
      stochDRef.current = chart.addSeries(LineSeries, { color: theme.stochD, lineWidth: 1, title: 'Stoch D' }, idx);
      stochDRef.current.setData(series.stochRsi.d);
    }

    chart.timeScale().fitContent();
  }, [removeSeriesSafe, clearIndicatorPanes, addIndicatorPane]);

  const onKlinesLoadedRef = useRef(onKlinesLoaded);
  onKlinesLoadedRef.current = onKlinesLoaded;

  const loadData = useCallback(async (sym: string, assetType: ChartAsset['type'], tf: ChartTimeframe, s: IndicatorSettings) => {
    setLoading(true);
    setError(null);
    try {
      const interval = getBinanceInterval(tf);
      const klines = await getChartKlines(assetType, sym, interval, INDICATOR_KLINE_LIMIT);
      klinesRef.current = klines;
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

    const time = toChartTime(kline.openTime);
    candle.update({ time, open: kline.open, high: kline.high, low: kline.low, close: kline.close });

    if (volumeSeriesRef.current) {
      const theme = chartThemeRef.current;
      volumeSeriesRef.current.update({
        time,
        value: kline.volume,
        color: kline.close >= kline.open ? theme.volumeUp : theme.volumeDown,
      });
    }

    const klines = klinesRef.current;
    const last = klines[klines.length - 1];
    if (last && last.openTime === kline.openTime) {
      klines[klines.length - 1] = kline;
    } else if (isClosed) {
      klines.push(kline);
      if (klines.length > 500) klines.shift();
    }

    if (isClosed) {
      applySeries(klines, settingsRef.current);
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

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      paneMapRef.current = { rsi: -1, macd: -1, stoch: -1 };
    };
  }, []);

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
    loadData(symbol, type, timeframe, settings);
  }, [symbol, type, timeframe, settings, loadData]);

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
  };
}
