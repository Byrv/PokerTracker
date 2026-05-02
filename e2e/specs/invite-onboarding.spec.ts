import { test, expect } from '@playwright/test';

/**
 * Invite-onboarding flows: pending_invite cookie, invalid token, closed session.
 *
 * STATUS: only the "invalid token" path is currently testable end-to-end —
 * the join page is implemented, but the live happy path requires the session
 * detail page to render, which is owned by the session-pages agent.
 */
test.describe('invite onboarding', () => {
  test('anonymous user hitting an invite URL is bounced to sign-in', async ({ page }) => {
    await page.goto('/join/__definitely-not-a-real-token__');
    // For anonymous users, the join page stashes a pending_invite cookie and
    // redirects to /sign-in?redirectTo=/join/<token>. The bad-token check
    // runs only AFTER sign-in.
    //
    // Note: Next 16 RC server-component redirects can take a beat — be
    // generous with the timeout. We assert via expect.poll so we tolerate a
    // transient intermediate page render.
    await expect
      .poll(() => page.url(), { timeout: 20_000, intervals: [200, 500, 1000] })
      .toMatch(/\/sign-in/);
    expect(page.url()).toContain('redirectTo');
  });

  test.fixme('invite link from open session signs new user in and adds them as participant', async () => {
    // pending: session-pages agent — needs a session detail page to land on.
  });

  test.fixme('invite link from closed session shows clear error after sign-in', async () => {
    // pending: session-pages agent.
  });
});
