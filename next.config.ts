import type { NextConfig } from 'next';
// next-pwa is a CommonJS package with no bundled types; use a runtime-only require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWAInit = require('next-pwa') as (
  options: Record<string, unknown>,
) => (config: NextConfig) => NextConfig;

const isDev = process.env.NODE_ENV === 'development';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: isDev,
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    // Static assets (images, fonts) — cache-first, long TTL.
    {
      urlPattern: /^https?.*\.(?:png|jpg|jpeg|svg|webp|gif|ico|woff2|woff|ttf|otf)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // Next.js build assets — cache-first.
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // API responses — network-first; do NOT cache by default. Short TTL fallback for offline shell only.
    {
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-shell',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 16, maxAgeSeconds: 60 },
      },
    },
    // Page documents — network-first, fall back to cache for the shell only.
    {
      urlPattern: ({ request }: { request: Request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: { cacheName: 'pages', networkTimeoutSeconds: 3 },
    },
  ],
});

const nextConfig: NextConfig = {
  // Empty turbopack config silences Next 16's warning about a webpack hook
  // (added by next-pwa above) without disabling Turbopack for `next dev`.
  // Production `next build --webpack` is what actually emits the SW.
  turbopack: {},
};

export default withPWA(nextConfig);
