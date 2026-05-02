import { Scroll, Settings, Trophy, User } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type NavLink = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const primaryNav: ReadonlyArray<NavLink> = [
  { href: '/sessions', label: 'Sessions', icon: Scroll },
  { href: '/leaderboard', label: 'Board', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];
