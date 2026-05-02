import { cn } from '@/lib/utils';

/**
 * Renders a chip value with tabular-mono digits and a "chips" suffix.
 * Used in buy-in / cash-out forms and ledger rows.
 */
export function ChipAmount({
  value,
  size = 'md',
  showSuffix = true,
  className,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showSuffix?: boolean;
  className?: string;
}) {
  const sizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl font-semibold',
  }[size];

  return (
    <span className={cn('font-mono tabular-nums', sizeClass, className)}>
      {value.toLocaleString('en-IN')}
      {showSuffix && <span className="text-muted-foreground ml-1 text-xs font-normal">chips</span>}
    </span>
  );
}
