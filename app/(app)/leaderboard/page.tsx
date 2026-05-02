import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, MoneyAmount, PlayerRow } from '@/components/shared';
import { getModules } from '@/lib/modules';
import type { LeaderboardSort } from '@/lib/modules/leaderboard';

import { LeaderboardFilters } from './filters';

const SORT_VALUES = ['net', 'sessions', 'winRate', 'biggestWin', 'average'] as const;

function parseSort(raw: string | undefined): LeaderboardSort {
  if (raw && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as LeaderboardSort;
  }
  return 'net';
}

function rankAccent(index: number): string {
  if (index === 0) return 'border-l-4 border-[#d4af37]'; // gold
  if (index === 1) return 'border-l-4 border-[#c0c0c0]'; // silver
  if (index === 2) return 'border-l-4 border-[#cd7f32]'; // bronze
  return '';
}

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ?? '';
  const to = params.to ?? '';
  const sort = parseSort(params.sort);

  const { leaderboard } = await getModules();
  const board = await leaderboard.getLeaderboard(
    {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
    sort,
  );

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-xl font-semibold">Leaderboard</h1>

      <LeaderboardFilters from={from} to={to} sort={sort} />

      {board.length === 0 ? (
        <EmptyState
          title="No closed sessions yet"
          description="Play and close a session to populate the leaderboard."
        />
      ) : (
        <Card>
          <CardContent className="divide-border divide-y p-4">
            {board.map((row, i) => (
              <div key={row.userId} className={rankAccent(i)}>
                <PlayerRow
                  user={{ nickname: row.nickname }}
                  amount={
                    <MoneyAmount
                      value={row.netPaise}
                      variant={row.netPaise >= 0 ? 'profit' : 'loss'}
                      showSign
                    />
                  }
                  hint={
                    <>
                      #{i + 1} · {row.sessionsPlayed}{' '}
                      {row.sessionsPlayed === 1 ? 'session' : 'sessions'} ·{' '}
                      {(row.winRate * 100).toFixed(0)}% win rate · biggest{' '}
                      <MoneyAmount value={row.biggestWinPaise} variant="profit" size="sm" /> · avg{' '}
                      <MoneyAmount
                        value={row.averagePerSessionPaise}
                        variant={row.averagePerSessionPaise >= 0 ? 'profit' : 'loss'}
                        size="sm"
                      />
                    </>
                  }
                  className="px-3"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
