import React, { useState } from 'react';
import { Redirect } from 'wouter';
import { useAuth, mapAuthError } from '../context/AuthContext';
import { AuthLayout, AuthLink } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The moment login() succeeds, isAuthenticated flips and this Redirect
  // navigates — no success banner or timer can ever run after it.
  if (isAuthenticated) return <Redirect to="/dashboard" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(mapAuthError(err));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your crypto scanner dashboard"
      footer={<>Don&apos;t have an account? <AuthLink href="/register">Create one</AuthLink></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm border"
            style={{ background: 'rgba(239,83,80,.08)', borderColor: 'rgba(239,83,80,.25)', color: '#ef5350' }}>
            {error}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
            required
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            Password
          </label>
          <Input
            id="login-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
            required
            minLength={8}
            className="h-11"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </AuthLayout>
  );
}
