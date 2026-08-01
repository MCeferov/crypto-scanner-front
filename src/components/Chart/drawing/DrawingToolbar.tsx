import React from 'react';
import {
  MousePointer2, TrendingUp, Minus, ArrowRight, ArrowUpDown,
  Square, Pencil, Type, Ruler, Magnet, Eye, EyeOff, Eraser, Trash2,
  ZoomIn, ZoomOut,
} from 'lucide-react';
import type { DrawingTool } from './drawingTypes';

interface DrawingToolbarProps {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  magnet: boolean;
  onToggleMagnet: () => void;
  drawingsVisible: boolean;
  onToggleVisible: () => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const TOOL_DEFS: { tool: DrawingTool; icon: React.ReactNode; title: string }[] = [
  { tool: 'none', icon: <MousePointer2 size={15} />, title: 'Crosshair / Select' },
  { tool: 'trend', icon: <TrendingUp size={15} />, title: 'Trend Line' },
  { tool: 'hline', icon: <Minus size={15} />, title: 'Horizontal Line' },
  { tool: 'hray', icon: <ArrowRight size={15} />, title: 'Horizontal Ray' },
  { tool: 'vline', icon: <ArrowUpDown size={15} />, title: 'Vertical Line' },
  { tool: 'rect', icon: <Square size={15} />, title: 'Rectangle' },
  { tool: 'brush', icon: <Pencil size={15} />, title: 'Brush' },
  { tool: 'text', icon: <Type size={15} />, title: 'Text' },
  { tool: 'ruler', icon: <Ruler size={15} />, title: 'Ruler / Measure' },
];

function SideButton({
  active, disabled, onClick, title, children,
}: {
  active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
      style={{
        color: disabled
          ? 'var(--chart-text-dim)'
          : active ? 'var(--accent)' : 'var(--chart-text)',
        background: active ? 'var(--accent-soft)' : 'transparent',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = 'var(--chart-surface)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

/** TradingView-style sol drawing toolbar */
export function DrawingToolbar({
  tool, onToolChange, magnet, onToggleMagnet, drawingsVisible, onToggleVisible,
  hasSelection, onDeleteSelected, onClearAll, onZoomIn, onZoomOut,
}: DrawingToolbarProps) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 py-1.5 px-1 border-r shrink-0 overflow-y-auto"
      style={{ borderColor: 'var(--chart-border)', background: 'var(--chart-bg)' }}
    >
      {TOOL_DEFS.map(def => (
        <SideButton
          key={def.tool}
          active={tool === def.tool}
          title={def.title}
          onClick={() => onToolChange(tool === def.tool && def.tool !== 'none' ? 'none' : def.tool)}
        >
          {def.icon}
        </SideButton>
      ))}

      <div className="w-5 h-px my-1" style={{ background: 'var(--chart-border)' }} />

      <SideButton active={magnet} title="Magnet (OHLC snap)" onClick={onToggleMagnet}>
        <Magnet size={15} />
      </SideButton>
      <SideButton title={drawingsVisible ? 'Hide drawings' : 'Show drawings'} onClick={onToggleVisible}>
        {drawingsVisible ? <Eye size={15} /> : <EyeOff size={15} />}
      </SideButton>

      <div className="w-5 h-px my-1" style={{ background: 'var(--chart-border)' }} />

      <SideButton title="Zoom in" onClick={onZoomIn}>
        <ZoomIn size={15} />
      </SideButton>
      <SideButton title="Zoom out" onClick={onZoomOut}>
        <ZoomOut size={15} />
      </SideButton>

      <div className="w-5 h-px my-1" style={{ background: 'var(--chart-border)' }} />

      <SideButton title="Delete selected (Del)" disabled={!hasSelection} onClick={onDeleteSelected}>
        <Eraser size={15} />
      </SideButton>
      <SideButton title="Delete all drawings" onClick={onClearAll}>
        <Trash2 size={15} />
      </SideButton>
    </div>
  );
}
