/**
 * Canonical test users. The auth bootstrap helper ensures these exist via the
 * Supabase admin API and pre-creates `profiles` rows on first run.
 *
 * Use the `E2E_` prefix on every email so test users are easy to scrub from a
 * shared Supabase project.
 */
export type TestUserKey = 'aman' | 'ravi' | 'priya';

export interface TestUser {
  key: TestUserKey;
  email: string;
  nickname: string;
}

const PREFIX = process.env.E2E_TEST_PREFIX ?? 'E2E_';

export const TEST_USERS: Record<TestUserKey, TestUser> = {
  aman: { key: 'aman', email: 'e2e-aman@example.com', nickname: `${PREFIX}Aman` },
  ravi: { key: 'ravi', email: 'e2e-ravi@example.com', nickname: `${PREFIX}Ravi` },
  priya: { key: 'priya', email: 'e2e-priya@example.com', nickname: `${PREFIX}Priya` },
};

export function getTestUser(key: TestUserKey): TestUser {
  return TEST_USERS[key];
}
