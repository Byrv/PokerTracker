import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/db/server';
import { getModules } from '@/lib/modules';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/sessions';

  if (code) {
    const supabase = await getServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const pending = req.cookies.get('pending_invite')?.value;
  if (pending) {
    try {
      const { auth } = await getModules();
      const sessionId = await auth.joinSessionByToken(pending);
      const res = NextResponse.redirect(new URL(`/sessions/${sessionId}`, req.url));
      res.cookies.delete('pending_invite');
      return res;
    } catch {
      const res = NextResponse.redirect(new URL(next, req.url));
      res.cookies.delete('pending_invite');
      return res;
    }
  }

  return NextResponse.redirect(new URL(next, req.url));
}
