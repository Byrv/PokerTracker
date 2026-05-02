/**
 * Programmatic auth bootstrap. We bypass the magic-link email flow entirely:
 *
 *  1. Ensure the test user exists (via admin.createUser; idempotent).
 *  2. Ensure a `profiles` row exists for the user (the production code is
 *     supposed to create one on first sign-in, but we don't trust that yet).
 *  3. Generate a magiclink via admin.generateLink — this returns the same
 *     `?code=...` URL the email would contain.
 *  4. Hit the app's /auth/callback endpoint with the code. The Server Action
 *     exchanges it for a real session and sets the Supabase SSR cookies on the
 *     browser context.
 *
 * After this returns, the Playwright `page` is fully signed in.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { getAdminClient } from './admin-client';
import { TEST_USERS, type TestUser, type TestUserKey, getTestUser } from '../fixtures/users';

const ensured = new Set<string>();

/** Idempotently ensure a test user exists in auth.users + profiles. Returns the user id. */
export async function ensureTestUser(userOrKey: TestUser | TestUserKey): Promise<string> {
  const user = typeof userOrKey === 'string' ? getTestUser(userOrKey) : userOrKey;
  const admin = getAdminClient();

  // 1. Ensure the auth user exists.
  let userId: string | null = null;
  // listUsers paginates — for E2E we only have a handful, so page 1 is enough.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === user.email);
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }
  if (!userId) throw new Error(`failed to ensure user ${user.email}`);

  // 2. Ensure profile row exists with our prefixed nickname.
  if (!ensured.has(userId)) {
    const { error: upErr } = await admin
      .from('profiles')
      .upsert({ user_id: userId, nickname: user.nickname }, { onConflict: 'user_id' });
    // The schema's exact column set may differ; if upsert fails, fall back to the
    // production code path on first sign-in.
    if (upErr) {
      console.warn(`[e2e] could not upsert profile for ${user.email}: ${upErr.message}`);
    }
    ensured.add(userId);
  }

  return userId;
}

/**
 * Sign a Playwright page in as the given test user, bypassing the magic-link
 * email entirely. Goes through the app's real /auth/callback so cookies are
 * set the same way the production code sets them.
 */
export async function signInAs(
  context: BrowserContext,
  page: Page,
  userOrKey: TestUser | TestUserKey,
): Promise<TestUser> {
  const user = typeof userOrKey === 'string' ? getTestUser(userOrKey) : userOrKey;
  await ensureTestUser(user);

  const admin = getAdminClient();
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
    options: {
      redirectTo: `${baseUrl}/auth/callback?next=/sessions`,
    },
  });
  if (error) throw error;

  // generateLink returns `properties.action_link` — the URL the email would link to.
  const actionLink = data.properties?.action_link;
  if (!actionLink) throw new Error('admin.generateLink did not return action_link');

  // Hit the action link. Supabase verifies, redirects through our /auth/callback,
  // which exchanges the code and sets the SSR cookies. Playwright follows redirects.
  await page.goto(actionLink, { waitUntil: 'commit' });
  // We don't assert URL here — callers will, since redirects depend on `pending_invite`.
  return user;
}

/** Convenience: opens a fresh context and signs in. Returns both for cleanup. */
export async function newSignedInContext(
  browser: import('@playwright/test').Browser,
  userOrKey: TestUser | TestUserKey,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(context, page, userOrKey);
  return { context, page };
}

export { TEST_USERS };
