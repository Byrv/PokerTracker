import type { DbBoundary } from '@/lib/db/boundary';

/**
 * Throws if there is no signed-in user, the session does not exist, or the
 * current user is not a participant (or house) of the target session.
 *
 * Resolves to the session row when the check succeeds.
 */
export async function assertSessionAccess(
  b: DbBoundary,
  sessionId: string,
): Promise<{ userId: string }> {
  const me = await b.auth.getCurrentUser();
  if (!me) throw new Error('not_authenticated');

  const session = await b.sessions.get(sessionId);
  if (!session) throw new Error('session_not_found');

  const participants = await b.sessions.listParticipants(sessionId);
  const isParticipant = participants.some((p) => p.user_id === me.id);
  const isHouse = session.created_by === me.id;
  if (!isParticipant && !isHouse) throw new Error('forbidden');

  return { userId: me.id };
}

/**
 * Resolves the current user id, throwing on no auth. Used by the full-history
 * export (any signed-in user is allowed).
 */
export async function requireUser(b: DbBoundary): Promise<{ userId: string }> {
  const me = await b.auth.getCurrentUser();
  if (!me) throw new Error('not_authenticated');
  return { userId: me.id };
}
