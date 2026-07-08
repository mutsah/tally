import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { SettingsView } from '@/components/settings/settings-view';

// Server component: the profile shown in Settings comes from the F1 session
// (the backend has no /auth/me endpoint yet). Middleware already gates /settings;
// this re-checks server-side so SettingsView always has a user.
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <SettingsView user={session} />;
}
