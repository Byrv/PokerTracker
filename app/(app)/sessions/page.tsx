import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { getModules } from '@/lib/modules';

type StatusFilter = 'open' | 'closed';

const FILTERS: Array<{ key: StatusFilter | 'all'; label: string; href: string }> = [
  { key: 'all', label: 'All', href: '/sessions' },
  { key: 'open', label: 'Open', href: '/sessions?status=open' },
  { key: 'closed', label: 'Closed', href: '/sessions?status=closed' },
];

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: StatusFilter }>;
}) {
  const params = await searchParams;
  const { sessions } = await getModules();
  const list = await sessions.listSessions(params.status ? { status: params.status } : undefined);

  const activeKey: StatusFilter | 'all' = params.status ?? 'all';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sessions</h1>
        <Button render={<Link href="/sessions/new">New session</Link>} />
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => {
          const isActive = activeKey === f.key;
          return (
            <Link
              key={f.key}
              href={f.href}
              className={
                isActive
                  ? 'rounded-full bg-[var(--surface)] px-3 py-1 text-sm font-medium ring-1 ring-[var(--border)]'
                  : 'rounded-full px-3 py-1 text-sm text-[var(--foreground)]/70 hover:text-[var(--foreground)]'
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Create one to get started."
          cta={<Button render={<Link href="/sessions/new">Create session</Link>} />}
        />
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id}>
              <Link href={`/sessions/${s.id}`} className="block">
                <Card className="transition-colors hover:ring-[var(--accent)]">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {s.name ?? `Session ${s.playedOn}`}
                      </div>
                      <div className="truncate text-sm text-[var(--foreground)]/70">
                        {s.location ?? '—'} · {s.playedOn} · {s.participants.length} player
                        {s.participants.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-xs tracking-wide text-[var(--foreground)]/70 uppercase">
                      {s.status}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
