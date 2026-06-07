import React from 'react';
import type { AIAnalysisResult } from '../../services/aiAnalysis';
import { classifySignal, signalLabel } from '../../utils/formatters';
import { getTrendScoreColor } from '../../utils/colors';

interface AIAnalysisPanelProps {
  analysis: AIAnalysisResult | null;
  loading?: boolean;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#8b949e]">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#21262d] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export function AIAnalysisPanel({ analysis, loading }: AIAnalysisPanelProps) {
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
      <div className="p-4 border-b border-[#21262d]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#484f58] mb-3">AI Analysis</h3>
        <span className={`inline-block font-bold rounded px-3 py-1.5 text-sm mb-3 ${classifySignal(analysis.signal)}`}>
          {signalLabel(analysis.signal)}
        </span>
        <p className="text-xs text-[#8b949e] leading-relaxed">{analysis.summary}</p>
      </div>

      <div className="p-4 border-b border-[#21262d]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#484f58] mb-3">Scores</h3>
        <ScoreBar label="Bullish Score" value={analysis.bullishScore} color="#26a69a" />
        <ScoreBar label="Bearish Score" value={analysis.bearishScore} color="#ef5350" />
        <div className="flex justify-between text-xs mt-2">
          <span className="text-[#8b949e]">Trend Strength</span>
          <span className="font-mono font-bold" style={{ color: getTrendScoreColor(analysis.trendStrength) }}>
            {analysis.trendStrength}%
          </span>
        </div>
      </div>

      <div className="p-4 border-b border-[#21262d]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#484f58] mb-3">Signal Reasons</h3>
        <ul className="space-y-1.5">
          {analysis.reasons.length > 0 ? analysis.reasons.map((r, i) => (
            <li key={i} className="text-xs text-[#8b949e] flex items-start gap-2">
              <span className="text-[#484f58] mt-0.5">•</span>{r}
            </li>
          )) : (
            <li className="text-xs text-[#484f58]">No strong signals detected</li>
          )}
        </ul>
      </div>

      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#484f58] mb-3">Indicator Summary</h3>
        <div className="space-y-2">
          {analysis.indicatorSummary.map(item => (
            <div key={item.name} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-[#161b22]">
              <span className="text-[#8b949e]">{item.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#e6edf3]">{item.value}</span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: item.bias === 'bullish' ? '#26a69a' : item.bias === 'bearish' ? '#ef5350' : '#484f58',
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
