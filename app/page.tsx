import { redirect } from 'next/navigation';
import { getModules } from '@/lib/modules';

export default async function Landing() {
  const { auth } = await getModules();
  const me = await auth.getCurrentUser();
  redirect(me ? '/sessions' : '/sign-in');
}
