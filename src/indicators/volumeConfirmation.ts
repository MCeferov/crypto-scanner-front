import type { Kline } from '../services/binanceApi';

export type VolumeConfirmStatus = 'real' | 'fake' | 'neutral' | 'nodata';
export type VolumeRsiTf = '15m' | '1h' | '4h' | '1d';

export interface VolumeConfirmResult {
  status: VolumeConfirmStatus;
  buyRatio: number | null;
  reason: string;
}

const BUY_RATIO_CONFIRM = 0.52;
const SELL_RATIO_CONFIRM = 0.48;
const LOOKBACK = 5;

const TF_LABELS: Record<VolumeRsiTf, string> = { '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' };

/**
 * Son LOOKBACK şamda alıcı həcmi nisbəti.
 * Kripto → Binance taker buy volume (real market order axını).
 * Digər varlıqlar (Yahoo) → taker yoxdursa, qalxan/düşən şam həcmi proksisi.
 */
function buyRatioForKlines(klines: Kline[]): number | null {
  const recent = klines.slice(-LOOKBACK);
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

/** Bütün RSI timeframe-ləri üçün alıcı nisbətini öncədən hesabla. */
export function computeBuyRatios(klineMap: Record<string, Kline[]>): Record<VolumeRsiTf, number | null> {
  return {
    '15m': buyRatioForKlines(klineMap['15m'] ?? []),
    '1h': buyRatioForKlines(klineMap['1h'] ?? []),
    '4h': buyRatioForKlines(klineMap['4h'] ?? []),
    '1d': buyRatioForKlines(klineMap['1d'] ?? []),
  };
}

/**
 * Seçilmiş timeframe-in RSI dəyərini həmin TF-in alıcı/satıcı həcmi ilə təsdiqləyir.
 * Status:
 *  - real    → RSI siqnalı + həcm təsdiqi (yaşıl)
 *  - fake    → RSI siqnalı, amma həcm ziddiyyətli (qırmızı)
 *  - neutral → RSI 30–70 (boz)
 *  - nodata  → RSI və ya həcm məlumatı yoxdur (sarı/N/A)
 */
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
  const isBuy = rsiValue < 30;
  const isSell = rsiValue > 70;

  if (!isBuy && !isSell) {
    return { status: 'neutral', buyRatio, reason: `${rsiLabel} — neytral zona (30–70)` };
  }

  if (buyRatio === null) {
    return { status: 'nodata', buyRatio: null, reason: `${rsiLabel} — həcm məlumatı yoxdur` };
  }

  const pct = Math.round(buyRatio * 100);
  if (isBuy) {
    const real = buyRatio >= BUY_RATIO_CONFIRM;
    return {
      status: real ? 'real' : 'fake',
      buyRatio,
      reason: real
        ? `${rsiLabel} alış + alıcı həcmi ${pct}% (real)`
        : `${rsiLabel} alış, amma alıcı həcmi yalnız ${pct}% (zəif/saxta)`,
    };
  }

  const real = buyRatio <= SELL_RATIO_CONFIRM;
  return {
    status: real ? 'real' : 'fake',
    buyRatio,
    reason: real
      ? `${rsiLabel} satış + satıcı həcmi ${100 - pct}% (real)`
      : `${rsiLabel} satış, amma alıcı həcmi ${pct}% (zəif/saxta)`,
  };
}
