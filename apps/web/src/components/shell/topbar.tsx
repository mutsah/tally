import { Bell, Search } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';

export function Topbar({ user }: { user: SessionUser }) {
  const name = user.firstName?.trim() || 'there';
  const initial = (user.firstName?.[0] || user.email[0] || 'T').toUpperCase();

  return (
    <header className="relative z-10 px-6 pt-6 md:px-8">
      {/* Divider is inset to the content gutters (not full-bleed): a faint 1px
          hairline plus a soft downward shadow so the header reads as a bar. */}
      <div className="flex items-center gap-4 border-b border-border pb-2 shadow-[0_8px_16px_-12px_rgba(19,36,29,0.18)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--surface)] bg-gradient-to-br from-pine-soft to-pine font-display text-lg font-semibold text-[color:var(--surface)] shadow-tally">
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl">Welcome back, {name}</h1>
            <p className="text-muted-foreground text-sm">
              Here’s where your money stands today.
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden min-w-[230px] items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-faint sm:flex">
            <Search className="size-4" />
            <input
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
              placeholder="Search transactions…"
              aria-label="Search"
              disabled
            />
          </div>
          <button
            type="button"
            className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-card text-pine"
            aria-label="Notifications"
          >
            <span className="absolute right-2.5 top-2.5 size-[7px] rounded-full border border-[color:var(--surface)] bg-gold" />
            <Bell className="size-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
