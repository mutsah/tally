import type { SessionUser } from '@/lib/auth/session';

// Read-only for now: the backend has no profile (GET /me) or update-name
// endpoint yet, so we display what the session already carries. Editable display
// name + account-created date are a small backend follow-up (a users/profile
// GET+PATCH) — deliberately not faked here.
export function ProfileTab({ user }: { user: SessionUser }) {
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || '—';

  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: name },
    { label: 'Email', value: user.email },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-tally">
      <h2 className="font-display text-lg font-semibold">Profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your account details. Editing your name is coming in a later update.
      </p>

      <dl className="mt-4 max-w-md divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 py-3"
          >
            <dt className="font-mono text-xs text-faint">{row.label}</dt>
            <dd className="text-sm text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
