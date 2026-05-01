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

  -- "Closed" session — must be inserted as 'open' so buyin/cashout writes pass
  -- the assert_session_open trigger, then closed at the end.
  insert into public.sessions(id, created_by, name, location, played_on, blinds_small, blinds_big, chips_per_paise, status)
  values (gen_random_uuid(), aman_id, 'Friday Night #41', 'Aman''s place', current_date - 7, 100, 200, 1, 'open')
  returning id into s1_id;

  insert into public.session_participants(session_id, user_id) values
    (s1_id, ravi_id), (s1_id, priya_id), (s1_id, karan_id);

  insert into public.buyins(session_id, user_id, amount_paise, chips, recorded_by) values
    (s1_id, aman_id, 50000, 50000, aman_id),
    (s1_id, ravi_id, 50000, 50000, aman_id),
    (s1_id, priya_id, 50000, 50000, aman_id),
    (s1_id, karan_id, 50000, 50000, aman_id),
    (s1_id, ravi_id, 50000, 50000, aman_id);

  insert into public.cashouts(session_id, user_id, chip_count, submitted_by, confirmed_by, confirmed_at, status) values
    (s1_id, aman_id, 60000, aman_id, aman_id, now() - interval '6 days', 'confirmed'),
    (s1_id, ravi_id, 30000, ravi_id, aman_id, now() - interval '6 days', 'confirmed'),
    (s1_id, priya_id, 80000, priya_id, aman_id, now() - interval '6 days', 'confirmed'),
    (s1_id, karan_id, 30000, karan_id, aman_id, now() - interval '6 days', 'confirmed');

  -- Set the JWT claim so audit trigger's auth.uid() returns aman_id (he's the house).
  perform set_config('request.jwt.claims', json_build_object('sub', aman_id::text, 'role', 'authenticated')::text, true);
  update public.sessions set status = 'closed', closed_at = now() - interval '6 days' where id = s1_id;
  perform set_config('request.jwt.claims', '', true);

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
