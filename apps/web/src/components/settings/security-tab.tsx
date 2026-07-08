'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { changePassword } from '@/lib/settings/api';
import { ApiError } from '@/lib/api/http';

// Mirror of the backend validator (register.dto / change-password.dto): at least
// 6 chars, containing a letter and a number. The server stays the source of
// truth — this just catches obvious mistakes before the round trip.
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/;

export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearFields() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError('Fill in every field.');
      return;
    }
    if (!PASSWORD_RE.test(newPassword)) {
      setError(
        'New password must be at least 6 characters and include a letter and a number.',
      );
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New password and confirmation don’t match.');
      return;
    }

    setSaving(true);
    try {
      const res = await changePassword({ currentPassword, newPassword });
      clearFields();
      setSuccess(res.message || 'Password changed.');
    } catch (err) {
      if (err instanceof ApiError) {
        // 401 here means the current password was wrong (the page itself is
        // session-gated). 400 carries Nest's weak/duplicate message.
        setError(
          err.status === 401
            ? 'Current password is incorrect.'
            : err.status === 400
              ? err.message
              : 'Couldn’t change your password. Please try again.',
        );
      } else {
        setError('Can’t reach the server. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-tally">
      <h2 className="font-display text-lg font-semibold">Change password</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Re-enter your current password, then choose a new one — at least 6
        characters with a letter and a number.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex max-w-md flex-col gap-3">
        <label className="font-mono text-xs text-faint">Current password</label>
        <Input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••"
        />

        <label className="mt-1 font-mono text-xs text-faint">New password</label>
        <Input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
        />

        <label className="mt-1 font-mono text-xs text-faint">
          Confirm new password
        </label>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error ? (
          <p className="text-sm text-[color:var(--neg)]" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="text-sm text-[color:var(--pos)]" role="status">
            {success}
          </p>
        ) : null}

        <Button type="submit" className="mt-2 self-start" disabled={saving}>
          {saving ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </section>
  );
}
