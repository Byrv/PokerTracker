import type { DbBoundary } from '@/lib/db/boundary';
import { asPaise, asSessionId, asUserId } from '@/lib/modules/core';
import type { Profiles } from '../index';
import type { ProfileSummary } from '../types';
import { computeCurrentStreak } from './streak';

type Participation = {
  sessionId: string;
  playedOn: string;
  netPaise: number;
};

export function createProfiles(b: DbBoundary): Profiles {
  return {
    async getProfile(userId): Promise<ProfileSummary> {
      const profile = await b.profiles.get(userId);
      if (!profile) throw new Error('not_found');

      const closedSessions = await b.sessions.list({ status: 'closed' });

      const participation: Participation[] = [];
      for (const s of closedSessions) {
        const parts = await b.sessions.listParticipants(s.id);
        if (!parts.some((p) => p.user_id === userId)) continue;
        const buyins = (await b.buyins.listForSession(s.id)).filter((x) => x.user_id === userId);
        const cashouts = (await b.cashouts.listForSession(s.id)).filter(
          (x) => x.user_id === userId,
        );
        const totalIn = buyins.reduce((acc, x) => acc + Number(x.amount_paise), 0);
        const out = cashouts.reduce((acc, x) => acc + Number(x.amount_paise), 0);
        participation.push({
          sessionId: s.id,
          playedOn: s.played_on,
          netPaise: out - totalIn,
        });
      }

      // Ascending order for bankroll series + streak math; tie-break by sessionId
      // so equal-date sessions keep a stable, deterministic order.
      const ascending = [...participation].sort((a, x) => {
        const cmp = a.playedOn.localeCompare(x.playedOn);
        return cmp !== 0 ? cmp : a.sessionId.localeCompare(x.sessionId);
      });

      // Descending order for `history` per spec.
      const descending = [...ascending].reverse();

      const lifetimeNet = ascending.reduce((acc, x) => acc + x.netPaise, 0);
      const biggestWin = ascending.reduce((acc, x) => (x.netPaise > acc ? x.netPaise : acc), 0);
      const biggestLoss = ascending.reduce((acc, x) => (x.netPaise < acc ? x.netPaise : acc), 0);
      const currentStreak = computeCurrentStreak(ascending.map((x) => x.netPaise));

      let cum = 0;
      const bankrollSeries = ascending.map((x) => {
        cum += x.netPaise;
        return { at: x.playedOn, cumulativeNetPaise: asPaise(cum) };
      });

      const badgeRows = await b.badges.listForUser(userId);
      const badges = badgeRows.map((row) => ({
        key: row.badge_key,
        earnedAt: row.earned_at,
        ...(row.session_id ? { sessionId: asSessionId(row.session_id) } : {}),
      }));

      return {
        user: {
          id: asUserId(profile.user_id),
          nickname: profile.nickname,
          ...(profile.avatar_url ? { avatarUrl: profile.avatar_url } : {}),
        },
        lifetime: {
          netPaise: asPaise(lifetimeNet),
          sessionsPlayed: ascending.length,
          biggestWinPaise: asPaise(biggestWin),
          biggestLossPaise: asPaise(biggestLoss),
          currentStreak,
        },
        badges,
        history: descending.map((x) => ({
          sessionId: asSessionId(x.sessionId),
          playedOn: x.playedOn,
          netPaise: asPaise(x.netPaise),
        })),
        bankrollSeries,
      };
    },

    async updateProfile(patch) {
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error('not_authenticated');
      const updates: Partial<{ nickname: string; avatar_url: string | null }> = {};
      if (patch.nickname !== undefined) updates.nickname = patch.nickname;
      if (patch.avatarUrl !== undefined) updates.avatar_url = patch.avatarUrl;
      await b.profiles.update(me.id, updates);
    },

    async listAllUsers() {
      const rows = await b.profiles.list();
      return rows.map((r) => ({
        id: asUserId(r.user_id),
        nickname: r.nickname,
        ...(r.avatar_url ? { avatarUrl: r.avatar_url } : {}),
      }));
    },
  };
}
