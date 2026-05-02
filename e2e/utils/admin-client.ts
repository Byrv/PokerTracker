/**
 * Service-role Supabase admin client for E2E specs. Bypasses RLS — only used
 * from utility code (auth bootstrap, seed, teardown). Specs themselves talk to
 * the running app, never to this client directly.
 */
// E2E utilities need the service-role admin client (auth.admin.* APIs) which
// the DbBoundary deliberately doesn't expose.
// eslint-disable-next-line no-restricted-imports
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';

let cached: SupabaseClient<Database> | null = null;

export function getAdminClient(): SupabaseClient<Database> {
  if (cached) return cached;
  const url =
    (process.env.E2E_SUPABASE_URL?.trim() || undefined) ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    (process.env.E2E_SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined) ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'E2E admin client requires (E2E_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) ' +
        'and (E2E_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY).',
    );
  }
  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function getAdminUrl(): string {
  return process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

export function getAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
