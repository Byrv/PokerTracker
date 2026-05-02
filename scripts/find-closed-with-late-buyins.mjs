// Find any closed session whose buyins were recorded AFTER closed_at.
import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL missing');
  process.exit(1);
}
const c = new Client({ connectionString: url });
await c.connect();
try {
  const r = await c.query(`
    select s.id as session_id, s.name, s.status, s.closed_at,
           b.id as buyin_id, b.amount_paise, b.recorded_at,
           b.recorded_at > s.closed_at as recorded_after_close
    from public.sessions s
    join public.buyins b on b.session_id = s.id
    where s.status = 'closed'
    order by s.closed_at desc nulls last, b.recorded_at
  `);
  console.log(`Closed sessions with buyins: ${r.rows.length} rows`);
  for (const row of r.rows) {
    console.log(
      `  ${row.session_id.slice(0, 8)} ${row.name?.padEnd(24)} closed=${row.closed_at?.toISOString?.() ?? row.closed_at}` +
        ` buyin@${row.recorded_at.toISOString?.() ?? row.recorded_at}` +
        ` ${row.recorded_after_close ? '*** AFTER CLOSE ***' : ''}`,
    );
  }

  // Also list all closed sessions even without buyins.
  const all = await c.query(
    `select id, name, status, closed_at, opened_at from public.sessions order by opened_at desc`,
  );
  console.log(`\nAll sessions:`);
  for (const s of all.rows) {
    console.log(
      `  ${s.id.slice(0, 8)} ${(s.name ?? '(unnamed)').padEnd(24)} ${s.status.padEnd(8)} closed=${s.closed_at?.toISOString?.() ?? '-'}`,
    );
  }
} finally {
  await c.end();
}
