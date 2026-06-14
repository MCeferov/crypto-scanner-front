import React from 'react';
import { Link, useLocation } from 'wouter';
import { useMarket } from '../../context/MarketContext';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../context/LocaleContext';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ThemeToggle';
import { LanguageSwitcher } from '../Controls/LanguageSwitcher';
import { isCryptoAsset } from '../../utils/assetHelpers';
import type { AssetCategory } from '../../types/asset';

function navStyle(active: boolean): React.CSSProperties {
  return active
    ? { color: 'var(--text)', background: 'var(--elevated)' }
    : { color: 'var(--muted)' };
}

function StatusBar() {
  const { assetCategory, coins, loadingProgress } = useMarket();
  const t = useT();

  const cryptoCoins = coins.filter(isCryptoAsset);
  const loaded = cryptoCoins.filter(c => c.indicatorsLoaded).length;
  const cryptoTotal = cryptoCoins.length;

  const categoryCounts: Record<AssetCategory, number> = {
    all: coins.length,
    crypto: cryptoCoins.length,
    stock: coins.filter(c => c.type === 'stock').length,
    commodity: coins.filter(c => c.type === 'commodity').length,
    forex: coins.filter(c => c.type === 'forex').length,
  };

  if (assetCategory === 'crypto' && cryptoTotal > 0) {
    const allLoaded = loaded === cryptoTotal;
    if (!allLoaded) {
      return (
        <div>
          <div className="flex justify-between text-[11px] mb-1" style={{ color: 'var(--muted)' }}>
            <span>{t('status.cryptoLoading')}</span>
            <span>{loaded}/{cryptoTotal} {t('status.cryptoCoin')}</span>
          </div>
          <div className="w-full rounded-full h-1" style={{ background: 'var(--elevated)' }}>
            <div className="loading-progress" style={{ width: `${loadingProgress}%` }} />
          </div>
        </div>
      );
    }
    return (
      <p className="text-center text-[11px]" style={{ color: 'var(--dim)' }}>
        ✓ {t('status.cryptoReady', { loaded, total: cryptoTotal })}
      </p>
    );
  }

  const count = categoryCounts[assetCategory];
  if (count === 0) return null;

  const keyMap: Record<AssetCategory, string> = {
    all: 'status.assetsReady',
    crypto: 'status.cryptoReady',
    stock: 'status.stockReady',
    commodity: 'status.commodityReady',
    forex: 'status.forexReady',
  };

  if (assetCategory === 'all') {
    return (
      <p className="text-center text-[11px]" style={{ color: 'var(--dim)' }}>
        ✓ {t('status.assetsReady', { count })}
        {cryptoTotal > 0 && loaded < cryptoTotal && (
          <span style={{ color: 'var(--muted)' }}>
            {' · '}{loaded}/{cryptoTotal} {t('status.cryptoCoin')}
          </span>
        )}
      </p>
    );
  }

  return (
    <p className="text-center text-[11px]" style={{ color: 'var(--dim)' }}>
      ✓ {t(keyMap[assetCategory], { count, loaded, total: cryptoTotal })}
    </p>
  );
}

export function Header() {
  const { wsConnected, wsReconnecting, coins } = useMarket();
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const t = useT();

  const cryptoCoins = coins.filter(isCryptoAsset);
  const isMarkets = location === '/' || location.startsWith('/coin/') || location.startsWith('/asset/');
  const isDashboard = location === '/dashboard';

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  return (
    <header
      className="sticky top-0 z-50 px-4 sm:px-5 py-2.5 backdrop-blur-md"
      style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between max-w-[1920px] mx-auto gap-3 sm:gap-4">

        <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: '#fff' }}
          >
            M
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-sm tracking-tight block" style={{ color: 'var(--text)' }}>
              {t('nav.brand')}
            </span>
            <span className="text-[10px] block" style={{ color: 'var(--dim)' }}>{t('nav.brandSub')}</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link href="/">
            <span className="text-xs px-3 py-1.5 rounded-md cursor-pointer" style={navStyle(isMarkets)}>
              {t('nav.markets')}
            </span>
          </Link>
          <Link href="/dashboard">
            <span className="text-xs px-3 py-1.5 rounded-md cursor-pointer" style={navStyle(isDashboard)}>
              {t('nav.dashboard')}
            </span>
          </Link>
        </nav>

        <div className="flex-1 max-w-xs hidden lg:block">
          <StatusBar />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {cryptoCoins.length > 0 && isMarkets && (
            <div className="flex items-center gap-1.5" title="WebSocket">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: wsConnected ? '#26a69a' : wsReconnecting ? '#f0b90b' : '#ef5350',
                  boxShadow: wsConnected ? '0 0 6px rgba(38,166,154,.7)' : 'none',
                }}
              />
              <span className="text-xs hidden sm:inline" style={{ color: 'var(--muted)' }}>
                {wsConnected ? t('status.live') : wsReconnecting ? t('status.reconnecting') : t('status.offline')}
              </span>
            </div>
          )}

          <LanguageSwitcher />

          {user && (
            <span className="text-xs font-medium hidden sm:inline" style={{ color: 'var(--text)' }}>
              {user.username}
            </span>
          )}

          <ThemeToggle />

          <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs h-7">
            {t('nav.logout')}
          </Button>
        </div>

      </div>
    </header>
  );
}
