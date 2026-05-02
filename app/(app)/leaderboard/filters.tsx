'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LeaderboardSort } from '@/lib/modules/leaderboard';

const SORT_OPTIONS: ReadonlyArray<{ value: LeaderboardSort; label: string }> = [
  { value: 'net', label: 'Net (high → low)' },
  { value: 'sessions', label: 'Sessions played' },
  { value: 'winRate', label: 'Win rate' },
  { value: 'biggestWin', label: 'Biggest single win' },
  { value: 'average', label: 'Avg per session' },
];

/**
 * Plain GET form. The server page reads `searchParams` and re-renders.
 * No client state — the URL is the source of truth.
 */
export function LeaderboardFilters({
  from,
  to,
  sort,
}: {
  from: string;
  to: string;
  sort: LeaderboardSort;
}) {
  return (
    <form
      method="get"
      action="/leaderboard"
      className="border-border bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="from">From</Label>
        <Input id="from" name="from" type="date" defaultValue={from} className="w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="to">To</Label>
        <Input id="to" name="to" type="date" defaultValue={to} className="w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="sort">Sort by</Label>
        <select
          id="sort"
          name="sort"
          defaultValue={sort}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="ml-auto flex gap-2">
        <Button type="submit">Apply</Button>
        <Button variant="outline" render={<Link href="/leaderboard">Reset</Link>} />
      </div>
    </form>
  );
}
