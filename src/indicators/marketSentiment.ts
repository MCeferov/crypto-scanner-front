/**
 * Market sentiment — Fear & Greed + BTC bias.
 * Birbaşa AL/SAT vermir; yalnız confidence tənzimləyir.
 * Gələcək: CryptoPanic / news adapter eyni `NewsSentiment` interfeysinə bağlana bilər.
 */

import type { FearGreedData } from '../services/fearGreedApi';
import type { ChartSignal } from './chartAnalysis';

export interface NewsSentiment {
  score: number; // -100..+100
  headlineCount: number;
  summary: string;
}

export interface SentimentInput {
  fearGreed: FearGreedData | null;
  btcChange24h: number;
  btcTrendScore: number;
  btcChartSignal: ChartSignal;
  /** Optional news layer (stub = 0) */
  news?: NewsSentiment | null;
}

export interface SentimentResult {
  score: number; // -100..+100
  confidenceAdjust: number; // -15..+15 for confidence %
  label: string;
  reasons: string[];
}

/** Stub — real news API bağlananda doldurulacaq */
export function fetchNewsSentimentStub(): NewsSentiment {
  return { score: 0, headlineCount: 0, summary: 'News feed bağlı deyil' };
}

export function computeMarketSentiment(input: SentimentInput): SentimentResult {
  let score = 0;
  const reasons: string[] = [];

  if (input.fearGreed) {
    const v = input.fearGreed.value;
    if (v <= 20) {
      score += 25;
      reasons.push(`F&G ${v} (Extreme Fear) — contrarian AL dəstəyi`);
    } else if (v <= 40) {
      score += 8;
      reasons.push(`F&G ${v} — ehtiyatlı bazar`);
    } else if (v >= 80) {
      score -= 25;
      reasons.push(`F&G ${v} (Extreme Greed) — SAT riski`);
    } else if (v >= 60) {
      score -= 8;
      reasons.push(`F&G ${v} — optimist bazar`);
    } else {
      reasons.push(`F&G ${v} — neytral`);
    }
  }

  if (input.btcChange24h > 2) {
    score += 18;
    reasons.push(`BTC +${input.btcChange24h.toFixed(1)}% 24s — bullish sentiment`);
  } else if (input.btcChange24h > 0.5) {
    score += 8;
  } else if (input.btcChange24h < -2) {
    score -= 18;
    reasons.push(`BTC ${input.btcChange24h.toFixed(1)}% 24s — bearish sentiment`);
  } else if (input.btcChange24h < -0.5) {
    score -= 8;
  }

  if (input.btcTrendScore >= 65) {
    score += 12;
    reasons.push(`BTC trend ${input.btcTrendScore} — güclü`);
  } else if (input.btcTrendScore <= 35) {
    score -= 12;
    reasons.push(`BTC trend ${input.btcTrendScore} — zəif`);
  }

  if (input.btcChartSignal === 'BUY') {
    score += 10;
    reasons.push('BTC chart BUY');
  } else if (input.btcChartSignal === 'SELL') {
    score -= 10;
    reasons.push('BTC chart SELL');
  }

  const news = input.news ?? fetchNewsSentimentStub();
  if (news.headlineCount > 0) {
    score += Math.max(-20, Math.min(20, news.score * 0.2));
    reasons.push(`News: ${news.summary}`);
  }

  score = Math.max(-100, Math.min(100, Math.round(score)));
  const confidenceAdjust = Math.max(-15, Math.min(15, Math.round(score * 0.15)));

  let label = 'Neytral';
  if (score >= 30) label = 'Bullish';
  else if (score <= -30) label = 'Bearish';

  return { score, confidenceAdjust, label, reasons };
}

/**
 * AL/SAT ilə sentiment ziddiyyəti — hard block üçün.
 * Extreme opposite sentiment → true (siqnal bloklanmalı).
 */
export function sentimentBlocksSide(
  side: 'buy' | 'sell',
  sentimentScore: number,
): boolean {
  if (side === 'buy' && sentimentScore <= -45) return true;
  if (side === 'sell' && sentimentScore >= 45) return true;
  return false;
}
