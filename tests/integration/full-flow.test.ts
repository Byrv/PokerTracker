import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import Papa from 'papaparse';

import * as auth from '@/lib/modules/auth';
import * as sessions from '@/lib/modules/sessions';
import * as ledger from '@/lib/modules/ledger';
import * as leaderboard from '@/lib/modules/leaderboard';
import * as profiles from '@/lib/modules/profiles';
import * as badges from '@/lib/modules/badges';
import * as exportMod from '@/lib/modules/export';

import { asChips, asPaise, asSessionId, asUserId } from '@/lib/modules/core';
import type { SessionId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '../helpers/fixtures';
import { createFakeBoundary } from '../helpers/fakeBoundary';

/**
 * Cross-module integration smoke. Wires every real module to the in-memory
 * fake boundary and walks the canonical poker-night flow end-to-end:
 * create → invite → join → buyins → cashouts (submit + confirm) → reconcile
 * → close → badges → leaderboard → profile → export → audit.
 *
 * If a module's public contract drifts from what its callers expect, this
 * test catches it before Phase 2 ships.
 */

const AMAN = 'u-aman';
const RAVI = 'u-ravi';

type Boundary = ReturnType<typeof createFakeBoundary>;

function wireModules(b: Boundary) {
  return {
    auth: auth.withBoundary(b),
    sessions: sessions.withBoundary(b),
    ledger: ledger.withBoundary(b),
    leaderboard: leaderboard.withBoundary(b),
    profiles: profiles.withBoundary(b),
    badges: badges.withBoundary(b),
    export: exportMod.withBoundary(b),
  };
}

describe('integration/full-flow', () => {
  let b: Boundary;
  let mods: ReturnType<typeof wireModules>;

  beforeEach(() => {
    b = createFakeBoundary({
      users: FIXTURE_USERS,
      currentUserId: AMAN,
      appSettings: { chipsPerPaise: 1 },
    });
    mods = wireModules(b);
  });

  it('complete poker night flow: open → join → buyins → cashouts → reconcile → close → badges → leaderboard → profile → export → audit', async () => {
    // 1. Aman creates a session.
    const session = await mods.sessions.createSession({
      name: 'Friday Night',
      location: 'Aman house',
      blinds: { small: asPaise(100), big: asPaise(200) },
    });
    expect(session.createdBy).toBe(AMAN);
    expect(session.status).toBe('open');
    expect(session.participants).toEqual([AMAN]);
    const sessionId: SessionId = session.id;

    // 2. Generate invite URL — must contain the session's token.
    const inviteUrl = await mods.sessions.generateInviteUrl(sessionId);
    expect(inviteUrl).toContain('/join/');
    expect(inviteUrl).toContain(session.inviteToken);

    // 3. Ravi joins via the token (auth-flavored path).
    b.__setCurrentUser(RAVI);
    const joinedId = await mods.auth.joinSessionByToken(session.inviteToken);
    expect(joinedId).toBe(sessionId);
    // Confirm participant list now includes Ravi.
    b.__setCurrentUser(AMAN);
    const afterJoin = await mods.sessions.getSession(sessionId);
    expect(afterJoin.participants).toEqual(expect.arrayContaining([AMAN, RAVI]));
    expect(afterJoin.participants).toHaveLength(2);

    // 4. House records buy-ins for both players.
    const amanBuyin = await mods.ledger.recordBuyin({
      sessionId,
      userId: asUserId(AMAN),
      amount: asPaise(50_000),
    });
    const raviBuyin = await mods.ledger.recordBuyin({
      sessionId,
      userId: asUserId(RAVI),
      amount: asPaise(50_000),
    });
    expect(amanBuyin.amount).toBe(50_000);
    expect(raviBuyin.amount).toBe(50_000);
    // chipsPerPaise === 1, so chips equals amount.
    expect(amanBuyin.chips).toBe(50_000);
    expect(raviBuyin.chips).toBe(50_000);
    const buyinList = await mods.ledger.listBuyins(sessionId);
    expect(buyinList).toHaveLength(2);

    // 5. Ravi submits his own cashout — pending.
    b.__setCurrentUser(RAVI);
    const raviCashout = await mods.ledger.submitCashout({
      sessionId,
      userId: asUserId(RAVI),
      chipCount: asChips(60_000),
    });
    expect(raviCashout.status).toBe('pending');
    expect(raviCashout.submittedBy).toBe(RAVI);
    expect(raviCashout.amount).toBe(60_000);

    // 6. Aman confirms Ravi's cashout.
    b.__setCurrentUser(AMAN);
    const raviConfirmed = await mods.ledger.confirmCashout(raviCashout.id);
    expect(raviConfirmed.status).toBe('confirmed');
    expect(raviConfirmed.confirmedBy).toBe(AMAN);

    // 7. Aman submits + confirms his own cashout.
    const amanCashout = await mods.ledger.submitCashout({
      sessionId,
      userId: asUserId(AMAN),
      chipCount: asChips(40_000),
    });
    expect(amanCashout.status).toBe('pending');
    const amanConfirmed = await mods.ledger.confirmCashout(amanCashout.id);
    expect(amanConfirmed.status).toBe('confirmed');

    // 8. Reconciliation — sum of buyins vs sum of confirmed cashouts.
    const recon = await mods.ledger.getReconciliation(sessionId);
    expect(recon.expected).toBe(100_000); // 50k + 50k
    expect(recon.actual).toBe(100_000); // 60k + 40k
    expect(recon.discrepancy).toBe(0);

    // Per-player ledger sanity: nets sum to zero on a balanced session.
    const playerLedger = await mods.ledger.getSessionLedger(sessionId);
    const amanRow = playerLedger.find((p) => p.userId === AMAN);
    const raviRow = playerLedger.find((p) => p.userId === RAVI);
    expect(amanRow?.netPaise).toBe(-10_000);
    expect(raviRow?.netPaise).toBe(10_000);

    // 9. Aman closes the session — every cashout is confirmed.
    const closed = await mods.sessions.closeSession(sessionId);
    expect(closed.status).toBe('closed');

    // Audit log must reflect session_close.
    const auditAfterClose = await mods.ledger.listAudit(sessionId);
    expect(auditAfterClose.some((a) => a.action === 'session_close')).toBe(true);

    // 10. Trying to record a buy-in on the closed session must fail.
    await expect(
      mods.ledger.recordBuyin({
        sessionId,
        userId: asUserId(AMAN),
        amount: asPaise(1_000),
      }),
    ).rejects.toThrow('session_closed');

    // 11. Badges evaluation — first_session for the two new players.
    const awarded = await mods.badges.evaluateBadgesForSession(sessionId);
    expect(awarded.length).toBeGreaterThanOrEqual(1);
    const awardedKeys = awarded.map((a) => a.key);
    expect(awardedKeys).toContain('first_session');
    // Both participants on their first session → two first_session awards.
    expect(awarded.filter((a) => a.key === 'first_session')).toHaveLength(2);

    // Idempotent re-evaluation — no double-awards.
    const reAwarded = await mods.badges.evaluateBadgesForSession(sessionId);
    expect(reAwarded.filter((a) => a.key === 'first_session')).toHaveLength(0);

    // 12. Leaderboard — one closed session, both players present, nets correct.
    const board = await mods.leaderboard.getLeaderboard();
    expect(board).toHaveLength(2);
    const lbAman = board.find((e) => e.userId === AMAN);
    const lbRavi = board.find((e) => e.userId === RAVI);
    expect(lbAman?.sessionsPlayed).toBe(1);
    expect(lbRavi?.sessionsPlayed).toBe(1);
    expect(lbAman?.netPaise).toBe(-10_000);
    expect(lbRavi?.netPaise).toBe(10_000);
    expect(lbAman?.sessionsWon).toBe(0);
    expect(lbRavi?.sessionsWon).toBe(1);
    expect(lbRavi?.biggestWinPaise).toBe(10_000);
    // Default sort = net descending → Ravi first.
    expect(board[0]?.userId).toBe(RAVI);

    // 13. Profile lookups — lifetime + history + badges populated.
    const amanProfile = await mods.profiles.getProfile(asUserId(AMAN));
    expect(amanProfile.user.id).toBe(AMAN);
    expect(amanProfile.user.nickname).toBe('Aman');
    expect(amanProfile.lifetime.sessionsPlayed).toBe(1);
    expect(amanProfile.lifetime.netPaise).toBe(-10_000);
    expect(amanProfile.lifetime.biggestLossPaise).toBe(-10_000);
    expect(amanProfile.history).toHaveLength(1);
    expect(amanProfile.history[0]?.sessionId).toBe(sessionId);
    expect(amanProfile.badges.length).toBeGreaterThan(0);
    expect(amanProfile.badges.some((b2) => b2.key === 'first_session')).toBe(true);
    expect(amanProfile.bankrollSeries).toHaveLength(1);

    const raviProfile = await mods.profiles.getProfile(asUserId(RAVI));
    expect(raviProfile.lifetime.sessionsPlayed).toBe(1);
    expect(raviProfile.lifetime.netPaise).toBe(10_000);
    expect(raviProfile.lifetime.biggestWinPaise).toBe(10_000);

    // 14. Export CSV — non-empty Blob with the documented columns.
    const csvBlob = await mods.export.exportSessionCSV(sessionId);
    expect(csvBlob).toBeInstanceOf(Blob);
    expect(csvBlob.size).toBeGreaterThan(0);
    expect(csvBlob.type).toContain('text/csv');
    const csvText = await csvBlob.text();
    expect(csvText).toContain(`# session_id,${sessionId}`);

    const tableText = csvText
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .join('\n')
      .trim();
    const parsed = Papa.parse<Record<string, string>>(tableText, {
      header: true,
      skipEmptyLines: true,
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.meta.fields).toEqual([
      'session_id',
      'played_on',
      'user_id',
      'nickname',
      'total_buyins_paise',
      'cashout_paise',
      'net_paise',
      'total_buyins_inr',
      'cashout_inr',
      'net_inr',
    ]);
    expect(parsed.data).toHaveLength(2);
    const csvAman = parsed.data.find((r) => r.user_id === AMAN);
    const csvRavi = parsed.data.find((r) => r.user_id === RAVI);
    expect(csvAman?.net_paise).toBe('-10000');
    expect(csvRavi?.net_paise).toBe('10000');

    // 15. Export PDF — produces a non-empty Blob.
    // The PDF renderer uses a React reconciler, so wrap in act() to keep the
    // jsdom environment quiet (our setup.ts treats console.error as fatal).
    let pdfBlob!: Blob;
    await act(async () => {
      pdfBlob = await mods.export.exportSessionPDF(sessionId);
    });
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.size).toBeGreaterThan(0);
    expect(pdfBlob.type).toContain('pdf');

    // 16. Audit log — full journey present.
    const audit = await mods.ledger.listAudit(sessionId);
    const actions = audit.map((a) => a.action);
    expect(actions).toContain('session_open');
    expect(actions).toContain('buyin_create');
    expect(actions).toContain('cashout_submit');
    expect(actions).toContain('cashout_confirm');
    expect(actions).toContain('session_close');
    // Two buy-ins → at least two buyin_create entries.
    expect(audit.filter((a) => a.action === 'buyin_create')).toHaveLength(2);
    // Two cashouts → two submit + two confirm entries.
    expect(audit.filter((a) => a.action === 'cashout_submit')).toHaveLength(2);
    expect(audit.filter((a) => a.action === 'cashout_confirm')).toHaveLength(2);
    // session_open precedes session_close in absolute time order.
    const opens = audit.filter((a) => a.action === 'session_open');
    const closes = audit.filter((a) => a.action === 'session_close');
    expect(opens).toHaveLength(1);
    expect(closes).toHaveLength(1);
    expect(opens[0]!.createdAt <= closes[0]!.createdAt).toBe(true);
  });

  it('rejects buy-ins on a closed session via the contract that real Supabase enforces', async () => {
    // Stand-alone smoke for the lockout guarantee — this is the property the
    // ledger module advertises and that downstream UI relies on.
    const session = await mods.sessions.createSession({
      blinds: { small: asPaise(100), big: asPaise(200) },
    });
    await mods.sessions.closeSession(asSessionId(session.id));
    await expect(
      mods.ledger.recordBuyin({
        sessionId: asSessionId(session.id),
        userId: asUserId(AMAN),
        amount: asPaise(1_000),
      }),
    ).rejects.toThrow('session_closed');
  });
});
