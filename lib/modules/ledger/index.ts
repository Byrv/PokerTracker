import type { DbBoundary } from '@/lib/db/boundary';
import type { Paise, Chips, SessionId, UserId } from '@/lib/modules/core';
import { createLedger } from './internal/factory';
export * from './types';

export interface Ledger {
  recordBuyin(input: {
    sessionId: SessionId;
    userId: UserId;
    amount: Paise;
  }): Promise<import('./types').Buyin>;
  editBuyin(id: string, patch: { amount?: Paise }): Promise<import('./types').Buyin>;
  deleteBuyin(id: string): Promise<void>;
  listBuyins(sessionId: SessionId): Promise<import('./types').Buyin[]>;

  submitCashout(input: {
    sessionId: SessionId;
    userId: UserId;
    chipCount: Chips;
  }): Promise<import('./types').Cashout>;
  confirmCashout(id: string): Promise<import('./types').Cashout>;
  listCashouts(sessionId: SessionId): Promise<import('./types').Cashout[]>;

  getSessionLedger(sessionId: SessionId): Promise<import('./types').PlayerLedger[]>;
  getReconciliation(sessionId: SessionId): Promise<import('./types').Reconciliation>;

  listAudit(sessionId: SessionId): Promise<import('./types').AuditEntry[]>;
}

export const withBoundary = (b: DbBoundary): Ledger => createLedger(b);
