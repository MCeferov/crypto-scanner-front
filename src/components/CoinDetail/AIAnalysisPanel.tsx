import React from 'react';
import type { CoinData } from '../../context/MarketContext';
import type { AIAnalysisResult } from '../../services/aiAnalysis';
import { classifySignal, signalLabel } from '../../utils/formatters';
import { getTrendScoreColor } from '../../utils/colors';

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

export function AIAnalysisPanel({ analysis, coin, loading }: AIAnalysisPanelProps) {
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
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>AI Analysis</h3>
        <span className={`inline-block font-bold rounded px-3 py-1.5 text-sm mb-3 ${classifySignal(analysis.signal)}`}>
          {signalLabel(analysis.signal)}
        </span>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--chart-text)' }}>{analysis.summary}</p>
      </div>

      <div className="p-4 border-b" style={{ borderColor: 'var(--chart-border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>Scores</h3>
        <ScoreBar label="Bullish Score" value={analysis.bullishScore} color="#26a69a" />
        <ScoreBar label="Bearish Score" value={analysis.bearishScore} color="#ef5350" />
        <div className="flex justify-between text-xs mt-2">
          <span style={{ color: 'var(--chart-text)' }}>Trend Strength</span>
          <span className="font-mono font-bold" style={{ color: getTrendScoreColor(analysis.trendStrength) }}>
            {analysis.trendStrength}%
          </span>
        </div>
      </div>

      {coin && coin.indicatorsLoaded && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--chart-border)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>
            Flip Risk & R:R
          </h3>
          <div className="text-xs mb-2 flex items-center gap-2">
            <span style={{ color: 'var(--chart-text)' }}>MTF uyğunluq:</span>
            <span className="font-semibold" style={{
              color: coin.mtfAlignment === 'CONFLICT' ? '#ef5350'
                : coin.mtfAlignment === 'ALIGNED' ? '#26a69a' : '#f0b90b',
            }}>
              {coin.mtfAlignment}
            </span>
            <span style={{ color: 'var(--chart-text-dim)' }}>
              ({coin.mtf15m}/{coin.mtf30m}/{coin.mtf1h}/{coin.mtf4h})
            </span>
          </div>
          {coin.reversalRisk !== 'NONE' && (
            <div className="rounded px-2 py-2 mb-2 text-xs" style={{
              background: coin.reversalRisk === 'HIGH' ? 'rgba(239,83,80,.1)' : 'rgba(240,185,11,.08)',
              border: `1px solid ${coin.reversalRisk === 'HIGH' ? 'rgba(239,83,80,.25)' : 'rgba(240,185,11,.2)'}`,
              color: coin.reversalRisk === 'HIGH' ? '#ef5350' : '#f0b90b',
            }}>
              ⚠ Flip risk: {coin.reversalRisk}
            </div>
          )}
          <ul className="space-y-1 mb-3">
            {coin.reversalReasons.map((r, i) => (
              <li key={i} className="text-xs" style={{ color: 'var(--chart-text)' }}>• {r}</li>
            ))}
          </ul>
          {coin.riskReward !== null && (
            <p className="text-[11px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--chart-text-dim)' }}>
              {coin.riskRewardNote}
            </p>
          )}
        </div>
      )}

      <div className="p-4 border-b" style={{ borderColor: 'var(--chart-border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>Signal Reasons</h3>
        <ul className="space-y-1.5">
          {analysis.reasons.length > 0 ? analysis.reasons.map((r, i) => (
            <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--chart-text)' }}>
              <span className="mt-0.5" style={{ color: 'var(--chart-text-dim)' }}>•</span>{r}
            </li>
          )) : (
            <li className="text-xs" style={{ color: 'var(--chart-text-dim)' }}>No strong signals detected</li>
          )}
        </ul>
      </div>

      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chart-text-dim)' }}>Indicator Summary</h3>
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
