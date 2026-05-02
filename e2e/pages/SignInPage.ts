import { expect, type Page } from '@playwright/test';

/**
 * POM for `/sign-in`. The form itself only triggers the magic-link Server
 * Action; for E2E we bypass the email round-trip via `e2e/utils/auth.ts`.
 * This POM exists for the small handful of specs that exercise the form UI.
 */
export class SignInPage {
  constructor(private readonly page: Page) {}

  async goto(redirectTo?: string): Promise<void> {
    const path = redirectTo ? `/sign-in?redirectTo=${encodeURIComponent(redirectTo)}` : '/sign-in';
    await this.page.goto(path);
  }

  async fillEmail(email: string): Promise<void> {
    await this.page.getByLabel(/email/i).fill(email);
  }

  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: /send magic link/i }).click();
  }

  async expectLinkSent(): Promise<void> {
    await expect(this.page.getByText(/check your email/i)).toBeVisible();
  }

  async expectFormVisible(): Promise<void> {
    await expect(this.page.getByRole('button', { name: /send magic link/i })).toBeVisible();
  }
}
