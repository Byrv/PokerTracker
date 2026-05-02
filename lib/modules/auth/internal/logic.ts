import type { ProfileRow } from '@/lib/db/boundary';
import type { CurrentUser } from '../types';
import { asUserId } from '@/lib/modules/core';
import type { AuthBoundaryUser } from './queries';

/**
 * Pure domain logic. Given the boundary user + (optional) profile row, build the
 * `CurrentUser` shape exposed to consumers. If the profile row is missing, derive
 * a nickname from the email's local-part (matches the README onboarding rule).
 */
export function buildCurrentUser(
  boundaryUser: AuthBoundaryUser,
  profile: ProfileRow | null,
): CurrentUser {
  const nickname = profile?.nickname ?? deriveNicknameFromEmail(boundaryUser.email);
  // ProfileRow.avatar_url is `string | null`; CurrentUser uses `string | undefined`.
  const avatarUrl = profile?.avatar_url ?? undefined;
  const base = {
    id: asUserId(boundaryUser.id),
    email: boundaryUser.email,
    nickname,
  };
  return avatarUrl === undefined ? base : { ...base, avatarUrl };
}

export function deriveNicknameFromEmail(email: string): string {
  // `noUncheckedIndexedAccess` makes `split[0]` `string | undefined` — fall back
  // to the full email if the local-part is empty (defensive; should never trigger
  // on a valid email but keeps the type sound without `!`).
  const [local] = email.split('@');
  return local && local.length > 0 ? local : email;
}

export function notAuthenticatedError(): Error {
  return new Error('not_authenticated');
}
