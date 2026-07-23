import React, { useState } from 'react';
import {
  CHART_TIMEFRAMES,
  type CandleMode,
  type ChartTimeframe,
  type IndicatorSettings,
  type IndicatorKey,
} from '../../types/chart';

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
  { key: 'superTrend', label: 'SuperTrend' },
];

const PANEL_INDICATORS: { key: IndicatorKey; panelKey?: 'rsi' | 'macd' | 'stochRsi'; label: string }[] = [
  { key: 'rsi', panelKey: 'rsi', label: 'RSI' },
  { key: 'macd', panelKey: 'macd', label: 'MACD' },
  { key: 'stochRsi', panelKey: 'stochRsi', label: 'Stoch RSI' },
];

function isEnabled(settings: IndicatorSettings, key: IndicatorKey): boolean {
  return settings[key].enabled;
}

function NumInput({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="whitespace-nowrap opacity-80">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={e => {
          const n = +e.target.value;
          if (!Number.isFinite(n)) return;
          onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-14 px-1.5 py-0.5 rounded border"
        style={{ background: 'var(--chart-surface)', borderColor: 'var(--chart-border)', color: 'var(--chart-text-bright)' }}
      />
    </label>
  );
}

export function ChartToolbar({
  timeframe, onTimeframeChange, settings, onToggleIndicator, onTogglePanel, onUpdateSettings,
}: ChartToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const candleMode: CandleMode = settings.candleMode;

  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2 border-b flex-wrap"
      style={{ borderColor: 'var(--chart-border)', background: 'var(--chart-bg)' }}
    >
      <div className="flex items-center gap-1">
        {CHART_TIMEFRAMES.map(tf => (
          <button
            key={tf.key}
            onClick={() => onTimeframeChange(tf.key)}
            className="px-2.5 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: timeframe === tf.key ? 'rgba(240,185,11,0.12)' : 'transparent',
              color: timeframe === tf.key ? '#f0b90b' : 'var(--chart-text)',
              border: `1px solid ${timeframe === tf.key ? 'rgba(240,185,11,0.25)' : 'transparent'}`,
            }}
          >
            {tf.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--chart-text-dim)' }}>
          Candles
        </span>
        {([
          { key: 'normal' as const, label: 'Normal' },
          { key: 'heikinAshi' as const, label: 'Heikin Ashi' },
        ]).map(opt => (
          <button
            key={opt.key}
            onClick={() => onUpdateSettings({ candleMode: opt.key })}
            className="px-2 py-1 rounded text-xs transition-all"
            style={{
              background: candleMode === opt.key ? 'rgba(240,185,11,0.12)' : 'var(--chart-surface)',
              color: candleMode === opt.key ? '#f0b90b' : 'var(--chart-text)',
              border: `1px solid ${candleMode === opt.key ? 'rgba(240,185,11,0.25)' : 'var(--chart-border)'}`,
            }}
          >
            {opt.label}
          </button>
        ))}

        <div className="w-px h-4 mx-1" style={{ background: 'var(--chart-border)' }} />

        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--chart-text-dim)' }} title="Grafik üzərində göstərilir">Overlay</span>
        {OVERLAY_INDICATORS.map(ind => (
          <button
            key={ind.key}
            onClick={() => onToggleIndicator(ind.key)}
            className="px-2 py-1 rounded text-xs transition-all"
            style={{
              background: isEnabled(settings, ind.key) ? 'rgba(38,166,154,0.12)' : 'var(--chart-surface)',
              color: isEnabled(settings, ind.key) ? '#26a69a' : 'var(--chart-text)',
              border: `1px solid ${isEnabled(settings, ind.key) ? 'rgba(38,166,154,0.25)' : 'var(--chart-border)'}`,
            }}
          >
            {ind.label}
          </button>
        ))}

        <div className="w-px h-4 mx-1" style={{ background: 'var(--chart-border)' }} />

        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--chart-text-dim)' }} title="Aşağıda ayrıca panel kimi göstərilir">Panels</span>
        {PANEL_INDICATORS.map(ind => (
          <button
            key={ind.key}
            onClick={() => onToggleIndicator(ind.key)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (ind.panelKey) onTogglePanel(ind.panelKey);
            }}
            title={ind.panelKey ? 'Right-click to toggle panel visibility' : undefined}
            className="px-2 py-1 rounded text-xs transition-all"
            style={{
              background: isEnabled(settings, ind.key) ? 'rgba(124,77,255,0.12)' : 'var(--chart-surface)',
              color: isEnabled(settings, ind.key) ? '#7c4dff' : 'var(--chart-text)',
              border: `1px solid ${isEnabled(settings, ind.key) ? 'rgba(124,77,255,0.25)' : 'var(--chart-border)'}`,
              opacity: ind.panelKey && !settings[ind.panelKey].panel ? 0.5 : 1,
            }}
          >
            {ind.label}
          </button>
        ))}

        <button
          onClick={() => setShowSettings(s => !s)}
          className="px-2 py-1 rounded text-xs border transition-all hover:opacity-80"
          style={{ color: 'var(--chart-text)', borderColor: 'var(--chart-border)' }}
        >
          ⚙ Settings
        </button>
      </div>

      {showSettings && (
        <div
          className="w-full flex flex-col gap-3 pt-2 border-t text-xs"
          style={{ borderColor: 'var(--chart-border)', color: 'var(--chart-text)' }}
        >
          <div className="flex gap-4 flex-wrap items-center">
            <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--chart-text-dim)', minWidth: 56 }}>RSI</span>
            <NumInput label="Period" value={settings.rsi.period} min={2} max={100}
              onChange={period => onUpdateSettings({ rsi: { ...settings.rsi, period } })} />
            <NumInput label="Oversold" value={settings.rsi.oversold} min={1} max={49}
              onChange={oversold => onUpdateSettings({ rsi: { ...settings.rsi, oversold } })} />
            <NumInput label="Overbought" value={settings.rsi.overbought} min={51} max={99}
              onChange={overbought => onUpdateSettings({ rsi: { ...settings.rsi, overbought } })} />
          </div>

          <div className="flex gap-4 flex-wrap items-center">
            <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--chart-text-dim)', minWidth: 56 }}>MACD</span>
            <NumInput label="Fast" value={settings.macd.fast} min={2} max={50}
              onChange={fast => onUpdateSettings({ macd: { ...settings.macd, fast } })} />
            <NumInput label="Slow" value={settings.macd.slow} min={2} max={100}
              onChange={slow => onUpdateSettings({ macd: { ...settings.macd, slow } })} />
            <NumInput label="Signal" value={settings.macd.signal} min={2} max={50}
              onChange={signal => onUpdateSettings({ macd: { ...settings.macd, signal } })} />
          </div>

          <div className="flex gap-4 flex-wrap items-center">
            <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--chart-text-dim)', minWidth: 56 }}>Stoch</span>
            <NumInput label="RSI" value={settings.stochRsi.rsiPeriod} min={2} max={50}
              onChange={rsiPeriod => onUpdateSettings({ stochRsi: { ...settings.stochRsi, rsiPeriod } })} />
            <NumInput label="Stoch" value={settings.stochRsi.stochPeriod} min={2} max={50}
              onChange={stochPeriod => onUpdateSettings({ stochRsi: { ...settings.stochRsi, stochPeriod } })} />
            <NumInput label="K" value={settings.stochRsi.kSmooth} min={1} max={20}
              onChange={kSmooth => onUpdateSettings({ stochRsi: { ...settings.stochRsi, kSmooth } })} />
            <NumInput label="D" value={settings.stochRsi.dSmooth} min={1} max={20}
              onChange={dSmooth => onUpdateSettings({ stochRsi: { ...settings.stochRsi, dSmooth } })} />
            <NumInput label="OS" value={settings.stochRsi.oversold} min={1} max={49}
              onChange={oversold => onUpdateSettings({ stochRsi: { ...settings.stochRsi, oversold } })} />
            <NumInput label="OB" value={settings.stochRsi.overbought} min={51} max={99}
              onChange={overbought => onUpdateSettings({ stochRsi: { ...settings.stochRsi, overbought } })} />
          </div>

          <div className="flex gap-4 flex-wrap items-center">
            <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--chart-text-dim)', minWidth: 56 }}>ST</span>
            <NumInput label="Period" value={settings.superTrend.period} min={2} max={50}
              onChange={period => onUpdateSettings({ superTrend: { ...settings.superTrend, period } })} />
            <NumInput label="Mult" value={settings.superTrend.multiplier} min={0.5} max={10} step={0.1}
              onChange={multiplier => onUpdateSettings({ superTrend: { ...settings.superTrend, multiplier } })} />
          </div>
        </div>
      )}
    </div>
  );
}
