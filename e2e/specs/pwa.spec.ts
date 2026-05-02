import { test, expect } from '@playwright/test';

/**
 * PWA install gate. These checks run against the static manifest + icon set
 * and don't depend on any UI page, so they're "live" today.
 */
test.describe('pwa', () => {
  test('manifest is valid and well-formed', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/manifest.webmanifest`);
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.name).toBe('Poker Tracker');
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('all advertised icon URLs return 200', async ({ request, baseURL }) => {
    const manifestRes = await request.get(`${baseURL}/manifest.webmanifest`);
    const manifest = (await manifestRes.json()) as { icons: { src: string }[] };
    for (const icon of manifest.icons) {
      const url = icon.src.startsWith('http') ? icon.src : `${baseURL}${icon.src}`;
      const r = await request.get(url);
      expect.soft(r.ok(), `icon ${icon.src} returned ${r.status()}`).toBeTruthy();
    }
  });

  test.fixme('service worker registers in production build', async () => {
    // Requires `pnpm build && pnpm start` (production mode). Dev mode skips
    // the SW. Enable this once CI runs the prod webServer config.
  });
});
