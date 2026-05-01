import type { Database } from './types';

type Tables = Database['public']['Tables'];

// Public types every module's index.ts may re-export. These match DB row shapes
// at the boundary; modules' own DTOs may differ.
export type SessionRow = Tables['sessions']['Row'];
export type SessionInsert = Tables['sessions']['Insert'];
export type SessionUpdate = Tables['sessions']['Update'];
export type ParticipantRow = Tables['session_participants']['Row'];
export type BuyinRow = Tables['buyins']['Row'];
export type BuyinInsert = Tables['buyins']['Insert'];
export type CashoutRow = Tables['cashouts']['Row'];
export type CashoutInsert = Tables['cashouts']['Insert'];
export type AuditRow = Tables['audit_log']['Row'];
export type NoteRow = Tables['notes']['Row'];
export type PhotoRow = Tables['photos']['Row'];
export type BadgeRow = Tables['badges']['Row'];
export type ProfileRow = Tables['profiles']['Row'];
export type AppSettingsRow = Tables['app_settings']['Row'];

export interface DbBoundary {
  // Auth
  auth: {
    getCurrentUser: () => Promise<{ id: string; email: string } | null>;
    signInWithMagicLink: (email: string, redirectTo: string) => Promise<void>;
    signOut: () => Promise<void>;
    joinSessionWithToken: (token: string) => Promise<SessionRow>;
  };
  // Per-table CRUD (the methods each module actually needs).
  profiles: {
    get: (userId: string) => Promise<ProfileRow | null>;
    update: (userId: string, patch: Partial<ProfileRow>) => Promise<ProfileRow>;
  };
  appSettings: {
    get: () => Promise<AppSettingsRow>;
    update: (patch: { chips_per_paise: number }) => Promise<AppSettingsRow>;
  };
  sessions: {
    create: (input: SessionInsert) => Promise<SessionRow>;
    get: (id: string) => Promise<SessionRow | null>;
    list: (filter?: { status?: 'open' | 'closed' }) => Promise<SessionRow[]>;
    update: (id: string, patch: SessionUpdate) => Promise<SessionRow>;
    listParticipants: (sessionId: string) => Promise<ParticipantRow[]>;
    removeParticipant: (sessionId: string, userId: string) => Promise<void>;
  };
  buyins: {
    create: (input: BuyinInsert) => Promise<BuyinRow>;
    update: (id: string, patch: Partial<BuyinRow>) => Promise<BuyinRow>;
    delete: (id: string) => Promise<void>;
    listForSession: (sessionId: string) => Promise<BuyinRow[]>;
  };
  cashouts: {
    upsert: (input: CashoutInsert) => Promise<CashoutRow>;
    confirm: (id: string, by: string) => Promise<CashoutRow>;
    listForSession: (sessionId: string) => Promise<CashoutRow[]>;
  };
  audit: {
    listForSession: (sessionId: string) => Promise<AuditRow[]>;
  };
  notes: {
    create: (input: {
      session_id: string;
      author_user_id: string;
      body: string;
    }) => Promise<NoteRow>;
    update: (id: string, body: string) => Promise<NoteRow>;
    delete: (id: string) => Promise<void>;
    listForSession: (sessionId: string) => Promise<NoteRow[]>;
  };
  photos: {
    create: (input: {
      session_id: string;
      uploaded_by: string;
      storage_path: string;
      caption?: string;
    }) => Promise<PhotoRow>;
    delete: (id: string) => Promise<void>;
    listForSession: (sessionId: string) => Promise<PhotoRow[]>;
  };
  badges: {
    create: (input: {
      user_id: string;
      badge_key: string;
      session_id?: string;
    }) => Promise<BadgeRow>;
    listForUser: (userId: string) => Promise<BadgeRow[]>;
    existsForUserSession: (
      userId: string,
      badgeKey: string,
      sessionId?: string,
    ) => Promise<boolean>;
  };
  storage: {
    upload: (path: string, file: Blob | File, contentType: string) => Promise<{ path: string }>;
    getSignedUrl: (path: string, expiresIn: number) => Promise<string>;
    remove: (path: string) => Promise<void>;
  };
}
