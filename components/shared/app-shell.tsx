import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { BottomNav } from './bottom-nav';
import { BrandLogo } from './brand-logo';
import { DesktopNav } from './desktop-nav';
import { type PlayerLike } from './player-avatar';
import { UserMenu } from './user-menu';

export type AppShellUser = (PlayerLike & { email?: string }) | null;

/**
 * Top-level chrome: sticky TopBar (logo + primary nav + user menu),
 * scrollable main content (max-w-3xl), mobile-only BottomNav.
 *
 * Pages in `app/(app)/...` wrap their content in this shell. The shell
 * works whether the user is signed in or not — it shows a "Sign in" CTA
 * when `user` is null so the chrome doesn't flicker between renders.
 *
 * Server component (no client-only state) — bottom/desktop nav are
 * client components themselves so they can read `usePathname`.
 */
export function AppShell({
  user = null,
  children,
  contentClassName,
  hideBottomNav = false,
}: {
  user?: AppShellUser;
  children: ReactNode;
  contentClassName?: string;
  hideBottomNav?: boolean;
}) {
  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <TopBar user={user} />
      <main
        className={cn(
          'mx-auto w-full max-w-3xl flex-1 px-4 py-4 lg:py-6',
          // Reserve room for the fixed BottomNav on mobile.
          !hideBottomNav && 'pb-24 lg:pb-6',
          contentClassName,
        )}
      >
        {children}
      </main>
      {hideBottomNav ? null : <BottomNav />}
    </div>
  );
}

function TopBar({ user }: { user: AppShellUser }) {
  return (
    <header
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4">
        <Link
          href={user ? '/sessions' : '/'}
          className="focus-visible:ring-ring/50 rounded-md focus-visible:ring-3 focus-visible:outline-none"
        >
          <BrandLogo />
        </Link>

        {user ? <DesktopNav /> : null}

        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Button render={<Link href="/sign-in" />} size="sm">
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
