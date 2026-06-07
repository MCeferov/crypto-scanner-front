import type { UTCTimestamp } from 'lightweight-charts';
import type { Kline } from '../services/binanceApi';
import type { IndicatorSettings } from '../types/chart';
import { calculateRSI } from '../indicators/rsi';
import { calculateMACD } from '../indicators/macd';
import { calculateBollingerBands } from '../indicators/bollingerBands';
import { calculateSuperTrend } from '../indicators/supertrend';
import { calculateStochRSI } from '../indicators/stochRsi';
import { calculateATR } from '../indicators/atr';

export function toChartTime(openTime: number): UTCTimestamp {
  return Math.floor(openTime / 1000) as UTCTimestamp;
}

export function klinesToCandles(klines: Kline[]) {
  return klines.map(k => ({
    time: toChartTime(k.openTime),
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
  }));
}

export function klinesToVolume(klines: Kline[]) {
  return klines.map(k => ({
    time: toChartTime(k.openTime),
    value: k.volume,
    color: k.close >= k.open ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)',
  }));
}

export function buildRSISeries(klines: Kline[], period: number) {
  const closes = klines.map(k => k.close);
  const values = calculateRSI(closes, period);
  const offset = closes.length - values.length;
  return values.map((value, i) => ({
    time: toChartTime(klines[offset + i].openTime),
    value,
  }));
}

export function buildMACDSeries(klines: Kline[], fast: number, slow: number, signal: number) {
  const closes = klines.map(k => k.close);
  const results = calculateMACD(closes, fast, slow, signal);
  const offset = closes.length - results.length;
  return {
    macd: results.map((r, i) => ({ time: toChartTime(klines[offset + i].openTime), value: r.macd })),
    signal: results.map((r, i) => ({ time: toChartTime(klines[offset + i].openTime), value: r.signal })),
    histogram: results.map((r, i) => ({
      time: toChartTime(klines[offset + i].openTime),
      value: r.histogram,
      color: r.histogram >= 0 ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)',
    })),
  };
}

export function buildBBSeries(klines: Kline[], period: number, stdDev: number) {
  const closes = klines.map(k => k.close);
  const results = calculateBollingerBands(closes, period, stdDev);
  const offset = closes.length - results.length;
  return {
    upper: results.map((r, i) => ({ time: toChartTime(klines[offset + i].openTime), value: r.upper })),
    middle: results.map((r, i) => ({ time: toChartTime(klines[offset + i].openTime), value: r.middle })),
    lower: results.map((r, i) => ({ time: toChartTime(klines[offset + i].openTime), value: r.lower })),
  };
}

export function buildSuperTrendSeries(klines: Kline[], period: number, multiplier: number) {
  const results = calculateSuperTrend(klines, period, multiplier);
  const offset = klines.length - results.length;
  return results.map((r, i) => ({
    time: toChartTime(klines[offset + i].openTime),
    value: r.value,
    trend: r.trend,
  }));
}

export function buildStochRSISeries(klines: Kline[], settings: IndicatorSettings['stochRsi']) {
  const closes = klines.map(k => k.close);
  const results = calculateStochRSI(
    closes,
    settings.rsiPeriod,
    settings.stochPeriod,
    settings.kSmooth,
    settings.dSmooth,
  );
  const offset = closes.length - results.length;
  return {
    k: results.map((r, i) => ({ time: toChartTime(klines[offset + i].openTime), value: r.k })),
    d: results.map((r, i) => ({ time: toChartTime(klines[offset + i].openTime), value: r.d })),
  };
}

export function buildATRSeries(klines: Kline[], period: number) {
  const values = calculateATR(klines, period);
  const offset = klines.length - values.length;
  return values.map((value, i) => ({
    time: toChartTime(klines[offset + i].openTime),
    value,
  }));
}

export function computeAllChartSeries(klines: Kline[], settings: IndicatorSettings) {
  return {
    candles: klinesToCandles(klines),
    volume: settings.volume.enabled ? klinesToVolume(klines) : [],
    rsi: settings.rsi.enabled ? buildRSISeries(klines, settings.rsi.period) : [],
    macd: settings.macd.enabled
      ? buildMACDSeries(klines, settings.macd.fast, settings.macd.slow, settings.macd.signal)
      : { macd: [], signal: [], histogram: [] },
    bb: settings.bollingerBands.enabled
      ? buildBBSeries(klines, settings.bollingerBands.period, settings.bollingerBands.stdDev)
      : { upper: [], middle: [], lower: [] },
    superTrend: settings.superTrend.enabled
      ? buildSuperTrendSeries(klines, settings.superTrend.period, settings.superTrend.multiplier)
      : [],
    stochRsi: settings.stochRsi.enabled ? buildStochRSISeries(klines, settings.stochRsi) : { k: [], d: [] },
    atr: settings.atr.enabled ? buildATRSeries(klines, settings.atr.period) : [],
  };
}
