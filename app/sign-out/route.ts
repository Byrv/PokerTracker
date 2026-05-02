import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/db/server';

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', request.url));
}

export async function GET(request: Request) {
  return POST(request);
}
