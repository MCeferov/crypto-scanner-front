import { useEffect, useRef, useState, useCallback } from 'react';
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
import { getKlines } from '../services/binanceApi';
import { ChartKlineWebSocket } from '../services/chartWebSocket';
import {
  CHART_TIMEFRAMES,
  CHART_THEME,
  DEFAULT_INDICATOR_SETTINGS,
  type ChartTimeframe,
  type IndicatorSettings,
} from '../types/chart';
import { computeAllChartSeries, toChartTime } from '../utils/chartSeries';

const BASE_CHART_OPTIONS = {
  layout: {
    background: { color: CHART_THEME.background },
    textColor: CHART_THEME.text,
    fontFamily: "'Inter', sans-serif",
    fontSize: 11,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: CHART_THEME.grid },
    horzLines: { color: CHART_THEME.grid },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: CHART_THEME.crosshair, width: 1 as const, style: 2 },
    horzLine: { color: CHART_THEME.crosshair, width: 1 as const, style: 2 },
  },
  rightPriceScale: { borderColor: CHART_THEME.border },
  timeScale: {
    borderColor: CHART_THEME.border,
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

const PANE_HEIGHTS = { main: 380, rsi: 100, macd: 100, stoch: 100 };

export function useTradingChart(symbol: string) {
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

  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1h');
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

    const series = computeAllChartSeries(klines, s);

    // --- Pane 0: Main chart ---
    removeSeriesSafe(chart, candleSeriesRef);
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: CHART_THEME.upColor,
      downColor: CHART_THEME.downColor,
      borderVisible: false,
      wickUpColor: CHART_THEME.upColor,
      wickDownColor: CHART_THEME.downColor,
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
      bbUpperRef.current = chart.addSeries(LineSeries, { color: CHART_THEME.bbUpper, lineWidth: 1, title: 'BB Upper' }, 0);
      bbMiddleRef.current = chart.addSeries(LineSeries, { color: CHART_THEME.bbMiddle, lineWidth: 1, title: 'BB Mid' }, 0);
      bbLowerRef.current = chart.addSeries(LineSeries, { color: CHART_THEME.bbLower, lineWidth: 1, title: 'BB Lower' }, 0);
      bbUpperRef.current.setData(series.bb.upper);
      bbMiddleRef.current.setData(series.bb.middle);
      bbLowerRef.current.setData(series.bb.lower);
    }

    removeSeriesSafe(chart, stSeriesRef);
    if (s.superTrend.enabled && series.superTrend.length) {
      stSeriesRef.current = chart.addSeries(LineSeries, { color: CHART_THEME.stBull, lineWidth: 2, title: 'SuperTrend' }, 0);
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
      rsiSeriesRef.current = chart.addSeries(LineSeries, { color: CHART_THEME.rsi, lineWidth: 2, title: 'RSI' }, idx);
      rsiSeriesRef.current.setData(series.rsi);
    }

    if (s.macd.enabled && s.macd.panel && series.macd.histogram.length) {
      const idx = addIndicatorPane(chart, 'macd');
      macdHistRef.current = chart.addSeries(HistogramSeries, { title: 'MACD Hist' }, idx);
      macdHistRef.current.setData(series.macd.histogram);
      macdLineRef.current = chart.addSeries(LineSeries, { color: CHART_THEME.macd, lineWidth: 1, title: 'MACD' }, idx);
      macdLineRef.current.setData(series.macd.macd);
      macdSignalRef.current = chart.addSeries(LineSeries, { color: CHART_THEME.macdSignal, lineWidth: 1, title: 'Signal' }, idx);
      macdSignalRef.current.setData(series.macd.signal);
    }

    if (s.stochRsi.enabled && s.stochRsi.panel && series.stochRsi.k.length) {
      const idx = addIndicatorPane(chart, 'stoch');
      stochKRef.current = chart.addSeries(LineSeries, { color: CHART_THEME.stochK, lineWidth: 2, title: 'Stoch K' }, idx);
      stochKRef.current.setData(series.stochRsi.k);
      stochDRef.current = chart.addSeries(LineSeries, { color: CHART_THEME.stochD, lineWidth: 1, title: 'Stoch D' }, idx);
      stochDRef.current.setData(series.stochRsi.d);
    }

    chart.timeScale().fitContent();
  }, [removeSeriesSafe, clearIndicatorPanes, addIndicatorPane]);

  const loadData = useCallback(async (sym: string, tf: ChartTimeframe, s: IndicatorSettings) => {
    setLoading(true);
    setError(null);
    try {
      const interval = getBinanceInterval(tf);
      const klines = await getKlines(sym, interval, 500);
      klinesRef.current = klines;
      applySeries(klines, s);
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
      volumeSeriesRef.current.update({
        time,
        value: kline.volume,
        color: kline.close >= kline.open ? CHART_THEME.volumeUp : CHART_THEME.volumeDown,
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

    const chart = createChart(containerRef.current, {
      ...BASE_CHART_OPTIONS,
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
    if (!symbol) return;
    loadData(symbol, timeframe, settings);
  }, [symbol, timeframe, settings, loadData]);

  useEffect(() => {
    if (!symbol) return;
    wsRef.current?.destroy();
    const ws = new ChartKlineWebSocket(symbol, getBinanceInterval(timeframe), handleRealtimeKline);
    ws.connect();
    wsRef.current = ws;
    return () => { ws.destroy(); wsRef.current = null; };
  }, [symbol, timeframe, getBinanceInterval, handleRealtimeKline]);

  const toggleIndicator = useCallback((key: keyof IndicatorSettings) => {
    setSettings(prev => {
      const next = { ...prev };
      if (key === 'volume') next.volume = { ...prev.volume, enabled: !prev.volume.enabled };
      else if (key === 'bollingerBands') next.bollingerBands = { ...prev.bollingerBands, enabled: !prev.bollingerBands.enabled };
      else if (key === 'superTrend') next.superTrend = { ...prev.superTrend, enabled: !prev.superTrend.enabled };
      else if (key === 'rsi') next.rsi = { ...prev.rsi, enabled: !prev.rsi.enabled };
      else if (key === 'macd') next.macd = { ...prev.macd, enabled: !prev.macd.enabled };
      else if (key === 'atr') next.atr = { ...prev.atr, enabled: !prev.atr.enabled };
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
