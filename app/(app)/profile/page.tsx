import { redirect } from 'next/navigation';
import { getModules } from '@/lib/modules';

export default async function ProfileRedirect() {
  const { auth } = await getModules();
  const me = await auth.requireUser();
  redirect(`/profile/${me.id}`);
}
