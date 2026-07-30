import React, { useRef, useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useMarket, type FilterKey } from '../../context/MarketContext';
import { useT } from '../../context/LocaleContext';
import {
  FILTER_DEFS, DEFAULT_FILTER_KEYS, OPTIONAL_FILTER_KEYS, getFilterDef,
} from './filterConfig';

/**
 * One accent for every active filter — the previous per-filter colors
 * (gold/teal/red chips side by side) read as noise, not information.
 */
function FilterButton({
  active, onClick, onRemove, label,
}: {
  f: { key: FilterKey; color?: string };
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1 whitespace-nowrap"
      style={{
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--muted)',
        border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); onRemove(); }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onRemove(); }
          }}
          className="ml-0.5 opacity-50 hover:opacity-100"
          style={{ lineHeight: 1 }}
        >
          <X size={10} />
        </span>
      )}
    </button>
  );
}

export function FilterControls() {
  const {
    filter, setFilter,
    visibleOptionalFilters, addOptionalFilter, removeOptionalFilter,
  } = useMarket();
  const t = useT();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const defaultFilters = FILTER_DEFS.filter(f => DEFAULT_FILTER_KEYS.includes(f.key));
  const activeOptional = FILTER_DEFS.filter(f => visibleOptionalFilters.includes(f.key));
  const availableOptional = OPTIONAL_FILTER_KEYS.filter(
    k => !visibleOptionalFilters.includes(k),
  );

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {defaultFilters.map(f => (
        <FilterButton
          key={f.key}
          f={f}
          label={t(f.labelKey)}
          active={filter === f.key}
          onClick={() => setFilter(f.key)}
        />
      ))}

      {activeOptional.map(f => (
        <FilterButton
          key={f.key}
          f={f}
          label={t(f.labelKey)}
          active={filter === f.key}
          onClick={() => setFilter(f.key)}
          onRemove={() => removeOptionalFilter(f.key)}
        />
      ))}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="text-xs px-2 py-1.5 rounded-md transition-all flex items-center gap-1"
          style={{
            background: menuOpen ? 'var(--elevated)' : 'var(--surface)',
            color: 'var(--muted)',
            border: `1px solid ${menuOpen ? 'var(--border-lite)' : 'var(--border)'}`,
          }}
          title={t('filter.addFilter')}
        >
          <Plus size={14} />
        </button>

        {menuOpen && availableOptional.length > 0 && (
          <div
            className="absolute left-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[140px] shadow-lg"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            {availableOptional.map(key => {
              const def = getFilterDef(key);
              if (!def) return null;
              return (
                <button
                  key={key}
                  onClick={() => { addOptionalFilter(key); setMenuOpen(false); }}
                  className="w-full text-left text-xs px-3 py-2 row-hover transition-colors"
                  style={{ color: 'var(--text)' }}
                >
                  {t(def.labelKey)}
                </button>
              );
            })}
          </div>
        )}

        {menuOpen && availableOptional.length === 0 && (
          <div
            className="absolute left-0 top-full mt-1 z-50 rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--dim)' }}
          >
            {t('filter.allAdded')}
          </div>
        )}
      </div>
    </div>
  );
}
