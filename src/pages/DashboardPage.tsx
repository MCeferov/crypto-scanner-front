import React from 'react';
import { Link } from 'wouter';
import { Header } from '../components/Layout/Header';
import { MarketSummary } from '../components/Dashboard/MarketSummary';
import { DashboardSearch } from '../components/Dashboard/DashboardSearch';
import { useAuth } from '../context/AuthContext';
import { useT } from '../context/LocaleContext';
import { Button } from '../components/ui/button';

export function DashboardPage() {
  const { user } = useAuth();
  const t = useT();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header />

      <div className="flex-1 px-4 py-6 sm:py-8 max-w-[1920px] mx-auto w-full">
        <section
          className="rounded-2xl border px-5 py-6 sm:px-7 sm:py-8 mb-6"
          style={{
            background: 'linear-gradient(165deg, var(--surface) 0%, var(--bg) 72%)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2"
                style={{ color: 'var(--dim)' }}
              >
                {t('nav.brand')}
              </p>
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ color: 'var(--text)' }}
              >
                {t('dashboard.title')}
              </h1>
              <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
                {t('dashboard.welcome', { username: user?.username ?? '' })}
              </p>
            </div>
            <DashboardSearch />
          </div>
        </section>

        <section className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-3 px-0.5">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {t('dashboard.overview')}
            </h2>
            <span className="text-[11px]" style={{ color: 'var(--dim)' }}>
              {t('dashboard.overviewHint')}
            </span>
          </div>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <MarketSummary useAllPool embedded />
          </div>
        </section>

        <section
          className="rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="min-w-0">
            <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
              {t('dashboard.heatmapTitle')}
            </h2>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('dashboard.heatmapDesc')}
            </p>
          </div>
          <Link href="/">
            <Button className="shrink-0 whitespace-nowrap">{t('dashboard.openHeatmap')}</Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
