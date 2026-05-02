import { test } from '@playwright/test';

/**
 * Leaderboard sort + filter checks. Most flows depend on at least one closed
 * session existing in the test DB, which in turn depends on session-pages.
 *
 * The pure render check is testable today as soon as the leaderboard page
 * exists (which it does in skeleton form), but writing through-the-UI flows
 * to seed data requires the detail page.
 */
test.describe('leaderboard', () => {
  test.fixme('closed sessions appear, open sessions do not', async () => {
    // pending: session-pages agent (need to close a session via UI).
  });

  test.fixme('sort orderings: net, win rate, biggest win', async () => {
    // pending: session-pages + leaderboard renderer with stable per-row test ids.
  });

  test.fixme('date filter inclusivity', async () => {
    // pending: session-pages.
  });
});
