import type { Paise, UserId } from '@/lib/modules/core';

export type LeaderboardEntry = {
  userId: UserId;
  nickname: string;
  netPaise: Paise;
  sessionsPlayed: number;
  sessionsWon: number;
  winRate: number;
  biggestWinPaise: Paise;
  averagePerSessionPaise: Paise;
};

export type LeaderboardFilter = { from?: string; to?: string };
export type LeaderboardSort = 'net' | 'sessions' | 'winRate' | 'biggestWin' | 'average';
