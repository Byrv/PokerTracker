import type { DbBoundary, ProfileRow, SessionRow } from '@/lib/db/boundary';

/**
 * Boundary calls only — no domain logic, no branding. Domain logic lives in `logic.ts`,
 * branding/coercion lives in `factory.ts`. Tests can swap any of these by passing a
 * fake `DbBoundary`.
 */
export type AuthBoundaryUser = { id: string; email: string };

export async function fetchCurrentBoundaryUser(b: DbBoundary): Promise<AuthBoundaryUser | null> {
  return b.auth.getCurrentUser();
}

export async function fetchProfile(b: DbBoundary, userId: string): Promise<ProfileRow | null> {
  return b.profiles.get(userId);
}

export async function sendMagicLink(
  b: DbBoundary,
  email: string,
  redirectTo: string,
): Promise<void> {
  await b.auth.signInWithMagicLink(email, redirectTo);
}

export async function signOutBoundary(b: DbBoundary): Promise<void> {
  await b.auth.signOut();
}

export async function joinSessionRpc(b: DbBoundary, token: string): Promise<SessionRow> {
  return b.auth.joinSessionWithToken(token);
}
