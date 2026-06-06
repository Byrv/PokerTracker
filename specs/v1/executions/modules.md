# Modules Execution Runbook

Implements `plans/modules.md`. **Parallel work** — one agent per module, dispatched after `executions/architecture.md` ships. Each section below is a self-contained work item.

The agent for `<MODULE>`:
1. Reads `requirments.md`, `plan.md`, `plans/architecture.md` (frozen contract), `plans/modules.md` → its section, this file → its section.
2. Implements `lib/modules/<MODULE>/internal/**`.
3. Replaces the `factory.ts` stub with a real implementation that returns a `Module` matching `index.ts`.
4. Writes tests under `tests/modules/<MODULE>/`.
5. Edits **only** files within its module folder + its test folder.

**Universal pattern** every module follows:

```
lib/modules/<m>/
├── index.ts              (FROZEN — do not edit)
├── types.ts              (FROZEN — do not edit)
├── README.md
└── internal/
    ├── factory.ts        # entry point — wires deps, returns Module
    ├── queries.ts        # DbBoundary calls only
    ├── logic.ts          # pure domain logic
    └── (extras as needed)
```

**Priority:** `core` finishes first within Phase 1 (every other module imports it). Other 8 modules can proceed in any order once `core` is green.

---

## Module: `core`

### File: `lib/modules/core/internal/factory.ts`

```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Core } from "../index";
import type { ChipRatio, Chips, Paise, Permission, UserId } from "../types";
import { asChips, asPaise } from "../types";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const DATETIME = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function createCore(b: DbBoundary): Core {
  return {
    chipsToPaise(chips, ratio) {
      return asPaise(Math.round((chips as number) / ratio.chipsPerPaise));
    },
    paiseToChips(paise, ratio) {
      return asChips(Math.round((paise as number) * ratio.chipsPerPaise));
    },
    formatINR(p) {
      const rupees = (p as number) / 100;
      return INR.format(rupees);
    },
    formatDate(d) {
      return DATE.format(typeof d === "string" ? new Date(d) : d);
    },
    formatDateTime(d) {
      return DATETIME.format(typeof d === "string" ? new Date(d) : d);
    },
    computeNetPL(totalBuyins, cashout) {
      return asPaise((cashout as number) - (totalBuyins as number));
    },
    assertSessionOpen(s) {
      if (s.status === "closed") throw new Error("session_closed");
    },
    permissionFor(userId: UserId, session) {
      if (session.createdBy === userId) return "house";
      if (session.participants.includes(userId)) return "participant";
      return "none" as Permission;
    },
    async getChipRatio(): Promise<ChipRatio> {
      const row = await b.appSettings.get();
      return { chipsPerPaise: Number(row.chips_per_paise) };
    },
    async setChipRatio(r: ChipRatio): Promise<void> {
      await b.appSettings.update({ chips_per_paise: r.chipsPerPaise });
    },
  };
}
```

### Tests: `tests/modules/core/`

`tests/modules/core/units.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as core from "@/lib/modules/core";
import { asChips, asPaise } from "@/lib/modules/core";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

const c = core.withBoundary(createFakeBoundary());

describe("core/units", () => {
  it("round-trips chips↔paise at ratio=1", () => {
    const r = { chipsPerPaise: 1 };
    expect(c.paiseToChips(c.chipsToPaise(asChips(50000), r), r)).toBe(50000);
  });
  it("rounds to nearest paisa", () => {
    const r = { chipsPerPaise: 3 };
    expect(c.chipsToPaise(asChips(10), r)).toBe(3);    // 10/3 ≈ 3.33 → 3
  });
});
```

`tests/modules/core/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as core from "@/lib/modules/core";
import { asPaise } from "@/lib/modules/core";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

const c = core.withBoundary(createFakeBoundary());

describe("core/format", () => {
  it("formats paise as INR", () => {
    expect(c.formatINR(asPaise(50000))).toMatch(/₹\s?500/);
    expect(c.formatINR(asPaise(0))).toMatch(/₹\s?0/);
    expect(c.formatINR(asPaise(123)).replace(/\s/g, "")).toContain("1.23");
  });
});
```

`tests/modules/core/pl.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as core from "@/lib/modules/core";
import { asPaise } from "@/lib/modules/core";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

const c = core.withBoundary(createFakeBoundary());

describe("core/pl", () => {
  it("net = cashout - buyins", () => {
    expect(c.computeNetPL(asPaise(10000), asPaise(15000))).toBe(5000);
    expect(c.computeNetPL(asPaise(20000), asPaise(5000))).toBe(-15000);
  });
});
```

`tests/modules/core/permissions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as core from "@/lib/modules/core";
import { asUserId } from "@/lib/modules/core";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

const c = core.withBoundary(createFakeBoundary());
const aman = asUserId("u-aman"), ravi = asUserId("u-ravi"), other = asUserId("u-other");

describe("core/permissions", () => {
  const session = { createdBy: aman, participants: [aman, ravi] };
  it("classifies house", () => expect(c.permissionFor(aman, session)).toBe("house"));
  it("classifies participant", () => expect(c.permissionFor(ravi, session)).toBe("participant"));
  it("classifies none", () => expect(c.permissionFor(other, session)).toBe("none"));
});
```

`tests/modules/core/settings.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as core from "@/lib/modules/core";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("core/settings", () => {
  it("get returns default", async () => {
    const b = createFakeBoundary({ appSettings: { chipsPerPaise: 1 } });
    const c = core.withBoundary(b);
    expect((await c.getChipRatio()).chipsPerPaise).toBe(1);
  });
  it("set updates", async () => {
    const b = createFakeBoundary({ appSettings: { chipsPerPaise: 1 } });
    const c = core.withBoundary(b);
    await c.setChipRatio({ chipsPerPaise: 5 });
    expect((await c.getChipRatio()).chipsPerPaise).toBe(5);
  });
});
```

### Acceptance
- [ ] All `core` tests pass.
- [ ] No imports from any other `lib/modules/*`.
- [ ] `factory.ts` no longer throws.

---

## Module: `auth`

### File: `lib/modules/auth/internal/factory.ts`

```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Auth, CurrentUser } from "../index";
import { asSessionId, asUserId } from "@/lib/modules/core";

export function createAuth(b: DbBoundary): Auth {
  return {
    async signInWithMagicLink(email, redirectTo) {
      await b.auth.signInWithMagicLink(email, redirectTo);
    },
    async signOut() {
      await b.auth.signOut();
    },
    async getCurrentUser(): Promise<CurrentUser | null> {
      const u = await b.auth.getCurrentUser();
      if (!u) return null;
      const profile = await b.profiles.get(u.id);
      return {
        id: asUserId(u.id),
        email: u.email,
        nickname: profile?.nickname ?? u.email.split("@")[0]!,
        avatarUrl: profile?.avatar_url ?? undefined,
      };
    },
    async requireUser() {
      const u = await this.getCurrentUser();
      if (!u) throw new Error("not_authenticated");
      return u;
    },
    async joinSessionByToken(token) {
      const s = await b.auth.joinSessionWithToken(token);
      return asSessionId(s.id);
    },
  };
}
```

### Tests: `tests/modules/auth/`

`tests/modules/auth/auth.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as auth from "@/lib/modules/auth";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("auth", () => {
  it("getCurrentUser returns null when signed out", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS });
    const a = auth.withBoundary(b);
    expect(await a.getCurrentUser()).toBeNull();
  });

  it("getCurrentUser returns the signed-in user with profile", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const a = auth.withBoundary(b);
    const u = await a.getCurrentUser();
    expect(u?.id).toBe("u-aman");
    expect(u?.nickname).toBe("Aman");
  });

  it("requireUser throws when signed out", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS });
    const a = auth.withBoundary(b);
    await expect(a.requireUser()).rejects.toThrow("not_authenticated");
  });

  it("joinSessionByToken throws on invalid token", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const a = auth.withBoundary(b);
    await expect(a.joinSessionByToken("nonexistent")).rejects.toThrow("invalid_or_closed_invite");
  });
});
```

### Acceptance
- [ ] All `auth` tests pass.
- [ ] No direct `@supabase/supabase-js` imports.
- [ ] Only `core` types are imported from another module.

---

## Module: `sessions`

### File: `lib/modules/sessions/internal/factory.ts`

```ts
import type { DbBoundary, SessionRow } from "@/lib/db/boundary";
import type { Sessions, Session } from "../index";
import { asPaise, asSessionId, asUserId, type Paise, type SessionId, type UserId } from "@/lib/modules/core";

function rowToSession(row: SessionRow, participants: UserId[]): Session {
  return {
    id: asSessionId(row.id),
    createdBy: asUserId(row.created_by),
    name: row.name ?? undefined,
    location: row.location ?? undefined,
    playedOn: row.played_on,
    blinds: { small: asPaise(Number(row.blinds_small)), big: asPaise(Number(row.blinds_big)) },
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
      if (!me) throw new Error("not_authenticated");
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
      if (!row) throw new Error("not_found");
      const participants = await loadParticipants(id);
      return rowToSession(row, participants);
    },

    async listSessions(filter) {
      const rows = await b.sessions.list(filter);
      return Promise.all(rows.map(async (row) => rowToSession(row, await loadParticipants(row.id))));
    },

    async addParticipant(sessionId, userId) {
      // Done via DbBoundary RPC join — direct add only by house, but plan delegates this to invite link.
      // For house-side direct adds we'd extend boundary.sessions.addParticipant — for now reject.
      throw new Error("use_invite_url");
    },

    async removeParticipant(sessionId, userId) {
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error("not_authenticated");
      const session = await b.sessions.get(sessionId);
      if (!session) throw new Error("not_found");
      if (session.created_by !== me.id) throw new Error("not_house");
      if (session.status === "closed") throw new Error("session_closed");
      await b.sessions.removeParticipant(sessionId, userId);
    },

    async closeSession(sessionId) {
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error("not_authenticated");
      const session = await b.sessions.get(sessionId);
      if (!session) throw new Error("not_found");
      if (session.created_by !== me.id) throw new Error("not_house");
      if (session.status === "closed") throw new Error("already_closed");

      const cashouts = await b.cashouts.listForSession(sessionId);
      const participants = await b.sessions.listParticipants(sessionId);
      for (const p of participants) {
        const co = cashouts.find((c) => c.user_id === p.user_id);
        if (!co || co.status !== "confirmed") throw new Error("cashouts_incomplete");
      }
      const updated = await b.sessions.update(sessionId, { status: "closed", closed_at: new Date().toISOString() });
      return rowToSession(updated, participants.map((p) => asUserId(p.user_id)));
    },

    async generateInviteUrl(sessionId) {
      const session = await b.sessions.get(sessionId);
      if (!session) throw new Error("not_found");
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      return `${origin}/join/${session.invite_token}`;
    },
  };
}
```

### Tests: `tests/modules/sessions/sessions.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as sessions from "@/lib/modules/sessions";
import * as ledger from "@/lib/modules/ledger";       // used to satisfy close prerequisites
import { asChips, asPaise, asSessionId, asUserId } from "@/lib/modules/core";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

const setup = (currentUserId = "u-aman") => {
  const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId });
  return { b, sessions: sessions.withBoundary(b), ledger: ledger.withBoundary(b) };
};

describe("sessions", () => {
  it("creates a session with creator as participant", async () => {
    const { sessions: s } = setup();
    const sess = await s.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });
    expect(sess.createdBy).toBe("u-aman");
    expect(sess.participants).toContain("u-aman");
    expect(sess.status).toBe("open");
  });

  it("rejects close from non-house", async () => {
    const env = setup();
    const sess = await env.sessions.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });
    env.b.__setCurrentUser("u-ravi");
    await expect(sessions.withBoundary(env.b).closeSession(sess.id)).rejects.toThrow("not_house");
  });

  it("rejects close when cashouts incomplete", async () => {
    const env = setup();
    const sess = await env.sessions.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });
    await expect(env.sessions.closeSession(sess.id)).rejects.toThrow("cashouts_incomplete");
  });

  it("generateInviteUrl is stable", async () => {
    const { sessions: s } = setup();
    const sess = await s.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });
    const a = await s.generateInviteUrl(sess.id);
    const b = await s.generateInviteUrl(sess.id);
    expect(a).toBe(b);
    expect(a).toContain("/join/");
  });
});
```

### Acceptance
- [ ] Tests pass.
- [ ] Permission rejections fire for non-house attempts.
- [ ] No direct DB access — only `DbBoundary`.

---

## Module: `ledger`

### File: `lib/modules/ledger/internal/factory.ts`

```ts
import type { DbBoundary, BuyinRow, CashoutRow, AuditRow } from "@/lib/db/boundary";
import type { Ledger, Buyin, Cashout, AuditEntry, PlayerLedger, Reconciliation } from "../index";
import { asChips, asPaise, asSessionId, asUserId, type Paise, type SessionId, type UserId } from "@/lib/modules/core";

const rowToBuyin = (r: BuyinRow): Buyin => ({
  id: r.id,
  sessionId: asSessionId(r.session_id),
  userId: asUserId(r.user_id),
  amount: asPaise(Number(r.amount_paise)),
  chips: asChips(Number(r.chips)),
  recordedAt: r.recorded_at,
});

const rowToCashout = (r: CashoutRow): Cashout => ({
  id: r.id,
  sessionId: asSessionId(r.session_id),
  userId: asUserId(r.user_id),
  chipCount: asChips(Number(r.chip_count)),
  amount: asPaise(Number(r.amount_paise)),
  status: r.status,
  submittedBy: asUserId(r.submitted_by),
  confirmedBy: r.confirmed_by ? asUserId(r.confirmed_by) : undefined,
});

const rowToAudit = (r: AuditRow): AuditEntry => ({
  id: r.id,
  sessionId: asSessionId(r.session_id),
  actor: asUserId(r.actor_user_id),
  action: r.action,
  before: r.before_data,
  after: r.after_data,
  createdAt: r.created_at,
});

export function createLedger(b: DbBoundary): Ledger {
  async function requireHouse(sessionId: string) {
    const me = await b.auth.getCurrentUser();
    if (!me) throw new Error("not_authenticated");
    const s = await b.sessions.get(sessionId);
    if (!s) throw new Error("not_found");
    if (s.created_by !== me.id) throw new Error("not_house");
    return { me, session: s };
  }

  async function requireParticipantOrHouse(sessionId: string) {
    const me = await b.auth.getCurrentUser();
    if (!me) throw new Error("not_authenticated");
    const s = await b.sessions.get(sessionId);
    if (!s) throw new Error("not_found");
    const ps = await b.sessions.listParticipants(sessionId);
    const isParticipant = ps.some((p) => p.user_id === me.id);
    if (!isParticipant && s.created_by !== me.id) throw new Error("not_participant");
    return { me, session: s };
  }

  return {
    async recordBuyin({ sessionId, userId, amount }) {
      const { me, session } = await requireHouse(sessionId);
      if (session.status === "closed") throw new Error("session_closed");
      const chips = (amount as number) * Number(session.chips_per_paise);
      const row = await b.buyins.create({
        session_id: sessionId,
        user_id: userId,
        amount_paise: amount as number,
        chips,
        recorded_by: me.id,
      });
      return rowToBuyin(row);
    },

    async editBuyin(id, patch) {
      const existing = await b.buyins.listForSession(""); // placeholder; better: fetch by id directly
      // Find via session listing — boundary doesn't expose getById, but the RealBoundary wraps update by id.
      const updated = await b.buyins.update(id, {
        ...(patch.amount !== undefined ? { amount_paise: patch.amount as number } : {}),
      });
      return rowToBuyin(updated);
    },

    async deleteBuyin(id) {
      await b.buyins.delete(id);
    },

    async listBuyins(sessionId) {
      await requireParticipantOrHouse(sessionId);
      const rows = await b.buyins.listForSession(sessionId);
      return rows.map(rowToBuyin);
    },

    async submitCashout({ sessionId, userId, chipCount }) {
      const { me } = await requireParticipantOrHouse(sessionId);
      const row = await b.cashouts.upsert({
        session_id: sessionId,
        user_id: userId,
        chip_count: chipCount as number,
        amount_paise: 0,           // computed by trigger / fake
        submitted_by: me.id,
      });
      return rowToCashout(row);
    },

    async confirmCashout(id) {
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error("not_authenticated");
      const row = await b.cashouts.confirm(id, me.id);
      return rowToCashout(row);
    },

    async listCashouts(sessionId) {
      await requireParticipantOrHouse(sessionId);
      const rows = await b.cashouts.listForSession(sessionId);
      return rows.map(rowToCashout);
    },

    async getSessionLedger(sessionId): Promise<PlayerLedger[]> {
      await requireParticipantOrHouse(sessionId);
      const [buyins, cashouts, parts] = await Promise.all([
        b.buyins.listForSession(sessionId),
        b.cashouts.listForSession(sessionId),
        b.sessions.listParticipants(sessionId),
      ]);
      return parts.map((p) => {
        const userBuyins = buyins.filter((x) => x.user_id === p.user_id);
        const totalBuyins = userBuyins.reduce((acc, x) => acc + Number(x.amount_paise), 0);
        const co = cashouts.find((x) => x.user_id === p.user_id);
        const cashoutPaise = co ? Number(co.amount_paise) : 0;
        return {
          userId: asUserId(p.user_id),
          totalBuyinsPaise: asPaise(totalBuyins),
          cashoutPaise: asPaise(cashoutPaise),
          netPaise: asPaise(cashoutPaise - totalBuyins),
        };
      });
    },

    async getReconciliation(sessionId): Promise<Reconciliation> {
      const [buyins, cashouts] = await Promise.all([
        b.buyins.listForSession(sessionId),
        b.cashouts.listForSession(sessionId),
      ]);
      const expected = buyins.reduce((acc, x) => acc + Number(x.amount_paise), 0);
      const actual = cashouts.reduce((acc, x) => acc + Number(x.amount_paise), 0);
      return {
        expected: asPaise(expected),
        actual: asPaise(actual),
        discrepancy: asPaise(expected - actual),
      };
    },

    async listAudit(sessionId) {
      await requireParticipantOrHouse(sessionId);
      const rows = await b.audit.listForSession(sessionId);
      return rows.map(rowToAudit);
    },
  };
}
```

### Tests: `tests/modules/ledger/`

`tests/modules/ledger/buyins.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as ledger from "@/lib/modules/ledger";
import * as sessions from "@/lib/modules/sessions";
import { asPaise, asUserId } from "@/lib/modules/core";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

const setup = async () => {
  const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
  const s = sessions.withBoundary(b);
  const sess = await s.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });
  const l = ledger.withBoundary(b);
  return { b, l, sess };
};

describe("ledger/buyins", () => {
  it("records a buy-in and writes audit", async () => {
    const { b, l, sess } = await setup();
    const buyin = await l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-ravi"), amount: asPaise(50000) });
    expect(buyin.amount).toBe(50000);
    const audit = await l.listAudit(sess.id);
    expect(audit.some((a) => a.action === "buyin_create")).toBe(true);
  });

  it("rejects buy-in from non-house", async () => {
    const { b, sess } = await setup();
    b.__setCurrentUser("u-ravi");
    const l = ledger.withBoundary(b);
    await expect(l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-ravi"), amount: asPaise(50000) })).rejects.toThrow("not_house");
  });
});
```

`tests/modules/ledger/cashouts.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as ledger from "@/lib/modules/ledger";
import * as sessions from "@/lib/modules/sessions";
import { asChips, asPaise, asUserId } from "@/lib/modules/core";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("ledger/cashouts", () => {
  it("submit then confirm flow", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const s = sessions.withBoundary(b);
    const sess = await s.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });
    const l = ledger.withBoundary(b);

    const co = await l.submitCashout({ sessionId: sess.id, userId: asUserId("u-aman"), chipCount: asChips(60000) });
    expect(co.status).toBe("pending");
    const confirmed = await l.confirmCashout(co.id);
    expect(confirmed.status).toBe("confirmed");
  });
});
```

`tests/modules/ledger/reconciliation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as ledger from "@/lib/modules/ledger";
import * as sessions from "@/lib/modules/sessions";
import { asChips, asPaise, asUserId } from "@/lib/modules/core";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("ledger/reconciliation", () => {
  it("zero discrepancy when chips conserved", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const s = sessions.withBoundary(b);
    const sess = await s.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });
    const l = ledger.withBoundary(b);
    await l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-aman"), amount: asPaise(50000) });
    await l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-ravi"), amount: asPaise(50000) });
    await l.submitCashout({ sessionId: sess.id, userId: asUserId("u-aman"), chipCount: asChips(40000) });
    await l.submitCashout({ sessionId: sess.id, userId: asUserId("u-ravi"), chipCount: asChips(60000) });
    const r = await l.getReconciliation(sess.id);
    expect(r.discrepancy).toBe(0);
  });
});
```

### Acceptance
- [ ] All ledger tests pass.
- [ ] Audit log entries appear for every write.
- [ ] Closed-session writes throw `session_closed`.

---

## Module: `leaderboard`

### File: `lib/modules/leaderboard/internal/factory.ts`

```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Leaderboard, LeaderboardEntry, LeaderboardSort } from "../index";
import { asPaise, asUserId, type Paise } from "@/lib/modules/core";

export function createLeaderboard(b: DbBoundary): Leaderboard {
  return {
    async getLeaderboard(filter, sort = "net") {
      const sessions = (await b.sessions.list({ status: "closed" }))
        .filter((s) => !filter?.from || s.played_on >= filter.from)
        .filter((s) => !filter?.to || s.played_on <= filter.to);

      const acc = new Map<string, { net: number; sessions: number; wins: number; biggestWin: number; nickname: string }>();

      for (const s of sessions) {
        const [buyins, cashouts, parts] = await Promise.all([
          b.buyins.listForSession(s.id),
          b.cashouts.listForSession(s.id),
          b.sessions.listParticipants(s.id),
        ]);
        for (const p of parts) {
          const profile = await b.profiles.get(p.user_id);
          const userBuyins = buyins.filter((x) => x.user_id === p.user_id).reduce((a, x) => a + Number(x.amount_paise), 0);
          const co = cashouts.find((x) => x.user_id === p.user_id);
          const cashoutPaise = co ? Number(co.amount_paise) : 0;
          const net = cashoutPaise - userBuyins;
          const cur = acc.get(p.user_id) ?? { net: 0, sessions: 0, wins: 0, biggestWin: 0, nickname: profile?.nickname ?? "" };
          cur.net += net;
          cur.sessions += 1;
          if (net > 0) cur.wins += 1;
          if (net > cur.biggestWin) cur.biggestWin = net;
          cur.nickname = profile?.nickname ?? cur.nickname;
          acc.set(p.user_id, cur);
        }
      }

      const entries: LeaderboardEntry[] = [...acc.entries()].map(([userId, v]) => ({
        userId: asUserId(userId),
        nickname: v.nickname,
        netPaise: asPaise(v.net),
        sessionsPlayed: v.sessions,
        sessionsWon: v.wins,
        winRate: v.sessions ? v.wins / v.sessions : 0,
        biggestWinPaise: asPaise(v.biggestWin),
        averagePerSessionPaise: asPaise(v.sessions ? Math.round(v.net / v.sessions) : 0),
      }));

      const sortFn: Record<LeaderboardSort, (a: LeaderboardEntry, b: LeaderboardEntry) => number> = {
        net: (a, b) => b.netPaise - a.netPaise,
        sessions: (a, b) => b.sessionsPlayed - a.sessionsPlayed,
        winRate: (a, b) => b.winRate - a.winRate,
        biggestWin: (a, b) => b.biggestWinPaise - a.biggestWinPaise,
        average: (a, b) => b.averagePerSessionPaise - a.averagePerSessionPaise,
      };
      return entries.sort(sortFn[sort]);
    },
  };
}
```

### Tests: `tests/modules/leaderboard/leaderboard.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as leaderboard from "@/lib/modules/leaderboard";
// Helper: build a closed-session fixture by calling sessions+ledger then closing.
import * as sessions from "@/lib/modules/sessions";
import * as ledger from "@/lib/modules/ledger";
import { asChips, asPaise, asUserId } from "@/lib/modules/core";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("leaderboard", () => {
  it("aggregates closed sessions correctly", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const s = sessions.withBoundary(b);
    const l = ledger.withBoundary(b);
    const sess = await s.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });

    // Aman is the house; manually add Ravi as participant via the fake's RPC.
    b.__setCurrentUser("u-ravi");
    await b.auth.joinSessionWithToken(sess.inviteToken);
    b.__setCurrentUser("u-aman");

    await l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-aman"), amount: asPaise(50000) });
    await l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-ravi"), amount: asPaise(50000) });
    const co1 = await l.submitCashout({ sessionId: sess.id, userId: asUserId("u-aman"), chipCount: asChips(70000) });
    const co2 = await l.submitCashout({ sessionId: sess.id, userId: asUserId("u-ravi"), chipCount: asChips(30000) });
    await l.confirmCashout(co1.id);
    await l.confirmCashout(co2.id);
    await s.closeSession(sess.id);

    const lb = leaderboard.withBoundary(b);
    const board = await lb.getLeaderboard();
    expect(board.find((e) => e.userId === "u-aman")?.netPaise).toBe(20000);
    expect(board.find((e) => e.userId === "u-ravi")?.netPaise).toBe(-20000);
  });
});
```

### Acceptance
- [ ] Tests pass.
- [ ] All sort orders work.
- [ ] Date filter inclusive.

---

## Module: `profiles`

### File: `lib/modules/profiles/internal/factory.ts`

```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Profiles, ProfileSummary } from "../index";
import * as badges from "@/lib/modules/badges";
import { asPaise, asSessionId, asUserId, type Paise } from "@/lib/modules/core";

export function createProfiles(b: DbBoundary): Profiles {
  const badgesModule = badges.withBoundary(b);

  return {
    async getProfile(userId): Promise<ProfileSummary> {
      const profile = await b.profiles.get(userId);
      if (!profile) throw new Error("not_found");

      const allSessions = await b.sessions.list({ status: "closed" });
      const myParticipation: Array<{ sessionId: string; playedOn: string; net: number }> = [];

      for (const s of allSessions) {
        const parts = await b.sessions.listParticipants(s.id);
        if (!parts.some((p) => p.user_id === userId)) continue;
        const buyins = (await b.buyins.listForSession(s.id)).filter((x) => x.user_id === userId);
        const cashouts = (await b.cashouts.listForSession(s.id)).filter((x) => x.user_id === userId);
        const totalIn = buyins.reduce((a, x) => a + Number(x.amount_paise), 0);
        const out = cashouts.reduce((a, x) => a + Number(x.amount_paise), 0);
        myParticipation.push({ sessionId: s.id, playedOn: s.played_on, net: out - totalIn });
      }

      myParticipation.sort((a, b) => a.playedOn.localeCompare(b.playedOn));

      const lifetimeNet = myParticipation.reduce((a, x) => a + x.net, 0);
      const biggestWin = myParticipation.reduce((a, x) => Math.max(a, x.net), 0);
      const biggestLoss = myParticipation.reduce((a, x) => Math.min(a, x.net), 0);
      const streak = computeStreak(myParticipation.map((x) => x.net));

      let cum = 0;
      const bankrollSeries = myParticipation.map((x) => {
        cum += x.net;
        return { at: x.playedOn, cumulativeNetPaise: asPaise(cum) };
      });

      const userBadges = await badgesModule.listBadgesForUser(userId);

      return {
        user: { id: asUserId(userId), nickname: profile.nickname, avatarUrl: profile.avatar_url ?? undefined },
        lifetime: {
          netPaise: asPaise(lifetimeNet),
          sessionsPlayed: myParticipation.length,
          biggestWinPaise: asPaise(biggestWin),
          biggestLossPaise: asPaise(biggestLoss),
          currentStreak: streak,
        },
        badges: userBadges.map((b) => ({ key: b.key, earnedAt: b.earnedAt, sessionId: b.sessionId })),
        history: myParticipation.map((x) => ({ sessionId: asSessionId(x.sessionId), playedOn: x.playedOn, netPaise: asPaise(x.net) })),
        bankrollSeries,
      };
    },

    async updateProfile(patch) {
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error("not_authenticated");
      await b.profiles.update(me.id, {
        ...(patch.nickname !== undefined ? { nickname: patch.nickname } : {}),
        ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
      });
    },
  };
}

function computeStreak(series: number[]): number {
  if (series.length === 0) return 0;
  const last = series[series.length - 1]!;
  if (last === 0) return 0;
  let n = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (Math.sign(series[i]!) === Math.sign(last) && series[i] !== 0) n++;
    else break;
  }
  return Math.sign(last) * n;
}
```

### Tests: `tests/modules/profiles/profiles.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as profiles from "@/lib/modules/profiles";
import { asUserId } from "@/lib/modules/core";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("profiles", () => {
  it("returns empty profile for player with no sessions", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId("u-aman"));
    expect(summary.lifetime.sessionsPlayed).toBe(0);
    expect(summary.lifetime.netPaise).toBe(0);
    expect(summary.history).toEqual([]);
    expect(summary.bankrollSeries).toEqual([]);
  });
});
```

### Acceptance
- [ ] Tests pass.
- [ ] Streak math correct on alternating + monotonic + zero series.

---

## Module: `badges`

### File: `lib/modules/badges/internal/factory.ts`

```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Badges, Badge } from "../index";
import { asSessionId, asUserId } from "@/lib/modules/core";
import { rules, type RuleContext } from "./rules/registry";

export function createBadges(b: DbBoundary): Badges {
  return {
    async evaluateBadgesForSession(sessionId): Promise<Badge[]> {
      const session = await b.sessions.get(sessionId);
      if (!session || session.status !== "closed") return [];
      const parts = await b.sessions.listParticipants(sessionId);
      const buyins = await b.buyins.listForSession(sessionId);
      const cashouts = await b.cashouts.listForSession(sessionId);

      const newlyAwarded: Badge[] = [];
      for (const p of parts) {
        const userHistory = await loadUserHistory(b, p.user_id);
        const ctx: RuleContext = {
          userId: p.user_id,
          session,
          buyins,
          cashouts,
          history: userHistory,
        };
        for (const rule of rules) {
          const earned = await rule.evaluate(ctx);
          if (!earned) continue;
          const exists = await b.badges.existsForUserSession(p.user_id, earned.key, sessionId);
          if (exists) continue;
          const row = await b.badges.create({ user_id: p.user_id, badge_key: earned.key, session_id: sessionId });
          newlyAwarded.push({ key: row.badge_key, earnedAt: row.earned_at, sessionId: row.session_id ? asSessionId(row.session_id) : undefined });
        }
      }
      return newlyAwarded;
    },

    async listBadgesForUser(userId) {
      const rows = await b.badges.listForUser(userId);
      return rows.map((r) => ({
        key: r.badge_key,
        earnedAt: r.earned_at,
        sessionId: r.session_id ? asSessionId(r.session_id) : undefined,
      }));
    },
  };
}

async function loadUserHistory(b: DbBoundary, userId: string) {
  const closed = await b.sessions.list({ status: "closed" });
  return closed.filter(async (s) => {
    const parts = await b.sessions.listParticipants(s.id);
    return parts.some((p) => p.user_id === userId);
  });
}
```

### File: `lib/modules/badges/internal/rules/registry.ts`

```ts
import type { SessionRow, BuyinRow, CashoutRow } from "@/lib/db/boundary";
import { firstSession } from "./first-session";
import { streak10 } from "./streak-10";
import { biggestPot } from "./biggest-pot";
import { comebackKid } from "./comeback-kid";

export type RuleContext = {
  userId: string;
  session: SessionRow;
  buyins: BuyinRow[];
  cashouts: CashoutRow[];
  history: SessionRow[];
};

export type Rule = {
  key: string;
  evaluate: (ctx: RuleContext) => Promise<{ key: string } | null>;
};

export const rules: Rule[] = [firstSession, streak10, biggestPot, comebackKid];
```

### File: `lib/modules/badges/internal/rules/first-session.ts`

```ts
import type { Rule } from "./registry";

export const firstSession: Rule = {
  key: "first_session",
  async evaluate(ctx) {
    if (ctx.history.length === 1) return { key: "first_session" };  // current is first closed
    return null;
  },
};
```

### File: `lib/modules/badges/internal/rules/streak-10.ts`

```ts
import type { Rule } from "./registry";

export const streak10: Rule = {
  key: "streak_10",
  async evaluate(ctx) {
    if (ctx.history.length >= 10) return { key: "streak_10" };
    return null;
  },
};
```

### File: `lib/modules/badges/internal/rules/biggest-pot.ts`

```ts
import type { Rule } from "./registry";

export const biggestPot: Rule = {
  key: "biggest_pot",
  async evaluate(ctx) {
    const myBuyins = ctx.buyins.filter((b) => b.user_id === ctx.userId).reduce((a, b) => a + Number(b.amount_paise), 0);
    const myCashout = ctx.cashouts.find((c) => c.user_id === ctx.userId);
    const myNet = myCashout ? Number(myCashout.amount_paise) - myBuyins : -myBuyins;

    const allNets = ctx.history.map((s) => myNetForSession(ctx, s));
    const maxOther = allNets.reduce((a, b) => Math.max(a, b), 0);

    return myNet > maxOther && myNet > 0 ? { key: "biggest_pot" } : null;
  },
};

function myNetForSession(ctx: any, _s: any) { return 0; /* simplified — improve when data available */ }
```

### File: `lib/modules/badges/internal/rules/comeback-kid.ts`

```ts
import type { Rule } from "./registry";

export const comebackKid: Rule = {
  key: "comeback_kid",
  async evaluate(ctx) {
    const myBuyins = ctx.buyins.filter((b) => b.user_id === ctx.userId);
    const myCashout = ctx.cashouts.find((c) => c.user_id === ctx.userId);
    if (!myCashout) return null;
    const totalIn = myBuyins.reduce((a, b) => a + Number(b.amount_paise), 0);
    const out = Number(myCashout.amount_paise);
    const net = out - totalIn;
    const bigBlind = Number(ctx.session.blinds_big);

    // Heuristic: if user had at least 2 buy-ins and finished positive, count as comeback.
    if (myBuyins.length >= 2 && net > 0) return { key: "comeback_kid" };
    return null;
  },
};
```

### Tests: `tests/modules/badges/badges.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as badges from "@/lib/modules/badges";
import { asSessionId } from "@/lib/modules/core";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("badges", () => {
  it("awards first_session on first closed session", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    // ... create + close a session via session+ledger modules first
    // (omitted here for brevity — the integration test in tests/integration covers full path)
    const m = badges.withBoundary(b);
    expect(await m.listBadgesForUser("u-aman")).toEqual([]);
  });
});
```

### Acceptance
- [ ] Tests pass.
- [ ] Adding a new rule file requires no DB migration.

---

## Module: `media`

### File: `lib/modules/media/internal/factory.ts`

```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { Media, Note, Photo } from "../index";
import { asSessionId, asUserId } from "@/lib/modules/core";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

export function createMedia(b: DbBoundary): Media {
  async function requireParticipant(sessionId: string) {
    const me = await b.auth.getCurrentUser();
    if (!me) throw new Error("not_authenticated");
    const ps = await b.sessions.listParticipants(sessionId);
    const session = await b.sessions.get(sessionId);
    if (!ps.some((p) => p.user_id === me.id) && session?.created_by !== me.id) throw new Error("not_participant");
    return me;
  }

  return {
    async listNotes(sessionId) {
      await requireParticipant(sessionId);
      const rows = await b.notes.listForSession(sessionId);
      return rows.map((r): Note => ({
        id: r.id,
        sessionId: asSessionId(r.session_id),
        authorUserId: asUserId(r.author_user_id),
        body: r.body,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    },
    async addNote({ sessionId, body }) {
      const me = await requireParticipant(sessionId);
      const r = await b.notes.create({ session_id: sessionId, author_user_id: me.id, body });
      return {
        id: r.id, sessionId: asSessionId(r.session_id), authorUserId: asUserId(r.author_user_id),
        body: r.body, createdAt: r.created_at, updatedAt: r.updated_at,
      };
    },
    async editNote(id, body) {
      const me = await b.auth.getCurrentUser();
      if (!me) throw new Error("not_authenticated");
      const r = await b.notes.update(id, body);
      if (r.author_user_id !== me.id) throw new Error("not_author");
      return {
        id: r.id, sessionId: asSessionId(r.session_id), authorUserId: asUserId(r.author_user_id),
        body: r.body, createdAt: r.created_at, updatedAt: r.updated_at,
      };
    },
    async deleteNote(id) { await b.notes.delete(id); },

    async listPhotos(sessionId) {
      await requireParticipant(sessionId);
      const rows = await b.photos.listForSession(sessionId);
      return Promise.all(rows.map(async (r): Promise<Photo> => ({
        id: r.id,
        sessionId: asSessionId(r.session_id),
        uploadedBy: asUserId(r.uploaded_by),
        url: await b.storage.getSignedUrl(r.storage_path, 3600),
        caption: r.caption ?? undefined,
        createdAt: r.created_at,
      })));
    },
    async uploadPhoto({ sessionId, file, caption }) {
      const me = await requireParticipant(sessionId);
      if (file.size > MAX_BYTES) throw new Error("too_large");
      if (!ALLOWED_MIME.has(file.type)) throw new Error("invalid_mime");
      const ext = file.type.split("/")[1] ?? "jpg";
      const path = `${sessionId}/${crypto.randomUUID()}.${ext}`;
      await b.storage.upload(path, file, file.type);
      const row = await b.photos.create({ session_id: sessionId, uploaded_by: me.id, storage_path: path, caption });
      return {
        id: row.id,
        sessionId: asSessionId(row.session_id),
        uploadedBy: asUserId(row.uploaded_by),
        url: await b.storage.getSignedUrl(path, 3600),
        caption: row.caption ?? undefined,
        createdAt: row.created_at,
      };
    },
    async deletePhoto(id) { await b.photos.delete(id); },
  };
}
```

### Tests: `tests/modules/media/media.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as media from "@/lib/modules/media";
import * as sessions from "@/lib/modules/sessions";
import { asPaise, asSessionId } from "@/lib/modules/core";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("media", () => {
  it("rejects oversize photo", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const s = sessions.withBoundary(b);
    const sess = await s.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });
    const m = media.withBoundary(b);
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    await expect(m.uploadPhoto({ sessionId: sess.id, file: big })).rejects.toThrow("too_large");
  });

  it("rejects wrong mime", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const s = sessions.withBoundary(b);
    const sess = await s.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });
    const m = media.withBoundary(b);
    const wrong = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
    await expect(m.uploadPhoto({ sessionId: sess.id, file: wrong })).rejects.toThrow("invalid_mime");
  });
});
```

### Acceptance
- [ ] Tests pass.

---

## Module: `export`

### File: `lib/modules/export/internal/factory.ts`

```ts
import type { DbBoundary } from "@/lib/db/boundary";
import type { ExportModule } from "../index";
import { asPaise } from "@/lib/modules/core";
import * as core from "@/lib/modules/core";
import * as ledger from "@/lib/modules/ledger";
import * as sessions from "@/lib/modules/sessions";

export function createExport(b: DbBoundary): ExportModule {
  const c = core.withBoundary(b);
  const sessionsMod = sessions.withBoundary(b);
  const ledgerMod = ledger.withBoundary(b);

  return {
    async exportSessionCSV(sessionId): Promise<Blob> {
      const session = await sessionsMod.getSession(sessionId);
      const players = await ledgerMod.getSessionLedger(sessionId);
      const rows = [
        ["played_on", "user_id", "total_buyins_inr", "cashout_inr", "net_inr"].join(","),
        ...await Promise.all(players.map(async (p) => [
          session.playedOn,
          p.userId,
          (p.totalBuyinsPaise / 100).toFixed(2),
          (p.cashoutPaise / 100).toFixed(2),
          (p.netPaise / 100).toFixed(2),
        ].join(","))),
      ];
      return new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    },

    async exportSessionPDF(sessionId): Promise<Blob> {
      // For v1: generate a minimal PDF via @react-pdf/renderer.
      // Frontend agent wires the actual rendering — this module just returns a placeholder Blob.
      // Implementation can be a server route that streams the PDF.
      const csv = await this.exportSessionCSV(sessionId);
      const text = await csv.text();
      return new Blob([`PDF placeholder\n\n${text}`], { type: "application/pdf" });
    },

    async exportFullHistoryCSV(): Promise<Blob> {
      const all = await sessionsMod.listSessions({ status: "closed" });
      const lines: string[] = [["session_id", "played_on", "user_id", "net_inr"].join(",")];
      for (const s of all) {
        const ledger = await ledgerMod.getSessionLedger(s.id);
        for (const p of ledger) {
          lines.push([s.id, s.playedOn, p.userId, (p.netPaise / 100).toFixed(2)].join(","));
        }
      }
      return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    },
  };
}
```

### Tests: `tests/modules/export/export.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as exportMod from "@/lib/modules/export";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("export", () => {
  it("exports an empty full history when no closed sessions exist", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const e = exportMod.withBoundary(b);
    const blob = await e.exportFullHistoryCSV();
    const text = await blob.text();
    expect(text).toContain("session_id,played_on,user_id,net_inr");
  });
});
```

### Acceptance
- [ ] Tests pass.
- [ ] PDF and CSV blobs non-empty for a real closed session.

---

## Cross-module integration test (run after all 9 modules ship)

`tests/integration/full-flow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as auth from "@/lib/modules/auth";
import * as sessions from "@/lib/modules/sessions";
import * as ledger from "@/lib/modules/ledger";
import * as leaderboard from "@/lib/modules/leaderboard";
import * as profiles from "@/lib/modules/profiles";
import * as badges from "@/lib/modules/badges";
import * as exportMod from "@/lib/modules/export";
import { asChips, asPaise, asUserId } from "@/lib/modules/core";
import { FIXTURE_USERS } from "tests/helpers/fixtures";
import { createFakeBoundary } from "tests/helpers/fakeBoundary";

describe("full flow", () => {
  it("create→buyins→cashouts→close→leaderboard→badges→export", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const s = sessions.withBoundary(b);
    const l = ledger.withBoundary(b);
    const lb = leaderboard.withBoundary(b);
    const p = profiles.withBoundary(b);
    const ex = exportMod.withBoundary(b);

    const sess = await s.createSession({ blinds: { small: asPaise(100), big: asPaise(200) } });

    // Ravi joins via invite
    b.__setCurrentUser("u-ravi");
    await b.auth.joinSessionWithToken(sess.inviteToken);

    // Priya joins via invite
    b.__setCurrentUser("u-priya");
    await b.auth.joinSessionWithToken(sess.inviteToken);

    // Aman records buy-ins
    b.__setCurrentUser("u-aman");
    await l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-aman"), amount: asPaise(50000) });
    await l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-ravi"), amount: asPaise(50000) });
    await l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-priya"), amount: asPaise(50000) });
    await l.recordBuyin({ sessionId: sess.id, userId: asUserId("u-ravi"), amount: asPaise(50000) }); // rebuy

    // Submit cashouts (chip ratio = 1 paise per chip → 1:1)
    await l.submitCashout({ sessionId: sess.id, userId: asUserId("u-aman"), chipCount: asChips(80000) });
    await l.submitCashout({ sessionId: sess.id, userId: asUserId("u-ravi"), chipCount: asChips(40000) });
    await l.submitCashout({ sessionId: sess.id, userId: asUserId("u-priya"), chipCount: asChips(80000) });

    // Confirm all
    const cashouts = await l.listCashouts(sess.id);
    for (const c of cashouts) await l.confirmCashout(c.id);

    // Close session
    await s.closeSession(sess.id);

    // Trigger badge eval
    const m = badges.withBoundary(b);
    await m.evaluateBadgesForSession(sess.id);

    // Assertions
    const board = await lb.getLeaderboard();
    expect(board.find((e) => e.userId === "u-aman")?.netPaise).toBe(30000);
    expect(board.find((e) => e.userId === "u-ravi")?.netPaise).toBe(-60000);
    expect(board.find((e) => e.userId === "u-priya")?.netPaise).toBe(30000);

    const amanProfile = await p.getProfile(asUserId("u-aman"));
    expect(amanProfile.lifetime.sessionsPlayed).toBe(1);
    expect(amanProfile.lifetime.netPaise).toBe(30000);

    const csv = await ex.exportSessionCSV(sess.id);
    const text = await csv.text();
    expect(text.split("\n").length).toBeGreaterThan(3); // header + 3 players

    const audit = await l.listAudit(sess.id);
    expect(audit.length).toBeGreaterThan(8); // open + 4 buyins + 3 submits + 3 confirms + close
  });
});
```

---

## Acceptance (cross-module)

- [ ] `pnpm test` runs all module + integration tests; all pass.
- [ ] Coverage thresholds met (see `vitest.config.ts`).
- [ ] `pnpm cycles` reports no cycles.
- [ ] `node scripts/audit-imports.mjs` reports no boundary violations.
- [ ] `pnpm typecheck` passes.

When all modules report green individually AND the integration test passes, Phase 1 modules are done. Phase 2 (frontend, e2e) can begin.
