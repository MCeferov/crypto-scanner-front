import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '../ThemeToggle';

/**
 * Pre-auth access gate: the whole app is locked behind a single access code
 * known only to the owner. Unlock state lives in sessionStorage, so every
 * new browser session asks again. The code itself is never stored — only
 * its SHA-256 hash is compared.
 */
const GATE_KEY = 'app-gate-unlocked';
const GATE_HASH = 'a9156affe895aeb451b9d5494c6041d6fa0d6967d4773d3b3445cdfa7e96f833';

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readUnlocked(): boolean {
  try {
    return sessionStorage.getItem(GATE_KEY) === GATE_HASH;
  } catch {
    return false;
  }
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus();
  }, [unlocked]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const value = code.trim();
      if (!value || checking) return;
      setChecking(true);
      const hash = await sha256Hex(value.toLowerCase());
      if (hash === GATE_HASH) {
        try {
          sessionStorage.setItem(GATE_KEY, GATE_HASH);
        } catch {
          /* private mode — unlock for this render anyway */
        }
        setLeaving(true);
        setTimeout(() => setUnlocked(true), 350);
      } else {
        setError(true);
        setCode('');
        setChecking(false);
        setTimeout(() => setError(false), 600);
      }
    },
    [code, checking],
  );

  if (unlocked) return <>{children}</>;

  return (
    <div
      className={`gate-screen min-h-screen relative flex items-center justify-center px-4 overflow-hidden ${leaving ? 'gate-leave' : ''}`}
      style={{ background: 'var(--bg)' }}
    >
      {/* ambient glow */}
      <div aria-hidden className="gate-glow gate-glow-a" />
      <div aria-hidden className="gate-glow gate-glow-b" />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className={`relative w-full max-w-sm text-center ${error ? 'gate-shake' : ''}`}>
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 12px 40px rgba(41,98,255,.30)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--text)' }}>
          Private Access
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          This dashboard is private. Enter the access code to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="rounded-xl border transition-all duration-200"
            style={{
              background: 'var(--surface)',
              borderColor: error ? 'rgba(239,83,80,.6)' : 'var(--border)',
              boxShadow: error ? '0 0 0 3px rgba(239,83,80,.12)' : 'var(--card-shadow)',
            }}
          >
            <input
              ref={inputRef}
              type="password"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Access code"
              value={code}
              disabled={checking && !error}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Access code"
              aria-invalid={error}
              className="w-full bg-transparent text-center text-lg tracking-[0.35em] font-semibold px-4 py-3.5 outline-none placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
              style={{ color: 'var(--text)' }}
            />
          </div>

          <button
            type="submit"
            disabled={!code.trim() || checking}
            className="w-full rounded-xl py-3 font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 active:scale-[.98]"
            style={{
              background: 'var(--accent)',
              color: '#ffffff',
              boxShadow: '0 6px 20px rgba(41,98,255,.25)',
            }}
          >
            {checking && !error ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>

        <p
          className="mt-6 text-xs transition-opacity duration-300"
          style={{ color: error ? '#ef5350' : 'var(--dim)', minHeight: '1rem' }}
        >
          {error ? 'Wrong access code' : 'Authorized access only'}
        </p>
      </div>
    </div>
  );
}
