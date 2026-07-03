'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navGroups } from './nav-config';
import { QuickAdd } from '@/components/quick-add/quick-add';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-1.5 bg-pine px-4 pb-4 pt-5 text-white/75 md:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span className="flex size-7 items-center justify-center rounded-[9px] bg-gold text-pine-deep">
          <Sprout className="size-4" />
        </span>
        <span className="font-display text-lg font-semibold text-[color:var(--surface)]">
          Tally
        </span>
      </div>

      {/* Nav groups */}
      <nav className="flex flex-col gap-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 px-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white/40">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'mb-0.5 flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-gold font-semibold text-pine-deep'
                      : 'text-white/75 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Log out (an action, styled as a nav item) */}
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
        >
          <LogOut className="size-[18px] shrink-0" />
          {loggingOut ? 'Signing out…' : 'Log out'}
        </button>
      </nav>

      {/* Quick add — the signature create flow (F3). */}
      <QuickAdd />
    </aside>
  );
}
