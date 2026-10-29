import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Radar, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Target } from 'lucide-react';
import { useMarket, type CoinData } from '../../context/MarketContext';
import { useT } from '../../context/LocaleContext';
import type { BreakoutEvent } from '../../indicators/breakoutEvents';
import { formatAssetPrice } from '../../utils/formatters';
import { isCryptoAsset } from '../../utils/assetHelpers';

/**
 * Qırılma radarı — "indicə nə baş verdi" lenti.
 *
 * Cədvəl "hansı aktiv necə dayanıb" sualına cavab verir; bu lent isə
 * HADİSƏ göstərir: hansı aktivdə dəstək/dirənc xətti neçə dəqiqə əvvəl
 * qırıldı, hansı aktiv qırılmaya sıxılıb. Siqnal deyil — xəbərdir, ona görə
 * heç bir AL/SAT tövsiyəsi yazmır, sadəcə faktı və vaxtını verir.
 *
 * Yığcam halda son 4 hadisə bir zolaqda, açıq halda tam siyahı görünür.
 */

const MAX_COLLAPSED = 4;
const MAX_EXPANDED = 24;

interface FeedRow {
  coin: CoinData;
  event: BreakoutEvent;
}

const isBreak = (e: BreakoutEvent) =>
  e.kind === 'resistance_break' || e.kind === 'support_break';

const isBullish = (e: BreakoutEvent) =>
  e.kind === 'resistance_break' || e.kind === 'near_support';

/** "15 dəq əvvəl" / "1 saat əvvəl" / "2 gün əvvəl" */
function timeAgo(t: ReturnType<typeof useT>, ms: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t('breakout.justNow');
  if (min < 60) return t('breakout.minAgo', { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return t('breakout.hourAgo', { n: hours });
  return t('breakout.dayAgo', { n: Math.floor(hours / 24) });
}

function eventText(t: ReturnType<typeof useT>, e: BreakoutEvent): string {
  return t(`breakout.kind.${e.kind}`);
}

function eventColor(e: BreakoutEvent): string {
  if (!isBreak(e)) return '#f3a52f';
  return isBullish(e) ? '#26a69a' : '#ef5350';
}

function EventIcon({ event }: { event: BreakoutEvent }) {
  const color = eventColor(event);
  if (!isBreak(event)) return <Target size={13} style={{ color }} />;
  return event.kind === 'resistance_break'
    ? <ArrowUpRight size={13} style={{ color }} />
    : <ArrowDownRight size={13} style={{ color }} />;
}

export function BreakoutFeed() {
  const { coins } = useMarket();
  const t = useT();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  // Hadisə vaxtları şam bağlanışına bağlıdır — siyahı yeniləndikcə "neçə
  // dəqiqə əvvəl" də özü yenilənir, ayrıca taymer saxlamağa ehtiyac yoxdur.
  const nowMs = Date.now();

  const rows = useMemo<FeedRow[]>(() => {
    const all: FeedRow[] = [];
    for (const coin of coins) {
      if (!coin.indicatorsLoaded || !coin.breakout) continue;
      all.push({ coin, event: coin.breakout });
    }

    const breaks = all
      .filter(r => isBreak(r.event))
      .sort((a, b) => b.event.atMs - a.event.atMs);
    const approaching = all
      .filter(r => !isBreak(r.event))
      .sort((a, b) => a.event.distancePct - b.event.distancePct);

    return [...breaks, ...approaching];
  }, [coins]);

  if (rows.length === 0) return null;

  const visible = open ? rows.slice(0, MAX_EXPANDED) : rows.slice(0, MAX_COLLAPSED);
  const breakCount = rows.filter(r => isBreak(r.event)).length;

  const go = (coin: CoinData) => {
    if (isCryptoAsset(coin)) setLocation(`/coin/${coin.symbol}`);
    else setLocation(`/asset/${coin.type}/${coin.baseAsset}`);
  };

  return (
    <section
      className="border-b px-4 py-2"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="max-w-[1920px] mx-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <Radar size={13} style={{ color: 'var(--accent)' }} />
            <span
              className="font-semibold uppercase"
              style={{ color: 'var(--dim)', fontSize: 10, letterSpacing: '0.06em' }}
            >
              {t('breakout.title')}
            </span>
            {breakCount > 0 && (
              <span
                className="font-mono rounded px-1.5"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 10 }}
              >
                {breakCount}
              </span>
            )}
          </span>

          {!open && (
            <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
              {visible.map(({ coin, event }) => (
                <button
                  key={coin.id}
                  type="button"
                  onClick={() => go(coin)}
                  title={`${coin.name} — ${eventText(t, event)} @ ${formatAssetPrice(event.level, coin.type)}`}
                  className="flex items-center gap-1.5 shrink-0 rounded-lg border px-2 py-1 transition-colors row-hover"
                  style={{ borderColor: 'var(--chart-border)' }}
                >
                  <EventIcon event={event} />
                  <span className="font-semibold" style={{ color: 'var(--text)', fontSize: 11 }}>
                    {coin.baseAsset || coin.name}
                  </span>
                  <span className="whitespace-nowrap" style={{ color: 'var(--chart-text)', fontSize: 11 }}>
                    {eventText(t, event)}
                  </span>
                  <span className="font-mono whitespace-nowrap" style={{ color: 'var(--dim)', fontSize: 10 }}>
                    {isBreak(event) ? timeAgo(t, event.atMs, nowMs) : `${event.distancePct.toFixed(2)}%`}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 shrink-0 rounded-md px-2 py-1 transition-colors hover:opacity-80"
            style={{ color: 'var(--accent)', fontSize: 11 }}
          >
            {open ? t('breakout.collapse') : t('breakout.expand', { n: rows.length })}
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {open && (
          <div className="mt-2 max-h-72 overflow-y-auto pr-1">
            <ul className="space-y-1">
              {visible.map(({ coin, event }) => (
                <li key={coin.id}>
                  <button
                    type="button"
                    onClick={() => go(coin)}
                    className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 transition-colors row-hover"
                  >
                    <EventIcon event={event} />
                    <span
                      className="font-semibold shrink-0"
                      style={{ color: 'var(--text)', fontSize: 12, minWidth: 64 }}
                    >
                      {coin.baseAsset || coin.name}
                    </span>
                    <span className="truncate" style={{ color: 'var(--chart-text)', fontSize: 12 }}>
                      {eventText(t, event)}
                    </span>
                    <span className="font-mono shrink-0" style={{ color: 'var(--dim)', fontSize: 11 }}>
                      {formatAssetPrice(event.level, coin.type)}
                    </span>
                    <span
                      className="font-mono shrink-0 rounded px-1"
                      style={{ background: 'var(--chart-surface)', color: 'var(--dim)', fontSize: 10 }}
                    >
                      {event.tf}
                    </span>
                    {event.volumeConfirmed && (
                      <span className="shrink-0" style={{ color: '#26a69a', fontSize: 10 }}>
                        {t('breakout.volumeOk')}
                      </span>
                    )}
                    {event.retest && (
                      <span className="shrink-0" style={{ color: 'var(--accent)', fontSize: 10 }}>
                        {t('breakout.retest')}
                      </span>
                    )}
                    <span className="flex-1" />
                    <span className="font-mono shrink-0 whitespace-nowrap" style={{ color: 'var(--dim)', fontSize: 11 }}>
                      {isBreak(event)
                        ? timeAgo(t, event.atMs, nowMs)
                        : t('breakout.distance', { pct: event.distancePct.toFixed(2) })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 px-2" style={{ color: 'var(--dim)', fontSize: 10 }}>
              {t('breakout.note')}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
