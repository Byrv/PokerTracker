import { test, expect } from '@playwright/test';

import { TEST_USERS } from '../fixtures/users';
import { LeaderboardPage } from '../pages/LeaderboardPage';
import { NewSessionPage } from '../pages/NewSessionPage';
import { ProfilePage } from '../pages/ProfilePage';
import { SessionDetailPage } from '../pages/SessionDetailPage';
import { SessionsListPage } from '../pages/SessionsListPage';
import { signInAs } from '../utils/auth';
import { hasE2EAdminEnv } from '../utils/env';

/**
 * The centerpiece spec — covers the full critical path described in
 * `plans/e2e.md`. Each step is its own `test.step` so the trace shows the
 * journey clearly.
 *
 * STATUS: pending session-pages, profile-pages, leaderboard-pages agents.
 *
 * The session-pages agent owns `app/(app)/sessions/[id]/**`, the leaderboard
 * agent owns the leaderboard listing render, and profile-pages owns the
 * `/profile/[id]/**` history view. None of those are committed yet, so the
 * test is wrapped in `test.fixme(true, ...)`. The orchestrator should flip
 * this to a regular `test(...)` once those siblings land.
 */
const hasAdmin = hasE2EAdminEnv();

test.describe('session lifecycle', () => {
  test.fixme(true, 'pending: session-pages + leaderboard-pages + profile-pages agents');

  test('full critical path: invite → buy-ins → cashouts → close → leaderboard + history', async ({
    browser,
  }) => {
    test.skip(!hasAdmin, 'Supabase admin env vars not configured');

    const sessionName = `${process.env.E2E_TEST_PREFIX ?? 'E2E_'}${Date.now()}`;

    // 1. Aman signs in.
    const amanCtx = await browser.newContext();
    const amanPage = await amanCtx.newPage();
    await signInAs(amanCtx, amanPage, 'aman');

    let inviteUrl = '';
    let sessionId = '';

    await test.step('Aman creates a session', async () => {
      const list = new SessionsListPage(amanPage);
      await list.goto();
      await list.clickNew();

      const form = new NewSessionPage(amanPage);
      await form.createSession({
        name: sessionName,
        location: 'E2E Lab',
        blinds: { small: 5, big: 10 },
      });
      await expect(amanPage).toHaveURL(/\/sessions\/[0-9a-f-]+$/);
      sessionId = amanPage.url().split('/').pop()!;
    });

    const amanDetail = new SessionDetailPage(amanPage);
    await test.step('Aman generates an invite URL', async () => {
      inviteUrl = await amanDetail.getInviteUrl();
      expect(inviteUrl).toMatch(/\/join\//);
    });

    // 2. Ravi joins via invite in a fresh context.
    const raviCtx = await browser.newContext();
    const raviPage = await raviCtx.newPage();
    await test.step('Ravi follows invite, signs in, lands on the session', async () => {
      await raviPage.goto(inviteUrl);
      // Fresh context — Ravi will be bounced to /sign-in with the invite stashed.
      // We bypass the magic-link by signing him in programmatically; the
      // /auth/callback will then consume the pending_invite cookie.
      await signInAs(raviCtx, raviPage, 'ravi');
      await raviPage.waitForURL(new RegExp(`/sessions/${sessionId}$`), { timeout: 15_000 });
    });

    // 3. Aman records buy-ins.
    await test.step('Aman records buy-ins for both players', async () => {
      await amanDetail.recordBuyin(TEST_USERS.aman.nickname, 500);
      await amanDetail.recordBuyin(TEST_USERS.ravi.nickname, 500);
    });

    // 4. Ravi submits cashout.
    await test.step('Ravi submits his cashout', async () => {
      const raviDetail = new SessionDetailPage(raviPage);
      await raviDetail.submitCashout(30000);
    });

    // 5. Aman submits his own cashout, confirms both.
    await test.step('Aman submits + confirms all cashouts', async () => {
      await amanDetail.submitCashout(70000);
      await amanDetail.confirmCashoutFor(TEST_USERS.ravi.nickname);
      await amanDetail.confirmCashoutFor(TEST_USERS.aman.nickname);
    });

    // 6. Aman closes the session.
    await test.step('Aman closes the session', async () => {
      await amanDetail.closeSession();
      await amanDetail.expectClosed();
    });

    // 7. Leaderboard reflects the closed session.
    await test.step('Leaderboard shows the closed session', async () => {
      const lb = new LeaderboardPage(amanPage);
      await lb.goto({ sort: 'net' });
      await lb.expectLoaded();
      await lb.expectPlayerVisible(TEST_USERS.aman.nickname);
      await lb.expectPlayerVisible(TEST_USERS.ravi.nickname);
    });

    // 8. Profile history shows the new session.
    await test.step("Aman's profile lists the new session", async () => {
      const profile = new ProfilePage(amanPage);
      await profile.gotoSelf();
      await profile.expectSessionInHistory(sessionName);
    });

    await amanCtx.close();
    await raviCtx.close();
  });
});
