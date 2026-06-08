import React, { useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useAuth, mapAuthError } from '../context/AuthContext';
import { AuthLayout, AuthLink } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (isAuthenticated) return <Redirect to="/dashboard" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      await login(email, password);
      setSuccess('Login successful! Redirecting…');
      setTimeout(() => setLocation('/dashboard'), 600);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
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
        {success && (
          <div className="rounded-lg px-4 py-3 text-sm border"
            style={{ background: 'rgba(38,166,154,.08)', borderColor: 'rgba(38,166,154,.25)', color: '#26a69a' }}>
            {success}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            Email
          </label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            Password
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
            required
            minLength={8}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </AuthLayout>
  );
}
