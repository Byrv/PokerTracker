/**
 * Playwright globalTeardown. Selectively scrubs test sessions and their
 * cascading rows (buy-ins, cashouts, audit log entries, participants) by the
 * `E2E_TEST_PREFIX` tag. Does NOT touch profile rows or auth.users — those
 * are stable across runs.
 */
import { cleanupTestSessions } from './cleanup';
import { hasE2EAdminEnv } from './env';
import { loadDotEnvLocal } from './load-env';

async function globalTeardown(): Promise<void> {
  loadDotEnvLocal();

  if (!hasE2EAdminEnv()) return;

  try {
    const { deleted } = await cleanupTestSessions();
    if (deleted > 0) {
      console.log(`[e2e] cleanup: deleted ${deleted} test session(s)`);
    }
  } catch (err) {
    console.warn(`[e2e] teardown error: ${(err as Error).message}`);
  }
}

export default globalTeardown;
