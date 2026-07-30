import React, { useEffect, useRef, useState } from 'react';
import {
  CandlestickChart, LineChart, AreaChart, ChevronDown,
  SlidersHorizontal, Camera, Maximize2, Check, Settings2,
} from 'lucide-react';
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
  logScale: boolean;
  onToggleLogScale: () => void;
  onScreenshot: () => void;
  onFullscreen: () => void;
}

const CHART_TYPES: { key: CandleMode; label: string; icon: React.ReactNode }[] = [
  { key: 'normal', label: 'Candles', icon: <CandlestickChart size={14} /> },
  { key: 'heikinAshi', label: 'Heikin Ashi', icon: <CandlestickChart size={14} /> },
  { key: 'line', label: 'Line', icon: <LineChart size={14} /> },
  { key: 'area', label: 'Area', icon: <AreaChart size={14} /> },
];

/** Click-outside helper for the dropdown menus. */
function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  return ref;
}

function ToolButton({
  active, onClick, title, children,
}: {
  active?: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors"
      style={{
        color: active ? 'var(--accent)' : 'var(--chart-text)',
        background: active ? 'var(--accent-soft)' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--chart-surface)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function MenuSurface({ children, width = 260 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      className="absolute top-full left-0 mt-1.5 z-40 rounded-lg border py-1.5 text-xs"
      style={{
        width,
        background: 'var(--surface)',
        borderColor: 'var(--chart-border)',
        boxShadow: 'var(--card-shadow)',
        color: 'var(--chart-text)',
      }}
    >
      {children}
    </div>
  );
}

function NumInput({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="whitespace-nowrap" style={{ color: 'var(--chart-text)' }}>{label}</span>
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
        className="w-16 px-1.5 py-1 rounded border text-right"
        style={{ background: 'var(--chart-bg)', borderColor: 'var(--chart-border)', color: 'var(--chart-text-bright)' }}
      />
    </label>
  );
}

interface IndicatorRowDef {
  key: IndicatorKey;
  panelKey?: 'rsi' | 'macd' | 'stochRsi';
  label: string;
  settingsBody?: (s: IndicatorSettings, update: (p: Partial<IndicatorSettings>) => void) => React.ReactNode;
}

const INDICATOR_ROWS: IndicatorRowDef[] = [
  { key: 'volume', label: 'Volume' },
  {
    key: 'bollingerBands', label: 'Bollinger Bands',
    settingsBody: (s, u) => (
      <>
        <NumInput label="Period" value={s.bollingerBands.period} min={2} max={100}
          onChange={period => u({ bollingerBands: { ...s.bollingerBands, period } })} />
        <NumInput label="StdDev" value={s.bollingerBands.stdDev} min={0.5} max={5} step={0.1}
          onChange={stdDev => u({ bollingerBands: { ...s.bollingerBands, stdDev } })} />
      </>
    ),
  },
  {
    key: 'superTrend', label: 'SuperTrend',
    settingsBody: (s, u) => (
      <>
        <NumInput label="Period" value={s.superTrend.period} min={2} max={50}
          onChange={period => u({ superTrend: { ...s.superTrend, period } })} />
        <NumInput label="Multiplier" value={s.superTrend.multiplier} min={0.5} max={10} step={0.1}
          onChange={multiplier => u({ superTrend: { ...s.superTrend, multiplier } })} />
      </>
    ),
  },
  {
    key: 'rsi', panelKey: 'rsi', label: 'RSI',
    settingsBody: (s, u) => (
      <>
        <NumInput label="Period" value={s.rsi.period} min={2} max={100}
          onChange={period => u({ rsi: { ...s.rsi, period } })} />
        <NumInput label="Oversold" value={s.rsi.oversold} min={1} max={49}
          onChange={oversold => u({ rsi: { ...s.rsi, oversold } })} />
        <NumInput label="Overbought" value={s.rsi.overbought} min={51} max={99}
          onChange={overbought => u({ rsi: { ...s.rsi, overbought } })} />
      </>
    ),
  },
  {
    key: 'macd', panelKey: 'macd', label: 'MACD',
    settingsBody: (s, u) => (
      <>
        <NumInput label="Fast" value={s.macd.fast} min={2} max={50}
          onChange={fast => u({ macd: { ...s.macd, fast } })} />
        <NumInput label="Slow" value={s.macd.slow} min={2} max={100}
          onChange={slow => u({ macd: { ...s.macd, slow } })} />
        <NumInput label="Signal" value={s.macd.signal} min={2} max={50}
          onChange={signal => u({ macd: { ...s.macd, signal } })} />
      </>
    ),
  },
  {
    key: 'stochRsi', panelKey: 'stochRsi', label: 'Stoch RSI',
    settingsBody: (s, u) => (
      <>
        <NumInput label="RSI period" value={s.stochRsi.rsiPeriod} min={2} max={50}
          onChange={rsiPeriod => u({ stochRsi: { ...s.stochRsi, rsiPeriod } })} />
        <NumInput label="Stoch period" value={s.stochRsi.stochPeriod} min={2} max={50}
          onChange={stochPeriod => u({ stochRsi: { ...s.stochRsi, stochPeriod } })} />
        <NumInput label="%K smooth" value={s.stochRsi.kSmooth} min={1} max={20}
          onChange={kSmooth => u({ stochRsi: { ...s.stochRsi, kSmooth } })} />
        <NumInput label="%D smooth" value={s.stochRsi.dSmooth} min={1} max={20}
          onChange={dSmooth => u({ stochRsi: { ...s.stochRsi, dSmooth } })} />
      </>
    ),
  },
];

export function ChartToolbar({
  timeframe, onTimeframeChange, settings, onToggleIndicator, onUpdateSettings,
  logScale, onToggleLogScale, onScreenshot, onFullscreen,
}: ChartToolbarProps) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [indOpen, setIndOpen] = useState(false);
  const [expanded, setExpanded] = useState<IndicatorKey | null>(null);

  const typeRef = useClickOutside(typeOpen, () => setTypeOpen(false));
  const indRef = useClickOutside(indOpen, () => setIndOpen(false));

  const currentType = CHART_TYPES.find(ct => ct.key === settings.candleMode) ?? CHART_TYPES[0];
  const enabledCount = INDICATOR_ROWS.filter(r => settings[r.key].enabled).length;

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1 border-b flex-wrap"
      style={{ borderColor: 'var(--chart-border)', background: 'var(--chart-bg)' }}
    >
      {/* Timeframes */}
      <div className="flex items-center">
        {CHART_TIMEFRAMES.map(tf => (
          <ToolButton
            key={tf.key}
            active={timeframe === tf.key}
            onClick={() => onTimeframeChange(tf.key)}
          >
            {tf.label}
          </ToolButton>
        ))}
      </div>

      <span className="w-px h-5 mx-1" style={{ background: 'var(--chart-border)' }} />

      {/* Chart type dropdown */}
      <div className="relative" ref={typeRef}>
        <ToolButton active={typeOpen} onClick={() => setTypeOpen(o => !o)} title="Chart type">
          {currentType.icon}
          <span className="hidden sm:inline">{currentType.label}</span>
          <ChevronDown size={12} />
        </ToolButton>
        {typeOpen && (
          <MenuSurface width={180}>
            {CHART_TYPES.map(ct => (
              <button
                key={ct.key}
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left row-hover"
                style={{ color: settings.candleMode === ct.key ? 'var(--accent)' : 'var(--chart-text-bright)' }}
                onClick={() => { onUpdateSettings({ candleMode: ct.key }); setTypeOpen(false); }}
              >
                {ct.icon}
                <span className="flex-1">{ct.label}</span>
                {settings.candleMode === ct.key && <Check size={13} />}
              </button>
            ))}
          </MenuSurface>
        )}
      </div>

      {/* Indicators dropdown */}
      <div className="relative" ref={indRef}>
        <ToolButton active={indOpen} onClick={() => setIndOpen(o => !o)} title="Indicators">
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Indicators</span>
          {enabledCount > 0 && (
            <span
              className="min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {enabledCount}
            </span>
          )}
        </ToolButton>
        {indOpen && (
          <MenuSurface width={280}>
            {INDICATOR_ROWS.map(row => {
              const enabled = settings[row.key].enabled;
              const isExpanded = expanded === row.key;
              return (
                <div key={row.key}>
                  <div className="flex items-center px-3 py-1.5 gap-2 row-hover">
                    <button
                      type="button"
                      className="flex items-center gap-2.5 flex-1 text-left"
                      onClick={() => onToggleIndicator(row.key)}
                    >
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center border transition-colors"
                        style={{
                          background: enabled ? 'var(--accent)' : 'transparent',
                          borderColor: enabled ? 'var(--accent)' : 'var(--chart-border)',
                        }}
                      >
                        {enabled && <Check size={11} color="#fff" />}
                      </span>
                      <span style={{ color: 'var(--chart-text-bright)' }}>{row.label}</span>
                    </button>
                    {row.settingsBody && (
                      <button
                        type="button"
                        title={`${row.label} settings`}
                        onClick={() => setExpanded(isExpanded ? null : row.key)}
                        className="p-1 rounded transition-colors"
                        style={{ color: isExpanded ? 'var(--accent)' : 'var(--chart-text-dim)' }}
                      >
                        <Settings2 size={13} />
                      </button>
                    )}
                  </div>
                  {isExpanded && row.settingsBody && (
                    <div
                      className="mx-3 mb-2 px-3 py-2.5 rounded-md flex flex-col gap-2"
                      style={{ background: 'var(--chart-surface)' }}
                    >
                      {row.settingsBody(settings, onUpdateSettings)}
                    </div>
                  )}
                </div>
              );
            })}
          </MenuSurface>
        )}
      </div>

      <span className="flex-1" />

      {/* Right controls */}
      <ToolButton active={logScale} onClick={onToggleLogScale} title="Logarithmic price scale">
        log
      </ToolButton>
      <ToolButton onClick={onScreenshot} title="Download chart image">
        <Camera size={14} />
      </ToolButton>
      <ToolButton onClick={onFullscreen} title="Fullscreen">
        <Maximize2 size={14} />
      </ToolButton>
    </div>
  );
}
