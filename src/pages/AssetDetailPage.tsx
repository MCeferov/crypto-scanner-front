import React, { useMemo, useEffect, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { useT } from '../context/LocaleContext';
import { TradingChart } from '../components/Chart/TradingChart';
import { CoinHeader } from '../components/CoinDetail/CoinHeader';
import { AIAnalysisPanel } from '../components/CoinDetail/AIAnalysisPanel';
import { ThemeToggle } from '../components/ThemeToggle';
import { analyzeFromCoin } from '../services/aiAnalysis';
import { batchKlinesFromServer, toKlineAssetRef } from '../services/klineBatchApi';
import type { Kline } from '../services/binanceApi';
import type { AssetType } from '../types/asset';

export function AssetDetailPage() {
  const [, params] = useRoute('/asset/:type/:symbol');
  const [, setLocation] = useLocation();
  const { coins, visibleRsiCols, syncAssetKlines } = useMarket();
  const t = useT();

  const type = (params?.type ?? '') as AssetType;
  const symbol = params?.symbol?.toUpperCase() ?? '';
  const initialTimeframe = visibleRsiCols[0] ?? '1h';

  const asset = useMemo(
    () => coins.find(c => c.type === type && c.baseAsset.toUpperCase() === symbol) ?? null,
    [coins, type, symbol],
  );

  const handleKlinesLoaded = useCallback((interval: string, klines: Kline[]) => {
    if (!asset) return;
    syncAssetKlines(asset.id, { [interval]: klines });
  }, [asset, syncAssetKlines]);

  useEffect(() => {
    if (!asset || asset.type === 'crypto') return;
    const ref = toKlineAssetRef(asset);
    void batchKlinesFromServer([ref], ['15m', '1h', '4h'], true).then(map => {
      const klines = map.get(asset.id);
      if (klines) syncAssetKlines(asset.id, klines);
    }).catch(() => {});
  }, [asset, syncAssetKlines]);

  const analysis = useMemo(() => {
    if (!asset || !asset.indicatorsLoaded) return null;
    return analyzeFromCoin(asset);
  }, [asset]);

  useEffect(() => {
    if (type === 'crypto' && symbol) {
      const sym = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
      setLocation(`/coin/${sym}`);
    }
  }, [type, symbol, setLocation]);

  if (!type || !symbol) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: 'var(--chart-text)' }}>
        {t('detail.notFound')}
      </div>
    );
  }

  if (type === 'crypto') return null;

  const chartSymbol = asset?.symbol ?? symbol;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--chart-bg)' }}>
      <div
        className="flex items-center justify-between gap-3 px-4 py-2 border-b"
        style={{ borderColor: 'var(--chart-border)', background: 'var(--chart-bg)' }}
      >
        <button
          onClick={() => setLocation('/')}
          className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color: 'var(--chart-text)' }}
        >
          <ArrowLeft size={14} />
          {t('detail.back')}
        </button>
        <ThemeToggle />
      </div>

      <CoinHeader coin={asset} symbol={chartSymbol} />

      {!asset ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--chart-text-dim)' }}>
          {t('detail.notFound')}
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col p-3">
            <TradingChart
              symbol={chartSymbol}
              type={type}
              initialTimeframe={initialTimeframe}
              onKlinesLoaded={handleKlinesLoaded}
            />
          </div>

          <div
            className="w-[300px] shrink-0 border-l overflow-hidden hidden lg:block"
            style={{ borderColor: 'var(--chart-border)', background: 'var(--chart-bg)' }}
          >
            <AIAnalysisPanel analysis={analysis} coin={asset} loading={!asset.indicatorsLoaded} />
          </div>
        </div>
      )}

      {asset && (
        <div className="lg:hidden border-t max-h-[240px] overflow-y-auto" style={{ borderColor: 'var(--chart-border)' }}>
          <AIAnalysisPanel analysis={analysis} coin={asset} loading={!asset.indicatorsLoaded} />
        </div>
      )}
    </div>
  );
}
