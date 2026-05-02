import type { DbBoundary, SessionRow } from '@/lib/db/boundary';
import type { Sessions } from '../index';
import type { Session } from '../types';
import { asPaise, asSessionId, asUserId, type UserId } from '@/lib/modules/core';

function rowToSession(row: SessionRow, participants: UserId[]): Session {
  return {
    id: asSessionId(row.id),
    createdBy: asUserId(row.created_by),
    name: row.name ?? undefined,
    location: row.location ?? undefined,
    playedOn: row.played_on,
    blinds: {
      small: asPaise(Number(row.blinds_small)),
      big: asPaise(Number(row.blinds_big)),
    },
    chipsPerPaise: Number(row.chips_per_paise),
    status: row.status,
    inviteToken: row.invite_token,
    participants,
  };
}

export function createSessions(b: DbBoundary): Sessions {
  async function loadParticipants(sessionId: string): Promise<UserId[]> {
    const ps = await b.sessions.listParticipants(sessionId);
    return ps.map((p) => asUserId(p.user_id));
  }

  return {
    async createSession(input) {
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error('not_authenticated');
      const settings = await b.appSettings.get();
      const row = await b.sessions.create({
        created_by: me.id,
        name: input.name ?? null,
        location: input.location ?? null,
        blinds_small: input.blinds.small as number,
        blinds_big: input.blinds.big as number,
        chips_per_paise: settings.chips_per_paise,
      });
      const participants = await loadParticipants(row.id);
      return rowToSession(row, participants);
    },

    async getSession(id) {
      const row = await b.sessions.get(id);
      if (!row) throw new Error('not_found');
      const participants = await loadParticipants(id);
      return rowToSession(row, participants);
    },

    async listSessions(filter) {
      const rows = await b.sessions.list(filter);
      return Promise.all(
        rows.map(async (row) => rowToSession(row, await loadParticipants(row.id))),
      );
    },

    async addParticipant(sessionId, userId) {
      // Idempotent: if already a participant, no-op. Otherwise delegate to
      // the boundary which (in production) calls the house_add_participant
      // RPC — that RPC enforces is_session_house and session-must-be-open at
      // the DB level. We mirror those checks here for clearer error messages.
      const ps = await b.sessions.listParticipants(sessionId);
      if (ps.some((p) => p.user_id === (userId as string))) return;
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error('not_authenticated');
      const session = await b.sessions.get(sessionId);
      if (!session) throw new Error('not_found');
      if (session.created_by !== me.id) throw new Error('not_house');
      if (session.status === 'closed') throw new Error('session_closed');
      await b.sessions.addParticipant(sessionId, userId as unknown as string);
    },

    async removeParticipant(sessionId, userId) {
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error('not_authenticated');
      const session = await b.sessions.get(sessionId);
      if (!session) throw new Error('not_found');
      if (session.created_by !== me.id) throw new Error('not_house');
      if (session.status === 'closed') throw new Error('session_closed');
      await b.sessions.removeParticipant(sessionId, userId as string);
    },

    async closeSession(sessionId) {
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error('not_authenticated');
      const session = await b.sessions.get(sessionId);
      if (!session) throw new Error('not_found');
      if (session.created_by !== me.id) throw new Error('not_house');
      if (session.status === 'closed') throw new Error('already_closed');

      const cashouts = await b.cashouts.listForSession(sessionId);
      const allConfirmed = cashouts.every((c) => c.status === 'confirmed');
      if (!allConfirmed) throw new Error('cashouts_incomplete');

      const updated = await b.sessions.update(sessionId, {
        status: 'closed',
        closed_at: new Date().toISOString(),
      });
      const participants = await loadParticipants(sessionId);
      return rowToSession(updated, participants);
    },

    async generateInviteUrl(sessionId) {
      const session = await b.sessions.get(sessionId);
      if (!session) throw new Error('not_found');
      const origin = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';
      return `${origin}/join/${session.invite_token}`;
    },
  };
}
