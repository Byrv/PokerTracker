import type { Paise, Chips, SessionId, UserId } from '@/lib/modules/core';

export type Buyin = {
  id: string;
  sessionId: SessionId;
  userId: UserId;
  amount: Paise;
  chips: Chips;
  recordedAt: string;
};
export type Cashout = {
  id: string;
  sessionId: SessionId;
  userId: UserId;
  chipCount: Chips;
  amount: Paise;
  status: 'pending' | 'confirmed';
  submittedBy: UserId;
  confirmedBy?: UserId;
};
export type Reconciliation = { expected: Paise; actual: Paise; discrepancy: Paise };
export type PlayerLedger = {
  userId: UserId;
  totalBuyinsPaise: Paise;
  cashoutPaise: Paise;
  netPaise: Paise;
};
export type AuditEntry = {
  id: string;
  sessionId: SessionId;
  actor: UserId;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};
