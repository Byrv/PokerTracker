import type { Rule } from '../registry';
import { sumBuyinsPaise, confirmedCashoutFor } from '../helpers';

/**
 * Awarded when the user reloaded mid-session (≥ 2 buy-ins) AND finished the
 * session net positive by more than 2 × big_blind. Proxy for "was deep in the
 * hole and clawed back" since per-hand chip stack history isn't tracked.
 */
export const comebackKid: Rule = {
  key: 'comeback_kid',
  evaluate(ctx) {
    const myBuyinCount = ctx.buyins.reduce((n, b) => (b.user_id === ctx.userId ? n + 1 : n), 0);
    if (myBuyinCount < 2) return null;
    const cashout = confirmedCashoutFor(ctx.cashouts, ctx.userId);
    if (!cashout) return null;
    const totalIn = sumBuyinsPaise(ctx.buyins, ctx.userId);
    const net = Number(cashout.amount_paise) - totalIn;
    const margin = 2 * Number(ctx.session.blinds_big);
    return net > margin ? { key: 'comeback_kid' } : null;
  },
};
