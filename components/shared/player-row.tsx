import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { PlayerAvatar, type PlayerAvatarSize, type PlayerLike } from './player-avatar';

/**
 * Standard list row used in leaderboards, ledgers and settle-up screens.
 * Avatar + nickname on the left, amount on the right, optional hint.
 *
 * `highlight` adds a felt-green left border to flag "your row".
 */
export function PlayerRow({
  user,
  amount,
  hint,
  size = 'sm',
  highlight = false,
  className,
}: {
  user: PlayerLike;
  amount: ReactNode;
  hint?: ReactNode;
  size?: PlayerAvatarSize;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      data-highlight={highlight ? 'true' : undefined}
      className={cn(
        'flex items-center justify-between gap-3 py-2',
        highlight && 'border-l-2 border-[var(--color-felt-green-500)] pl-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar user={user} size={size} />
        <div className="min-w-0">
          <div className="truncate font-medium">{user.nickname}</div>
          {hint ? <div className="text-muted-foreground truncate text-xs">{hint}</div> : null}
        </div>
      </div>
      <div className="shrink-0">{amount}</div>
    </div>
  );
}
