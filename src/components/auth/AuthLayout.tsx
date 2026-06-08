import React from 'react';
import { Link } from 'wouter';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-base"
            style={{ background: 'linear-gradient(135deg,#f0b90b,#f59e0b)', color: '#0a0e17' }}
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
            boxShadow: '0 8px 32px rgba(0,0,0,.25)',
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
      style={{ color: '#f0b90b' }}
    >
      {children}
    </Link>
  );
}
