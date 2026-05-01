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
