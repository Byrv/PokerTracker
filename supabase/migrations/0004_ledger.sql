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
