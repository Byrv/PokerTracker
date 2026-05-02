import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Generic zero-data state. Centered icon + title + description + optional CTA.
 */
export function EmptyState({
  icon,
  title,
  description,
  cta,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 p-12 text-center', className)}
    >
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {cta ? <div className="pt-1">{cta}</div> : null}
    </div>
  );
}
