import type { DbBoundary, SessionRow } from '@/lib/db/boundary';
import { asPaise, asUserId } from '@/lib/modules/core';
import type { Leaderboard } from '../index';
import type { LeaderboardEntry, LeaderboardSort } from '../types';

type Acc = {
  net: number;
  sessions: number;
  wins: number;
  biggestWin: number;
  nickname: string;
};

function inDateRange(s: SessionRow, from?: string, to?: string): boolean {
  if (from && s.played_on < from) return false;
  if (to && s.played_on > to) return false;
  return true;
}

export function createLeaderboard(b: DbBoundary): Leaderboard {
  return {
    async getLeaderboard(filter, sort = 'net') {
      const all = await b.sessions.list({ status: 'closed' });
      const sessions = all.filter((s) => inDateRange(s, filter?.from, filter?.to));

      const acc = new Map<string, Acc>();

      for (const s of sessions) {
        const [buyins, cashouts, parts] = await Promise.all([
          b.buyins.listForSession(s.id),
          b.cashouts.listForSession(s.id),
          b.sessions.listParticipants(s.id),
        ]);

        for (const p of parts) {
          const userBuyins = buyins
            .filter((x) => x.user_id === p.user_id)
            .reduce((a, x) => a + Number(x.amount_paise), 0);
          const co = cashouts.find((x) => x.user_id === p.user_id);
          const cashoutPaise = co ? Number(co.amount_paise) : 0;
          const net = cashoutPaise - userBuyins;

          let cur = acc.get(p.user_id);
          if (!cur) {
            const profile = await b.profiles.get(p.user_id);
            cur = {
              net: 0,
              sessions: 0,
              wins: 0,
              biggestWin: 0,
              nickname: profile?.nickname ?? '',
            };
            acc.set(p.user_id, cur);
          }
          cur.net += net;
          cur.sessions += 1;
          if (net > 0) cur.wins += 1;
          if (net > cur.biggestWin) cur.biggestWin = net;
        }
      }

      const entries: LeaderboardEntry[] = [...acc.entries()].map(([userId, v]) => ({
        userId: asUserId(userId),
        nickname: v.nickname,
        netPaise: asPaise(v.net),
        sessionsPlayed: v.sessions,
        sessionsWon: v.wins,
        winRate: v.sessions > 0 ? v.wins / v.sessions : 0,
        biggestWinPaise: asPaise(v.biggestWin),
        averagePerSessionPaise: asPaise(v.sessions > 0 ? Math.round(v.net / v.sessions) : 0),
      }));

      const sortFn: Record<LeaderboardSort, (a: LeaderboardEntry, b: LeaderboardEntry) => number> =
        {
          net: (a, b) => b.netPaise - a.netPaise,
          sessions: (a, b) => b.sessionsPlayed - a.sessionsPlayed,
          winRate: (a, b) => b.winRate - a.winRate,
          biggestWin: (a, b) => b.biggestWinPaise - a.biggestWinPaise,
          average: (a, b) => b.averagePerSessionPaise - a.averagePerSessionPaise,
        };
      return entries.sort(sortFn[sort]);
    },
  };
}
