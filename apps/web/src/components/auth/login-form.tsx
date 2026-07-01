'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.ok) {
        router.replace('/dashboard');
        router.refresh();
        return;
      }
      setError(
        res.status === 401
          ? 'Invalid email or password.'
          : res.status === 429
            ? 'Too many attempts — please wait a moment.'
            : 'Something went wrong. Please try again.',
      );
    } catch {
      setError('Can’t reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 text-left">
      <label className="font-mono text-xs text-faint">Email</label>
      <Input
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <label className="mt-1 font-mono text-xs text-faint">Password</label>
      <Input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
      />

      {error ? (
        <p className="text-sm text-[color:var(--neg)]" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="mt-2" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="mt-1 text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link href="/register" className="text-[color:var(--gold)] font-medium">
          Create an account
        </Link>
      </p>
    </form>
  );
}
