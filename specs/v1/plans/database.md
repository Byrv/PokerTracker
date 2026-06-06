# Database Plan

Supabase project, schema, RLS policies, migrations, seed, and generated types. Runs **second**, **sequentially**, **single agent**, after `foundation.md`. Locked-down output: schema is immutable after this plan ships.

---

## Output

A working Supabase project (local + remote) with:
- All tables and indexes for v1 features
- RLS policies enforcing the requirements
- Triggers/functions for audit logging and badge evaluation
- Seed data for ~5 users + 2 sample sessions
- Generated TypeScript types in `lib/db/types.ts`

---

## Project setup

```bash
pnpm dlx supabase@latest init
pnpm dlx supabase@latest start    # local dev
```

`supabase/config.toml`: enable Auth (email magic link), enable Storage (bucket `session-media`), disable Realtime (we don't use it).

Two environments:
- **Local** — for development, reset freely.
- **Remote** — Vercel preview + production share one project (separate per environment is overkill for v1; deployment plan uses env vars to point at it).

---

## Naming conventions

- Tables: `snake_case`, plural where it's a collection (`sessions`, `buyins`).
- Columns: `snake_case`. Booleans as `is_*` / `has_*`.
- Foreign keys: `<referenced_table_singular>_id` (e.g. `session_id`).
- Money in **paise** (smallest INR unit) as `bigint`. Never store rupees as float.
- Chips as `bigint`.
- Timestamps: `timestamptz`, default `now()`.

---

## Schema

### `profiles`
Extends `auth.users` with display data.
```sql
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);
```

### `app_settings`
Singleton (one row, id always = 1). Holds the global chip ratio.
```sql
create table app_settings (
  id smallint primary key default 1 check (id = 1),
  chips_per_paise bigint not null,             -- e.g. 1 chip = 100 paise (₹1) → value 100
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
```

### `sessions`
A poker night.
```sql
create type session_status as enum ('open', 'closed');

create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),  -- the house
  name text,
  location text,
  played_on date not null default current_date,
  blinds_small bigint not null,                        -- in paise
  blinds_big bigint not null,
  chips_per_paise bigint not null,                     -- snapshot of app_settings at creation
  invite_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  status session_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index on sessions(status);
create index on sessions(created_by);
create index on sessions(played_on desc);
```

### `session_participants`
```sql
create table session_participants (
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index on session_participants(user_id);
```

### `buyins`
```sql
create table buyins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  amount_paise bigint not null check (amount_paise > 0),
  chips bigint not null check (chips > 0),
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now()
);
create index on buyins(session_id);
create index on buyins(user_id);
```

### `cashouts`
```sql
create type cashout_status as enum ('pending', 'confirmed');

create table cashouts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  chip_count bigint not null check (chip_count >= 0),
  amount_paise bigint not null,                        -- computed from chip_count + session.chips_per_paise
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  status cashout_status not null default 'pending',
  unique (session_id, user_id)
);
create index on cashouts(session_id);
```

### `audit_log`
Append-only. One row per create / edit / delete on buy-ins or cash-outs.
```sql
create type audit_action as enum (
  'buyin_create', 'buyin_edit', 'buyin_delete',
  'cashout_submit', 'cashout_edit', 'cashout_confirm',
  'session_open', 'session_close'
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  action audit_action not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log(session_id, created_at desc);
```

### `notes`
```sql
create table notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on notes(session_id, created_at desc);
```

### `photos`
Files live in Storage; this table holds metadata.
```sql
create table photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null,                          -- e.g. session-media/<session_id>/<uuid>.jpg
  caption text,
  created_at timestamptz not null default now()
);
create index on photos(session_id);
```

### `badges`
Awarded badges (the catalog of badge keys lives in code).
```sql
create table badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  badge_key text not null,
  session_id uuid references sessions(id),             -- nullable: not all badges tied to a session
  earned_at timestamptz not null default now(),
  unique (user_id, badge_key, session_id)
);
create index on badges(user_id);
```

---

## Row Level Security (every table on)

```sql
alter table profiles enable row level security;
alter table app_settings enable row level security;
alter table sessions enable row level security;
alter table session_participants enable row level security;
alter table buyins enable row level security;
alter table cashouts enable row level security;
alter table audit_log enable row level security;
alter table notes enable row level security;
alter table photos enable row level security;
alter table badges enable row level security;
```

### Helper functions
```sql
create or replace function is_session_participant(s uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from session_participants
    where session_id = s and user_id = auth.uid()
  );
$$;

create or replace function is_session_house(s uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from sessions where id = s and created_by = auth.uid()
  );
$$;
```

### Policy summary

| Table | Read | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | any authenticated | self | self | none |
| `app_settings` | any authenticated | none (seeded) | any authenticated | none |
| `sessions` | any authenticated | any authenticated (creator becomes house) | house only | none |
| `session_participants` | any authenticated | house OR self with valid invite_token (RPC) | none | house only |
| `buyins` | session participants | house only | house only | house only |
| `cashouts` | session participants | participant or house | house (confirm) or own row while pending | none |
| `audit_log` | session participants | server-side via trigger only | none | none |
| `notes` | session participants | session participants | author | author |
| `photos` | session participants | session participants | uploader | uploader |
| `badges` | any authenticated | server-side function only | none | none |

Write each policy out explicitly in the migration. Example for `buyins`:
```sql
create policy "buyins_read" on buyins
  for select using (is_session_participant(session_id));
create policy "buyins_write_house" on buyins
  for all using (is_session_house(session_id))
            with check (is_session_house(session_id));
```

### Joining via invite token (RPC, bypasses RLS for the insert)
```sql
create or replace function join_session_with_token(token text)
returns sessions language plpgsql security definer set search_path = public as $$
declare s sessions;
begin
  select * into s from sessions where invite_token = token and status = 'open';
  if not found then raise exception 'invalid or closed invite'; end if;
  insert into session_participants(session_id, user_id) values (s.id, auth.uid())
    on conflict do nothing;
  return s;
end;
$$;
```

---

## Triggers

### Audit log trigger (on `buyins`, `cashouts`, `sessions`)
One trigger per table; writes to `audit_log` with before/after JSON.

### Cash-out amount enforcement
```sql
create or replace function compute_cashout_amount() returns trigger language plpgsql as $$
declare ratio bigint;
begin
  select chips_per_paise into ratio from sessions where id = new.session_id;
  new.amount_paise := new.chip_count * ratio;
  return new;
end;
$$;
create trigger cashouts_compute before insert or update of chip_count on cashouts
for each row execute function compute_cashout_amount();
```

### Lock writes when session is closed
Trigger on `buyins`, `cashouts`, `notes` rejecting writes if `sessions.status = 'closed'`.

---

## Storage

Bucket `session-media`, public read for participants only (enforced via signed URLs from server actions). Path convention: `<session_id>/<uuid>.<ext>`.

---

## Seed data (`supabase/seed.sql`)

- 5 fake auth users with profiles (Aman, Ravi, Priya, Karan, Neha).
- 1 closed session with full ledger (buy-ins, cash-outs, audit log).
- 1 open session with two buy-ins recorded, no cash-outs yet.
- `app_settings` row: `chips_per_paise = 1` (₹0.01 per chip — adjust to taste).

Seed is for local dev and Playwright fixtures only. Never run against production.

---

## Type generation

After every migration:
```bash
pnpm db:gen-types
```

Generates `lib/db/types.ts`. **All modules use `Database` types from this file as the single source of DB shape truth.**

---

## Migration discipline

- One migration file per logical change, named `NNNN_<slug>.sql`.
- Forward-only. No `down` migrations in v1.
- Schema-only migrations vs. data migrations are separate files.

---

## Acceptance checklist

- [ ] `supabase start` brings up local stack cleanly.
- [ ] `supabase db reset` rebuilds the DB from migrations + seed without errors.
- [ ] All tables exist, all RLS policies active.
- [ ] Manual RLS smoke test: a non-participant cannot read another session's buy-ins; a non-house cannot insert a buy-in; the audit log is written by trigger.
- [ ] `pnpm db:gen-types` produces `lib/db/types.ts`; `pnpm typecheck` still passes.
- [ ] Seed data loads and matches a fixture file used by `e2e.md`.

When all boxes are checked, schema is **frozen**. Future changes go through new migrations only.
