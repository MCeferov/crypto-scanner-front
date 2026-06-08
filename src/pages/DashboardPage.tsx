import React from 'react';
import { Link } from 'wouter';
import { Header } from '../components/Layout/Header';
import { MarketSummary } from '../components/Dashboard/MarketSummary';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Header />
      <div className="px-4 py-6 max-w-[1920px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Welcome back, <span className="font-semibold" style={{ color: '#f0b90b' }}>{user?.username}</span>
          </p>
        </div>

        <MarketSummary />

        <div
          className="mt-6 rounded-xl border p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div>
            <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>Crypto Heatmap</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Real-time RSI, MACD, SuperTrend and AI signals for top pairs
            </p>
          </div>
          <Link href="/">
            <Button>Open Heatmap →</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
