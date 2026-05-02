import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getModules } from '@/lib/modules';

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { auth } = await getModules();
  const me = await auth.getCurrentUser();

  if (me) {
    let sessionId: string | null = null;
    try {
      sessionId = await auth.joinSessionByToken(token);
    } catch {
      return (
        <main className="flex min-h-svh items-center justify-center p-6">
          <div className="max-w-sm space-y-2 text-center">
            <h1 className="text-2xl font-semibold">Invalid invite</h1>
            <p className="text-sm text-neutral-500">
              This invite is no longer valid or the session has closed.
            </p>
          </div>
        </main>
      );
    }
    redirect(`/sessions/${sessionId}`);
  }

  const cookieStore = await cookies();
  cookieStore.set('pending_invite', token, {
    httpOnly: true,
    maxAge: 3600,
    path: '/',
  });
  redirect(`/sign-in?redirectTo=${encodeURIComponent(`/join/${token}`)}`);
}
