import type { DbBoundary, SessionRow } from '@/lib/db/boundary';
import type { Badges } from '../index';
import type { Badge } from '../types';
import { asSessionId } from '@/lib/modules/core';
import { rules, type RuleContext, type SessionLedgerSummary } from './registry';

export function createBadges(b: DbBoundary): Badges {
  return {
    async evaluateBadgesForSession(sessionId): Promise<Badge[]> {
      const session = await b.sessions.get(sessionId);
      if (!session || session.status !== 'closed') return [];

      const parts = await b.sessions.listParticipants(sessionId);
      const buyins = await b.buyins.listForSession(sessionId);
      const cashouts = await b.cashouts.listForSession(sessionId);

      const newlyAwarded: Badge[] = [];

      for (const p of parts) {
        const history = await loadUserHistory(b, p.user_id, session);
        const ctx: RuleContext = {
          userId: p.user_id,
          session,
          buyins,
          cashouts,
          history,
        };
        for (const rule of rules) {
          const earned = await rule.evaluate(ctx);
          if (!earned) continue;
          const exists = await b.badges.existsForUserSession(p.user_id, earned.key, sessionId);
          if (exists) continue;
          const row = await b.badges.create({
            user_id: p.user_id,
            badge_key: earned.key,
            session_id: sessionId,
          });
          newlyAwarded.push({
            key: row.badge_key,
            earnedAt: row.earned_at,
            sessionId: row.session_id ? asSessionId(row.session_id) : undefined,
          });
        }
      }

      return newlyAwarded;
    },

    async listBadgesForUser(userId): Promise<Badge[]> {
      const rows = await b.badges.listForUser(userId);
      return rows.map((r) => ({
        key: r.badge_key,
        earnedAt: r.earned_at,
        sessionId: r.session_id ? asSessionId(r.session_id) : undefined,
      }));
    },
  };
}

/**
 * Build per-closed-session ledger summaries for sessions where `userId`
 * participated. Sorted oldest → newest by `played_on` then `opened_at`.
 *
 * The current `session` is guaranteed to appear (already closed by caller's
 * contract). We build it on top of the listed sessions to avoid sort-order
 * surprises and ensure idempotency when called repeatedly.
 */
async function loadUserHistory(
  b: DbBoundary,
  userId: string,
  current: SessionRow,
): Promise<SessionLedgerSummary[]> {
  const closed = await b.sessions.list({ status: 'closed' });
  const mine: SessionRow[] = [];
  for (const s of closed) {
    const parts = await b.sessions.listParticipants(s.id);
    if (parts.some((p) => p.user_id === userId)) mine.push(s);
  }
  // Defensive: ensure current is in the set.
  if (!mine.some((s) => s.id === current.id)) mine.push(current);

  mine.sort((a, b2) => {
    const ad = a.played_on ?? '';
    const bd = b2.played_on ?? '';
    if (ad !== bd) return ad < bd ? -1 : 1;
    const ao = a.opened_at ?? '';
    const bo = b2.opened_at ?? '';
    if (ao !== bo) return ao < bo ? -1 : 1;
    return a.id < b2.id ? -1 : a.id > b2.id ? 1 : 0;
  });

  const out: SessionLedgerSummary[] = [];
  for (const s of mine) {
    const sBuyins = await b.buyins.listForSession(s.id);
    const sCashouts = await b.cashouts.listForSession(s.id);
    out.push({ session: s, buyins: sBuyins, cashouts: sCashouts });
  }
  return out;
}
