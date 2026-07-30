import type { Kline } from '../services/binanceApi';
import {
  VOL_BUY_RATIO_CONFIRM,
  VOL_SELL_RATIO_CONFIRM,
  VOL_LOOKBACK,
  VOL_SMA_PERIOD,
  VOL_EXPANSION_MULT,
  VOL_DRY_MULT,
} from './signalConfig';

export type VolumeConfirmStatus = 'real' | 'fake' | 'neutral' | 'nodata';
export type VolumeRsiTf = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type VolumeGate = 'confirm' | 'weak' | 'diverge' | 'neutral' | 'nodata';

export interface VolumeConfirmResult {
  status: VolumeConfirmStatus;
  buyRatio: number | null;
  /** Alıcı gücü % (0–100), Binance taker buy əsasında */
  buyPct: number | null;
  reason: string;
}

export interface VolumeAnalysis {
  buyRatio: number | null;
  volVsSma: number | null;
  gate: VolumeGate;
  volumeScore: number;
  reason: string;
}

const TF_LABELS: Record<VolumeRsiTf, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D',
};

/**
 * Binance-style buy power: takerBuyVolume / total volume.
 * Only candles with real takerBuyVolume count — no RSI, no green-candle guess.
 */
function buyRatioForKlines(klines: Kline[], lookback = VOL_LOOKBACK): number | null {
  const recent = klines.slice(-lookback);
  let buy = 0;
  let total = 0;
  let takerBars = 0;

  for (const k of recent) {
    if (k.volume <= 0 || k.takerBuyVolume == null) continue;
    buy += k.takerBuyVolume;
    total += k.volume;
    takerBars++;
  }

  // Need at least one real taker-buy bar (Binance kline field [9])
  if (takerBars === 0 || total <= 0) return null;
  return buy / total;
}

function volumeVsSma(klines: Kline[]): number | null {
  // The final kline is the in-progress candle: its volume is partial for most
  // of the candle's lifetime, so comparing it to a closed-bar SMA reads as
  // "dry" almost always. Compare the last CLOSED candle instead.
  if (klines.length < VOL_SMA_PERIOD + 2) return null;
  const vols = klines.map(k => k.volume);
  const lastClosed = vols[vols.length - 2];
  const sma = vols.slice(-VOL_SMA_PERIOD - 2, -2).reduce((a, b) => a + b, 0) / VOL_SMA_PERIOD;
  if (sma <= 0) return null;
  return lastClosed / sma;
}

export function computeBuyRatios(klineMap: Record<string, Kline[]>): Record<VolumeRsiTf, number | null> {
  return {
    '1m': buyRatioForKlines(klineMap['1m'] ?? []),
    '5m': buyRatioForKlines(klineMap['5m'] ?? []),
    '15m': buyRatioForKlines(klineMap['15m'] ?? []),
    '1h': buyRatioForKlines(klineMap['1h'] ?? []),
    '4h': buyRatioForKlines(klineMap['4h'] ?? []),
    '1d': buyRatioForKlines(klineMap['1d'] ?? []),
  };
}

/**
 * Setup/confidence gate — alıcı gücü + volume expansion.
 * side: gözlənilən istiqamət (siqnal); volume özü RSI-dən asılı deyil.
 */
export function analyzeVolumeForSignal(
  klines: Kline[],
  side: 'buy' | 'sell' | null,
): VolumeAnalysis {
  const buyRatio = buyRatioForKlines(klines);
  const volVsSma = volumeVsSma(klines);

  if (buyRatio === null) {
    return {
      buyRatio: null,
      volVsSma,
      gate: 'nodata',
      volumeScore: 0,
      reason: 'Taker buy həcmi yoxdur (Binance alıcı gücü)',
    };
  }

  const pct = Math.round(buyRatio * 100);
  const expansion = volVsSma !== null && volVsSma >= VOL_EXPANSION_MULT;
  const dry = volVsSma !== null && volVsSma <= VOL_DRY_MULT;

  if (side === null) {
    // Neytral siqnal — yalnız alıcı gücünü skorla
    if (buyRatio >= VOL_BUY_RATIO_CONFIRM) {
      return {
        buyRatio, volVsSma, gate: 'confirm', volumeScore: expansion ? 80 : 65,
        reason: `Alıcı gücü ${pct}%`,
      };
    }
    if (buyRatio <= VOL_SELL_RATIO_CONFIRM) {
      return {
        buyRatio, volVsSma, gate: 'confirm', volumeScore: expansion ? 80 : 65,
        reason: `Satıcı gücü ${100 - pct}%`,
      };
    }
    return {
      buyRatio, volVsSma, gate: 'neutral', volumeScore: 50,
      reason: `Balanslı axın ${pct}% alıcı`,
    };
  }

  if (side === 'buy') {
    const flowOk = buyRatio >= VOL_BUY_RATIO_CONFIRM;
    if (flowOk && expansion) {
      return {
        buyRatio, volVsSma, gate: 'confirm', volumeScore: 90,
        reason: `Alıcı gücü ${pct}% + volume expansion (${volVsSma!.toFixed(2)}× SMA)`,
      };
    }
    if (flowOk && !dry) {
      return {
        buyRatio, volVsSma, gate: 'confirm', volumeScore: 72,
        reason: `Alıcı gücü ${pct}% təsdiqləyir`,
      };
    }
    if (!flowOk && expansion) {
      return {
        buyRatio, volVsSma, gate: 'diverge', volumeScore: 25,
        reason: `Volume yüksək amma alıcı yalnız ${pct}% — divergence`,
      };
    }
    if (dry) {
      return {
        buyRatio, volVsSma, gate: 'weak', volumeScore: 30,
        reason: `Zəif həcm (${volVsSma?.toFixed(2) ?? '?'}× SMA)`,
      };
    }
    return {
      buyRatio, volVsSma, gate: 'weak', volumeScore: 40,
      reason: `Alıcı gücü ${pct}% — zəif`,
    };
  }

  // sell
  const flowOk = buyRatio <= VOL_SELL_RATIO_CONFIRM;
  if (flowOk && expansion) {
    return {
      buyRatio, volVsSma, gate: 'confirm', volumeScore: 90,
      reason: `Satıcı gücü ${100 - pct}% + volume expansion`,
    };
  }
  if (flowOk && !dry) {
    return {
      buyRatio, volVsSma, gate: 'confirm', volumeScore: 72,
      reason: `Satıcı gücü ${100 - pct}% təsdiqləyir`,
    };
  }
  if (!flowOk && expansion) {
    return {
      buyRatio, volVsSma, gate: 'diverge', volumeScore: 25,
      reason: `Volume yüksək amma alıcı ${pct}% — satış divergence`,
    };
  }
  if (dry) {
    return {
      buyRatio, volVsSma, gate: 'weak', volumeScore: 30,
      reason: `Zəif həcm — satış siqnalı zəif`,
    };
  }
  return {
    buyRatio, volVsSma, gate: 'weak', volumeScore: 40,
    reason: `Alıcı ${pct}% — satış təsdiqi zəif`,
  };
}

/**
 * UI badge — yalnız Binance taker buy (alıcı gücü), RSI iştirak etmir.
 * Real  = alıcı gücü ≥ 55%
 * Fake  = alıcı gücü ≤ 45% (satıcı üstünlüyü)
 * Neutral = 45–55% balans
 */
export function classifyVolume(
  tf: VolumeRsiTf,
  buyRatio: number | null,
): VolumeConfirmResult {
  const label = TF_LABELS[tf];

  if (buyRatio === null) {
    return {
      status: 'nodata',
      buyRatio: null,
      buyPct: null,
      reason: `${label}: taker buy yoxdur — Binance alıcı gücü hesablana bilmədi`,
    };
  }

  const buyPct = Math.round(buyRatio * 100);
  const sellPct = 100 - buyPct;

  if (buyRatio >= VOL_BUY_RATIO_CONFIRM) {
    return {
      status: 'real',
      buyRatio,
      buyPct,
      reason: `${label}: alıcı gücü ${buyPct}% (taker buy) — Real`,
    };
  }

  if (buyRatio <= VOL_SELL_RATIO_CONFIRM) {
    return {
      status: 'fake',
      buyRatio,
      buyPct,
      reason: `${label}: alıcı gücü ${buyPct}% / satıcı ${sellPct}% — Saxta (zəif alış)`,
    };
  }

  return {
    status: 'neutral',
    buyRatio,
    buyPct,
    reason: `${label}: balanslı axın — alıcı ${buyPct}% / satıcı ${sellPct}%`,
  };
}
