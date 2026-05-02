import type { SessionRow, BuyinRow, CashoutRow } from '@/lib/db/boundary';

export type SessionLedgerSummary = {
  session: SessionRow;
  buyins: BuyinRow[];
  cashouts: CashoutRow[];
};

export type RuleContext = {
  userId: string;
  /** The just-closed session being evaluated. */
  session: SessionRow;
  /** All buy-ins for the just-closed session. */
  buyins: BuyinRow[];
  /** All cash-outs for the just-closed session. */
  cashouts: CashoutRow[];
  /**
   * Per-closed-session ledger summaries (oldest → newest, most-recent included)
   * for sessions where this user was a participant. Includes the just-closed
   * session as the last entry.
   */
  history: SessionLedgerSummary[];
};

export type RuleAward = { key: string };

export type Rule = {
  key: string;
  evaluate: (ctx: RuleContext) => Promise<RuleAward | null> | RuleAward | null;
};

import { firstSession } from './rules/first-session';
import { streak10 } from './rules/streak-10';
import { biggestPot } from './rules/biggest-pot';
import { comebackKid } from './rules/comeback-kid';

/**
 * Registered rules. Adding a new badge: create a new file under
 * `internal/rules/` exporting a `Rule`, then add it to this array.
 * No DB migration required.
 */
export const rules: Rule[] = [firstSession, streak10, biggestPot, comebackKid];
