# PWA Execution Runbook

Implements `plans/pwa.md`. Single agent. Phase 1, parallel. Owns manifest, icons, service worker config, mobile chrome polish.

Working directory: `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Step 1 — Source icon

The agent needs a source SVG. If a brand asset exists, use it. Otherwise, create a placeholder `public/icons/source.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0F6D40"/>
  <text x="50%" y="58%" text-anchor="middle" font-family="Geist, sans-serif" font-size="220" font-weight="700" fill="#FAF7EE">P</text>
</svg>
```

(Replace later with a proper logo — placeholder is fine for v1 install criteria.)

---

## Step 2 — Generate icons

```bash
pnpm dlx pwa-asset-generator public/icons/source.svg public/icons \
  --opaque false --padding "0%" --background "#0F6D40" \
  --type png --quality 100 \
  --maskable true \
  --favicon false \
  --manifest public/manifest.webmanifest
```

This produces all standard sizes in `public/icons/` and the iOS splash variants. Also writes a manifest stub — overwrite it in Step 3.

Make sure these exist (rename if generator names them differently):
- `public/icons/icon-192.png`
- `public/icons/icon-256.png`
- `public/icons/icon-384.png`
- `public/icons/icon-512.png`
- `public/icons/icon-maskable-512.png`
- `public/icons/apple-touch-icon.png` (180×180)

---

## Step 3 — Manifest

Create `public/manifest.webmanifest`:

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

## Step 4 — `next-pwa` wrapping

Replace `next.config.ts`:

```ts
import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?.*\.(png|jpg|jpeg|svg|webp|woff2|woff)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: ({ request }: { request: Request }) => request.destination === "document",
      handler: "NetworkFirst",
      options: { cacheName: "pages", networkTimeoutSeconds: 3 },
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
};

export default withPWA(nextConfig as never);
```

Add to `.gitignore`:
```
public/sw.js
public/sw.js.map
public/workbox-*.js
public/workbox-*.js.map
```

---

## Step 5 — Layout head metadata

Update `app/layout.tsx` `<head>` (UI agent owns this file; PWA agent contributes these tags):

```tsx
<head>
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
</head>
```

(Theme color is already set in `viewport` export — see UI runbook.)

---

## Step 6 — Install button

Create `components/shared/install-button.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("install-dismissed") === "1") setDismissed(true);
    const handler = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    const ua = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isIos && !isStandalone) setIosHint(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed) return null;

  if (evt) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-3 flex items-center justify-between">
        <span className="text-sm">Install Poker Tracker on your phone</span>
        <div className="flex gap-2">
          <Button size="sm" onClick={async () => { await evt.prompt(); }}>Install</Button>
          <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem("install-dismissed", "1"); setDismissed(true); }}>Hide</Button>
        </div>
      </div>
    );
  }

  if (iosHint) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
        Tap <span className="font-medium">Share</span> → <span className="font-medium">Add to Home Screen</span> to install.
      </div>
    );
  }

  return null;
}
```

Mount it on `/settings` (the settings agent imports this — single line addition near the top of the page).

---

## Step 7 — Production build smoke test

```bash
pnpm build
pnpm start
```

Open `http://localhost:3000`:
- Confirm `sw.js` exists at `/sw.js` (devtools → Application → Service Workers).
- Confirm manifest loads (Application → Manifest panel shows all icons).
- "Install" button appears in `/settings` on Chrome (after it fires `beforeinstallprompt`).

Lighthouse audit (Chrome DevTools → Lighthouse → PWA category):
- "Installable" must pass.
- Manifest icons resolve.

---

## Acceptance checklist

- [ ] Manifest validates (use `https://manifest-validator.appspot.com/` or Chrome Lighthouse).
- [ ] All icon sizes exist in `public/icons/` and load.
- [ ] `next-pwa` config in `next.config.ts` correct; service worker disabled in dev.
- [ ] Install button works on Android Chrome; iOS shows the hint.
- [ ] Theme color shows as felt-green in installed app's status bar.
- [ ] Safe-area insets respected (visually verified on iPhone notch viewport).
- [ ] Lighthouse "Installable" passes.

When all boxes green, commit as `feat: PWA manifest + service worker + install affordance`.
