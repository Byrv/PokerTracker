import type { Rule } from '../registry';

/**
 * Awarded when the user's just-closed session is their FIRST closed session.
 * Because `history` includes the just-closed session, length === 1 means this
 * is also the user's first.
 */
export const firstSession: Rule = {
  key: 'first_session',
  evaluate(ctx) {
    return ctx.history.length === 1 ? { key: 'first_session' } : null;
  },
};
