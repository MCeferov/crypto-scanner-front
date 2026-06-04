import React from 'react';
import { useMarket } from '../../context/MarketContext';

export function Header() {
  const { wsConnected, wsReconnecting, loadingProgress, coins, refresh } = useMarket();
  const indicatorsLoaded = coins.filter(c => c.indicatorsLoaded).length;
  const total = coins.length;
  const allLoaded = indicatorsLoaded === total && total > 0;

  return (
    <header style={{ background: 'hsl(222,20%,8%)', borderBottom: '1px solid hsl(222,15%,16%)' }}
      className="sticky top-0 z-50 px-4 py-3">
      <div className="flex items-center justify-between max-w-[1920px] mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold"
              style={{ background: 'linear-gradient(135deg, #f0b90b, #f3a52f)', color: '#0b0e11' }}>
              H
            </div>
            <div>
              <div className="font-bold text-sm leading-none" style={{ color: '#e6e8ec' }}>
                Crypto Heatmap
              </div>
              <div className="text-xs leading-none mt-0.5" style={{ color: '#8b949e' }}>
                RSI & Indicators
              </div>
            </div>
          </div>
        </div>

        {/* Center: Loading progress */}
        <div className="flex-1 max-w-xs mx-8">
          {!allLoaded && total > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: '#8b949e' }}>
                <span>Loading indicators...</span>
                <span>{indicatorsLoaded}/{total}</span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: 'hsl(222,15%,17%)' }}>
                <div
                  className="loading-progress"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          )}
          {allLoaded && (
            <div className="text-xs text-center" style={{ color: '#8b949e' }}>
              ✓ All indicators loaded · {total} pairs
            </div>
          )}
        </div>

        {/* Right: Status */}
        <div className="flex items-center gap-3">
          {/* Binance API badge */}
          <div className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(240,185,11,0.1)', color: '#f0b90b', border: '1px solid rgba(240,185,11,0.2)' }}>
            Binance
          </div>

          {/* WS Status */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: wsConnected ? '#0ecb81' : wsReconnecting ? '#f3a52f' : '#f6465d',
                boxShadow: wsConnected ? '0 0 6px rgba(14,203,129,0.6)' : 'none',
                animation: wsConnected ? 'none' : 'pulse 1.5s infinite',
              }}
            />
            <span className="text-xs" style={{ color: '#8b949e' }}>
              {wsConnected ? 'Live' : wsReconnecting ? 'Reconnecting...' : 'Disconnected'}
            </span>
          </div>

          {/* Refresh button */}
          <button
            onClick={refresh}
            className="text-xs px-3 py-1.5 rounded-md transition-all hover:opacity-80 active:opacity-60"
            style={{ background: 'hsl(222,15%,15%)', color: '#e6e8ec', border: '1px solid hsl(222,15%,22%)' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
