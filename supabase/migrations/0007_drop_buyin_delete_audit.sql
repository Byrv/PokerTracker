-- Drop the DELETE branch from log_buyin_change.
--
-- Original migration 0004 wired log_buyin_change as `after insert or update or
-- delete`. The DELETE branch raises a FK violation when a session-level cascade
-- nukes audit_log first (the trigger then tries to insert a fresh
-- buyin_delete row referencing a session that no longer exists). We never
-- audit-log the cascade case, and manual single-buyin deletes are rare —
-- prefer ledger.editBuyin / a future undo flow over silent destructive
-- deletes. Symmetric with cashouts (which only audits INSERT/UPDATE).

drop trigger if exists buyins_audit on public.buyins;

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
  end if;
  return null;
end;
$$;

create trigger buyins_audit
  after insert or update on public.buyins
  for each row execute function public.log_buyin_change();
