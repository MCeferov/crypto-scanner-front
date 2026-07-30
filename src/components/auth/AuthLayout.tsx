import React from 'react';
import { Link } from 'wouter';
import { ThemeToggle } from '../ThemeToggle';
import { LanguageSwitcher } from '../Controls/LanguageSwitcher';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div aria-hidden className="gate-glow gate-glow-a" />
      <div aria-hidden className="gate-glow gate-glow-b" />
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md relative">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-base"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            C
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--text)' }}>
            Crypto Scanner
          </span>
        </div>

        <div
          className="rounded-xl p-8 border shadow-lg"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>{title}</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{subtitle}</p>
          {children}
        </div>

        {footer && (
          <div className="text-center mt-6 text-sm" style={{ color: 'var(--muted)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-semibold hover:underline"
      style={{ color: 'var(--accent)' }}
    >
      {children}
    </Link>
  );
}
