'use client';

import Link from 'next/link';
import { LogOut, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { PlayerAvatar, type PlayerLike } from './player-avatar';

/**
 * Avatar trigger that opens the current-user menu (profile / settings /
 * sign out). Rendered in the TopBar when a user is signed in.
 */
export function UserMenu({ user }: { user: PlayerLike & { email?: string } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.nickname}`}
        className="focus-visible:ring-ring/50 rounded-full focus-visible:ring-3 focus-visible:outline-none"
      >
        <PlayerAvatar user={user} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-48">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate font-medium">{user.nickname}</span>
            {user.email ? (
              <span className="text-muted-foreground truncate text-xs">{user.email}</span>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserIcon className="size-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          <SettingsIcon className="size-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/sign-out" />}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
