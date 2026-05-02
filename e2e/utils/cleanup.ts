/**
 * Test data cleanup. Uses the admin client to scrub anything created by an
 * E2E run. Identifying tag: session.name LIKE `${E2E_TEST_PREFIX}%`.
 *
 * Run from globalTeardown (post-suite) or on-demand. Buy-ins / cashouts /
 * audit_log / participants all FK to sessions, so deleting sessions cascades.
 *
 * Profile rows for test users persist across runs by design (they're keyed by
 * a stable email); their nicknames also carry the prefix so they're trivially
 * filterable.
 */
import { getAdminClient } from './admin-client';

const PREFIX = process.env.E2E_TEST_PREFIX ?? 'E2E_';

export async function cleanupTestSessions(): Promise<{ deleted: number }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('sessions')
    .delete()
    .like('name', `${PREFIX}%`)
    .select('id');
  if (error) {
    console.warn(`[e2e] cleanup error: ${error.message}`);
    return { deleted: 0 };
  }
  return { deleted: data?.length ?? 0 };
}
