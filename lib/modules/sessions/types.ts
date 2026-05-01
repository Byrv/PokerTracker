import type { Paise, SessionId, UserId } from '@/lib/modules/core';

export type Session = {
  id: SessionId;
  createdBy: UserId;
  name?: string;
  location?: string;
  playedOn: string;
  blinds: { small: Paise; big: Paise };
  chipsPerPaise: number;
  status: 'open' | 'closed';
  inviteToken: string;
  participants: UserId[];
};
