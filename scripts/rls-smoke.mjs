// RLS smoke test: verify participant-only reads + house-only writes work.
// Required by executions/database.md Step 14 acceptance gate.

import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL missing');
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();

let pass = 0;
let fail = 0;

async function check(label, fn) {
  await client.query('savepoint sp');
  try {
    await fn();
    await client.query('release savepoint sp');
    console.log(`  PASS  ${label}`);
    pass++;
  } catch (err) {
    await client.query('rollback to savepoint sp');
    console.log(`  FAIL  ${label}`);
    console.log(`        ${err.message}`);
    fail++;
  }
}

async function asUser(uid, fn) {
  // SET LOCAL is scoped to the current (sub)transaction and reverts automatically
  // when the enclosing savepoint is rolled back, so no manual cleanup needed.
  await client.query('set local role authenticated');
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ]);
  return await fn();
}

try {
  // Look up our seed users + sessions.
  const aman = (await client.query("select id from auth.users where email = 'aman@example.com'"))
    .rows[0].id;
  const neha = (await client.query("select id from auth.users where email = 'neha@example.com'"))
    .rows[0].id;
  const s1 = (await client.query("select id from public.sessions where name = 'Friday Night #41'"))
    .rows[0].id; // house = aman, closed
  const s2 = (await client.query("select id from public.sessions where name = 'Saturday Game'"))
    .rows[0].id; // house = neha, open

  console.log(
    `Setup: aman=${aman.slice(0, 8)} neha=${neha.slice(0, 8)} s1=${s1.slice(0, 8)} (closed) s2=${s2.slice(0, 8)} (open)\n`,
  );

  await client.query('begin');

  // 1. Aman is participant of s1, can read its buyins.
  await check('aman reads s1 buyins (he is house)', async () => {
    const r = await asUser(aman, () =>
      client.query('select count(*) from public.buyins where session_id = $1', [s1]),
    );
    if (Number(r.rows[0].count) === 0) throw new Error('expected non-zero buyins');
  });

  // 2. Aman is participant of s2 (Neha invited him), can read s2 buyins.
  await check('aman reads s2 buyins (he is participant)', async () => {
    const r = await asUser(aman, () =>
      client.query('select count(*) from public.buyins where session_id = $1', [s2]),
    );
    if (Number(r.rows[0].count) === 0)
      throw new Error('expected non-zero buyins (aman is participant)');
  });

  // 3. Aman cannot insert a buyin into s2 (he is participant, not house — only house writes buyins).
  // Use a nested savepoint so the RLS exception doesn't poison the outer one.
  await check('aman cannot insert buyin into s2 (he is not house)', async () => {
    let rejected = false;
    await client.query('savepoint sp_inner');
    try {
      await asUser(aman, () =>
        client.query(
          `insert into public.buyins(session_id, user_id, amount_paise, chips, recorded_by) values ($1, $2, 1000, 1000, $2)`,
          [s2, aman],
        ),
      );
    } catch {
      rejected = true;
    } finally {
      await client.query('rollback to savepoint sp_inner');
    }
    if (!rejected) throw new Error('expected RLS rejection (aman is not house of s2)');
  });

  // 4. Aman is house of s1 but s1 is closed; the assert_session_open trigger should reject.
  await check('aman cannot insert buyin into closed s1 (session_closed trigger)', async () => {
    let rejected = false;
    let errMsg = '';
    await client.query('savepoint sp_inner');
    try {
      await asUser(aman, () =>
        client.query(
          `insert into public.buyins(session_id, user_id, amount_paise, chips, recorded_by) values ($1, $2, 1000, 1000, $2)`,
          [s1, aman],
        ),
      );
    } catch (err) {
      rejected = true;
      errMsg = err.message;
    } finally {
      await client.query('rollback to savepoint sp_inner');
    }
    if (!rejected) throw new Error('expected session_closed rejection');
    if (!errMsg.includes('session_closed')) throw new Error(`wrong error: ${errMsg}`);
  });

  // 5. Neha can insert a buyin into s2 (she is house, s2 is open).
  await check('neha can insert buyin into open s2 (she is house)', async () => {
    await asUser(neha, () =>
      client.query(
        `insert into public.buyins(session_id, user_id, amount_paise, chips, recorded_by) values ($1, $2, 1000, 1000, $2)`,
        [s2, neha],
      ),
    );
  });

  // 6. audit_log was populated by triggers (system-only writes via SECURITY DEFINER).
  await check('audit_log readable by participant of s1', async () => {
    const r = await asUser(aman, () =>
      client.query('select count(*) from public.audit_log where session_id = $1', [s1]),
    );
    if (Number(r.rows[0].count) === 0) throw new Error('expected audit entries');
  });

  // Roll back to leave DB in clean seed state.
  await client.query('rollback');

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
} finally {
  await client.end();
}
