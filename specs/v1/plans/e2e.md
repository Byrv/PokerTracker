# End-to-End Testing Plan

Separate from unit/integration testing (`plans/testing.md`). E2E covers the **real** stack: a running Next.js app talking to a real Supabase project, exercised through Playwright.

Runs in **Phase 2**, in parallel with `frontend.md` page-group agents. A single Playwright agent owns this plan.

---

## Goals

- Verify the **critical path** end-to-end: sign-in → join → buy-in → cash-out → close → leaderboard updates.
- Verify **RLS** in practice (which the boundary fake does NOT replicate).
- Verify the **real auth flow** including magic-link + invite-token paths.
- Catch regressions in **Server Action / revalidation** behavior that unit tests miss.
- Lighthouse PWA install gate.

E2E does NOT replace unit tests. We keep this suite small and fast — exhaustive coverage lives in module tests.

---

## Tooling

```bash
pnpm add -D @playwright/test
pnpm dlx playwright install --with-deps
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['iPhone 13'] } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
```

Two project lanes: mobile and desktop. Both run on every push.

---

## Test environment

- Dedicated Supabase project for E2E (separate from prod). Connection string in `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY`.
- Before each test run: reset DB via `supabase db reset` against the E2E project (or run a fresh local Supabase via `supabase start` in CI).
- Seeded with the same fixture as unit tests (`supabase/seed.sql`).
- Magic-link emails are intercepted via Supabase's test-mode token endpoint (avoid real email).

---

## Folder layout

```
e2e/
├── specs/                         # one file per critical journey
│   ├── auth.spec.ts
│   ├── session-lifecycle.spec.ts
│   ├── ledger-edits.spec.ts
│   ├── leaderboard.spec.ts
│   ├── profile.spec.ts
│   ├── invite-onboarding.spec.ts
│   ├── notes-photos.spec.ts
│   ├── export.spec.ts
│   ├── permissions.spec.ts        # RLS + house-only UI
│   └── pwa.spec.ts
├── fixtures/
│   ├── users.ts                   # canonical user data
│   └── auth.ts                    # `loginAs(page, user)` helper
├── pages/                         # Page Object Models
│   ├── SignInPage.ts
│   ├── SessionsPage.ts
│   ├── SessionDetailPage.ts
│   ├── LeaderboardPage.ts
│   └── ProfilePage.ts
└── utils/
    ├── reset-db.ts
    ├── magic-link.ts              # fetches the link from Supabase test API
    └── assertions.ts              # custom expects (e.g. expectMoneyEquals)
```

Page Object Model: every page in the app has a class wrapping the locators and actions, so specs read like prose.

---

## Critical-path specs (must always pass)

### `auth.spec.ts`
- Sign in as Aman via magic link → redirected to `/sessions`.
- Sign out clears the session; `/sessions` redirects to `/sign-in`.
- Invalid magic-link code shows error.

### `session-lifecycle.spec.ts` (the centerpiece)
The **single most important** spec — covers the full critical path.
```
1. Login as Aman.
2. Create a session: name, location, blinds, no participants beyond self.
3. Generate invite link.
4. In a second browser context: open the invite as Ravi (not signed in) → magic-link sign-in → land on the session as a participant.
5. Repeat for Priya.
6. As Aman: record buy-in (₹500) for each player.
7. As Aman: record a rebuy for Ravi (₹500).
8. As Ravi: submit cashout = 1000 chips.
9. As Priya: submit cashout = 200 chips.
10. As Aman: submit own cashout = 800 chips.
11. As Aman: confirm all 3 cashouts.
12. As Aman: close the session.
13. Assert leaderboard shows correct nets.
14. Assert each profile's history has the new session entry.
15. Assert audit log has the expected sequence of entries.
```

### `ledger-edits.spec.ts`
- House edits a buy-in mid-session → audit log shows before/after.
- House deletes a buy-in → audit log shows the deletion.
- Cashout edited after confirmation flips back to pending.
- Discrepancy in reconciliation surfaces in the UI.

### `leaderboard.spec.ts`
- Closed sessions appear; open sessions don't.
- Sort orderings: net, win rate, biggest win — verified against fixture.
- Date filter inclusivity.

### `profile.spec.ts`
- Own profile: edit nickname → saves and reflects on leaderboard.
- Other profile: read-only.
- Bankroll-over-time chart renders with > 0 points after one closed session.
- Earned badges visible.

### `invite-onboarding.spec.ts`
- New user via invite link: cookie pending_invite set → magic link → joined to session and `profiles` row auto-created.
- Closed-session invite link: shows error, doesn't add user.
- Invalid token: error page.

### `notes-photos.spec.ts`
- Add a note as a participant; another participant sees it.
- Edit note as author; delete; non-author cannot edit/delete.
- Upload photo (small JPEG fixture); appears in gallery; lightbox opens.
- Oversize photo rejected.

### `export.spec.ts`
- CSV download from a closed session: file downloaded, MIME `text/csv`, contains expected rows.
- PDF download: file downloaded, MIME `application/pdf`, non-empty.
- Non-participant gets 403 / hidden CTA.

### `permissions.spec.ts` — the RLS verification spec
This spec exists specifically because the boundary fake doesn't replicate RLS.
- Player B cannot see Player A's session they weren't invited to (404 on direct URL access).
- Non-house cannot record a buy-in (UI button hidden + Server Action rejects).
- Non-house cannot close session.
- Anonymous user redirected from any `/(app)/*` route.
- Author-only edit on notes verified at the API level (Server Action rejects).

### `pwa.spec.ts`
- `/manifest.webmanifest` returns valid JSON.
- All advertised icon URLs return 200.
- Service worker registered (after build, in production mode).
- Lighthouse `installable` audit passes (use `@playwright/test` + `lighthouse` integration).

---

## Mobile-specific spec checks

The mobile project lane (`chromium-mobile`) re-runs every spec but additionally asserts:
- Bottom nav is visible; top desktop nav is hidden.
- Buy-in form opens as a bottom sheet.
- Tap targets are ≥ 44 px (use `boundingBox()` checks on critical buttons).
- Safe-area padding present.

---

## Helpers

### `loginAs(page, user)`
```ts
export async function loginAs(page: Page, user: { email: string }) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Send magic link' }).click();
  const link = await fetchLatestMagicLink(user.email);   // utils/magic-link.ts
  await page.goto(link);
  await expect(page).toHaveURL(/\/sessions/);
}
```

### `expectMoneyEquals(locator, paise)`
```ts
export async function expectMoneyEquals(loc: Locator, paise: number) {
  await expect(loc).toHaveText(formatINR(paise));     // import the same helper from `core`
}
```
Importing `core.formatINR` keeps the assertion in lock-step with production formatting.

### `resetDb()`
Uses Supabase Admin API or a local `supabase db reset`. Called in `globalSetup` (once) and per-test if specs request isolation.

---

## CI integration

GitHub Action lane:
```yaml
e2e:
  runs-on: ubuntu-latest
  services:
    postgres: { image: postgres:15, ... }
  steps:
    - checkout
    - pnpm install
    - run: supabase start
    - run: supabase db reset    # applies migrations + seed
    - run: pnpm playwright install --with-deps
    - run: pnpm build
    - run: pnpm test:e2e
    - upload-artifact: playwright-report/
```

The whole lane targets ≤ 8 minutes. Cap retries at 2.

---

## Acceptance checklist

- [ ] `pnpm test:e2e` runs locally against `supabase start`.
- [ ] All specs above exist and pass on `chromium-mobile` and `chromium-desktop`.
- [ ] `session-lifecycle.spec.ts` is the longest and most carefully reviewed spec.
- [ ] `permissions.spec.ts` covers every RLS-relevant rule.
- [ ] Lighthouse PWA install audit passes in `pwa.spec.ts`.
- [ ] Suite completes in under 8 minutes in CI.
- [ ] No spec uses `page.waitForTimeout` — all waits are condition-based.
- [ ] Page Object Model used everywhere — no raw selectors in specs.
