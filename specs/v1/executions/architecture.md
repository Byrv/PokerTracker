# Architecture Execution Runbook

Implements `plans/architecture.md`. Single agent. Runs after `executions/database.md`. Output: 9 module skeletons with frozen public interfaces, the `DbBoundary` real implementation, and the boundary fake used by tests.

After this runbook, **public interfaces are frozen**. Phase 1 fan-out begins.

Working directory: `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Step 1 — Real `DbBoundary` implementation

Replace the stub `lib/db/realBoundary.ts` with the full implementation. This wraps the Supabase server client and exposes the typed `DbBoundary` interface. **All modules consume this in production.**

```ts
import type { DbBoundary } from "./boundary";
import { getServerSupabase } from "./server";

export async function createRealBoundary(): Promise<DbBoundary> {
  const supabase = await getServerSupabase();

  return {
    auth: {
      getCurrentUser: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        return { id: user.id, email: user.email ?? "" };
      },
      signInWithMagicLink: async (email, redirectTo) => {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      joinSessionWithToken: async (token) => {
        const { data, error } = await supabase.rpc("join_session_with_token", { token });
        if (error) throw error;
        return data;
      },
    },

    profiles: {
      get: async (userId) => {
        const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
        return data;
      },
      update: async (userId, patch) => {
        const { data, error } = await supabase.from("profiles").update(patch).eq("user_id", userId).select().single();
        if (error) throw error; return data;
      },
    },

    appSettings: {
      get: async () => {
        const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();
        if (error) throw error; return data;
      },
      update: async (patch) => {
        const { data, error } = await supabase.from("app_settings").update(patch).eq("id", 1).select().single();
        if (error) throw error; return data;
      },
    },

    sessions: {
      create: async (input) => {
        const { data, error } = await supabase.from("sessions").insert(input).select().single();
        if (error) throw error; return data;
      },
      get: async (id) => {
        const { data } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
        return data;
      },
      list: async (filter) => {
        let q = supabase.from("sessions").select("*").order("played_on", { ascending: false });
        if (filter?.status) q = q.eq("status", filter.status);
        const { data, error } = await q;
        if (error) throw error; return data ?? [];
      },
      update: async (id, patch) => {
        const { data, error } = await supabase.from("sessions").update(patch).eq("id", id).select().single();
        if (error) throw error; return data;
      },
      listParticipants: async (sessionId) => {
        const { data, error } = await supabase.from("session_participants").select("*").eq("session_id", sessionId);
        if (error) throw error; return data ?? [];
      },
      removeParticipant: async (sessionId, userId) => {
        const { error } = await supabase.from("session_participants").delete()
          .eq("session_id", sessionId).eq("user_id", userId);
        if (error) throw error;
      },
    },

    buyins: {
      create: async (input) => {
        const { data, error } = await supabase.from("buyins").insert(input).select().single();
        if (error) throw error; return data;
      },
      update: async (id, patch) => {
        const { data, error } = await supabase.from("buyins").update(patch).eq("id", id).select().single();
        if (error) throw error; return data;
      },
      delete: async (id) => {
        const { error } = await supabase.from("buyins").delete().eq("id", id);
        if (error) throw error;
      },
      listForSession: async (sessionId) => {
        const { data, error } = await supabase.from("buyins").select("*").eq("session_id", sessionId).order("recorded_at");
        if (error) throw error; return data ?? [];
      },
    },

    cashouts: {
      upsert: async (input) => {
        const { data, error } = await supabase.from("cashouts").upsert(input, { onConflict: "session_id,user_id" }).select().single();
        if (error) throw error; return data;
      },
      confirm: async (id, by) => {
        const { data, error } = await supabase.from("cashouts").update({
          status: "confirmed",
          confirmed_by: by,
          confirmed_at: new Date().toISOString(),
        }).eq("id", id).select().single();
        if (error) throw error; return data;
      },
      listForSession: async (sessionId) => {
        const { data, error } = await supabase.from("cashouts").select("*").eq("session_id", sessionId);
        if (error) throw error; return data ?? [];
      },
    },

    audit: {
      listForSession: async (sessionId) => {
        const { data, error } = await supabase.from("audit_log").select("*").eq("session_id", sessionId).order("created_at", { ascending: false });
        if (error) throw error; return data ?? [];
      },
    },

    notes: {
      create: async (input) => {
        const { data, error } = await supabase.from("notes").insert(input).select().single();
        if (error) throw error; return data;
      },
      update: async (id, body) => {
        const { data, error } = await supabase.from("notes").update({ body }).eq("id", id).select().single();
        if (error) throw error; return data;
      },
      delete: async (id) => {
        const { error } = await supabase.from("notes").delete().eq("id", id);
        if (error) throw error;
      },
      listForSession: async (sessionId) => {
        const { data, error } = await supabase.from("notes").select("*").eq("session_id", sessionId).order("created_at", { ascending: false });
        if (error) throw error; return data ?? [];
      },
    },

    photos: {
      create: async (input) => {
        const { data, error } = await supabase.from("photos").insert(input).select().single();
        if (error) throw error; return data;
      },
      delete: async (id) => {
        const { error } = await supabase.from("photos").delete().eq("id", id);
        if (error) throw error;
      },
      listForSession: async (sessionId) => {
        const { data, error } = await supabase.from("photos").select("*").eq("session_id", sessionId);
        if (error) throw error; return data ?? [];
      },
    },

    badges: {
      create: async (input) => {
        const { data, error } = await supabase.from("badges").insert(input).select().single();
        if (error) throw error; return data;
      },
      listForUser: async (userId) => {
        const { data, error } = await supabase.from("badges").select("*").eq("user_id", userId);
        if (error) throw error; return data ?? [];
      },
      existsForUserSession: async (userId, badgeKey, sessionId) => {
        let q = supabase.from("badges").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("badge_key", badgeKey);
        q = sessionId ? q.eq("session_id", sessionId) : q.is("session_id", null);
        const { count } = await q;
        return (count ?? 0) > 0;
      },
    },

    storage: {
      upload: async (path, file, contentType) => {
        const { error } = await supabase.storage.from("session-media").upload(path, file, { contentType });
        if (error) throw error;
        return { path };
      },
      getSignedUrl: async (path, expiresIn) => {
        const { data, error } = await supabase.storage.from("session-media").createSignedUrl(path, expiresIn);
        if (error) throw error;
        return data.signedUrl;
      },
      remove: async (path) => {
        const { error } = await supabase.storage.from("session-media").remove([path]);
        if (error) throw error;
      },
    },
  };
}
```

---

## Step 2 — Boundary fake (the test seam)

Create `tests/helpers/fakeBoundary.ts`. This is the in-memory implementation of `DbBoundary` used by every module's tests. Mirrors the DB triggers we depend on (audit log writes, cashout amount computation, session-closed lockout).

```ts
import type {
  DbBoundary, SessionRow, ParticipantRow, BuyinRow, CashoutRow,
  AuditRow, NoteRow, PhotoRow, BadgeRow, ProfileRow, AppSettingsRow,
} from "@/lib/db/boundary";

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
  const participants = new Map<string, ParticipantRow>();   // key = sessionId|userId
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
    profiles.set(u.id, { user_id: u.id, nickname: u.nickname, avatar_url: null, created_at: now() });
  }

  function assertOpen(sessionId: string) {
    const s = sessions.get(sessionId);
    if (!s) throw new Error("session_not_found");
    if (s.status === "closed") throw new Error("session_closed");
  }

  function logAudit(input: Omit<AuditRow, "id" | "created_at">) {
    const row: AuditRow = { id: newId(), created_at: now(), ...input };
    audit.set(row.id, row);
  }

  return {
    __reset: () => {
      profiles.clear(); sessions.clear(); participants.clear();
      buyins.clear(); cashouts.clear(); audit.clear();
      notes.clear(); photos.clear(); badges.clear(); storage.clear();
    },
    __setCurrentUser: (id) => { currentUserId = id; },
    __dump: () => ({ profiles, sessions, participants, buyins, cashouts, audit, notes, photos, badges, appSettings }),

    auth: {
      getCurrentUser: async () => {
        if (!currentUserId) return null;
        const u = seededUsers.get(currentUserId);
        if (!u) return null;
        return { id: u.id, email: u.email };
      },
      signInWithMagicLink: async () => { /* no-op in tests */ },
      signOut: async () => { currentUserId = null; },
      joinSessionWithToken: async (token) => {
        const session = [...sessions.values()].find((s) => s.invite_token === token && s.status === "open");
        if (!session) throw new Error("invalid_or_closed_invite");
        if (!currentUserId) throw new Error("not_authenticated");
        const key = `${session.id}|${currentUserId}`;
        if (!participants.has(key)) {
          participants.set(key, { session_id: session.id, user_id: currentUserId, joined_at: now() });
        }
        return session;
      },
    },

    profiles: {
      get: async (userId) => profiles.get(userId) ?? null,
      update: async (userId, patch) => {
        const p = profiles.get(userId);
        if (!p) throw new Error("not_found");
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
          status: input.status ?? "open",
          opened_at: now(),
          closed_at: null,
        };
        sessions.set(id, row);
        participants.set(`${id}|${row.created_by}`, { session_id: id, user_id: row.created_by, joined_at: now() });
        logAudit({ session_id: id, actor_user_id: row.created_by, action: "session_open", entity_id: id, before_data: null, after_data: row });
        return row;
      },
      get: async (id) => sessions.get(id) ?? null,
      list: async (filter) => {
        const rows = [...sessions.values()];
        return filter?.status ? rows.filter((r) => r.status === filter.status) : rows;
      },
      update: async (id, patch) => {
        const old = sessions.get(id);
        if (!old) throw new Error("not_found");
        const updated = { ...old, ...patch };
        sessions.set(id, updated);
        if (old.status === "open" && updated.status === "closed") {
          logAudit({ session_id: id, actor_user_id: currentUserId!, action: "session_close", entity_id: id, before_data: old, after_data: updated });
        }
        return updated;
      },
      listParticipants: async (sessionId) => [...participants.values()].filter((p) => p.session_id === sessionId),
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
        logAudit({ session_id: row.session_id, actor_user_id: row.recorded_by, action: "buyin_create", entity_id: row.id, before_data: null, after_data: row });
        return row;
      },
      update: async (id, patch) => {
        const old = buyins.get(id);
        if (!old) throw new Error("not_found");
        assertOpen(old.session_id);
        const updated = { ...old, ...patch };
        buyins.set(id, updated);
        logAudit({ session_id: old.session_id, actor_user_id: currentUserId!, action: "buyin_edit", entity_id: id, before_data: old, after_data: updated });
        return updated;
      },
      delete: async (id) => {
        const old = buyins.get(id);
        if (!old) return;
        assertOpen(old.session_id);
        buyins.delete(id);
        logAudit({ session_id: old.session_id, actor_user_id: currentUserId!, action: "buyin_delete", entity_id: id, before_data: old, after_data: null });
      },
      listForSession: async (sessionId) => [...buyins.values()].filter((b) => b.session_id === sessionId),
    },

    cashouts: {
      upsert: async (input) => {
        assertOpen(input.session_id!);
        const session = sessions.get(input.session_id!)!;
        const key = [...cashouts.values()].find((c) => c.session_id === input.session_id && c.user_id === input.user_id);
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
          status: "pending",
        };
        const old = cashouts.get(id) ?? null;
        cashouts.set(id, row);
        logAudit({
          session_id: row.session_id,
          actor_user_id: row.submitted_by,
          action: old ? "cashout_edit" : "cashout_submit",
          entity_id: id,
          before_data: old,
          after_data: row,
        });
        return row;
      },
      confirm: async (id, by) => {
        const old = cashouts.get(id);
        if (!old) throw new Error("not_found");
        assertOpen(old.session_id);
        const updated: CashoutRow = { ...old, status: "confirmed", confirmed_by: by, confirmed_at: now() };
        cashouts.set(id, updated);
        logAudit({ session_id: updated.session_id, actor_user_id: by, action: "cashout_confirm", entity_id: id, before_data: old, after_data: updated });
        return updated;
      },
      listForSession: async (sessionId) => [...cashouts.values()].filter((c) => c.session_id === sessionId),
    },

    audit: {
      listForSession: async (sessionId) => [...audit.values()]
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
        const old = notes.get(id); if (!old) throw new Error("not_found");
        const updated = { ...old, body, updated_at: now() };
        notes.set(id, updated);
        return updated;
      },
      delete: async (id) => { notes.delete(id); },
      listForSession: async (sessionId) => [...notes.values()].filter((n) => n.session_id === sessionId),
    },

    photos: {
      create: async (input) => {
        const row: PhotoRow = { id: newId(), ...input, caption: input.caption ?? null, created_at: now() };
        photos.set(row.id, row);
        return row;
      },
      delete: async (id) => { photos.delete(id); },
      listForSession: async (sessionId) => [...photos.values()].filter((p) => p.session_id === sessionId),
    },

    badges: {
      create: async (input) => {
        const row: BadgeRow = { id: newId(), ...input, session_id: input.session_id ?? null, earned_at: now() };
        badges.set(row.id, row);
        return row;
      },
      listForUser: async (userId) => [...badges.values()].filter((b) => b.user_id === userId),
      existsForUserSession: async (userId, badgeKey, sessionId) => {
        return [...badges.values()].some((b) => b.user_id === userId && b.badge_key === badgeKey && (b.session_id ?? null) === (sessionId ?? null));
      },
    },

    storage: {
      upload: async (path, file) => { storage.set(path, file as Blob); return { path }; },
      getSignedUrl: async (path) => `fake://storage/${path}`,
      remove: async (path) => { storage.delete(path); },
    },
  };
}
```

Create `tests/helpers/fixtures.ts`:

```ts
export const FIXTURE_USERS = [
  { id: "u-aman", email: "aman@example.com", nickname: "Aman" },
  { id: "u-ravi", email: "ravi@example.com", nickname: "Ravi" },
  { id: "u-priya", email: "priya@example.com", nickname: "Priya" },
  { id: "u-karan", email: "karan@example.com", nickname: "Karan" },
  { id: "u-neha", email: "neha@example.com", nickname: "Neha" },
];
```

---

## Step 3 — Module skeleton template

Each module follows this exact shape. The module agents implement `internal/`; this runbook only writes `index.ts`, `types.ts`, `internal/factory.ts` stub, and `README.md`.

```
lib/modules/<module>/
├── index.ts
├── types.ts
├── README.md
└── internal/
    └── factory.ts        # stub: throws "not implemented"
```

For every module below, the agent creates these four files. `index.ts` re-exports from `factory.ts` so the public API never changes shape when implementations land.

---

## Step 4 — Module: `core`

`lib/modules/core/types.ts`:
```ts
export type UserId = string & { readonly __brand: "UserId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type Paise = number & { readonly __brand: "Paise" };
export type Chips = number & { readonly __brand: "Chips" };
export type Permission = "house" | "participant" | "none";
export type ChipRatio = { chipsPerPaise: number };

export const asUserId = (s: string) => s as UserId;
export const asSessionId = (s: string) => s as SessionId;
export const asPaise = (n: number) => n as Paise;
export const asChips = (n: number) => n as Chips;
```

`lib/modules/core/index.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import { createCore } from "./internal/factory";
export * from "./types";

export interface Core {
  chipsToPaise(chips: import("./types").Chips, ratio: import("./types").ChipRatio): import("./types").Paise;
  paiseToChips(paise: import("./types").Paise, ratio: import("./types").ChipRatio): import("./types").Chips;
  formatINR(p: import("./types").Paise): string;
  formatDate(d: Date | string): string;
  formatDateTime(d: Date | string): string;
  computeNetPL(totalBuyinsPaise: import("./types").Paise, cashoutPaise: import("./types").Paise): import("./types").Paise;
  assertSessionOpen(s: { status: "open" | "closed" }): void;
  getChipRatio(): Promise<import("./types").ChipRatio>;
  setChipRatio(r: import("./types").ChipRatio): Promise<void>;
  permissionFor(userId: import("./types").UserId, session: { createdBy: import("./types").UserId; participants: import("./types").UserId[] }): import("./types").Permission;
}

export const withBoundary = (b: DbBoundary): Core => createCore(b);
```

`lib/modules/core/internal/factory.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Core } from "../index";
export function createCore(_b: DbBoundary): Core {
  throw new Error("core: not implemented (module agent owns this)");
}
```

`lib/modules/core/README.md`:
```markdown
# core

Shared primitives: chip↔INR conversion, formatting, P&L math, permission checks, settings access.

## Public interface
See `index.ts`.

## Inputs / outputs
- Pure helpers: synchronous, no side effects.
- Settings: async; reads/writes the `app_settings` singleton via DbBoundary.

## Dependencies
- `DbBoundary.appSettings` only.

## Owned shared primitives
All of them except `audit` (owned by `ledger`).

## Test plan
`tests/modules/core/` — unit tests for every pure function plus settings round-trips against `fakeBoundary`.
```

---

## Step 5 — Module: `auth`

`lib/modules/auth/types.ts`:
```ts
import type { UserId, SessionId } from "@/lib/modules/core";
export type CurrentUser = { id: UserId; email: string; nickname: string; avatarUrl?: string };
export type { UserId, SessionId };
```

`lib/modules/auth/index.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import { createAuth } from "./internal/factory";
export * from "./types";

export interface Auth {
  signInWithMagicLink(email: string, redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<import("./types").CurrentUser | null>;
  requireUser(): Promise<import("./types").CurrentUser>;
  joinSessionByToken(token: string): Promise<import("./types").SessionId>;
}

export const withBoundary = (b: DbBoundary): Auth => createAuth(b);
```

`lib/modules/auth/internal/factory.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Auth } from "../index";
export function createAuth(_b: DbBoundary): Auth {
  throw new Error("auth: not implemented (module agent owns this)");
}
```

`lib/modules/auth/README.md`:
```markdown
# auth

Magic-link sign-in, current-user resolution, session-invite onboarding.

## Public interface
See `index.ts`.

## Inputs / outputs
- `signInWithMagicLink(email, redirectTo)` — sends magic link.
- `getCurrentUser()` — returns the signed-in user or null.
- `joinSessionByToken(token)` — calls the `join_session_with_token` RPC.

## Dependencies
- `core` (UserId, SessionId types).
- `DbBoundary.auth`.

## Owned shared primitives
None.

## Test plan
`tests/modules/auth/` — magic-link payload, current user (signed in / out), token join (valid / invalid / closed).
```

---

## Step 6 — Module: `sessions`

`lib/modules/sessions/types.ts`:
```ts
import type { Paise, SessionId, UserId } from "@/lib/modules/core";

export type Session = {
  id: SessionId;
  createdBy: UserId;
  name?: string;
  location?: string;
  playedOn: string;
  blinds: { small: Paise; big: Paise };
  chipsPerPaise: number;
  status: "open" | "closed";
  inviteToken: string;
  participants: UserId[];
};
```

`lib/modules/sessions/index.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Paise, SessionId, UserId } from "@/lib/modules/core";
import { createSessions } from "./internal/factory";
export * from "./types";

export interface Sessions {
  createSession(input: { name?: string; location?: string; blinds: { small: Paise; big: Paise } }): Promise<import("./types").Session>;
  getSession(id: SessionId): Promise<import("./types").Session>;
  listSessions(filter?: { status?: "open" | "closed" }): Promise<import("./types").Session[]>;
  addParticipant(sessionId: SessionId, userId: UserId): Promise<void>;
  removeParticipant(sessionId: SessionId, userId: UserId): Promise<void>;
  closeSession(sessionId: SessionId): Promise<import("./types").Session>;
  generateInviteUrl(sessionId: SessionId): Promise<string>;
}

export const withBoundary = (b: DbBoundary): Sessions => createSessions(b);
```

`lib/modules/sessions/internal/factory.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Sessions } from "../index";
export function createSessions(_b: DbBoundary): Sessions {
  throw new Error("sessions: not implemented (module agent owns this)");
}
```

`lib/modules/sessions/README.md`:
```markdown
# sessions

Session lifecycle and participants.

## Public interface
See `index.ts`.

## Inputs / outputs
Session CRUD + participant management + invite-URL generation + close-with-validation.

## Dependencies
- `core` (UserId, SessionId, Paise, ChipRatio).
- `DbBoundary.sessions`.
- `auth` (current user) — via `DbBoundary.auth.getCurrentUser` (no direct module import).

## Owned shared primitives
None.

## Test plan
`tests/modules/sessions/` — create→addParticipant→close happy path; close-with-pending-cashouts rejection; non-house close rejection; invite URL idempotency.
```

---

## Step 7 — Module: `ledger`

`lib/modules/ledger/types.ts`:
```ts
import type { Paise, Chips, SessionId, UserId } from "@/lib/modules/core";

export type Buyin = { id: string; sessionId: SessionId; userId: UserId; amount: Paise; chips: Chips; recordedAt: string };
export type Cashout = {
  id: string; sessionId: SessionId; userId: UserId;
  chipCount: Chips; amount: Paise;
  status: "pending" | "confirmed";
  submittedBy: UserId; confirmedBy?: UserId;
};
export type Reconciliation = { expected: Paise; actual: Paise; discrepancy: Paise };
export type PlayerLedger = { userId: UserId; totalBuyinsPaise: Paise; cashoutPaise: Paise; netPaise: Paise };
export type AuditEntry = { id: string; sessionId: SessionId; actor: UserId; action: string; before: unknown; after: unknown; createdAt: string };
```

`lib/modules/ledger/index.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Paise, Chips, SessionId, UserId } from "@/lib/modules/core";
import { createLedger } from "./internal/factory";
export * from "./types";

export interface Ledger {
  recordBuyin(input: { sessionId: SessionId; userId: UserId; amount: Paise }): Promise<import("./types").Buyin>;
  editBuyin(id: string, patch: { amount?: Paise }): Promise<import("./types").Buyin>;
  deleteBuyin(id: string): Promise<void>;
  listBuyins(sessionId: SessionId): Promise<import("./types").Buyin[]>;

  submitCashout(input: { sessionId: SessionId; userId: UserId; chipCount: Chips }): Promise<import("./types").Cashout>;
  confirmCashout(id: string): Promise<import("./types").Cashout>;
  listCashouts(sessionId: SessionId): Promise<import("./types").Cashout[]>;

  getSessionLedger(sessionId: SessionId): Promise<import("./types").PlayerLedger[]>;
  getReconciliation(sessionId: SessionId): Promise<import("./types").Reconciliation>;

  listAudit(sessionId: SessionId): Promise<import("./types").AuditEntry[]>;
}

export const withBoundary = (b: DbBoundary): Ledger => createLedger(b);
```

`lib/modules/ledger/internal/factory.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Ledger } from "../index";
export function createLedger(_b: DbBoundary): Ledger {
  throw new Error("ledger: not implemented (module agent owns this)");
}
```

`lib/modules/ledger/README.md`:
```markdown
# ledger

Buy-ins, cash-outs, P&L, reconciliation, audit log.

## Public interface
See `index.ts`.

## Inputs / outputs
- Record/edit/delete buy-ins (house only).
- Submit/confirm cash-outs.
- Compute per-player and per-session ledger + reconciliation.
- Read the audit log.

## Dependencies
- `core` (Paise, Chips, conversions, computeNetPL, assertSessionOpen).
- `auth` (current user, permission checks via DbBoundary).
- `DbBoundary.{buyins,cashouts,audit,sessions}`.

## Owned shared primitives
The typed audit-log read API (DB triggers do the actual writes).

## Test plan
`tests/modules/ledger/` — heavy. Lifecycle of buyins + cashouts; reconciliation correctness; permission rejections; closed-session lockout.
```

---

## Step 8 — Module: `leaderboard`

`lib/modules/leaderboard/types.ts`:
```ts
import type { Paise, UserId } from "@/lib/modules/core";

export type LeaderboardEntry = {
  userId: UserId;
  nickname: string;
  netPaise: Paise;
  sessionsPlayed: number;
  sessionsWon: number;
  winRate: number;
  biggestWinPaise: Paise;
  averagePerSessionPaise: Paise;
};

export type LeaderboardFilter = { from?: string; to?: string };
export type LeaderboardSort = "net" | "sessions" | "winRate" | "biggestWin" | "average";
```

`lib/modules/leaderboard/index.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import { createLeaderboard } from "./internal/factory";
export * from "./types";

export interface Leaderboard {
  getLeaderboard(filter?: import("./types").LeaderboardFilter, sort?: import("./types").LeaderboardSort): Promise<import("./types").LeaderboardEntry[]>;
}

export const withBoundary = (b: DbBoundary): Leaderboard => createLeaderboard(b);
```

`lib/modules/leaderboard/internal/factory.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Leaderboard } from "../index";
export function createLeaderboard(_b: DbBoundary): Leaderboard {
  throw new Error("leaderboard: not implemented");
}
```

`lib/modules/leaderboard/README.md`:
```markdown
# leaderboard

All-time standings + filters.

## Public interface
See `index.ts`.

## Dependencies
- `core`, `ledger`, `DbBoundary.{sessions,profiles,buyins,cashouts}`.

## Owned shared primitives
None.

## Test plan
`tests/modules/leaderboard/` — aggregation correctness, sort orders, date filters.
```

---

## Step 9 — Module: `profiles`

`lib/modules/profiles/types.ts`:
```ts
import type { Paise, SessionId, UserId } from "@/lib/modules/core";

export type ProfileSummary = {
  user: { id: UserId; nickname: string; avatarUrl?: string };
  lifetime: { netPaise: Paise; sessionsPlayed: number; biggestWinPaise: Paise; biggestLossPaise: Paise; currentStreak: number };
  badges: Array<{ key: string; earnedAt: string; sessionId?: SessionId }>;
  history: Array<{ sessionId: SessionId; playedOn: string; netPaise: Paise }>;
  bankrollSeries: Array<{ at: string; cumulativeNetPaise: Paise }>;
};
```

`lib/modules/profiles/index.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { UserId } from "@/lib/modules/core";
import { createProfiles } from "./internal/factory";
export * from "./types";

export interface Profiles {
  getProfile(userId: UserId): Promise<import("./types").ProfileSummary>;
  updateProfile(patch: { nickname?: string; avatarUrl?: string }): Promise<void>;
}

export const withBoundary = (b: DbBoundary): Profiles => createProfiles(b);
```

`lib/modules/profiles/internal/factory.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Profiles } from "../index";
export function createProfiles(_b: DbBoundary): Profiles {
  throw new Error("profiles: not implemented");
}
```

`lib/modules/profiles/README.md`:
```markdown
# profiles

Per-player view: lifetime stats, history, bankroll series, badges.

## Public interface
See `index.ts`.

## Dependencies
- `core`, `ledger`, `badges`, `DbBoundary.{profiles,sessions}`.

## Test plan
`tests/modules/profiles/` — aggregate correctness, streak math, bankroll ordering, self-only update.
```

---

## Step 10 — Module: `badges`

`lib/modules/badges/types.ts`:
```ts
import type { SessionId } from "@/lib/modules/core";
export type BadgeKey = "first_session" | "streak_10" | "biggest_pot" | "comeback_kid" | string;
export type Badge = { key: BadgeKey; earnedAt: string; sessionId?: SessionId };
```

`lib/modules/badges/index.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { SessionId, UserId } from "@/lib/modules/core";
import { createBadges } from "./internal/factory";
export * from "./types";

export interface Badges {
  evaluateBadgesForSession(sessionId: SessionId): Promise<import("./types").Badge[]>;
  listBadgesForUser(userId: UserId): Promise<import("./types").Badge[]>;
}

export const withBoundary = (b: DbBoundary): Badges => createBadges(b);
```

`lib/modules/badges/internal/factory.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Badges } from "../index";
export function createBadges(_b: DbBoundary): Badges {
  throw new Error("badges: not implemented");
}
```

`lib/modules/badges/README.md`:
```markdown
# badges

Achievement rules engine + awarding on session close.

## Public interface
See `index.ts`.

## Dependencies
- `core`, `ledger`, `DbBoundary.{badges,sessions}`.

## Test plan
`tests/modules/badges/` — one rule per file with hand-built fixtures; idempotency; registry adds new rules without schema change.
```

---

## Step 11 — Module: `media`

`lib/modules/media/types.ts`:
```ts
import type { SessionId, UserId } from "@/lib/modules/core";

export type Note = { id: string; sessionId: SessionId; authorUserId: UserId; body: string; createdAt: string; updatedAt: string };
export type Photo = { id: string; sessionId: SessionId; uploadedBy: UserId; url: string; caption?: string; createdAt: string };
```

`lib/modules/media/index.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { SessionId } from "@/lib/modules/core";
import { createMedia } from "./internal/factory";
export * from "./types";

export interface Media {
  listNotes(sessionId: SessionId): Promise<import("./types").Note[]>;
  addNote(input: { sessionId: SessionId; body: string }): Promise<import("./types").Note>;
  editNote(id: string, body: string): Promise<import("./types").Note>;
  deleteNote(id: string): Promise<void>;

  listPhotos(sessionId: SessionId): Promise<import("./types").Photo[]>;
  uploadPhoto(input: { sessionId: SessionId; file: File; caption?: string }): Promise<import("./types").Photo>;
  deletePhoto(id: string): Promise<void>;
}

export const withBoundary = (b: DbBoundary): Media => createMedia(b);
```

`lib/modules/media/internal/factory.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Media } from "../index";
export function createMedia(_b: DbBoundary): Media {
  throw new Error("media: not implemented");
}
```

`lib/modules/media/README.md`:
```markdown
# media

Notes + photos attached to sessions.

## Public interface
See `index.ts`.

## Dependencies
- `core`, `auth`, `sessions`, `DbBoundary.{notes,photos,storage}`.

## Test plan
`tests/modules/media/` — participant gating, author edit/delete, photo size/MIME validation.
```

---

## Step 12 — Module: `export`

`lib/modules/export/types.ts`:
```ts
import type { SessionId } from "@/lib/modules/core";
export type ExportSessionInput = { sessionId: SessionId };
```

`lib/modules/export/index.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { SessionId } from "@/lib/modules/core";
import { createExport } from "./internal/factory";
export * from "./types";

export interface ExportModule {
  exportSessionCSV(sessionId: SessionId): Promise<Blob>;
  exportSessionPDF(sessionId: SessionId): Promise<Blob>;
  exportFullHistoryCSV(): Promise<Blob>;
}

export const withBoundary = (b: DbBoundary): ExportModule => createExport(b);
```

`lib/modules/export/internal/factory.ts`:
```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { ExportModule } from "../index";
export function createExport(_b: DbBoundary): ExportModule {
  throw new Error("export: not implemented");
}
```

`lib/modules/export/README.md`:
```markdown
# export

CSV / PDF exports of sessions and full history.

## Public interface
See `index.ts`.

## Dependencies
- `core`, `ledger`, `sessions`, `DbBoundary.{sessions,buyins,cashouts,profiles}`.

## Test plan
`tests/modules/export/` — CSV column shape + numerics; PDF non-empty Blob; participant-only session export.
```

---

## Step 13 — Wire withBoundary into a single app composition

Create `lib/modules/index.ts` — single composition root used by Server Components / Server Actions:
```ts
import { createRealBoundary } from "@/lib/db/realBoundary";
import * as core from "./core";
import * as auth from "./auth";
import * as sessions from "./sessions";
import * as ledger from "./ledger";
import * as leaderboard from "./leaderboard";
import * as profiles from "./profiles";
import * as badges from "./badges";
import * as media from "./media";
import * as exportMod from "./export";

export async function getModules() {
  const b = await createRealBoundary();
  return {
    core: core.withBoundary(b),
    auth: auth.withBoundary(b),
    sessions: sessions.withBoundary(b),
    ledger: ledger.withBoundary(b),
    leaderboard: leaderboard.withBoundary(b),
    profiles: profiles.withBoundary(b),
    badges: badges.withBoundary(b),
    media: media.withBoundary(b),
    export: exportMod.withBoundary(b),
  };
}
```

This is the single import surface for every page / server action.

---

## Step 14 — Cycle check

```bash
pnpm cycles
```

Output must be:
```
✔ No circular dependency found!
```

If any cycle is detected, the offending edge contradicts `plans/architecture.md`. Resolve before proceeding.

---

## Step 15 — Type-check + lint

```bash
pnpm typecheck
pnpm lint
node scripts/audit-imports.mjs
```

All must exit 0.

---

## Acceptance checklist

- [ ] `lib/db/realBoundary.ts` fully implemented (no `not implemented` strings).
- [ ] `tests/helpers/fakeBoundary.ts` exists and exports `createFakeBoundary`.
- [ ] `tests/helpers/fixtures.ts` exists with `FIXTURE_USERS`.
- [ ] All 9 modules exist under `lib/modules/<m>/` with `index.ts`, `types.ts`, `README.md`, `internal/factory.ts`.
- [ ] Every `index.ts` matches `plans/architecture.md` exactly.
- [ ] Every `factory.ts` throws `"not implemented"` — Phase 1 module agents replace these.
- [ ] `lib/modules/index.ts` composition root exists.
- [ ] `pnpm cycles` reports no cycles.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `node scripts/audit-imports.mjs` passes.

When all boxes green, **public interfaces are FROZEN** and Phase 1 fan-out begins. Commit as `chore: module skeletons + frozen interfaces`.
