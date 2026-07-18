import type { Kline } from '../services/binanceApi';
import {
  VOL_BUY_RATIO_CONFIRM,
  VOL_SELL_RATIO_CONFIRM,
  VOL_LOOKBACK,
  VOL_SMA_PERIOD,
  VOL_EXPANSION_MULT,
  VOL_DRY_MULT,
  RSI_STRONG_OS,
  RSI_STRONG_OB,
} from './signalConfig';

export type VolumeConfirmStatus = 'real' | 'fake' | 'neutral' | 'nodata';
export type VolumeRsiTf = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type VolumeGate = 'confirm' | 'weak' | 'diverge' | 'neutral' | 'nodata';

export interface VolumeConfirmResult {
  status: VolumeConfirmStatus;
  buyRatio: number | null;
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

function buyRatioForKlines(klines: Kline[], lookback = VOL_LOOKBACK): number | null {
  const recent = klines.slice(-lookback);
  let buy = 0;
  let total = 0;
  for (const k of recent) {
    if (k.volume <= 0) continue;
    const buyVol = k.takerBuyVolume != null
      ? k.takerBuyVolume
      : (k.close >= k.open ? k.volume : 0);
    buy += buyVol;
    total += k.volume;
  }
  if (total <= 0) return null;
  return buy / total;
}

function volumeVsSma(klines: Kline[]): number | null {
  if (klines.length < VOL_SMA_PERIOD + 1) return null;
  const vols = klines.map(k => k.volume);
  const sma = vols.slice(-VOL_SMA_PERIOD - 1, -1).reduce((a, b) => a + b, 0) / VOL_SMA_PERIOD;
  const last = vols[vols.length - 1];
  if (sma <= 0) return null;
  return last / sma;
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
 * RSI siqnalı üçün volume təsdiqi — setup/confidence gate.
 * side: 'buy' | 'sell' | null (neytral RSI)
 */
export function analyzeVolumeForSignal(
  klines: Kline[],
  side: 'buy' | 'sell' | null,
): VolumeAnalysis {
  const buyRatio = buyRatioForKlines(klines);
  const volVsSma = volumeVsSma(klines);

  if (side === null) {
    return {
      buyRatio,
      volVsSma,
      gate: 'neutral',
      volumeScore: 50,
      reason: 'RSI neytral — volume gate gözləyir',
    };
  }

  if (buyRatio === null) {
    return {
      buyRatio: null,
      volVsSma,
      gate: 'nodata',
      volumeScore: 0,
      reason: 'Həcm məlumatı yoxdur',
    };
  }

  const pct = Math.round(buyRatio * 100);
  const expansion = volVsSma !== null && volVsSma >= VOL_EXPANSION_MULT;
  const dry = volVsSma !== null && volVsSma <= VOL_DRY_MULT;

  if (side === 'buy') {
    const flowOk = buyRatio >= VOL_BUY_RATIO_CONFIRM;
    if (flowOk && expansion) {
      return {
        buyRatio, volVsSma, gate: 'confirm', volumeScore: 90,
        reason: `Alıcı həcmi ${pct}% + volume expansion (${volVsSma!.toFixed(2)}× SMA)`,
      };
    }
    if (flowOk && !dry) {
      return {
        buyRatio, volVsSma, gate: 'confirm', volumeScore: 72,
        reason: `Alıcı həcmi ${pct}% təsdiqləyir`,
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
        reason: `Zəif həcm (${volVsSma?.toFixed(2) ?? '?'}× SMA) — siqnal zəif`,
      };
    }
    return {
      buyRatio, volVsSma, gate: 'weak', volumeScore: 40,
      reason: `Alıcı həcmi ${pct}% — zəif təsdiq`,
    };
  }

  // sell
  const flowOk = buyRatio <= VOL_SELL_RATIO_CONFIRM;
  if (flowOk && expansion) {
    return {
      buyRatio, volVsSma, gate: 'confirm', volumeScore: 90,
      reason: `Satıcı həcmi ${100 - pct}% + volume expansion`,
    };
  }
  if (flowOk && !dry) {
    return {
      buyRatio, volVsSma, gate: 'confirm', volumeScore: 72,
      reason: `Satıcı həcmi ${100 - pct}% təsdiqləyir`,
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

/** UI badge — vahid RSI_STRONG hədləri ilə */
export function classifyVolume(
  tf: VolumeRsiTf,
  rsiValue: number | null,
  buyRatio: number | null,
): VolumeConfirmResult {
  const label = TF_LABELS[tf];

  if (rsiValue === null) {
    return { status: 'nodata', buyRatio, reason: `RSI ${label} məlumatı yoxdur` };
  }

  const rsiLabel = `RSI ${label}: ${rsiValue.toFixed(1)}`;
  const isBuy = rsiValue < RSI_STRONG_OS;
  const isSell = rsiValue > RSI_STRONG_OB;

  if (!isBuy && !isSell) {
    return { status: 'neutral', buyRatio, reason: `${rsiLabel} — neytral zona` };
  }

  if (buyRatio === null) {
    return { status: 'nodata', buyRatio: null, reason: `${rsiLabel} — həcm məlumatı yoxdur` };
  }

  const pct = Math.round(buyRatio * 100);
  if (isBuy) {
    const real = buyRatio >= VOL_BUY_RATIO_CONFIRM;
    return {
      status: real ? 'real' : 'fake',
      buyRatio,
      reason: real
        ? `${rsiLabel} alış + alıcı həcmi ${pct}% (real)`
        : `${rsiLabel} alış, amma alıcı həcmi yalnız ${pct}% (zəif/saxta)`,
    };
  }

  const real = buyRatio <= VOL_SELL_RATIO_CONFIRM;
  return {
    status: real ? 'real' : 'fake',
    buyRatio,
    reason: real
      ? `${rsiLabel} satış + satıcı həcmi ${100 - pct}% (real)`
      : `${rsiLabel} satış, amma alıcı həcmi ${pct}% (zəif/saxta)`,
  };
}
