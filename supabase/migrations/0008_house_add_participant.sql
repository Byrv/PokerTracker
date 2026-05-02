-- House-side direct add of an existing user to a session, without going
-- through the invite-URL flow. Restricted to the session's house and
-- only on open sessions.
--
-- Why a SECURITY DEFINER RPC: session_participants has no INSERT RLS
-- policy. Inserts only come from the session_add_creator trigger and
-- the join_session_with_token RPC. This adds a third controlled path.

create or replace function public.house_add_participant(s uuid, u uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s_status public.session_status;
begin
  if not public.is_session_house(s) then
    raise exception 'not_house';
  end if;
  select status into s_status from public.sessions where id = s;
  if s_status is null then
    raise exception 'not_found';
  end if;
  if s_status = 'closed' then
    raise exception 'session_closed';
  end if;
  insert into public.session_participants(session_id, user_id) values (s, u)
    on conflict do nothing;
end;
$$;

grant execute on function public.house_add_participant(uuid, uuid) to authenticated;
