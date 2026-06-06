# E2E Execution Runbook

Implements `plans/e2e.md`. Single Playwright agent. Phase 2, parallel with frontend page agents. Owns `e2e/**` and `playwright.config.ts`.

Working directory: `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Step 1 — Verify Playwright config

Confirm `playwright.config.ts` was created in foundation. If not, create per `plans/e2e.md`. Install browsers:

```bash
pnpm dlx playwright install --with-deps chromium
```

---

## Step 2 — Magic-link helper

Local Supabase exposes Inbucket at `http://localhost:54324` for inbox capture.

Create `e2e/utils/magic-link.ts`:

```ts
export async function fetchLatestMagicLink(email: string): Promise<string> {
  const inboxUrl = `http://localhost:54324/api/v1/mailbox/${encodeURIComponent(email)}`;
  const res = await fetch(inboxUrl);
  const messages = (await res.json()) as Array<{ id: string }>;
  if (messages.length === 0) throw new Error(`no email for ${email}`);
  const latest = messages[messages.length - 1]!;
  const msgRes = await fetch(`${inboxUrl}/${latest.id}`);
  const msg = (await msgRes.json()) as { body?: { html?: string; text?: string } };
  const body = msg.body?.text ?? msg.body?.html ?? "";
  const m = body.match(/(http[^\s"']+)/);
  if (!m) throw new Error("no link in email");
  return m[1]!;
}
```

---

## Step 3 — DB reset helper

Create `e2e/utils/reset-db.ts`:

```ts
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

export async function resetDb() {
  execSync("supabase db reset", { stdio: "inherit" });
  // re-seed users
  const url = process.env.E2E_SUPABASE_URL ?? "http://localhost:54321";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const emails = ["aman@example.com", "ravi@example.com", "priya@example.com", "karan@example.com", "neha@example.com"];
  for (const email of emails) {
    await admin.auth.admin.createUser({ email, email_confirm: true });
  }
  execSync("supabase db reset", { stdio: "inherit" });
}
```

Add a `globalSetup` to `playwright.config.ts`:

```ts
// at top of playwright.config.ts:
globalSetup: "./e2e/utils/global-setup.ts",
```

Create `e2e/utils/global-setup.ts`:

```ts
import { resetDb } from "./reset-db";
async function globalSetup() { await resetDb(); }
export default globalSetup;
```

---

## Step 4 — Custom assertions

Create `e2e/utils/assertions.ts`:

```ts
import { expect, type Locator } from "@playwright/test";

export async function expectMoneyEquals(loc: Locator, paise: number) {
  const formatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  await expect(loc).toHaveText(formatter.format(paise / 100));
}
```

---

## Step 5 — Page Object Models

Create `e2e/pages/SignInPage.ts`:

```ts
import type { Page } from "@playwright/test";
import { fetchLatestMagicLink } from "../utils/magic-link";

export class SignInPage {
  constructor(private page: Page) {}
  async goto() { await this.page.goto("/sign-in"); }
  async loginAs(email: string) {
    await this.goto();
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByRole("button", { name: "Send magic link" }).click();
    await this.page.getByText("Check your email").waitFor();
    const link = await fetchLatestMagicLink(email);
    await this.page.goto(link);
  }
}
```

Create `e2e/pages/SessionsPage.ts`:

```ts
import type { Page } from "@playwright/test";

export class SessionsPage {
  constructor(private page: Page) {}
  async goto() { await this.page.goto("/sessions"); }
  async clickNew() { await this.page.getByRole("link", { name: /new session/i }).click(); }
  async openSession(name: string) { await this.page.getByText(name).first().click(); }
}
```

Create `e2e/pages/SessionDetailPage.ts`:

```ts
import type { Page } from "@playwright/test";

export class SessionDetailPage {
  constructor(private page: Page) {}

  async getInviteUrl(): Promise<string> {
    // Implementation: depends on the UI. Minimum viable: a "Copy invite" button or URL displayed in house controls.
    // Adjust selector to match the implemented UI.
    const link = await this.page.getByRole("link", { name: /invite/i }).getAttribute("href");
    if (!link) throw new Error("no invite link found");
    return link;
  }

  async recordBuyin(playerLabel: string, rupees: number) {
    await this.page.getByRole("button", { name: /record buy-in/i }).click();
    await this.page.getByLabel("Player").click();
    await this.page.getByRole("option", { name: playerLabel }).click();
    await this.page.getByLabel(/amount/i).fill(String(rupees));
    await this.page.getByRole("button", { name: /^Record$/ }).click();
  }

  async submitCashout(chipCount: number) {
    await this.page.getByRole("button", { name: /submit your cashout/i }).click();
    await this.page.getByLabel(/final chip count/i).fill(String(chipCount));
    await this.page.getByRole("button", { name: /^Submit$/ }).click();
  }

  async confirmCashout(playerLabel: string) {
    const row = this.page.locator("li, div", { hasText: playerLabel });
    await row.getByRole("button", { name: /confirm/i }).click();
  }

  async closeSession() {
    await this.page.getByRole("button", { name: /close session/i }).click();
    await this.page.getByRole("button", { name: /^Close$/ }).click();
  }
}
```

Create `e2e/pages/LeaderboardPage.ts` and `e2e/pages/ProfilePage.ts` similarly with selectors matching the implemented UI.

---

## Step 6 — Specs

### `e2e/specs/auth.spec.ts`

```ts
import { test, expect } from "@playwright/test";
import { SignInPage } from "../pages/SignInPage";

test("sign in via magic link redirects to sessions", async ({ page }) => {
  const sp = new SignInPage(page);
  await sp.loginAs("aman@example.com");
  await expect(page).toHaveURL(/\/sessions/);
});

test("anonymous user is redirected from /sessions", async ({ page }) => {
  await page.goto("/sessions");
  await expect(page).toHaveURL(/\/sign-in/);
});
```

### `e2e/specs/session-lifecycle.spec.ts`

The centerpiece spec. Covers the entire critical path.

```ts
import { test, expect, type BrowserContext } from "@playwright/test";
import { SignInPage } from "../pages/SignInPage";
import { SessionsPage } from "../pages/SessionsPage";
import { SessionDetailPage } from "../pages/SessionDetailPage";

test("full lifecycle: sign-in → invite → buy-ins → cashouts → close", async ({ browser }) => {
  // 1. Aman signs in and creates session
  const amanCtx = await browser.newContext();
  const amanPage = await amanCtx.newPage();
  await new SignInPage(amanPage).loginAs("aman@example.com");
  await new SessionsPage(amanPage).goto();
  await amanPage.getByRole("link", { name: /new session/i }).click();
  await amanPage.getByLabel("Name").fill("E2E Session");
  await amanPage.getByLabel("Location").fill("Test");
  await amanPage.getByRole("button", { name: /create session/i }).click();
  await amanPage.waitForURL(/\/sessions\/[a-f0-9-]+$/);

  const detail = new SessionDetailPage(amanPage);
  const inviteUrl = await detail.getInviteUrl();

  // 2. Ravi joins via invite
  const raviCtx = await browser.newContext();
  const raviPage = await raviCtx.newPage();
  await raviPage.goto(inviteUrl);
  // Stash + sign-in
  await new SignInPage(raviPage).loginAs("ravi@example.com");
  await expect(raviPage).toHaveURL(/\/sessions\/[a-f0-9-]+$/);

  // 3. Aman records buy-ins
  await detail.recordBuyin("aman", 500);
  await detail.recordBuyin("ravi", 500);

  // 4. Ravi submits cashout
  await new SessionDetailPage(raviPage).submitCashout(30000);

  // 5. Aman submits + confirms
  await detail.submitCashout(70000);
  await detail.confirmCashout("aman");
  await detail.confirmCashout("ravi");

  // 6. Close session
  await detail.closeSession();
  await expect(amanPage.getByText(/closed/i)).toBeVisible();

  // 7. Leaderboard reflects nets
  await amanPage.goto("/leaderboard");
  await expect(amanPage.getByText(/aman/i)).toBeVisible();
});
```

### `e2e/specs/permissions.spec.ts`

```ts
import { test, expect } from "@playwright/test";
import { SignInPage } from "../pages/SignInPage";

test("non-house cannot see buy-in button", async ({ browser }) => {
  // Aman creates session
  const amanCtx = await browser.newContext();
  const amanPage = await amanCtx.newPage();
  await new SignInPage(amanPage).loginAs("aman@example.com");
  await amanPage.goto("/sessions");
  await amanPage.getByRole("link", { name: /new session/i }).click();
  await amanPage.getByLabel("Name").fill("Perm test");
  await amanPage.getByRole("button", { name: /create session/i }).click();
  const url = amanPage.url();

  // Ravi (different user) navigates directly — but is not a participant yet.
  const raviCtx = await browser.newContext();
  const raviPage = await raviCtx.newPage();
  await new SignInPage(raviPage).loginAs("ravi@example.com");
  await raviPage.goto(url);
  // Without invite, Ravi has no permission to see buyins, so the page should 404 or hide details.
  await expect(raviPage.getByRole("button", { name: /record buy-in/i })).not.toBeVisible();
});
```

### `e2e/specs/pwa.spec.ts`

```ts
import { test, expect } from "@playwright/test";

test("manifest is valid", async ({ request, baseURL }) => {
  const res = await request.get(`${baseURL}/manifest.webmanifest`);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name).toBe("Poker Tracker");
  expect(manifest.icons).toBeInstanceOf(Array);
  for (const icon of manifest.icons) {
    const img = await request.get(`${baseURL}${icon.src}`);
    expect(img.ok()).toBe(true);
  }
});

test("service worker registered in production", async ({ page, baseURL }) => {
  await page.goto(baseURL!);
  const hasSW = await page.evaluate(() => "serviceWorker" in navigator && navigator.serviceWorker.getRegistration().then((r) => Boolean(r)));
  expect(hasSW).toBe(true);
});
```

### Other specs

Implement following the patterns above:
- `e2e/specs/ledger-edits.spec.ts` — buy-in edit, delete, audit log entries.
- `e2e/specs/leaderboard.spec.ts` — sort orders, date filter.
- `e2e/specs/profile.spec.ts` — own vs other profile, bankroll chart visible.
- `e2e/specs/invite-onboarding.spec.ts` — first-time user via invite.
- `e2e/specs/notes-photos.spec.ts` — note + photo CRUD with permission cases.
- `e2e/specs/export.spec.ts` — CSV download contains expected rows.

For each: define a Page Object Model, write the spec at the level of user behavior.

---

## Step 7 — CI integration

The deployment runbook adds the E2E lane. Locally:

```bash
supabase start
pnpm dlx supabase@latest db reset
node scripts/seed-users.mjs
pnpm dlx supabase@latest db reset
pnpm build
pnpm start &
pnpm test:e2e
```

---

## Acceptance checklist

- [ ] All specs in `e2e/specs/` exist and pass on `chromium-mobile` + `chromium-desktop`.
- [ ] Suite completes in under 8 minutes locally.
- [ ] No `page.waitForTimeout` calls — all waits are condition-based.
- [ ] Page Object Models used everywhere — no raw selectors in specs.
- [ ] `permissions.spec.ts` covers the RLS-relevant behaviors.
- [ ] `pwa.spec.ts` passes in a production build.
- [ ] Magic-link helper successfully fetches links from Inbucket.

When all boxes green, commit as `feat: e2e suite`.
