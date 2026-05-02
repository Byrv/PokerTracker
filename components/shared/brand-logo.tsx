import { cn } from '@/lib/utils';

/**
 * Wordmark + chip glyph. Used in TopBar and on the marketing/sign-in pages.
 */
export function BrandLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <ChipGlyph aria-hidden className="size-6" />
      {showWordmark ? (
        <span className="font-heading text-base leading-none font-semibold tracking-tight">
          Poker Tracker
        </span>
      ) : null}
    </span>
  );
}

function ChipGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="10" fill="var(--color-felt-green-500)" />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="var(--color-cream-50)"
        strokeWidth="1.25"
        strokeDasharray="2.5 1.7"
      />
      <circle cx="12" cy="12" r="4.25" fill="var(--color-cream-50)" />
      <text
        x="12"
        y="14.4"
        textAnchor="middle"
        fontSize="4.5"
        fontWeight="700"
        fill="var(--color-felt-green-700)"
      >
        ♠
      </text>
    </svg>
  );
}
