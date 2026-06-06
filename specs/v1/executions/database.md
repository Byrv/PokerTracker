# Database Execution Runbook

Implements `plans/database.md`. Single agent. Runs after `executions/foundation.md` is green. Output: working Supabase project (local + remote-ready), with schema, RLS, triggers, seed, and generated types.

Schema is **immutable** after this runbook ships. Future schema changes go through new migration files only.

Working directory: `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Step 1 — Install Supabase CLI and initialize

```bash
pnpm dlx supabase@latest --version           # confirm available
pnpm dlx supabase@latest init
```

This creates `supabase/config.toml` and `supabase/seed.sql`.

Update `supabase/config.toml` — enable email auth, disable phone/social, configure storage:

```toml
project_id = "poker-tracker"

[api]
enabled = true
port = 54321
schemas = ["public"]
extra_search_path = ["public"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323

[inbucket]
enabled = true
port = 54324

[storage]
enabled = true
file_size_limit = "20MiB"

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/callback"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = false
enable_confirmations = false       # magic-link only, no double-confirm
otp_length = 6
otp_expiry = 3600

[realtime]
enabled = false
```

```bash
pnpm dlx supabase@latest start
```

**Verify:**
```bash
pnpm dlx supabase@latest status
# All services running. Note the local URLs and anon key — write them to .env.local.
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<value from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<value from `supabase status`>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Step 2 — Migration 0001: extensions, helper functions, profiles

Create `supabase/migrations/0001_init.sql`:

```sql
-- Extensions
create extension if not exists pgcrypto;

-- profiles (extends auth.users)
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth.users row is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id, nickname)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles_read_all" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_self" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
```

---

## Step 3 — Migration 0002: app_settings (singleton)

Create `supabase/migrations/0002_app_settings.sql`:

```sql
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  chips_per_paise bigint not null default 1,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Seed the singleton row.
insert into public.app_settings (id, chips_per_paise) values (1, 1)
  on conflict (id) do nothing;

alter table public.app_settings enable row level security;

create policy "app_settings_read_all" on public.app_settings
  for select using (auth.role() = 'authenticated');

create policy "app_settings_update_any" on public.app_settings
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
```

---

## Step 4 — Migration 0003: sessions + participants + invite RPC

Create `supabase/migrations/0003_sessions.sql`:

```sql
create type public.session_status as enum ('open', 'closed');

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  name text,
  location text,
  played_on date not null default current_date,
  blinds_small bigint not null,
  blinds_big bigint not null,
  chips_per_paise bigint not null,
  invite_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  status public.session_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index sessions_status_idx on public.sessions(status);
create index sessions_created_by_idx on public.sessions(created_by);
create index sessions_played_on_idx on public.sessions(played_on desc);

create table public.session_participants (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index session_participants_user_idx on public.session_participants(user_id);

-- Helper functions used in RLS.
create or replace function public.is_session_participant(s uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.session_participants
    where session_id = s and user_id = auth.uid()
  );
$$;

create or replace function public.is_session_house(s uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sessions where id = s and created_by = auth.uid()
  );
$$;

-- Auto-add creator as participant.
create or replace function public.session_add_creator()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.session_participants(session_id, user_id) values (new.id, new.created_by)
    on conflict do nothing;
  return new;
end;
$$;

create trigger sessions_add_creator
  after insert on public.sessions
  for each row execute function public.session_add_creator();

-- RPC: join via invite token (bypasses RLS via security definer).
create or replace function public.join_session_with_token(token text)
returns public.sessions language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from public.sessions where invite_token = token and status = 'open';
  if not found then
    raise exception 'invalid_or_closed_invite';
  end if;
  insert into public.session_participants(session_id, user_id) values (s.id, auth.uid())
    on conflict do nothing;
  return s;
end;
$$;

-- RLS
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;

create policy "sessions_read_all_authenticated" on public.sessions
  for select using (auth.role() = 'authenticated');

create policy "sessions_insert_self_as_house" on public.sessions
  for insert with check (created_by = auth.uid());

create policy "sessions_update_house" on public.sessions
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "session_participants_read" on public.session_participants
  for select using (auth.role() = 'authenticated');

create policy "session_participants_house_remove" on public.session_participants
  for delete using (public.is_session_house(session_id));
```

---

## Step 5 — Migration 0004: buyins + cashouts + audit_log

Create `supabase/migrations/0004_ledger.sql`:

```sql
create type public.cashout_status as enum ('pending', 'confirmed');

create table public.buyins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  amount_paise bigint not null check (amount_paise > 0),
  chips bigint not null check (chips > 0),
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now()
);

create index buyins_session_idx on public.buyins(session_id);
create index buyins_user_idx on public.buyins(user_id);

create table public.cashouts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  chip_count bigint not null check (chip_count >= 0),
  amount_paise bigint not null,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  status public.cashout_status not null default 'pending',
  unique (session_id, user_id)
);

create index cashouts_session_idx on public.cashouts(session_id);

-- Compute amount_paise from chip_count using the session's chip_ratio snapshot.
create or replace function public.compute_cashout_amount()
returns trigger language plpgsql as $$
declare ratio bigint;
begin
  select chips_per_paise into ratio from public.sessions where id = new.session_id;
  new.amount_paise := new.chip_count * ratio;
  return new;
end;
$$;

create trigger cashouts_compute_amount
  before insert or update of chip_count on public.cashouts
  for each row execute function public.compute_cashout_amount();

-- Audit log
create type public.audit_action as enum (
  'buyin_create', 'buyin_edit', 'buyin_delete',
  'cashout_submit', 'cashout_edit', 'cashout_confirm',
  'session_open', 'session_close'
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  action public.audit_action not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_session_idx on public.audit_log(session_id, created_at desc);

-- Audit triggers.
create or replace function public.log_buyin_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name public.audit_action;
begin
  if (tg_op = 'INSERT') then
    action_name := 'buyin_create';
    insert into public.audit_log(session_id, actor_user_id, action, entity_id, before_data, after_data)
      values (new.session_id, new.recorded_by, action_name, new.id, null, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    action_name := 'buyin_edit';
    insert into public.audit_log(session_id, actor_user_id, action, entity_id, before_data, after_data)
      values (new.session_id, auth.uid(), action_name, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    action_name := 'buyin_delete';
    insert into public.audit_log(session_id, actor_user_id, action, entity_id, before_data, after_data)
      values (old.session_id, auth.uid(), action_name, old.id, to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

create trigger buyins_audit
  after insert or update or delete on public.buyins
  for each row execute function public.log_buyin_change();

create or replace function public.log_cashout_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name public.audit_action;
begin
  if (tg_op = 'INSERT') then
    action_name := 'cashout_submit';
    insert into public.audit_log(session_id, actor_user_id, action, entity_id, before_data, after_data)
      values (new.session_id, new.submitted_by, action_name, new.id, null, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    if old.status = 'pending' and new.status = 'confirmed' then
      action_name := 'cashout_confirm';
    else
      action_name := 'cashout_edit';
    end if;
    insert into public.audit_log(session_id, actor_user_id, action, entity_id, before_data, after_data)
      values (new.session_id, auth.uid(), action_name, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$;

create trigger cashouts_audit
  after insert or update on public.cashouts
  for each row execute function public.log_cashout_change();

-- Session open/close audit.
create or replace function public.log_session_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_log(session_id, actor_user_id, action, entity_id, before_data, after_data)
      values (new.id, new.created_by, 'session_open', new.id, null, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE' and old.status = 'open' and new.status = 'closed') then
    insert into public.audit_log(session_id, actor_user_id, action, entity_id, before_data, after_data)
      values (new.id, auth.uid(), 'session_close', new.id, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
  return new;
end;
$$;

create trigger sessions_audit
  after insert or update on public.sessions
  for each row execute function public.log_session_change();

-- Lockouts: forbid writes when session is closed.
create or replace function public.assert_session_open()
returns trigger language plpgsql as $$
declare s_status public.session_status;
begin
  select status into s_status from public.sessions where id = coalesce(new.session_id, old.session_id);
  if s_status = 'closed' then
    raise exception 'session_closed';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger buyins_open_only
  before insert or update or delete on public.buyins
  for each row execute function public.assert_session_open();

create trigger cashouts_open_only
  before insert or update on public.cashouts
  for each row execute function public.assert_session_open();

-- RLS
alter table public.buyins enable row level security;
alter table public.cashouts enable row level security;
alter table public.audit_log enable row level security;

create policy "buyins_read_participants" on public.buyins
  for select using (public.is_session_participant(session_id));

create policy "buyins_write_house" on public.buyins
  for all using (public.is_session_house(session_id))
            with check (public.is_session_house(session_id));

create policy "cashouts_read_participants" on public.cashouts
  for select using (public.is_session_participant(session_id));

create policy "cashouts_insert_participant_or_house" on public.cashouts
  for insert with check (
    public.is_session_house(session_id)
    or (public.is_session_participant(session_id) and user_id = auth.uid())
  );

create policy "cashouts_update_house_or_self_pending" on public.cashouts
  for update using (
    public.is_session_house(session_id)
    or (user_id = auth.uid() and status = 'pending')
  )
  with check (
    public.is_session_house(session_id)
    or (user_id = auth.uid() and status = 'pending')
  );

create policy "audit_log_read_participants" on public.audit_log
  for select using (public.is_session_participant(session_id));
-- No insert policy on audit_log: only the trigger inserts (via security definer).
```

---

## Step 6 — Migration 0005: notes + photos + badges

Create `supabase/migrations/0005_media_badges.sql`:

```sql
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_session_idx on public.notes(session_id, created_at desc);

create or replace function public.notes_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger notes_updated_at before update on public.notes
  for each row execute function public.notes_set_updated_at();

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index photos_session_idx on public.photos(session_id);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  badge_key text not null,
  session_id uuid references public.sessions(id),
  earned_at timestamptz not null default now(),
  unique (user_id, badge_key, session_id)
);

create index badges_user_idx on public.badges(user_id);

-- Notes lock when session closes.
create trigger notes_open_only
  before insert or update or delete on public.notes
  for each row execute function public.assert_session_open();

-- RLS
alter table public.notes enable row level security;
alter table public.photos enable row level security;
alter table public.badges enable row level security;

create policy "notes_read_participants" on public.notes
  for select using (public.is_session_participant(session_id));
create policy "notes_insert_participant" on public.notes
  for insert with check (public.is_session_participant(session_id) and author_user_id = auth.uid());
create policy "notes_update_author" on public.notes
  for update using (author_user_id = auth.uid()) with check (author_user_id = auth.uid());
create policy "notes_delete_author" on public.notes
  for delete using (author_user_id = auth.uid());

create policy "photos_read_participants" on public.photos
  for select using (public.is_session_participant(session_id));
create policy "photos_insert_participant" on public.photos
  for insert with check (public.is_session_participant(session_id) and uploaded_by = auth.uid());
create policy "photos_delete_uploader" on public.photos
  for delete using (uploaded_by = auth.uid());

create policy "badges_read_all" on public.badges
  for select using (auth.role() = 'authenticated');
-- No insert/update/delete policy on badges — only server-side functions write here.
```

---

## Step 7 — Storage bucket setup

Create `supabase/migrations/0006_storage.sql`:

```sql
insert into storage.buckets (id, name, public)
values ('session-media', 'session-media', false)
on conflict (id) do nothing;

create policy "session_media_read"
  on storage.objects for select
  using (
    bucket_id = 'session-media'
    and (
      auth.role() = 'authenticated'                  -- participants resolve via signed URLs server-side
    )
  );

create policy "session_media_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'session-media' and auth.role() = 'authenticated'
  );

create policy "session_media_delete"
  on storage.objects for delete
  using (bucket_id = 'session-media' and owner = auth.uid());
```

Note: tighter participant-only checking is done server-side via signed URLs in the `media` module.

---

## Step 8 — Seed data

Replace `supabase/seed.sql`:

```sql
-- Seed users via auth.admin (only works in local Supabase).
-- 5 fake users.
do $$
declare
  aman_id uuid;
  ravi_id uuid;
  priya_id uuid;
  karan_id uuid;
  neha_id uuid;
  s1_id uuid;
  s2_id uuid;
begin
  -- Create auth users via the supabase admin function (local only).
  select id into aman_id from auth.users where email = 'aman@example.com';
  if aman_id is null then
    aman_id := (select id from auth.users where email = 'aman@example.com');
  end if;
  -- Note: auth.users seeding requires the service-role API. For local dev,
  -- use the dashboard or a separate script. The lines below assume the users
  -- already exist in auth.users via a one-time script (see scripts/seed-users.mjs).
  --
  -- This SQL seed only fills public schema once auth users exist.

  -- Look up by email; skip seeding if any are missing.
  select id into aman_id from auth.users where email = 'aman@example.com';
  select id into ravi_id from auth.users where email = 'ravi@example.com';
  select id into priya_id from auth.users where email = 'priya@example.com';
  select id into karan_id from auth.users where email = 'karan@example.com';
  select id into neha_id from auth.users where email = 'neha@example.com';

  if aman_id is null then return; end if;

  -- Profiles
  insert into public.profiles(user_id, nickname) values
    (aman_id, 'Aman'),
    (ravi_id, 'Ravi'),
    (priya_id, 'Priya'),
    (karan_id, 'Karan'),
    (neha_id, 'Neha')
  on conflict (user_id) do update set nickname = excluded.nickname;

  -- Closed session
  insert into public.sessions(id, created_by, name, location, played_on, blinds_small, blinds_big, chips_per_paise, status, closed_at)
  values (gen_random_uuid(), aman_id, 'Friday Night #41', 'Aman''s place', current_date - 7, 100, 200, 1, 'closed', now() - interval '6 days')
  returning id into s1_id;

  insert into public.session_participants(session_id, user_id) values
    (s1_id, ravi_id), (s1_id, priya_id), (s1_id, karan_id);

  insert into public.buyins(session_id, user_id, amount_paise, chips, recorded_by) values
    (s1_id, aman_id, 50000, 50000, aman_id),
    (s1_id, ravi_id, 50000, 50000, aman_id),
    (s1_id, priya_id, 50000, 50000, aman_id),
    (s1_id, karan_id, 50000, 50000, aman_id),
    (s1_id, ravi_id, 50000, 50000, aman_id);   -- rebuy

  insert into public.cashouts(session_id, user_id, chip_count, submitted_by, confirmed_by, confirmed_at, status) values
    (s1_id, aman_id, 60000, aman_id, aman_id, now() - interval '6 days', 'confirmed'),
    (s1_id, ravi_id, 30000, ravi_id, aman_id, now() - interval '6 days', 'confirmed'),
    (s1_id, priya_id, 80000, priya_id, aman_id, now() - interval '6 days', 'confirmed'),
    (s1_id, karan_id, 30000, karan_id, aman_id, now() - interval '6 days', 'confirmed');

  -- Open session
  insert into public.sessions(id, created_by, name, location, played_on, blinds_small, blinds_big, chips_per_paise, status)
  values (gen_random_uuid(), neha_id, 'Saturday Game', 'Neha''s place', current_date, 100, 200, 1, 'open')
  returning id into s2_id;

  insert into public.session_participants(session_id, user_id) values
    (s2_id, aman_id), (s2_id, ravi_id);

  insert into public.buyins(session_id, user_id, amount_paise, chips, recorded_by) values
    (s2_id, aman_id, 50000, 50000, neha_id),
    (s2_id, ravi_id, 50000, 50000, neha_id);
end $$;
```

Create `scripts/seed-users.mjs` (one-time auth-users bootstrap):

```js
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const users = [
  { email: "aman@example.com" },
  { email: "ravi@example.com" },
  { email: "priya@example.com" },
  { email: "karan@example.com" },
  { email: "neha@example.com" },
];

for (const u of users) {
  const { error } = await admin.auth.admin.createUser({ email: u.email, email_confirm: true });
  if (error && !error.message.includes("already")) { console.error(u.email, error.message); process.exit(1); }
  console.log("seeded", u.email);
}
```

Add to `package.json` scripts:
```jsonc
"db:seed-users": "node scripts/seed-users.mjs",
"db:bootstrap": "supabase db reset && node scripts/seed-users.mjs && supabase db reset"
```

(Two `supabase db reset` calls so seeded auth.users persist across the schema reset; second reset re-applies SQL seed which now finds the auth users.)

---

## Step 9 — Apply migrations and seed

```bash
pnpm dlx supabase@latest db reset
node scripts/seed-users.mjs
pnpm dlx supabase@latest db reset       # second pass with users present so seed.sql finds them
```

**Verify in Supabase Studio (`http://localhost:54323`):**
- `profiles` has 5 rows.
- `sessions` has 2 rows (1 closed, 1 open).
- `buyins` has 7 rows.
- `cashouts` has 4 rows (all confirmed).
- `audit_log` populated automatically (1 session_open + 5 buyin_create + 4 cashout_submit + 4 cashout_confirm + 1 session_close = 15 entries for the closed session).

---

## Step 10 — Generate TypeScript types

```bash
pnpm db:gen-types
```

This writes `lib/db/types.ts`. Inspect it: it should export `Database` with all tables, enums, and functions typed.

**Verify:**
```bash
pnpm typecheck
# zero errors
```

---

## Step 11 — Create the Supabase client wrappers

Create `lib/db/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(items) {
          try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* called from a Server Component, can ignore */ }
        },
      },
    },
  );
}

export function getServiceSupabase() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
```

Create `lib/db/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function getBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Create `lib/db/middleware.ts` (used by `middleware.ts` from auth runbook):

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) {
          items.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/(app)")) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
```

---

## Step 12 — Create `DbBoundary` interface

Create `lib/db/boundary.ts`:

```ts
import type { Database } from "./types";

type Tables = Database["public"]["Tables"];

// Public types every module's index.ts may re-export. These match DB row shapes
// at the boundary; modules' own DTOs may differ.
export type SessionRow = Tables["sessions"]["Row"];
export type SessionInsert = Tables["sessions"]["Insert"];
export type SessionUpdate = Tables["sessions"]["Update"];
export type ParticipantRow = Tables["session_participants"]["Row"];
export type BuyinRow = Tables["buyins"]["Row"];
export type BuyinInsert = Tables["buyins"]["Insert"];
export type CashoutRow = Tables["cashouts"]["Row"];
export type CashoutInsert = Tables["cashouts"]["Insert"];
export type AuditRow = Tables["audit_log"]["Row"];
export type NoteRow = Tables["notes"]["Row"];
export type PhotoRow = Tables["photos"]["Row"];
export type BadgeRow = Tables["badges"]["Row"];
export type ProfileRow = Tables["profiles"]["Row"];
export type AppSettingsRow = Tables["app_settings"]["Row"];

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
    list: (filter?: { status?: "open" | "closed" }) => Promise<SessionRow[]>;
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
    create: (input: { session_id: string; author_user_id: string; body: string }) => Promise<NoteRow>;
    update: (id: string, body: string) => Promise<NoteRow>;
    delete: (id: string) => Promise<void>;
    listForSession: (sessionId: string) => Promise<NoteRow[]>;
  };
  photos: {
    create: (input: { session_id: string; uploaded_by: string; storage_path: string; caption?: string }) => Promise<PhotoRow>;
    delete: (id: string) => Promise<void>;
    listForSession: (sessionId: string) => Promise<PhotoRow[]>;
  };
  badges: {
    create: (input: { user_id: string; badge_key: string; session_id?: string }) => Promise<BadgeRow>;
    listForUser: (userId: string) => Promise<BadgeRow[]>;
    existsForUserSession: (userId: string, badgeKey: string, sessionId?: string) => Promise<boolean>;
  };
  storage: {
    upload: (path: string, file: Blob | File, contentType: string) => Promise<{ path: string }>;
    getSignedUrl: (path: string, expiresIn: number) => Promise<string>;
    remove: (path: string) => Promise<void>;
  };
}
```

Create `lib/db/realBoundary.ts` — the production `DbBoundary` that wraps the Supabase client. Architecture agent finalizes this; for now it's a stub:

```ts
import type { DbBoundary } from "./boundary";
import { getServerSupabase } from "./server";

// Architecture agent fills this in. Foundation only ensures the file exists
// so the boundary import path is reserved.
export async function createRealBoundary(): Promise<DbBoundary> {
  throw new Error("realBoundary not yet implemented — architecture agent owns this");
}
```

---

## Step 13 — Update foundation script: ensure DB scripts work

Add to `package.json`:
```jsonc
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:status": "supabase status"
```

---

## Step 14 — Final acceptance run

```bash
pnpm dlx supabase@latest db reset
node scripts/seed-users.mjs
pnpm dlx supabase@latest db reset
pnpm db:gen-types
pnpm typecheck
```

All must exit 0.

**Manual RLS smoke test:**

In Supabase Studio SQL editor, switch to `authenticated` role with one of the seeded user IDs:
```sql
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"<aman_id>","role":"authenticated"}';
select * from buyins;       -- only sessions Aman participates in
insert into buyins(session_id, user_id, amount_paise, chips, recorded_by)
  values ('<other-session-id>', '<aman_id>', 1000, 1000, '<aman_id>');
-- Should error with RLS violation since Aman is not the house of <other-session-id>.
```

---

## Acceptance checklist

- [ ] All 6 migration files apply cleanly via `supabase db reset`.
- [ ] All RLS policies active (verify in Studio: each table shows "RLS enabled, N policies").
- [ ] `audit_log` populates automatically on buy-in / cash-out / session changes.
- [ ] `cashouts.amount_paise` is computed by trigger from `chip_count × chips_per_paise`.
- [ ] Writes against a closed session fail with `session_closed` exception.
- [ ] `lib/db/types.ts` is up to date and `pnpm typecheck` passes.
- [ ] `lib/db/server.ts`, `lib/db/client.ts`, `lib/db/middleware.ts`, `lib/db/boundary.ts`, `lib/db/realBoundary.ts` all exist.
- [ ] Seed loads 5 users + 1 closed session + 1 open session.
- [ ] Manual RLS smoke confirms participant-only reads + house-only writes.

When all boxes green, commit as `chore: database schema + RLS + seed`. Phase 0 advances to architecture.
