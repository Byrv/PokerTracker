'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { primaryNav } from './nav-links';

/**
 * Desktop top-bar navigation. Hidden under lg, where the BottomNav shows.
 */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
      {primaryNav.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--color-felt-green-50)] text-[var(--color-felt-green-700)] dark:bg-[var(--color-felt-green-700)]/30 dark:text-[var(--color-felt-green-50)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
