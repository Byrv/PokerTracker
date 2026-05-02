import type { DbBoundary, BuyinRow, CashoutRow, AuditRow } from '@/lib/db/boundary';
import type { Ledger } from '../index';
import type { Buyin, Cashout, AuditEntry, PlayerLedger, Reconciliation } from '../types';
import { asChips, asPaise, asSessionId, asUserId } from '@/lib/modules/core';

const rowToBuyin = (r: BuyinRow): Buyin => ({
  id: r.id,
  sessionId: asSessionId(r.session_id),
  userId: asUserId(r.user_id),
  amount: asPaise(Number(r.amount_paise)),
  chips: asChips(Number(r.chips)),
  recordedAt: r.recorded_at,
});

const rowToCashout = (r: CashoutRow): Cashout => ({
  id: r.id,
  sessionId: asSessionId(r.session_id),
  userId: asUserId(r.user_id),
  chipCount: asChips(Number(r.chip_count)),
  amount: asPaise(Number(r.amount_paise)),
  status: r.status,
  submittedBy: asUserId(r.submitted_by),
  confirmedBy: r.confirmed_by ? asUserId(r.confirmed_by) : undefined,
});

const rowToAudit = (r: AuditRow): AuditEntry => ({
  id: r.id,
  sessionId: asSessionId(r.session_id),
  actor: asUserId(r.actor_user_id),
  action: r.action,
  before: r.before_data,
  after: r.after_data,
  createdAt: r.created_at,
});

export function createLedger(b: DbBoundary): Ledger {
  async function requireAuthed() {
    const me = await b.auth.getCurrentUser();
    if (!me) throw new Error('not_authenticated');
    return me;
  }

  async function requireSession(sessionId: string) {
    const s = await b.sessions.get(sessionId);
    if (!s) throw new Error('not_found');
    return s;
  }

  async function requireHouse(sessionId: string) {
    const me = await requireAuthed();
    const session = await requireSession(sessionId);
    if (session.created_by !== me.id) throw new Error('not_house');
    return { me, session };
  }

  async function requireParticipantOrHouse(sessionId: string) {
    const me = await requireAuthed();
    const session = await requireSession(sessionId);
    if (session.created_by === me.id) return { me, session };
    const ps = await b.sessions.listParticipants(sessionId);
    const isParticipant = ps.some((p) => p.user_id === me.id);
    if (!isParticipant) throw new Error('not_participant');
    return { me, session };
  }

  return {
    async recordBuyin({ sessionId, userId, amount }) {
      const { me, session } = await requireHouse(sessionId);
      if (session.status === 'closed') throw new Error('session_closed');
      const amountNum = amount as unknown as number;
      const chips = amountNum * Number(session.chips_per_paise);
      const row = await b.buyins.create({
        session_id: sessionId,
        user_id: userId,
        amount_paise: amountNum,
        chips,
        recorded_by: me.id,
      });
      return rowToBuyin(row);
    },

    async editBuyin(id, patch) {
      // Boundary doesn't expose getById; trust the id. The DB/fake `assert_session_open`
      // trigger guards against closed-session writes.
      await requireAuthed();
      const updatePatch: Partial<BuyinRow> = {};
      if (patch.amount !== undefined) {
        updatePatch.amount_paise = patch.amount as unknown as number;
      }
      const updated = await b.buyins.update(id, updatePatch);
      return rowToBuyin(updated);
    },

    async deleteBuyin(id) {
      await requireAuthed();
      await b.buyins.delete(id);
    },

    async listBuyins(sessionId) {
      await requireParticipantOrHouse(sessionId);
      const rows = await b.buyins.listForSession(sessionId);
      return rows.map(rowToBuyin);
    },

    async submitCashout({ sessionId, userId, chipCount }) {
      const { me, session } = await requireParticipantOrHouse(sessionId);
      if (session.status === 'closed') throw new Error('session_closed');
      // Participants can only submit for themselves; house can submit for anyone.
      if (session.created_by !== me.id && me.id !== (userId as unknown as string)) {
        throw new Error('not_house');
      }
      const chipCountNum = chipCount as unknown as number;
      const row = await b.cashouts.upsert({
        session_id: sessionId,
        user_id: userId,
        chip_count: chipCountNum,
        amount_paise: 0, // computed by trigger / fake
        submitted_by: me.id,
      });
      return rowToCashout(row);
    },

    async confirmCashout(id) {
      const me = await requireAuthed();
      const row = await b.cashouts.confirm(id, me.id);
      return rowToCashout(row);
    },

    async listCashouts(sessionId) {
      await requireParticipantOrHouse(sessionId);
      const rows = await b.cashouts.listForSession(sessionId);
      return rows.map(rowToCashout);
    },

    async getSessionLedger(sessionId): Promise<PlayerLedger[]> {
      await requireParticipantOrHouse(sessionId);
      const [buyinRows, cashoutRows, parts] = await Promise.all([
        b.buyins.listForSession(sessionId),
        b.cashouts.listForSession(sessionId),
        b.sessions.listParticipants(sessionId),
      ]);
      return parts.map((p) => {
        const userBuyins = buyinRows.filter((x) => x.user_id === p.user_id);
        const totalBuyins = userBuyins.reduce((acc, x) => acc + Number(x.amount_paise), 0);
        const co = cashoutRows.find((x) => x.user_id === p.user_id);
        const cashoutPaise = co ? Number(co.amount_paise) : 0;
        return {
          userId: asUserId(p.user_id),
          totalBuyinsPaise: asPaise(totalBuyins),
          cashoutPaise: asPaise(cashoutPaise),
          netPaise: asPaise(cashoutPaise - totalBuyins),
        };
      });
    },

    async getReconciliation(sessionId): Promise<Reconciliation> {
      await requireParticipantOrHouse(sessionId);
      const [buyinRows, cashoutRows] = await Promise.all([
        b.buyins.listForSession(sessionId),
        b.cashouts.listForSession(sessionId),
      ]);
      const expected = buyinRows.reduce((acc, x) => acc + Number(x.amount_paise), 0);
      const actual = cashoutRows
        .filter((x) => x.status === 'confirmed')
        .reduce((acc, x) => acc + Number(x.amount_paise), 0);
      return {
        expected: asPaise(expected),
        actual: asPaise(actual),
        discrepancy: asPaise(expected - actual),
      };
    },

    async listAudit(sessionId) {
      await requireParticipantOrHouse(sessionId);
      const rows = await b.audit.listForSession(sessionId);
      return rows.map(rowToAudit);
    },
  };
}
