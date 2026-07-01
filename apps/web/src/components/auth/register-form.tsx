'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
// Mirror the backend rule: ≥6 chars, at least one letter and one number.
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

export function RegisterForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!PASSWORD_RE.test(password)) {
      setError(
        'Password must be at least 6 characters and include a letter and a number.',
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      if (res.ok) {
        router.replace('/dashboard');
        router.refresh();
        return;
      }
      setError(
        res.status === 409
          ? 'An account with that email already exists.'
          : res.status === 400
            ? 'Please check your details and try again.'
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
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="font-mono text-xs text-faint">First name</label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Divine"
            autoComplete="given-name"
          />
        </div>
        <div className="flex-1">
          <label className="font-mono text-xs text-faint">Last name</label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Mutsah"
            autoComplete="family-name"
          />
        </div>
      </div>
      <label className="mt-1 font-mono text-xs text-faint">Email</label>
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
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 6 chars, a letter and a number"
      />

      {error ? (
        <p className="text-sm text-[color:var(--neg)]" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="mt-2" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="mt-1 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-[color:var(--gold)] font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
}
