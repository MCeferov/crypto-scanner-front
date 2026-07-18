import React from 'react';
import type { CoinData } from '../../context/MarketContext';
import type { AIAnalysisResult } from '../../services/aiAnalysis';
import { classifySignal } from '../../utils/formatters';
import { getTrendScoreColor } from '../../utils/colors';
import { useT } from '../../context/LocaleContext';

interface AIAnalysisPanelProps {
  analysis: AIAnalysisResult | null;
  coin?: CoinData | null;
  loading?: boolean;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--chart-text)' }}>{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--chart-border)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function mtfLabel(t: (k: string) => string, alignment: string): string {
  if (alignment === 'ALIGNED') return t('detail.mtfAligned');
  if (alignment === 'CONFLICT') return t('detail.mtfConflict');
  return t('detail.mtfMixed');
}

function riskLabel(t: (k: string) => string, risk: string): string {
  if (risk === 'HIGH') return t('detail.riskHigh');
  if (risk === 'MEDIUM') return t('detail.riskMedium');
  if (risk === 'LOW') return t('detail.riskLow');
  return t('detail.riskNone');
}

function sideLabel(t: (k: string) => string, side: string): string {
  if (side === 'BUY') return t('detail.sideBuy');
  if (side === 'SELL') return t('detail.sideSell');
  return t('detail.sideNeutral');
}

export function AIAnalysisPanel({ analysis, coin, loading }: AIAnalysisPanelProps) {
  const t = useT();

  if (loading || !analysis) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-8 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b" style={{ borderColor: 'var(--chart-border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>
          {t('detail.aiAnalysis')}
        </h3>
        <span className={`inline-block font-bold rounded px-3 py-1.5 text-sm mb-3 ${classifySignal(analysis.signal)}`}>
          {t(`signal.${analysis.signal}`)}
        </span>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--chart-text)' }}>{analysis.summary}</p>
      </div>

      <div className="p-4 border-b" style={{ borderColor: 'var(--chart-border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>
          {t('detail.scores')}
        </h3>
        <ScoreBar label={t('detail.bullishScore')} value={analysis.bullishScore} color="#26a69a" />
        <ScoreBar label={t('detail.bearishScore')} value={analysis.bearishScore} color="#ef5350" />
        <div className="flex justify-between text-xs mt-2">
          <span style={{ color: 'var(--chart-text)' }}>{t('detail.trendStrength')}</span>
          <span className="font-mono font-bold" style={{ color: getTrendScoreColor(analysis.trendStrength) }}>
            {analysis.trendStrength}%
          </span>
        </div>
      </div>

      {coin && coin.indicatorsLoaded && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--chart-border)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>
            {t('detail.confidence')}
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block font-bold rounded px-2 py-1 text-xs ${
              coin.confidenceSide === 'BUY' ? 'signal-buy'
                : coin.confidenceSide === 'SELL' ? 'signal-sell' : 'signal-neutral'
            }`}>
              {sideLabel(t, coin.confidenceSide)}
            </span>
            <span className="font-mono font-bold text-sm" style={{
              color: coin.confidence >= 70 ? '#26a69a' : coin.confidence >= 50 ? '#f0b90b' : 'var(--chart-text-dim)',
            }}>
              {coin.confidence}%
            </span>
          </div>
          <ScoreBar
            label={t('detail.totalConfidence')}
            value={coin.confidence}
            color={coin.confidence >= 70 ? '#26a69a' : coin.confidence >= 50 ? '#f0b90b' : '#ef5350'}
          />
          <ul className="space-y-1 mt-2">
            {coin.confidenceReasons.slice(0, 6).map((r, i) => (
              <li key={i} className="text-[11px]" style={{ color: 'var(--chart-text)' }}>• {r}</li>
            ))}
          </ul>
          {coin.volumeReason && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--chart-text-dim)' }}>
              {t('detail.volume')}: {coin.volumeGate} — {coin.volumeReason}
            </p>
          )}
          {coin.sentimentLabel && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--chart-text-dim)' }}>
              {t('detail.sentiment')}: {coin.sentimentLabel} ({coin.sentimentScore})
            </p>
          )}
        </div>
      )}

      {coin && coin.indicatorsLoaded && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--chart-border)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>
            {t('detail.flipRisk')}
          </h3>
          <div className="text-xs mb-2 flex items-center gap-2">
            <span style={{ color: 'var(--chart-text)' }}>{t('detail.mtfAlignment')}:</span>
            <span className="font-semibold" style={{
              color: coin.mtfAlignment === 'CONFLICT' ? '#ef5350'
                : coin.mtfAlignment === 'ALIGNED' ? '#26a69a' : '#f0b90b',
            }}>
              {mtfLabel(t, coin.mtfAlignment)}
            </span>
            <span style={{ color: 'var(--chart-text-dim)' }}>
              ({coin.mtf1m}/{coin.mtf5m}/{coin.mtf15m}/{coin.mtf30m}/{coin.mtf1h}/{coin.mtf4h})
            </span>
          </div>
          {coin.reversalRisk !== 'NONE' && (
            <div className="rounded px-2 py-2 mb-2 text-xs" style={{
              background: coin.reversalRisk === 'HIGH' ? 'rgba(239,83,80,.1)' : 'rgba(240,185,11,.08)',
              border: `1px solid ${coin.reversalRisk === 'HIGH' ? 'rgba(239,83,80,.25)' : 'rgba(240,185,11,.2)'}`,
              color: coin.reversalRisk === 'HIGH' ? '#ef5350' : '#f0b90b',
            }}>
              {t('detail.flipRiskLabel', { level: riskLabel(t, coin.reversalRisk) })}
            </div>
          )}
          <ul className="space-y-1 mb-3">
            {coin.reversalReasons.map((r, i) => (
              <li key={i} className="text-xs" style={{ color: 'var(--chart-text)' }}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4 border-b" style={{ borderColor: 'var(--chart-border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>
          {t('detail.signalReasons')}
        </h3>
        <ul className="space-y-1.5">
          {analysis.reasons.length > 0 ? analysis.reasons.map((r, i) => (
            <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--chart-text)' }}>
              <span className="mt-0.5" style={{ color: 'var(--chart-text-dim)' }}>•</span>{r}
            </li>
          )) : (
            <li className="text-xs" style={{ color: 'var(--chart-text-dim)' }}>{t('detail.noSignals')}</li>
          )}
        </ul>
      </div>

      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>
          {t('detail.indicatorSummary')}
        </h3>
        <div className="space-y-2">
          {analysis.indicatorSummary.map(item => (
            <div
              key={item.name}
              className="flex items-center justify-between text-xs py-1.5 px-2 rounded"
              style={{ background: 'var(--chart-surface)' }}
            >
              <span style={{ color: 'var(--chart-text)' }}>{item.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono" style={{ color: 'var(--chart-text-bright)' }}>{item.value}</span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: item.bias === 'bullish' ? '#26a69a' : item.bias === 'bearish' ? '#ef5350' : 'var(--chart-text-dim)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
