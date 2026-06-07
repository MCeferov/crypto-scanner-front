import type { CoinData } from '../context/MarketContext';
import type { Kline } from './binanceApi';
import type { Signal } from '../indicators/aiSignal';
import { computeSignal } from '../indicators/aiSignal';
import { getLatestRSI } from '../indicators/rsi';
import { getLatestMACD } from '../indicators/macd';
import { getLatestBB } from '../indicators/bollingerBands';
import { getLatestATR } from '../indicators/atr';
import { getLatestStochRSI } from '../indicators/stochRsi';
import { getLatestSuperTrend } from '../indicators/supertrend';
import { calculateTrendScore } from '../indicators/trendScore';

export interface IndicatorSummaryItem {
  name: string;
  value: string;
  bias: 'bullish' | 'bearish' | 'neutral';
}

export interface AIAnalysisResult {
  signal: Signal;
  bullishScore: number;
  bearishScore: number;
  trendStrength: number;
  summary: string;
  reasons: string[];
  indicatorSummary: IndicatorSummaryItem[];
}

function biasFromRSI(rsi: number | null): 'bullish' | 'bearish' | 'neutral' {
  if (rsi === null) return 'neutral';
  if (rsi < 35) return 'bullish';
  if (rsi > 65) return 'bearish';
  return 'neutral';
}

function buildSummary(signal: Signal, bullish: number, bearish: number, trendStrength: number): string {
  const net = bullish - bearish;
  if (signal === 'STRONG_BUY') {
    return `Strong bullish momentum detected. Multiple indicators align for upside with ${trendStrength}% trend strength.`;
  }
  if (signal === 'BUY') {
    return `Bullish bias with score +${net}. Trend strength at ${trendStrength}% suggests upward pressure.`;
  }
  if (signal === 'STRONG_SELL') {
    return `Strong bearish pressure. Indicators converge on downside risk with ${trendStrength}% trend strength.`;
  }
  if (signal === 'SELL') {
    return `Bearish bias with score ${net}. Trend strength ${trendStrength}% favors sellers.`;
  }
  return `Mixed signals — bullish ${bullish} vs bearish ${bearish}. Market in consolidation, await clearer direction.`;
}

export function analyzeFromCoin(coin: CoinData): AIAnalysisResult {
  const signalResult = computeSignal({
    rsi15m: coin.rsi15m,
    rsi1h: coin.rsi1h,
    rsi4h: coin.rsi4h,
    rsi1d: coin.rsi1d,
    macdHistogram: coin.macdHistogram,
    price: coin.price,
    ema50: coin.ema50,
    ema200: coin.ema200,
    stochRsiK: coin.stochRsiK,
    priceChange24h: coin.priceChange24h,
  });

  const bullishScore = Math.min(100, Math.round((signalResult.bullishCount / 8) * 100));
  const bearishScore = Math.min(100, Math.round((signalResult.bearishCount / 8) * 100));
  const trendStrength = coin.trendScore;

  const indicatorSummary: IndicatorSummaryItem[] = [
    {
      name: 'RSI (1H)',
      value: coin.rsi1h !== null ? coin.rsi1h.toFixed(1) : '—',
      bias: biasFromRSI(coin.rsi1h),
    },
    {
      name: 'MACD',
      value: coin.macdHistogram !== null ? (coin.macdHistogram > 0 ? 'Bullish' : 'Bearish') : '—',
      bias: coin.macdHistogram === null ? 'neutral' : coin.macdHistogram > 0 ? 'bullish' : 'bearish',
    },
    {
      name: 'Volume 24h',
      value: coin.volume24h >= 1e9 ? `$${(coin.volume24h / 1e9).toFixed(2)}B` : `$${(coin.volume24h / 1e6).toFixed(1)}M`,
      bias: 'neutral',
    },
    {
      name: 'ATR %',
      value: coin.atrPercent !== null ? `${coin.atrPercent.toFixed(2)}%` : '—',
      bias: coin.atrPercent !== null && coin.atrPercent > 3 ? 'bearish' : 'neutral',
    },
    {
      name: 'Stoch RSI',
      value: coin.stochRsiK !== null ? `K ${coin.stochRsiK.toFixed(1)}` : '—',
      bias: coin.stochRsiK === null ? 'neutral' : coin.stochRsiK < 20 ? 'bullish' : coin.stochRsiK > 80 ? 'bearish' : 'neutral',
    },
    {
      name: 'SuperTrend',
      value: coin.superTrend === 1 ? 'Bullish' : coin.superTrend === -1 ? 'Bearish' : '—',
      bias: coin.superTrend === 1 ? 'bullish' : coin.superTrend === -1 ? 'bearish' : 'neutral',
    },
    {
      name: 'Bollinger %B',
      value: coin.bbPercent !== null ? `${(coin.bbPercent * 100).toFixed(0)}%` : '—',
      bias: coin.bbPercent === null ? 'neutral' : coin.bbPercent < 0.2 ? 'bullish' : coin.bbPercent > 0.8 ? 'bearish' : 'neutral',
    },
  ];

  return {
    signal: signalResult.signal,
    bullishScore,
    bearishScore,
    trendStrength,
    summary: buildSummary(signalResult.signal, bullishScore, bearishScore, trendStrength),
    reasons: signalResult.reasons,
    indicatorSummary,
  };
}

export function analyzeFromKlines(klines: Kline[], price: number, change24h: number): AIAnalysisResult {
  const closes = klines.map(k => k.close);
  const rsi1h = getLatestRSI(closes, 14);
  const macd = getLatestMACD(closes);
  const bb = getLatestBB(closes);
  const atr = getLatestATR(klines, 14);
  const atrPercent = atr !== null && price > 0 ? (atr / price) * 100 : null;
  const stoch = getLatestStochRSI(closes);
  const st = getLatestSuperTrend(klines);
  const trendScore = calculateTrendScore({
    rsi1h, rsi4h: null, rsi1d: null,
    macdHistogram: macd?.histogram ?? null,
    price, ema20: null, ema50: null, ema200: null,
    priceChange24h: change24h, stochRsiK: stoch?.k ?? null,
  });

  const coin: CoinData = {
    symbol: '', baseAsset: '', price, priceChange1h: 0, priceChange24h: change24h,
    volume24h: 0, rsi15m: null, rsi1h, rsi4h: null, rsi1d: null,
    ema20: null, ema50: null, ema200: null,
    macd: macd?.macd ?? null, macdSignal: macd?.signal ?? null, macdHistogram: macd?.histogram ?? null,
    bbUpper: bb?.upper ?? null, bbMiddle: bb?.middle ?? null, bbLower: bb?.lower ?? null,
    bbPercent: bb?.percentB ?? null, atr, atrPercent,
    stochRsiK: stoch?.k ?? null, stochRsiD: stoch?.d ?? null,
    superTrend: st?.trend ?? null, superTrendValue: st?.value ?? null,
    trendScore, signal: 'NEUTRAL', signalReasons: [], indicatorsLoaded: true,
  };

  return analyzeFromCoin(coin);
}
