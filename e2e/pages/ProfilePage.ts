import { expect, type Page } from '@playwright/test';

/**
 * POM for `/profile/[id]`. (`/profile` itself is a redirect to the current
 * user's profile.) The page shows nickname, lifetime stats, recent sessions,
 * and a bankroll-over-time chart.
 */
export class ProfilePage {
  constructor(private readonly page: Page) {}

  async gotoSelf(): Promise<void> {
    await this.page.goto('/profile');
  }

  async gotoUser(userId: string): Promise<void> {
    await this.page.goto(`/profile/${userId}`);
  }

  async expectLoaded(): Promise<void> {
    // Either a heading "Profile" or the nickname.
    await expect(this.page.getByRole('heading').first()).toBeVisible();
  }

  async expectSessionInHistory(sessionName: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(sessionName, 'i')).first()).toBeVisible();
  }

  async expectBankrollChartVisible(): Promise<void> {
    // Recharts renders an SVG inside a container with role="img" or className.
    await expect(this.page.locator('svg').first()).toBeVisible();
  }
}
