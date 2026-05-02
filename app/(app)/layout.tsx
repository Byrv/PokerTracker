import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shared';
import { getModules } from '@/lib/modules';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { auth } = await getModules();
  const me = await auth.getCurrentUser();
  if (!me) redirect('/sign-in');

  return (
    <AppShell user={{ nickname: me.nickname, email: me.email, avatarUrl: me.avatarUrl }}>
      {children}
    </AppShell>
  );
}
