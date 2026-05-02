/**
 * Playwright globalSetup. Runs once before any spec.
 *
 *  - Loads .env.local manually (Playwright doesn't auto-import Next's env).
 *  - Pre-creates the canonical test users so signInAs() is fast on first call.
 *
 * Does NOT reset the DB. We share the dev Supabase project; a wholesale reset
 * would nuke real data. Cleanup is selective and runs in globalTeardown.
 */
import { TEST_USERS } from '../fixtures/users';
import { ensureTestUser } from './auth';
import { hasE2EAdminEnv } from './env';
import { loadDotEnvLocal } from './load-env';

async function globalSetup(): Promise<void> {
  // Load .env.local explicitly. Playwright doesn't run inside Next.
  loadDotEnvLocal();

  if (!hasE2EAdminEnv()) {
    console.warn(
      '[e2e] Supabase env vars not found. Specs that need auth will be skipped at runtime.',
    );
    return;
  }

  // Pre-create users so the first specs aren't slowed down by /listUsers calls.
  for (const user of Object.values(TEST_USERS)) {
    try {
      await ensureTestUser(user);
    } catch (err) {
      console.warn(`[e2e] failed to pre-create ${user.email}: ${(err as Error).message}`);
    }
  }
}

export default globalSetup;
