// eslint-disable-next-line no-restricted-imports -- bootstrap script needs auth admin API, which DbBoundary deliberately does not expose
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const users = [
  { email: 'aman@example.com' },
  { email: 'ravi@example.com' },
  { email: 'priya@example.com' },
  { email: 'karan@example.com' },
  { email: 'neha@example.com' },
];

for (const u of users) {
  const { error } = await admin.auth.admin.createUser({ email: u.email, email_confirm: true });
  if (error && !error.message.includes('already')) {
    console.error(u.email, error.message);
    process.exit(1);
  }
  console.log('seeded', u.email);
}
