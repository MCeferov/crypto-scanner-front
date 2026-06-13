import type { CoinData } from '../context/MarketContext';
import type { SetupSignal } from './setupSignal';

export type ReversalRisk = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type MtfAlignment = 'ALIGNED' | 'MIXED' | 'CONFLICT';

export interface ReversalAnalysis {
  reversalRisk: ReversalRisk;
  reversalReasons: string[];
  mtfAlignment: MtfAlignment;
  riskRewardNote: string;
}

export function riskRewardExplanation(
  rr: number | null,
  stopLoss: number | null,
  takeProfit: number | null,
  direction: 'buy' | 'sell' | 'neutral',
): string {
  if (rr === null || stopLoss === null || takeProfit === null) {
    return 'R:R hesablanmayıb — zone (S/D) tapılmayıb.';
  }
  const dir = direction === 'buy' ? 'Alış' : direction === 'sell' ? 'Satış' : 'Neytral';
  return [
    `R:R = ${rr.toFixed(1)} (mükafat ÷ risk)`,
    `${dir}: SL $${stopLoss.toFixed(4)} → TP $${takeProfit.toFixed(4)}`,
    'SL: demand zone altı + ATR buffer (alışda)',
    'TP: supply zone və ya 2× risk məsafəsi',
    'Yüksək R:R = potensial gəlir riskdən böyük, amma flip riski ayrıca yoxlanmalıdır',
  ].join('\n');
}

function inferTradeDirection(coin: CoinData): 'buy' | 'sell' | 'neutral' {
  if (coin.setupSignal === 'STRONG_BUY' || coin.setupSignal === 'BUY') return 'buy';
  if (coin.setupSignal === 'STRONG_SELL' || coin.setupSignal === 'SELL') return 'sell';
  if (coin.chartSignal === 'BUY') return 'buy';
  if (coin.chartSignal === 'SELL') return 'sell';
  return 'neutral';
}

export function computeReversalRisk(coin: CoinData): ReversalAnalysis {
  const reasons: string[] = [];
  let riskPoints = 0;

  const tfs = [
    { label: '15m', sig: coin.mtf15m },
    { label: '30m', sig: coin.mtf30m },
    { label: '1H', sig: coin.mtf1h },
    { label: '4H', sig: coin.mtf4h },
  ];
  const buyTfs = tfs.filter(t => t.sig === 'BUY').map(t => t.label);
  const sellTfs = tfs.filter(t => t.sig === 'SELL').map(t => t.label);

  let mtfAlignment: MtfAlignment = 'ALIGNED';
  if (buyTfs.length > 0 && sellTfs.length > 0) {
    mtfAlignment = 'CONFLICT';
    riskPoints += 2;
    reasons.push(`TF ziddiyyəti: ${buyTfs.join(', ')} BUY vs ${sellTfs.join(', ')} SELL`);
  } else if (buyTfs.length > 0 && buyTfs.length < 4 && sellTfs.length === 0) {
    mtfAlignment = 'MIXED';
  } else if (sellTfs.length > 0 && sellTfs.length < 4 && buyTfs.length === 0) {
    mtfAlignment = 'MIXED';
  }

  // Qısa TF satış, uzun TF alış — klassik "tez flip" ssenarisi
  const shortBear = coin.mtf15m === 'SELL' || coin.mtf30m === 'SELL';
  const longBull = coin.mtf1h === 'BUY' || coin.mtf4h === 'BUY';
  const shortBull = coin.mtf15m === 'BUY' || coin.mtf30m === 'BUY';
  const longBear = coin.mtf1h === 'SELL' || coin.mtf4h === 'SELL';
  const setupBull = coin.setupSignal === 'BUY' || coin.setupSignal === 'STRONG_BUY';
  const setupBear = coin.setupSignal === 'SELL' || coin.setupSignal === 'STRONG_SELL';

  if (shortBear && longBull && setupBull) {
    riskPoints += 3;
    reasons.push('⚠ 15m/30m artıq SATışa keçir, 1H/4H hələ ALış — qısa müddətdə flip riski yüksək');
  }
  if (shortBull && longBear && setupBear) {
    riskPoints += 3;
    reasons.push('⚠ 15m/30m ALış, 1H/4H SATış — qısa covering bounce ola bilər');
  }

  // HA reversal siqnalları
  const haReversalDown = coin.haReasons.some(r =>
    r.includes('bearish reversal') || r.includes('HA bearish'),
  );
  const haReversalUp = coin.haReasons.some(r =>
    r.includes('bullish reversal') || r.includes('HA bullish'),
  );
  if (haReversalDown && setupBull) {
    riskPoints += 2;
    reasons.push('HA 15m bearish reversal — qiymət qalxsa da momentum dönür');
  }
  if (haReversalUp && setupBear) {
    riskPoints += 2;
    reasons.push('HA bullish reversal — düşüş dayanır ola bilər');
  }

  // Supply zonasında alış — tez satışa keçmə riski
  if ((coin.zonePosition === 'at_supply' || coin.zonePosition === 'near_supply') && setupBull) {
    riskPoints += 2;
    reasons.push('Supply (müqavimət) zonasında alış — qrafikdə satışa keçid normaldır');
  }
  if ((coin.zonePosition === 'at_demand' || coin.zonePosition === 'near_demand') && setupBear) {
    riskPoints += 2;
    reasons.push('Demand (dəstək) zonasında satış — bounce riski');
  }

  // RSI overbought + alış
  if (coin.rsi15m !== null && coin.rsi15m > 68 && (coin.mtf15m === 'BUY' || setupBull)) {
    riskPoints += 1.5;
    reasons.push(`RSI 15m ${coin.rsi15m.toFixed(0)} overbought — düzəliş/satışa keçid ehtimalı`);
  }
  if (coin.rsi1h !== null && coin.rsi1h > 72 && setupBull) {
    riskPoints += 1;
    reasons.push(`RSI 1H ${coin.rsi1h.toFixed(0)} yüksək — qalxış davam etsə də risk artır`);
  }

  // MACD divergence hint: histogram negative but buy
  if (coin.macdHistogram !== null && coin.macdHistogram < 0 && setupBull && coin.mtf15m === 'BUY') {
    riskPoints += 1;
    reasons.push('MACD histogram mənfi — qiymət qalxır amma momentum zəifləyir');
  }

  let reversalRisk: ReversalRisk = 'NONE';
  if (riskPoints >= 4) reversalRisk = 'HIGH';
  else if (riskPoints >= 2) reversalRisk = 'MEDIUM';
  else if (riskPoints >= 1) reversalRisk = 'LOW';

  if (reversalRisk === 'NONE' && mtfAlignment === 'ALIGNED' && setupBull && buyTfs.length >= 3) {
    reasons.push('TF uyğunluğu yaxşı — 15m/1H/4H eyni istiqamət');
  }

  const direction = inferTradeDirection(coin);
  const riskRewardNote = riskRewardExplanation(
    coin.riskReward, coin.stopLoss, coin.takeProfit, direction,
  );

  return {
    reversalRisk,
    reversalReasons: reasons.slice(0, 5),
    mtfAlignment,
    riskRewardNote,
  };
}

/** Flip riski yüksəkdirsə setup conviction azaldılır */
export function applyReversalPenalty(
  setupSignal: SetupSignal,
  setupConviction: number,
  reversalRisk: ReversalRisk,
): { setupSignal: SetupSignal; setupConviction: number } {
  if (reversalRisk === 'NONE') return { setupSignal, setupConviction };

  const penalty = reversalRisk === 'HIGH' ? 0.6 : reversalRisk === 'MEDIUM' ? 0.35 : 0.15;
  let conviction = setupConviction - penalty;

  let signal = setupSignal;
  if (reversalRisk === 'HIGH') {
    if (setupSignal === 'STRONG_BUY') signal = 'BUY';
    else if (setupSignal === 'BUY') signal = 'NEUTRAL';
    else if (setupSignal === 'STRONG_SELL') signal = 'SELL';
    else if (setupSignal === 'SELL') signal = 'NEUTRAL';
  } else if (reversalRisk === 'MEDIUM') {
    if (setupSignal === 'STRONG_BUY') signal = 'BUY';
    else if (setupSignal === 'STRONG_SELL') signal = 'SELL';
  }

  return {
    setupSignal: signal,
    setupConviction: Math.round(conviction * 100) / 100,
  };
}
