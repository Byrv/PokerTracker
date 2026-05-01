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
