'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { primaryNav } from './nav-links';

/**
 * Mobile bottom navigation. Hidden at lg+ breakpoint where the TopBar
 * shows the full menu. Honors safe-area inset on devices with a notch.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-medium transition-colors',
                  active
                    ? 'text-[var(--color-felt-green-500)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon
                  aria-hidden
                  className={cn('size-5', active && 'stroke-[var(--color-felt-green-500)]')}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
