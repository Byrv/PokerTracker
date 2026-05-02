import { expect, type Locator } from '@playwright/test';

/**
 * Assert a locator's text matches an INR-formatted paise amount.
 *
 * Mirrors the production formatter (en-IN, INR, no fractional digits when
 * paise %% 100 === 0) so specs stay in lock-step with the UI.
 */
export async function expectMoneyEquals(loc: Locator, paise: number): Promise<void> {
  const rupees = paise / 100;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  });
  await expect(loc).toHaveText(formatter.format(rupees));
}
