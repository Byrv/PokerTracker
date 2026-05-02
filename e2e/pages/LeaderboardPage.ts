import { expect, type Page } from '@playwright/test';

import type { LeaderboardSort } from '@/lib/modules/leaderboard';

/**
 * POM for `/leaderboard`. The page is server-rendered with the URL as the
 * source of truth; filters are a plain GET form.
 */
export class LeaderboardPage {
  constructor(private readonly page: Page) {}

  async goto(query?: { from?: string; to?: string; sort?: LeaderboardSort }): Promise<void> {
    const params = new URLSearchParams();
    if (query?.from) params.set('from', query.from);
    if (query?.to) params.set('to', query.to);
    if (query?.sort) params.set('sort', query.sort);
    const qs = params.toString();
    await this.page.goto(qs ? `/leaderboard?${qs}` : '/leaderboard');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /leaderboard/i })).toBeVisible();
  }

  async expectPlayerVisible(nickname: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(nickname, 'i')).first()).toBeVisible();
  }

  async setSort(sort: LeaderboardSort): Promise<void> {
    await this.page.getByLabel(/sort by/i).selectOption(sort);
    await this.page.getByRole('button', { name: /apply/i }).click();
  }
}
