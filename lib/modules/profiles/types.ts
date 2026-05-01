import type { Paise, SessionId, UserId } from '@/lib/modules/core';

export type ProfileSummary = {
  user: { id: UserId; nickname: string; avatarUrl?: string };
  lifetime: {
    netPaise: Paise;
    sessionsPlayed: number;
    biggestWinPaise: Paise;
    biggestLossPaise: Paise;
    currentStreak: number;
  };
  badges: Array<{ key: string; earnedAt: string; sessionId?: SessionId }>;
  history: Array<{ sessionId: SessionId; playedOn: string; netPaise: Paise }>;
  bankrollSeries: Array<{ at: string; cumulativeNetPaise: Paise }>;
};
