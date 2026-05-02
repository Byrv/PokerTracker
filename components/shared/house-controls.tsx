import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Wrapper that renders children only when the viewing user is the session
 * house. Pages render house controls inside `<HouseControls isHouse={...}>`
 * and don't have to branch themselves.
 */
export function HouseControls({
  isHouse,
  children,
  className,
}: {
  isHouse: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!isHouse) return null;
  return (
    <div
      data-slot="house-controls"
      className={cn(
        'border-border text-card-foreground rounded-xl border bg-[var(--surface)] p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
