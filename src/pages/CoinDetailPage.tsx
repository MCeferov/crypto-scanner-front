import React, { useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { TradingChart } from '../components/Chart/TradingChart';
import { CoinHeader } from '../components/CoinDetail/CoinHeader';
import { AIAnalysisPanel } from '../components/CoinDetail/AIAnalysisPanel';
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
      <div className="flex items-center justify-center h-screen text-[#8b949e]">
        Invalid symbol
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#21262d] bg-[#0d1117]">
        <button
          onClick={() => setLocation('/')}
          className="flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Scanner
        </button>
      </div>

      <CoinHeader coin={coin} symbol={symbol} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col p-3">
          <TradingChart symbol={symbol} />
        </div>

        <div className="w-[300px] shrink-0 border-l border-[#21262d] bg-[#0d1117] overflow-hidden hidden lg:block">
          <AIAnalysisPanel analysis={analysis} loading={!coin?.indicatorsLoaded} />
        </div>
      </div>

      {/* Mobile AI panel */}
      <div className="lg:hidden border-t border-[#21262d] max-h-[240px] overflow-y-auto">
        <AIAnalysisPanel analysis={analysis} loading={!coin?.indicatorsLoaded} />
      </div>
    </div>
  );
}
