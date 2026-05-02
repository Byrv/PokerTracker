import { test } from '@playwright/test';

/**
 * Profile page checks. Depend on profile-pages agent committing
 * `app/(app)/profile/[id]/**`.
 */
test.describe('profile', () => {
  test.fixme('own profile: edit nickname, save, reflect on leaderboard', async () => {
    // pending: profile-pages agent.
  });

  test.fixme('other user profile is read-only', async () => {
    // pending: profile-pages agent.
  });

  test.fixme('bankroll-over-time chart renders after one closed session', async () => {
    // pending: profile-pages + session-pages (need a closed session).
  });
});
