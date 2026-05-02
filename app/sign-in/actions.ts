'use server';

import { getModules } from '@/lib/modules';

export async function signInAction(email: string, redirectTo: string) {
  const { auth } = await getModules();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  await auth.signInWithMagicLink(
    email,
    `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
  );
}
