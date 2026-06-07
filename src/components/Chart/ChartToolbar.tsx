import React, { useState } from 'react';
import { CHART_TIMEFRAMES, type ChartTimeframe, type IndicatorSettings, type IndicatorKey } from '../../types/chart';

interface ChartToolbarProps {
  timeframe: ChartTimeframe;
  onTimeframeChange: (tf: ChartTimeframe) => void;
  settings: IndicatorSettings;
  onToggleIndicator: (key: IndicatorKey) => void;
  onTogglePanel: (key: 'rsi' | 'macd' | 'stochRsi') => void;
  onUpdateSettings: (partial: Partial<IndicatorSettings>) => void;
}

const OVERLAY_INDICATORS: { key: IndicatorKey; label: string }[] = [
  { key: 'volume', label: 'Volume' },
  { key: 'bollingerBands', label: 'BB' },
  { key: 'superTrend', label: 'SuperTrend' },
];

const PANEL_INDICATORS: { key: IndicatorKey; panelKey?: 'rsi' | 'macd' | 'stochRsi'; label: string }[] = [
  { key: 'rsi', panelKey: 'rsi', label: 'RSI' },
  { key: 'macd', panelKey: 'macd', label: 'MACD' },
  { key: 'stochRsi', panelKey: 'stochRsi', label: 'Stoch RSI' },
  { key: 'atr', label: 'ATR' },
];

function isEnabled(settings: IndicatorSettings, key: IndicatorKey): boolean {
  return settings[key].enabled;
}

export function ChartToolbar({
  timeframe, onTimeframeChange, settings, onToggleIndicator, onTogglePanel, onUpdateSettings,
}: ChartToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[#21262d] bg-[#0d1117] flex-wrap">
      <div className="flex items-center gap-1">
        {CHART_TIMEFRAMES.map(tf => (
          <button
            key={tf.key}
            onClick={() => onTimeframeChange(tf.key)}
            className="px-2.5 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: timeframe === tf.key ? 'rgba(240,185,11,0.12)' : 'transparent',
              color: timeframe === tf.key ? '#f0b90b' : '#8b949e',
              border: `1px solid ${timeframe === tf.key ? 'rgba(240,185,11,0.25)' : 'transparent'}`,
            }}
          >
            {tf.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-[#484f58] font-semibold" title="Grafik üzərində göstərilir">Overlay</span>
        {OVERLAY_INDICATORS.map(ind => (
          <button
            key={ind.key}
            onClick={() => onToggleIndicator(ind.key)}
            className="px-2 py-1 rounded text-xs transition-all"
            style={{
              background: isEnabled(settings, ind.key) ? 'rgba(38,166,154,0.12)' : '#161b22',
              color: isEnabled(settings, ind.key) ? '#26a69a' : '#6b7280',
              border: `1px solid ${isEnabled(settings, ind.key) ? 'rgba(38,166,154,0.25)' : '#21262d'}`,
            }}
          >
            {ind.label}
          </button>
        ))}

        <div className="w-px h-4 bg-[#21262d] mx-1" />

        <span className="text-[10px] uppercase tracking-wider text-[#484f58] font-semibold" title="Aşağıda ayrıca panel kimi göstərilir">Panels</span>
        {PANEL_INDICATORS.map(ind => (
          <button
            key={ind.key}
            onClick={() => {
              onToggleIndicator(ind.key);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (ind.panelKey) onTogglePanel(ind.panelKey);
            }}
            title={ind.panelKey ? 'Right-click to toggle panel visibility' : undefined}
            className="px-2 py-1 rounded text-xs transition-all"
            style={{
              background: isEnabled(settings, ind.key) ? 'rgba(124,77,255,0.12)' : '#161b22',
              color: isEnabled(settings, ind.key) ? '#7c4dff' : '#6b7280',
              border: `1px solid ${isEnabled(settings, ind.key) ? 'rgba(124,77,255,0.25)' : '#21262d'}`,
              opacity: ind.panelKey && !settings[ind.panelKey].panel ? 0.5 : 1,
            }}
          >
            {ind.label}
          </button>
        ))}

        <button
          onClick={() => setShowSettings(s => !s)}
          className="px-2 py-1 rounded text-xs text-[#8b949e] border border-[#21262d] hover:border-[#484f58] transition-all"
        >
          ⚙ Settings
        </button>
      </div>

      {showSettings && (
        <div className="w-full flex gap-4 flex-wrap pt-2 border-t border-[#21262d] text-xs text-[#8b949e]">
          <label className="flex items-center gap-2">
            RSI Period
            <input
              type="number" min={2} max={50} value={settings.rsi.period}
              onChange={e => onUpdateSettings({ rsi: { ...settings.rsi, period: +e.target.value } })}
              className="w-14 px-1.5 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#e6edf3]"
            />
          </label>
          <label className="flex items-center gap-2">
            MACD Fast
            <input
              type="number" min={2} max={50} value={settings.macd.fast}
              onChange={e => onUpdateSettings({ macd: { ...settings.macd, fast: +e.target.value } })}
              className="w-14 px-1.5 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#e6edf3]"
            />
          </label>
          <label className="flex items-center gap-2">
            MACD Slow
            <input
              type="number" min={2} max={100} value={settings.macd.slow}
              onChange={e => onUpdateSettings({ macd: { ...settings.macd, slow: +e.target.value } })}
              className="w-14 px-1.5 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#e6edf3]"
            />
          </label>
          <label className="flex items-center gap-2">
            BB Period
            <input
              type="number" min={5} max={50} value={settings.bollingerBands.period}
              onChange={e => onUpdateSettings({ bollingerBands: { ...settings.bollingerBands, period: +e.target.value } })}
              className="w-14 px-1.5 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#e6edf3]"
            />
          </label>
          <label className="flex items-center gap-2">
            ST Multiplier
            <input
              type="number" min={1} max={10} step={0.5} value={settings.superTrend.multiplier}
              onChange={e => onUpdateSettings({ superTrend: { ...settings.superTrend, multiplier: +e.target.value } })}
              className="w-14 px-1.5 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#e6edf3]"
            />
          </label>
        </div>
      )}
    </div>
  );
}
