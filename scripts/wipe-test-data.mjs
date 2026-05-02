// Wipe all sessions + seeded test users so the prod UI starts clean.
// Keeps the real auth user (whoever isn't in SEED_EMAILS) and app_settings.

import { Client } from 'pg';
// eslint-disable-next-line no-restricted-imports -- admin script needs auth.admin.* APIs which DbBoundary deliberately doesn't expose
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_DB_URL;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !apiUrl || !serviceKey) {
  console.error('SUPABASE_DB_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const SEED_EMAILS = new Set([
  'aman@example.com',
  'ravi@example.com',
  'priya@example.com',
  'karan@example.com',
  'neha@example.com',
]);

const c = new Client({ connectionString: url });
const admin = createClient(apiUrl, serviceKey, { auth: { persistSession: false } });

await c.connect();
try {
  await c.query('begin');

  // Discover every session and delete it via the same ordered-cleanup pattern
  // delete-session.mjs uses (audit_log → buyins → cashouts → re-clean audit_log
  // → participants → session). The buyin DELETE trigger was dropped in
  // migration 0007 so the cascade order is simpler now, but we keep it
  // explicit to be safe in case the schema changes again.
  const sessions = (await c.query('select id, name, created_by from public.sessions')).rows;
  console.log(`Found ${sessions.length} sessions to wipe.`);

  for (const s of sessions) {
    await c.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: s.created_by, role: 'authenticated' })],
    );
    // The assert_session_open trigger on buyins / notes blocks DELETE when
    // status='closed'. Reopen the session first so the wipe passes.
    // closed->open isn't audit-logged (only open->close is) so no extra rows.
    await c.query(`update public.sessions set status = 'open' where id = $1`, [s.id]);
    const ops = [
      `delete from public.audit_log           where session_id = $1`,
      `delete from public.badges              where session_id = $1`,
      `delete from public.notes               where session_id = $1`,
      `delete from public.photos              where session_id = $1`,
      `delete from public.buyins              where session_id = $1`,
      `delete from public.cashouts            where session_id = $1`,
      `delete from public.audit_log           where session_id = $1`,
      `delete from public.session_participants where session_id = $1`,
      `delete from public.sessions            where id         = $1`,
    ];
    for (const sql of ops) await c.query(sql, [s.id]);
    console.log(`  wiped ${s.id.slice(0, 8)} ${s.name ?? '(unnamed)'}`);
  }

  await c.query('commit');
} catch (err) {
  await c.query('rollback').catch(() => {});
  throw err;
} finally {
  await c.end();
}

// Now delete the seed auth users via admin API. Cascade clears profiles +
// any badges that referenced them.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listErr) {
  console.error('listUsers error:', listErr.message);
  process.exit(1);
}

console.log(`\nFound ${list.users.length} auth users; deleting seed accounts only.`);
for (const u of list.users) {
  if (!u.email || !SEED_EMAILS.has(u.email)) {
    console.log(`  keep   ${u.email ?? '(no email)'} ${u.id.slice(0, 8)}`);
    continue;
  }
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) {
    console.error(`  FAIL   ${u.email}: ${error.message}`);
  } else {
    console.log(`  delete ${u.email}`);
  }
}

console.log('\nDone.');
