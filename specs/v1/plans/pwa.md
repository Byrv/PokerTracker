# PWA Plan

Make the app installable on phone home screens and feel native. Runs **in parallel** with module work, UI, and auth in Phase 1.

---

## Scope

- Web manifest with icons, theme colors, and start URL.
- App icons (multiple sizes) generated from a single source.
- Service worker for offline-shell caching of static assets only (no offline data — out of scope).
- Mobile chrome polish: safe-area insets, status bar color, splash screen, "add to home screen" affordance.
- Lighthouse PWA install criteria pass.

This plan does **not** cover offline data sync — explicitly out of scope per requirements.

---

## Tooling

- `next-pwa` or hand-rolled service worker — pick `next-pwa` for v1 (minimal config).
- `pwa-asset-generator` for icon + splash generation from a single SVG.

```bash
pnpm add -D next-pwa pwa-asset-generator
```

---

## Files this plan owns

```
public/
├── icons/
│   ├── icon-192.png
│   ├── icon-256.png
│   ├── icon-384.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   └── apple-touch-icon.png
├── splash/                       # iOS splash variants (generated)
└── manifest.webmanifest
next.config.ts                    # next-pwa wrapping
app/layout.tsx                    # adds <link rel="manifest"> and theme-color (UI agent owns layout; PWA agent contributes the head tags)
```

---

## Manifest (`public/manifest.webmanifest`)

```json
{
  "name": "Poker Tracker",
  "short_name": "Poker",
  "description": "Track your home poker games — buy-ins, cash-outs, leaderboard.",
  "start_url": "/sessions",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0F6D40",
  "theme_color": "#0F6D40",
  "categories": ["finance", "games", "utilities"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-256.png", "sizes": "256x256", "type": "image/png" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

---

## next.config.ts

```ts
import withPWA from 'next-pwa';

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // Static assets — cache-first, long TTL
    {
      urlPattern: /^https?.*\.(png|jpg|jpeg|svg|webp|woff2)$/,
      handler: 'CacheFirst',
      options: { cacheName: 'static-assets', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 } },
    },
    // Page documents — network-first, fall back to cache when offline (shell only)
    {
      urlPattern: ({ request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: { cacheName: 'pages', networkTimeoutSeconds: 3 },
    },
  ],
})({
  // ...rest of next config
});
```

**API responses are never cached.** No data is meaningful offline; we don't fake it.

---

## Mobile chrome polish

In `app/layout.tsx` `<head>`:
```tsx
<meta name="theme-color" content="#0F6D40" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0B5732" media="(prefers-color-scheme: dark)" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

Safe-area handling in CSS (`styles/globals.css`):
```css
:root {
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
}
body {
  padding-top: var(--safe-area-top);
  padding-bottom: var(--safe-area-bottom);
}
```

The `<AppShell>` (UI agent) uses these vars for top bar and bottom nav so notch / home-indicator don't overlap content.

---

## Install affordance

A tiny "Install" button in `/settings` that triggers `beforeinstallprompt` on supported browsers. On iOS (no install prompt), show a static one-shot guide ("Tap Share → Add to Home Screen"). Dismissal stored in `localStorage`.

Component: `components/shared/install-button.tsx` (UI agent reviewer; PWA agent author).

---

## Acceptance checklist

- [ ] Manifest is valid (`https://manifest-validator.appspot.com/`).
- [ ] All icon sizes exist and render correctly when installed.
- [ ] Lighthouse "Installable" criteria pass (manifest + service worker + HTTPS in prod).
- [ ] App can be installed on Chrome (Android) and Safari (iOS) and launches in `standalone` display mode.
- [ ] Theme color matches felt-green in installed app's status bar.
- [ ] Safe-area insets respected on iPhone with notch (visually verified).
- [ ] Service worker disabled in dev (`process.env.NODE_ENV === 'development'`).
