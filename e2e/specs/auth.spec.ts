import { test, expect } from '@playwright/test';

import { SignInPage } from '../pages/SignInPage';
import { signInAs } from '../utils/auth';
import { hasE2EAdminEnv } from '../utils/env';
import { TEST_USERS } from '../fixtures/users';

const hasAdmin = hasE2EAdminEnv();

test.describe('auth', () => {
  test('sign-in page renders the magic-link form', async ({ page }) => {
    const sp = new SignInPage(page);
    await sp.goto();
    await sp.expectFormVisible();
  });

  test('anonymous user navigating to /sessions is redirected to /sign-in', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('programmatic sign-in lands on /sessions', async ({ browser }) => {
    test.skip(!hasAdmin, 'Supabase admin env vars not configured');

    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await signInAs(context, page, 'aman');
      // The /auth/callback handler redirects to ?next=/sessions or /sessions/<id>
      // depending on a pending invite cookie (none here).
      await page.waitForURL(/\/sessions(\/|$|\?)/, { timeout: 15_000 });
      await expect(page).toHaveURL(/\/sessions/);
    } finally {
      await context.close();
    }
  });

  test.fixme('sign-in form shows "Check your email" after submitting', async () => {
    // Submitting the real form calls Supabase auth; running it on every CI
    // pass would rate-limit our shared inbox. Re-enable once we have a
    // separate test project, or stub the Server Action.
  });

  // Reference list — keeps the spec self-documenting without unused imports.
  test.skip(`canonical test users are: ${Object.keys(TEST_USERS).join(', ')}`, async () => {
    /* documentation only */
  });
});
