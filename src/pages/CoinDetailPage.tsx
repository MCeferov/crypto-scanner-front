import React, { useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { TradingChart } from '../components/Chart/TradingChart';
import { CoinHeader } from '../components/CoinDetail/CoinHeader';
import { AIAnalysisPanel } from '../components/CoinDetail/AIAnalysisPanel';
import { ThemeToggle } from '../components/ThemeToggle';
import { analyzeFromCoin } from '../services/aiAnalysis';

export function CoinDetailPage() {
  const [, params] = useRoute('/coin/:symbol');
  const [, setLocation] = useLocation();
  const { coins } = useMarket();

  const symbol = params?.symbol?.toUpperCase() ?? '';
  const coin = useMemo(() => coins.find(c => c.symbol === symbol) ?? null, [coins, symbol]);

  const analysis = useMemo(() => {
    if (!coin || !coin.indicatorsLoaded) return null;
    return analyzeFromCoin(coin);
  }, [coin]);

  if (!symbol) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: 'var(--chart-text)' }}>
        Invalid symbol
      </div>
    );
  }

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
          Back to Scanner
        </button>
        <ThemeToggle />
      </div>

      <CoinHeader coin={coin} symbol={symbol} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col p-3">
          <TradingChart symbol={symbol} />
        </div>

        <div
          className="w-[300px] shrink-0 border-l overflow-hidden hidden lg:block"
          style={{ borderColor: 'var(--chart-border)', background: 'var(--chart-bg)' }}
        >
          <AIAnalysisPanel analysis={analysis} coin={coin} loading={!coin?.indicatorsLoaded} />
        </div>
      </div>

      <div className="lg:hidden border-t max-h-[240px] overflow-y-auto" style={{ borderColor: 'var(--chart-border)' }}>
        <AIAnalysisPanel analysis={analysis} coin={coin} loading={!coin?.indicatorsLoaded} />
      </div>
    </div>
  );
}
