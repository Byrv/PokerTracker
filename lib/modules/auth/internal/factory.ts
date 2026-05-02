import type { DbBoundary } from '@/lib/db/boundary';
import type { Auth } from '../index';
import type { CurrentUser, SessionId } from '../types';
import { asSessionId } from '@/lib/modules/core';
import {
  fetchCurrentBoundaryUser,
  fetchProfile,
  joinSessionRpc,
  sendMagicLink,
  signOutBoundary,
} from './queries';
import { buildCurrentUser, notAuthenticatedError } from './logic';

export function createAuth(b: DbBoundary): Auth {
  async function getCurrentUser(): Promise<CurrentUser | null> {
    const boundaryUser = await fetchCurrentBoundaryUser(b);
    if (!boundaryUser) return null;
    const profile = await fetchProfile(b, boundaryUser.id);
    return buildCurrentUser(boundaryUser, profile);
  }

  return {
    async signInWithMagicLink(email, redirectTo) {
      await sendMagicLink(b, email, redirectTo);
    },

    async signOut() {
      await signOutBoundary(b);
    },

    getCurrentUser,

    async requireUser(): Promise<CurrentUser> {
      const user = await getCurrentUser();
      if (!user) throw notAuthenticatedError();
      return user;
    },

    async joinSessionByToken(token): Promise<SessionId> {
      const session = await joinSessionRpc(b, token);
      return asSessionId(session.id);
    },
  };
}
