// One-off: apply supabase/seed.sql to whatever DB SUPABASE_DB_URL points at.
// Use this for remote projects (where `supabase db reset` doesn't apply).

import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL missing — run with `node --env-file=.env.local`');
  process.exit(1);
}

const sql = readFileSync('supabase/seed.sql', 'utf8');
const client = new Client({ connectionString: url });

await client.connect();
try {
  await client.query(sql);
  console.log('seed applied');
} finally {
  await client.end();
}
