import React from 'react';
import { Link, useLocation } from 'wouter';
import { useMarket } from '../../context/MarketContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ThemeToggle';

export function Header() {
  const { wsConnected, wsReconnecting, loadingProgress, coins } = useMarket();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const loaded = coins.filter(c => c.indicatorsLoaded).length;
  const total  = coins.length;
  const allLoaded = loaded === total && total > 0;

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  return (
    <header
      className="sticky top-0 z-50 px-5 py-2.5"
      style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between max-w-[1920px] mx-auto gap-4">

        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 no-underline">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-black text-sm"
            style={{ background: 'linear-gradient(135deg,#f0b90b,#f59e0b)', color: '#0a0e17' }}
          >
            C
          </div>
          <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text)' }}>
            Crypto Scanner
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link href="/dashboard">
            <span className="text-xs px-3 py-1.5 rounded-md cursor-pointer hover:opacity-80"
              style={{ color: 'var(--muted)' }}>Dashboard</span>
          </Link>
          <Link href="/">
            <span className="text-xs px-3 py-1.5 rounded-md cursor-pointer hover:opacity-80"
              style={{ color: 'var(--muted)' }}>Heatmap</span>
          </Link>
        </nav>

        <div className="flex-1 max-w-sm hidden lg:block">
          {!allLoaded && total > 0 ? (
            <div>
              <div className="flex justify-between text-[11px] mb-1" style={{ color: 'var(--muted)' }}>
                <span>Loading indicators…</span>
                <span>{loaded}/{total}</span>
              </div>
              <div className="w-full rounded-full h-1" style={{ background: 'var(--elevated)' }}>
                <div className="loading-progress" style={{ width: `${loadingProgress}%` }} />
              </div>
            </div>
          ) : allLoaded ? (
            <p className="text-center text-[11px]" style={{ color: 'var(--dim)' }}>
              ✓ All indicators loaded · {total} pairs
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: wsConnected ? '#26a69a' : wsReconnecting ? '#f0b90b' : '#ef5350',
                boxShadow: wsConnected ? '0 0 6px rgba(38,166,154,.7)' : 'none',
              }}
            />
            <span className="text-xs hidden sm:inline" style={{ color: 'var(--muted)' }}>
              {wsConnected ? 'Live' : wsReconnecting ? 'Reconnecting…' : 'Offline'}
            </span>
          </div>

          {user && (
            <span className="text-xs font-medium hidden sm:inline" style={{ color: 'var(--text)' }}>
              {user.username}
            </span>
          )}

          <ThemeToggle />

          <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs h-7">
            Logout
          </Button>
        </div>

      </div>
    </header>
  );
}
