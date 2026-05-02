import type { DbBoundary, SessionRow } from '@/lib/db/boundary';

export type PlayerRow = {
  userId: string;
  nickname: string;
  totalBuyinsPaise: number;
  cashoutPaise: number;
  netPaise: number;
};

/**
 * Compute a per-participant rollup for a single session by reading directly
 * from the boundary. Inlines the chip → paise math so this module does not
 * depend on `core.withBoundary` (which sibling agents may not have shipped).
 *
 * - `totalBuyinsPaise` = Σ buyin.amount_paise for the user.
 * - `cashoutPaise` = the most recent cashout's amount (boundary upserts a
 *    single row per (session,user); we take whichever row is present, or 0).
 * - `netPaise` = cashoutPaise − totalBuyinsPaise.
 */
export async function getSessionPlayerRows(
  b: DbBoundary,
  session: SessionRow,
): Promise<PlayerRow[]> {
  const [participants, buyins, cashouts] = await Promise.all([
    b.sessions.listParticipants(session.id),
    b.buyins.listForSession(session.id),
    b.cashouts.listForSession(session.id),
  ]);

  const rows: PlayerRow[] = [];
  for (const p of participants) {
    const userBuyins = buyins.filter((x) => x.user_id === p.user_id);
    const totalBuyinsPaise = userBuyins.reduce((acc, x) => acc + x.amount_paise, 0);

    // In the v1 schema there is one cashout row per (session, user) — boundary
    // upserts it. We use that single row; if absent, the player has not cashed out.
    const cashout = cashouts.find((x) => x.user_id === p.user_id);
    const cashoutPaise = cashout?.amount_paise ?? 0;

    const profile = await b.profiles.get(p.user_id);
    rows.push({
      userId: p.user_id,
      nickname: profile?.nickname ?? p.user_id,
      totalBuyinsPaise,
      cashoutPaise,
      netPaise: cashoutPaise - totalBuyinsPaise,
    });
  }
  return rows;
}

/**
 * Sum of buy-ins minus sum of cashouts. On a reconciled session this is zero;
 * any non-zero value is the discrepancy reported in the PDF footer.
 */
export function reconciliation(rows: PlayerRow[]): {
  expectedPaise: number;
  actualPaise: number;
  discrepancyPaise: number;
} {
  const expectedPaise = rows.reduce((a, r) => a + r.totalBuyinsPaise, 0);
  const actualPaise = rows.reduce((a, r) => a + r.cashoutPaise, 0);
  return {
    expectedPaise,
    actualPaise,
    discrepancyPaise: expectedPaise - actualPaise,
  };
}

/** Convert paise to a fixed-2 INR string (e.g. 12345 → "123.45"). */
export function paiseToInrString(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${rupees}.${remainder.toString().padStart(2, '0')}`;
}
