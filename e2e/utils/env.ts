/**
 * Tiny env helpers. `.env.local` for this project sets some E2E_* keys to
 * empty strings as placeholders (so the file documents them); we treat empty
 * strings the same as unset.
 */
export function envOrFallback(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function hasE2EAdminEnv(): boolean {
  const url = envOrFallback('E2E_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const key = envOrFallback('E2E_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  return Boolean(url && key);
}
