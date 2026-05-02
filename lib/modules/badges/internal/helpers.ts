import type { BuyinRow, CashoutRow } from '@/lib/db/boundary';

/** Sum of all buy-in `amount_paise` rows belonging to the given user. */
export function sumBuyinsPaise(buyins: BuyinRow[], userId: string): number {
  let total = 0;
  for (const b of buyins) {
    if (b.user_id === userId) total += Number(b.amount_paise);
  }
  return total;
}

/** Confirmed cashout for the user, if any. (We only count confirmed money.) */
export function confirmedCashoutFor(cashouts: CashoutRow[], userId: string): CashoutRow | null {
  for (const c of cashouts) {
    if (c.user_id === userId && c.status === 'confirmed') return c;
  }
  return null;
}

/** Net P&L for a user in a single session, in paise. Confirmed cashout − total buy-ins. */
export function netForUser(buyins: BuyinRow[], cashouts: CashoutRow[], userId: string): number {
  const totalIn = sumBuyinsPaise(buyins, userId);
  const cashout = confirmedCashoutFor(cashouts, userId);
  const out = cashout ? Number(cashout.amount_paise) : 0;
  return out - totalIn;
}

/** Largest single buy-in (`amount_paise`) made by the user in the session, or 0. */
export function largestSingleBuyin(buyins: BuyinRow[], userId: string): number {
  let max = 0;
  for (const b of buyins) {
    if (b.user_id === userId) {
      const v = Number(b.amount_paise);
      if (v > max) max = v;
    }
  }
  return max;
}
