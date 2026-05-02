// One-off: delete a session and everything tied to it. Use with care —
// only run for test/garbage sessions. Most child tables cascade on
// `on delete cascade`; badges do NOT cascade, so we clear those first.
//
// Usage: node --env-file=.env.local scripts/delete-session.mjs <session-id>

import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL;
const sessionId = process.argv[2];
if (!url || !sessionId) {
  console.error('Usage: node --env-file=.env.local scripts/delete-session.mjs <session-id>');
  process.exit(1);
}

const c = new Client({ connectionString: url });
await c.connect();
try {
  await c.query('begin');

  const before = (
    await c.query('select id, name, status, created_by from public.sessions where id = $1', [
      sessionId,
    ])
  ).rows[0];
  if (!before) {
    console.error('not found');
    process.exit(2);
  }
  console.log('Before:', before);

  // Audit triggers on the cascade-deleted buyins/cashouts call auth.uid() and
  // require it not to be null. Set the JWT claim to the session creator so
  // the trigger inserts can satisfy the NOT NULL constraint.
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: before.created_by, role: 'authenticated' }),
  ]);

  // The buyin DELETE trigger inserts a `buyin_delete` row into audit_log,
  // which under a session-level cascade fails because the session is already
  // gone (FK violation on audit_log.session_id). So delete children
  // explicitly in dependency order while the parent still exists, then
  // mop up the trigger's late writes before dropping the session.
  const ops = [
    ['audit_log', `delete from public.audit_log           where session_id = $1`],
    ['badges', `delete from public.badges              where session_id = $1`],
    ['notes', `delete from public.notes               where session_id = $1`],
    ['photos', `delete from public.photos              where session_id = $1`],
    ['buyins', `delete from public.buyins              where session_id = $1`], // re-fires audit trigger
    ['cashouts', `delete from public.cashouts            where session_id = $1`],
    ['audit_log (post-trigger)', `delete from public.audit_log      where session_id = $1`], // mop up trigger writes
    ['session_participants', `delete from public.session_participants where session_id = $1`],
    ['sessions', `delete from public.sessions            where id         = $1`],
  ];
  for (const [label, sql] of ops) {
    const r = await c.query(sql, [sessionId]);
    console.log(`  ${label.padEnd(28)} ${r.rowCount}`);
  }

  await c.query('commit');

  const after = (await c.query('select id from public.sessions where id = $1', [sessionId]))
    .rows[0];
  console.log('After:', after ?? '(not present)');
} catch (err) {
  await c.query('rollback').catch(() => {});
  throw err;
} finally {
  await c.end();
}
