import { type Page } from '@playwright/test';

/**
 * POM for `/sessions/new`. The form renders inputs for name, location, and
 * blinds. The exact label text is owned by the sessions-pages agent — the
 * regexes below are tolerant to small wording changes.
 */
export class NewSessionPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/sessions/new');
  }

  async fillName(name: string): Promise<void> {
    await this.page.getByLabel(/name/i).fill(name);
  }

  async fillLocation(location: string): Promise<void> {
    await this.page.getByLabel(/location/i).fill(location);
  }

  async fillBlinds(small: number, big: number): Promise<void> {
    // Both blinds are entered in rupees in the UI.
    const smallInput = this.page.getByLabel(/small\s*blind/i);
    const bigInput = this.page.getByLabel(/big\s*blind/i);
    if (await smallInput.isVisible()) await smallInput.fill(String(small));
    if (await bigInput.isVisible()) await bigInput.fill(String(big));
  }

  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: /create session/i }).click();
  }

  async createSession(input: {
    name: string;
    location?: string;
    blinds?: { small: number; big: number };
  }): Promise<void> {
    await this.fillName(input.name);
    if (input.location) await this.fillLocation(input.location);
    if (input.blinds) await this.fillBlinds(input.blinds.small, input.blinds.big);
    await this.submit();
    await this.page.waitForURL(/\/sessions\/[0-9a-f-]+$/);
  }
}
