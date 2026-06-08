import React, { useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useAuth, mapAuthError } from '../context/AuthContext';
import { AuthLayout, AuthLink } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export function RegisterPage() {
  const { signup, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (isAuthenticated) return <Redirect to="/dashboard" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (username.trim().length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }
    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await signup(username, email, password);
      setSuccess('Account created! Redirecting…');
      setTimeout(() => setLocation('/dashboard'), 600);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Join Crypto Scanner for professional market analysis"
      footer={<>Already have an account? <AuthLink href="/login">Sign in</AuthLink></>}
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
            Username
          </label>
          <Input
            type="text"
            placeholder="trader_pro"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            disabled={loading}
            required
            minLength={3}
            maxLength={50}
          />
        </div>

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
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
            required
            minLength={8}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            Confirm Password
          </label>
          <Input
            type="password"
            placeholder="Repeat password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
            required
            minLength={8}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
