import type { Rule } from '../registry';
import { largestSingleBuyin } from '../helpers';

/**
 * Awarded when the user posts the largest single buy-in IN THE just-closed
 * session — i.e. they are the unique high-buyin holder for that session.
 *
 * (The cross-session "all-time biggest pot" is computed at the leaderboard
 * layer; here we award per-session so each closed session can produce at most
 * one biggest_pot badge.)
 */
export const biggestPot: Rule = {
  key: 'biggest_pot',
  evaluate(ctx) {
    const myMax = largestSingleBuyin(ctx.buyins, ctx.userId);
    if (myMax <= 0) return null;
    // Find session-wide max single buy-in across all participants.
    let sessionMax = 0;
    let holders = 0;
    const perUserMax = new Map<string, number>();
    for (const b of ctx.buyins) {
      const v = Number(b.amount_paise);
      const cur = perUserMax.get(b.user_id) ?? 0;
      if (v > cur) perUserMax.set(b.user_id, v);
    }
    for (const v of perUserMax.values()) {
      if (v > sessionMax) sessionMax = v;
    }
    for (const v of perUserMax.values()) {
      if (v === sessionMax) holders++;
    }
    // Award only if this user uniquely holds the max (no ties).
    return myMax === sessionMax && holders === 1 ? { key: 'biggest_pot' } : null;
  },
};
