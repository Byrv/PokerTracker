// Verify the seed populated the expected counts.

import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL missing');
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
try {
  const queries = [
    ['profiles', 'select count(*) from public.profiles'],
    ['sessions (open)', "select count(*) from public.sessions where status = 'open'"],
    ['sessions (closed)', "select count(*) from public.sessions where status = 'closed'"],
    ['session_participants', 'select count(*) from public.session_participants'],
    ['buyins', 'select count(*) from public.buyins'],
    ['cashouts (confirmed)', "select count(*) from public.cashouts where status = 'confirmed'"],
    ['audit_log', 'select count(*) from public.audit_log'],
    ['app_settings', 'select count(*) from public.app_settings'],
  ];
  for (const [label, sql] of queries) {
    const r = await client.query(sql);
    console.log(`${label.padEnd(28)} ${r.rows[0].count}`);
  }

  console.log('\n--- audit_log breakdown ---');
  const audit = await client.query(
    'select action, count(*) from public.audit_log group by action order by action',
  );
  for (const row of audit.rows) console.log(`${row.action.padEnd(20)} ${row.count}`);
} finally {
  await client.end();
}
