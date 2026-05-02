import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type PlayerAvatarSize = 'sm' | 'md' | 'lg';

export type PlayerLike = {
  nickname: string;
  avatarUrl?: string | null;
};

function initialsFor(nickname: string) {
  return (
    nickname
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

/**
 * Avatar for a player. Falls back to initials when no avatar URL is set.
 * Sizes map roughly to: sm = list rows, md = headers, lg = profile hero.
 */
export function PlayerAvatar({
  user,
  size = 'md',
  className,
}: {
  user: PlayerLike;
  size?: PlayerAvatarSize;
  className?: string;
}) {
  const sizeClass = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-14 text-base',
  }[size];

  return (
    <Avatar
      className={cn(sizeClass, className)}
      aria-label={user.nickname}
      data-size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'}
    >
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.nickname} /> : null}
      <AvatarFallback>{initialsFor(user.nickname)}</AvatarFallback>
    </Avatar>
  );
}
