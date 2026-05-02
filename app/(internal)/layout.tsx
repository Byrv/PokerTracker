import type { ReactNode } from 'react';

export const metadata = {
  title: 'Internal',
  robots: { index: false, follow: false },
};

/**
 * Internal-only routes (UI kit, dev utilities). Bare passthrough — pages
 * supply their own chrome.
 */
export default function InternalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
