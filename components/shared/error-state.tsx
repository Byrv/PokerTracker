'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Generic error UI. Use inside an Error Boundary or as a fallback for
 * mutation failures. Pass `retry` to render a "Try again" button.
 */
export function ErrorState({
  error,
  retry,
  title = 'Something went wrong',
  className,
}: {
  error: Error | string;
  retry?: () => void;
  title?: string;
  className?: string;
}) {
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div className={cn('flex flex-col items-center gap-3 p-8 text-center', className)} role="alert">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
      {retry ? (
        <Button onClick={retry} variant="outline">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
