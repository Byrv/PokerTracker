// Wrapper around `supabase` CLI that uses SUPABASE_DB_URL from .env.local
// when set (remote project) and falls back to --local (local Docker stack)
// otherwise. Lets db:gen-types / db:push / db:reset work in either mode
// without changing package.json scripts.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

loadDotEnvLocal();

const [, , subcommand, ...rest] = process.argv;
const remote = process.env.SUPABASE_DB_URL;

const baseArgs = remote ? ['--db-url', remote] : ['--local'];

const subcommandMap = {
  'gen-types': ['gen', 'types', 'typescript', ...baseArgs],
  push: ['db', 'push', ...(remote ? ['--db-url', remote] : []), '--include-all'],
  pull: ['db', 'pull', ...(remote ? ['--db-url', remote] : [])],
  diff: ['db', 'diff', ...(remote ? ['--db-url', remote] : [])],
};

const args = subcommandMap[subcommand];
if (!args) {
  console.error(`Unknown subcommand: ${subcommand}`);
  console.error(`Available: ${Object.keys(subcommandMap).join(', ')}`);
  process.exit(1);
}

const writesStdout = subcommand === 'gen-types';
const outFile = writesStdout ? rest[0] : null;
const passthroughArgs = writesStdout ? rest.slice(1) : rest;

const child = spawn('pnpm', ['exec', 'supabase', ...args, ...passthroughArgs], {
  stdio: ['inherit', writesStdout ? 'pipe' : 'inherit', 'inherit'],
  shell: process.platform === 'win32',
});

if (writesStdout && outFile) {
  const chunks = [];
  child.stdout.on('data', (c) => chunks.push(c));
  child.on('exit', (code) => {
    if (code === 0) writeFileSync(outFile, Buffer.concat(chunks));
    process.exit(code ?? 0);
  });
} else if (writesStdout) {
  child.stdout.pipe(process.stdout);
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  child.on('exit', (code) => process.exit(code ?? 0));
}
