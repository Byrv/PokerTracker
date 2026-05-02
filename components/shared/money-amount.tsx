import { cn } from '@/lib/utils';

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export type MoneyVariant = 'profit' | 'loss' | 'neutral' | 'auto';
export type MoneySize = 'sm' | 'md' | 'lg';

/**
 * Renders a paise value (integer) as an INR-formatted string with
 * tabular-mono numerals so columns align. The single way money is
 * rendered anywhere in the app.
 *
 * `variant="auto"` infers profit/loss from sign.
 */
export function MoneyAmount({
  value,
  variant = 'neutral',
  size = 'md',
  showSign = false,
  className,
}: {
  /** Amount in paise (1 INR = 100 paise). */
  value: number;
  variant?: MoneyVariant;
  size?: MoneySize;
  /** When true, prepend "+" for positive values. */
  showSign?: boolean;
  className?: string;
}) {
  const rupees = value / 100;
  const resolved: Exclude<MoneyVariant, 'auto'> =
    variant === 'auto' ? (value > 0 ? 'profit' : value < 0 ? 'loss' : 'neutral') : variant;

  const colorClass =
    resolved === 'profit'
      ? 'text-[var(--profit)]'
      : resolved === 'loss'
        ? 'text-[var(--loss)]'
        : 'text-foreground';

  const sizeClass: Record<MoneySize, string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl font-semibold',
  };

  const formatted = formatter.format(rupees);
  const display = showSign && value > 0 ? `+${formatted}` : formatted;

  return (
    <span className={cn('font-mono tabular-nums', colorClass, sizeClass[size], className)}>
      {display}
    </span>
  );
}
