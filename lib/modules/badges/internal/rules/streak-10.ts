import type { Rule } from '../registry';
import { netForUser } from '../helpers';

/**
 * Awarded when the user has 10 consecutive WINNING sessions (net > 0)
 * ending with the just-closed session.
 *
 * `ctx.history` is sorted oldest → newest and includes the current session as
 * the last entry, so we walk backwards counting consecutive wins.
 */
export const streak10: Rule = {
  key: 'streak_10',
  evaluate(ctx) {
    if (ctx.history.length < 10) return null;
    let streak = 0;
    for (let i = ctx.history.length - 1; i >= 0; i--) {
      const slot = ctx.history[i];
      if (!slot) break;
      const net = netForUser(slot.buyins, slot.cashouts, ctx.userId);
      if (net > 0) {
        streak += 1;
        if (streak >= 10) return { key: 'streak_10' };
      } else {
        break;
      }
    }
    return null;
  },
};
