import { expect, type Page } from '@playwright/test';

/**
 * POM for `/sessions`. Implementation note: the page reads a `?status=`
 * query param (open/closed/all) and renders a list of cards. Selectors here
 * intentionally use roles + accessible names so they survive a class rewrite.
 */
export class SessionsListPage {
  constructor(private readonly page: Page) {}

  async goto(filter?: 'open' | 'closed'): Promise<void> {
    await this.page.goto(filter ? `/sessions?status=${filter}` : '/sessions');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /sessions/i })).toBeVisible();
  }

  async clickNew(): Promise<void> {
    // Tolerant to either a "New session" button OR link.
    const link = this.page.getByRole('link', { name: /new session/i });
    if (await link.isVisible()) {
      await link.click();
      return;
    }
    await this.page.getByRole('button', { name: /new session/i }).click();
  }

  async openSessionByName(name: string): Promise<void> {
    await this.page
      .getByRole('link', { name: new RegExp(name, 'i') })
      .first()
      .click();
  }

  filterTab(label: 'All' | 'Open' | 'Closed') {
    return this.page.getByRole('link', { name: label, exact: true });
  }
}
