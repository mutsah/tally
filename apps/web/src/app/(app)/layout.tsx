import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

// (app) route group — the authenticated app shell. Middleware already gates
// access; this re-checks server-side and supplies the session to the shell.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-col">
        <Topbar user={user} />
        {/* Full-bleed content: fill the region right of the sidebar with
            consistent page gutters (matches the dashboard reference — no
            centered max-width column). Every app page inherits this. */}
        <main className="w-full min-w-0 flex-1 px-6 pb-10 pt-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
