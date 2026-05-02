import { expect, type Page } from '@playwright/test';

/**
 * POM for `/sessions/[id]`. The detail page is the largest UI in the app —
 * it shows participants, the live ledger, audit log, and exposes house-only
 * controls (record buy-in, confirm cashout, close session).
 *
 * The exact selectors are owned by the session-pages agent. POM uses
 * tolerant regex matching so minor wording tweaks don't break the suite.
 */
export class SessionDetailPage {
  constructor(private readonly page: Page) {}

  async gotoById(id: string): Promise<void> {
    await this.page.goto(`/sessions/${id}`);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/sessions\/[0-9a-f-]+$/);
  }

  // ── Invite ──────────────────────────────────────────────────────────────

  /**
   * Resolve the invite URL from the page. Implementation may surface this as
   * either a copy button (data-invite-url attribute) or a visible link/input.
   * We try the most stable options in order.
   */
  async getInviteUrl(): Promise<string> {
    // Option A: a button or element exposing the URL via data attribute.
    const copyBtn = this.page.locator('[data-invite-url]');
    if (await copyBtn.count()) {
      const url = await copyBtn.first().getAttribute('data-invite-url');
      if (url) return url;
    }
    // Option B: a readonly input populated with the URL.
    const inviteInput = this.page.getByRole('textbox', { name: /invite/i });
    if (await inviteInput.count()) {
      const v = await inviteInput.first().inputValue();
      if (v) return v;
    }
    // Option C: a real <a href>.
    const inviteLink = this.page.getByRole('link', { name: /invite/i });
    if (await inviteLink.count()) {
      const href = await inviteLink.first().getAttribute('href');
      if (href) return href;
    }
    throw new Error('SessionDetailPage.getInviteUrl: no invite element found');
  }

  // ── Buy-ins ─────────────────────────────────────────────────────────────

  async openBuyinForm(): Promise<void> {
    await this.page
      .getByRole('button', { name: /record buy-?in/i })
      .first()
      .click();
  }

  async recordBuyin(playerNickname: string, rupees: number): Promise<void> {
    await this.openBuyinForm();
    // Player select — could be a native <select> or a custom combobox.
    const select = this.page.getByLabel(/player|user/i);
    if (await select.first().isVisible()) {
      // Native select supports selectOption via label.
      await select.first().selectOption({ label: new RegExp(playerNickname, 'i').source });
    }
    await this.page.getByLabel(/amount/i).fill(String(rupees));
    await this.page.getByRole('button', { name: /^(record|save|submit)$/i }).click();
  }

  // ── Cashouts ────────────────────────────────────────────────────────────

  async submitCashout(chipCount: number): Promise<void> {
    await this.page.getByRole('button', { name: /submit (your )?cashout/i }).click();
    await this.page.getByLabel(/(final )?chip count/i).fill(String(chipCount));
    await this.page.getByRole('button', { name: /^(submit|save)$/i }).click();
  }

  async confirmCashoutFor(playerNickname: string): Promise<void> {
    const row = this.page
      .getByRole('listitem')
      .filter({ hasText: new RegExp(playerNickname, 'i') });
    await row.getByRole('button', { name: /confirm/i }).click();
  }

  // ── Close ───────────────────────────────────────────────────────────────

  async closeSession(): Promise<void> {
    await this.page.getByRole('button', { name: /close session/i }).click();
    // Confirmation dialog — accept.
    await this.page.getByRole('button', { name: /^(close|confirm|yes)$/i }).click();
  }

  async expectClosed(): Promise<void> {
    await expect(this.page.getByText(/closed/i).first()).toBeVisible();
  }

  // ── Visibility helpers ──────────────────────────────────────────────────

  async expectBuyinControlVisible(visible = true): Promise<void> {
    const btn = this.page.getByRole('button', { name: /record buy-?in/i });
    if (visible) await expect(btn).toBeVisible();
    else await expect(btn).toHaveCount(0);
  }
}
