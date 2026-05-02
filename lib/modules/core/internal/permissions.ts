import type { Permission, UserId } from '../types';

/**
 * Decide a user's permission for a session: house (creator), participant, or none.
 */
export function permissionFor(
  userId: UserId,
  session: { createdBy: UserId; participants: UserId[] },
): Permission {
  if (session.createdBy === userId) return 'house';
  if (session.participants.includes(userId)) return 'participant';
  return 'none';
}

/**
 * Throws `session_closed` if the session is not open. Used as a guard on every
 * write path before mutating ledger/media state.
 */
export function assertSessionOpen(s: { status: 'open' | 'closed' }): void {
  if (s.status === 'closed') {
    throw new Error('session_closed');
  }
}
