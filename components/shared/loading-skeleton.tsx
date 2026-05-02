import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type LoadingSkeletonVariant = 'row' | 'card' | 'table' | 'stat';

/**
 * Skeleton shapes that mirror the real components — keeps layout shift
 * low when data resolves.
 */
export function LoadingSkeleton({
  variant = 'row',
  count = variant === 'table' ? 5 : 1,
  className,
}: {
  variant?: LoadingSkeletonVariant;
  count?: number;
  className?: string;
}) {
  if (variant === 'card') {
    return <Skeleton className={cn('h-32 w-full rounded-xl', className)} />;
  }
  if (variant === 'stat') {
    return <Skeleton className={cn('h-12 w-32 rounded-lg', className)} />;
  }
  if (variant === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }
  return <Skeleton className={cn('h-10 w-full rounded-md', className)} />;
}
