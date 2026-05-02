import { test, expect } from '@playwright/test';

import { signInAs } from '../utils/auth';
import { hasE2EAdminEnv } from '../utils/env';

const hasAdmin = hasE2EAdminEnv();

/**
 * RLS verification spec. The boundary fake doesn't replicate RLS, so this
 * suite exists to verify the production database actually enforces it.
 *
 * The pure-routing checks (anonymous → /sign-in, sign-out clears cookies)
 * are testable today. The "non-house cannot see buy-in button" check needs
 * the session detail page (session-pages agent).
 */
test.describe('permissions', () => {
  test('anonymous user is redirected from /sessions', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('anonymous user is redirected from /leaderboard', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('anonymous user is redirected from /profile', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('signed-in user can reach /sessions', async ({ browser }) => {
    test.skip(!hasAdmin, 'Supabase admin env vars not configured');

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signInAs(ctx, page, 'aman');
      await page.goto('/sessions');
      await expect(page).toHaveURL(/\/sessions/);
    } finally {
      await ctx.close();
    }
  });

  test.fixme('non-participant cannot see buy-in controls (RLS + UI hide)', async () => {
    // pending: session-pages agent — needs the detail page rendered.
  });

  test.fixme('non-house cannot close session (RLS + UI hide)', async () => {
    // pending: session-pages agent.
  });
});
