import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL;
const sessionId = process.argv[2];
if (!url || !sessionId) {
  console.error('Usage: node --env-file=.env.local scripts/inspect-session.mjs <session-id>');
  process.exit(1);
}

const c = new Client({ connectionString: url });
await c.connect();
try {
  const s = (await c.query('select * from public.sessions where id = $1', [sessionId])).rows[0];
  if (!s) {
    console.error('not found');
    process.exit(2);
  }
  console.log('SESSION');
  console.log({
    id: s.id,
    name: s.name,
    status: s.status,
    created_by: s.created_by,
    chips_per_paise: Number(s.chips_per_paise),
    played_on: s.played_on,
  });

  const ps = (
    await c.query(
      'select user_id, joined_at from public.session_participants where session_id = $1',
      [sessionId],
    )
  ).rows;
  console.log('\nPARTICIPANTS', ps.length);
  for (const p of ps) console.log(' ', p.user_id);

  const bs = (
    await c.query(
      'select user_id, amount_paise, chips, recorded_at from public.buyins where session_id = $1 order by recorded_at',
      [sessionId],
    )
  ).rows;
  console.log('\nBUYINS', bs.length);
  let totalBuyin = 0n;
  for (const b of bs) {
    console.log(`  user=${b.user_id.slice(0, 8)} amount=${b.amount_paise} chips=${b.chips}`);
    totalBuyin += BigInt(b.amount_paise);
  }

  const cs = (
    await c.query(
      'select user_id, chip_count, amount_paise, status, submitted_at, confirmed_at from public.cashouts where session_id = $1 order by submitted_at',
      [sessionId],
    )
  ).rows;
  console.log('\nCASHOUTS', cs.length);
  let totalCashConfirmed = 0n;
  for (const co of cs) {
    console.log(
      `  user=${co.user_id.slice(0, 8)} chip_count=${co.chip_count} amount=${co.amount_paise} status=${co.status}`,
    );
    if (co.status === 'confirmed') totalCashConfirmed += BigInt(co.amount_paise);
  }

  console.log('\nRECONCILIATION');
  console.log(`  expected (sum buyins)         = ${totalBuyin}`);
  console.log(`  actual   (sum confirmed cash) = ${totalCashConfirmed}`);
  console.log(`  discrepancy                   = ${totalBuyin - totalCashConfirmed}`);

  const pendingCount = cs.filter((x) => x.status === 'pending').length;
  const everyParticipantConfirmed = ps.every((p) =>
    cs.some((co) => co.user_id === p.user_id && co.status === 'confirmed'),
  );
  console.log(`  pending cashouts              = ${pendingCount}`);
  console.log(`  every participant confirmed   = ${everyParticipantConfirmed}`);
} finally {
  await c.end();
}
