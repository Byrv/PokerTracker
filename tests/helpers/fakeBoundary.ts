import type {
  DbBoundary,
  SessionRow,
  ParticipantRow,
  BuyinRow,
  CashoutRow,
  AuditRow,
  NoteRow,
  PhotoRow,
  BadgeRow,
  ProfileRow,
  AppSettingsRow,
} from '@/lib/db/boundary';

let __id = 0;
const newId = () => `id_${++__id}`;
const now = () => new Date().toISOString();

export type SeedData = {
  users?: Array<{ id: string; email: string; nickname: string }>;
  appSettings?: { chipsPerPaise: number };
  currentUserId?: string;
};

export function createFakeBoundary(seed: SeedData = {}): DbBoundary & {
  __reset: () => void;
  __setCurrentUser: (userId: string | null) => void;
  __dump: () => Record<string, unknown>;
} {
  const profiles = new Map<string, ProfileRow>();
  const sessions = new Map<string, SessionRow>();
  const participants = new Map<string, ParticipantRow>(); // key = sessionId|userId
  const buyins = new Map<string, BuyinRow>();
  const cashouts = new Map<string, CashoutRow>();
  const audit = new Map<string, AuditRow>();
  const notes = new Map<string, NoteRow>();
  const photos = new Map<string, PhotoRow>();
  const badges = new Map<string, BadgeRow>();
  const storage = new Map<string, Blob>();
  let appSettings: AppSettingsRow = {
    id: 1,
    chips_per_paise: seed.appSettings?.chipsPerPaise ?? 1,
    updated_by: null,
    updated_at: now(),
  };
  let currentUserId: string | null = seed.currentUserId ?? null;
  const seededUsers = new Map<string, { id: string; email: string }>();

  for (const u of seed.users ?? []) {
    seededUsers.set(u.id, { id: u.id, email: u.email });
    profiles.set(u.id, {
      user_id: u.id,
      nickname: u.nickname,
      avatar_url: null,
      created_at: now(),
    });
  }

  function assertOpen(sessionId: string) {
    const s = sessions.get(sessionId);
    if (!s) throw new Error('session_not_found');
    if (s.status === 'closed') throw new Error('session_closed');
  }

  function logAudit(input: Omit<AuditRow, 'id' | 'created_at'>) {
    const row: AuditRow = { id: newId(), created_at: now(), ...input };
    audit.set(row.id, row);
  }

  return {
    __reset: () => {
      profiles.clear();
      sessions.clear();
      participants.clear();
      buyins.clear();
      cashouts.clear();
      audit.clear();
      notes.clear();
      photos.clear();
      badges.clear();
      storage.clear();
    },
    __setCurrentUser: (id) => {
      currentUserId = id;
    },
    __dump: () => ({
      profiles,
      sessions,
      participants,
      buyins,
      cashouts,
      audit,
      notes,
      photos,
      badges,
      appSettings,
    }),

    auth: {
      getCurrentUser: async () => {
        if (!currentUserId) return null;
        const u = seededUsers.get(currentUserId);
        if (!u) return null;
        return { id: u.id, email: u.email };
      },
      signInWithMagicLink: async () => {
        /* no-op in tests */
      },
      signOut: async () => {
        currentUserId = null;
      },
      joinSessionWithToken: async (token) => {
        const session = [...sessions.values()].find(
          (s) => s.invite_token === token && s.status === 'open',
        );
        if (!session) throw new Error('invalid_or_closed_invite');
        if (!currentUserId) throw new Error('not_authenticated');
        const key = `${session.id}|${currentUserId}`;
        if (!participants.has(key)) {
          participants.set(key, {
            session_id: session.id,
            user_id: currentUserId,
            joined_at: now(),
          });
        }
        return session;
      },
    },

    profiles: {
      get: async (userId) => profiles.get(userId) ?? null,
      update: async (userId, patch) => {
        const p = profiles.get(userId);
        if (!p) throw new Error('not_found');
        const u = { ...p, ...patch };
        profiles.set(userId, u);
        return u;
      },
    },

    appSettings: {
      get: async () => ({ ...appSettings }),
      update: async (patch) => {
        appSettings = { ...appSettings, ...patch, updated_at: now(), updated_by: currentUserId };
        return { ...appSettings };
      },
    },

    sessions: {
      create: async (input) => {
        const id = input.id ?? newId();
        const row: SessionRow = {
          id,
          created_by: input.created_by!,
          name: input.name ?? null,
          location: input.location ?? null,
          played_on: input.played_on ?? new Date().toISOString().slice(0, 10),
          blinds_small: input.blinds_small!,
          blinds_big: input.blinds_big!,
          chips_per_paise: input.chips_per_paise ?? appSettings.chips_per_paise,
          invite_token: input.invite_token ?? `tok_${id}`,
          status: input.status ?? 'open',
          opened_at: now(),
          closed_at: null,
        };
        sessions.set(id, row);
        participants.set(`${id}|${row.created_by}`, {
          session_id: id,
          user_id: row.created_by,
          joined_at: now(),
        });
        logAudit({
          session_id: id,
          actor_user_id: row.created_by,
          action: 'session_open',
          entity_id: id,
          before_data: null,
          after_data: row,
        });
        return row;
      },
      get: async (id) => sessions.get(id) ?? null,
      list: async (filter) => {
        const rows = [...sessions.values()];
        return filter?.status ? rows.filter((r) => r.status === filter.status) : rows;
      },
      update: async (id, patch) => {
        const old = sessions.get(id);
        if (!old) throw new Error('not_found');
        const updated = { ...old, ...patch };
        sessions.set(id, updated);
        if (old.status === 'open' && updated.status === 'closed') {
          logAudit({
            session_id: id,
            actor_user_id: currentUserId!,
            action: 'session_close',
            entity_id: id,
            before_data: old,
            after_data: updated,
          });
        }
        return updated;
      },
      listParticipants: async (sessionId) =>
        [...participants.values()].filter((p) => p.session_id === sessionId),
      removeParticipant: async (sessionId, userId) => {
        participants.delete(`${sessionId}|${userId}`);
      },
    },

    buyins: {
      create: async (input) => {
        assertOpen(input.session_id!);
        const row: BuyinRow = {
          id: input.id ?? newId(),
          session_id: input.session_id!,
          user_id: input.user_id!,
          amount_paise: input.amount_paise!,
          chips: input.chips!,
          recorded_by: input.recorded_by!,
          recorded_at: now(),
        };
        buyins.set(row.id, row);
        logAudit({
          session_id: row.session_id,
          actor_user_id: row.recorded_by,
          action: 'buyin_create',
          entity_id: row.id,
          before_data: null,
          after_data: row,
        });
        return row;
      },
      update: async (id, patch) => {
        const old = buyins.get(id);
        if (!old) throw new Error('not_found');
        assertOpen(old.session_id);
        const updated = { ...old, ...patch };
        buyins.set(id, updated);
        logAudit({
          session_id: old.session_id,
          actor_user_id: currentUserId!,
          action: 'buyin_edit',
          entity_id: id,
          before_data: old,
          after_data: updated,
        });
        return updated;
      },
      delete: async (id) => {
        const old = buyins.get(id);
        if (!old) return;
        assertOpen(old.session_id);
        buyins.delete(id);
        logAudit({
          session_id: old.session_id,
          actor_user_id: currentUserId!,
          action: 'buyin_delete',
          entity_id: id,
          before_data: old,
          after_data: null,
        });
      },
      listForSession: async (sessionId) =>
        [...buyins.values()].filter((b) => b.session_id === sessionId),
    },

    cashouts: {
      upsert: async (input) => {
        assertOpen(input.session_id!);
        const session = sessions.get(input.session_id!)!;
        const key = [...cashouts.values()].find(
          (c) => c.session_id === input.session_id && c.user_id === input.user_id,
        );
        const id = key?.id ?? input.id ?? newId();
        const row: CashoutRow = {
          id,
          session_id: input.session_id!,
          user_id: input.user_id!,
          chip_count: input.chip_count!,
          amount_paise: input.chip_count! * session.chips_per_paise,
          submitted_by: input.submitted_by!,
          submitted_at: now(),
          confirmed_by: null,
          confirmed_at: null,
          status: 'pending',
        };
        const old = cashouts.get(id) ?? null;
        cashouts.set(id, row);
        logAudit({
          session_id: row.session_id,
          actor_user_id: row.submitted_by,
          action: old ? 'cashout_edit' : 'cashout_submit',
          entity_id: id,
          before_data: old,
          after_data: row,
        });
        return row;
      },
      confirm: async (id, by) => {
        const old = cashouts.get(id);
        if (!old) throw new Error('not_found');
        assertOpen(old.session_id);
        const updated: CashoutRow = {
          ...old,
          status: 'confirmed',
          confirmed_by: by,
          confirmed_at: now(),
        };
        cashouts.set(id, updated);
        logAudit({
          session_id: updated.session_id,
          actor_user_id: by,
          action: 'cashout_confirm',
          entity_id: id,
          before_data: old,
          after_data: updated,
        });
        return updated;
      },
      listForSession: async (sessionId) =>
        [...cashouts.values()].filter((c) => c.session_id === sessionId),
    },

    audit: {
      listForSession: async (sessionId) =>
        [...audit.values()]
          .filter((a) => a.session_id === sessionId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    },

    notes: {
      create: async (input) => {
        const row: NoteRow = { id: newId(), ...input, created_at: now(), updated_at: now() };
        notes.set(row.id, row);
        return row;
      },
      update: async (id, body) => {
        const old = notes.get(id);
        if (!old) throw new Error('not_found');
        const updated = { ...old, body, updated_at: now() };
        notes.set(id, updated);
        return updated;
      },
      delete: async (id) => {
        notes.delete(id);
      },
      listForSession: async (sessionId) =>
        [...notes.values()].filter((n) => n.session_id === sessionId),
    },

    photos: {
      create: async (input) => {
        const row: PhotoRow = {
          id: newId(),
          ...input,
          caption: input.caption ?? null,
          created_at: now(),
        };
        photos.set(row.id, row);
        return row;
      },
      delete: async (id) => {
        photos.delete(id);
      },
      listForSession: async (sessionId) =>
        [...photos.values()].filter((p) => p.session_id === sessionId),
    },

    badges: {
      create: async (input) => {
        const row: BadgeRow = {
          id: newId(),
          ...input,
          session_id: input.session_id ?? null,
          earned_at: now(),
        };
        badges.set(row.id, row);
        return row;
      },
      listForUser: async (userId) => [...badges.values()].filter((b) => b.user_id === userId),
      existsForUserSession: async (userId, badgeKey, sessionId) => {
        return [...badges.values()].some(
          (b) =>
            b.user_id === userId &&
            b.badge_key === badgeKey &&
            (b.session_id ?? null) === (sessionId ?? null),
        );
      },
    },

    storage: {
      upload: async (path, file) => {
        storage.set(path, file as Blob);
        return { path };
      },
      getSignedUrl: async (path) => `fake://storage/${path}`,
      remove: async (path) => {
        storage.delete(path);
      },
    },
  };
}
