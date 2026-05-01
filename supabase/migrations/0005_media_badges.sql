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
