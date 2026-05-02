// Cross-platform import audit. Walks the relevant trees and grep-equivalent
// checks the contents using pure Node so the script runs on Windows + POSIX.
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      walk(full, files);
    } else {
      const dotIdx = entry.lastIndexOf('.');
      if (dotIdx >= 0 && SOURCE_EXT.has(entry.slice(dotIdx))) files.push(full);
    }
  }
  return files;
}

function grep(roots, regex) {
  const hits = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      const text = readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (!regex.test(lines[i])) continue;
        // Honor the same per-line eslint disable that ESLint uses, so an explicit
        // architectural exception (e.g. a registry-shape test) doesn't double-fail.
        const prev = i > 0 ? lines[i - 1] : '';
        if (/eslint-disable-next-line[^\n]*no-restricted-imports/.test(prev)) continue;
        hits.push(`${file}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  }
  return hits;
}

const checks = [
  {
    name: 'No internal imports outside the owning module',
    run: () =>
      grep(['app', 'lib/modules', 'tests'], /from\s+['"]@?\.?\/?lib\/modules\/[^/'"]+\/internal/),
  },
  {
    name: 'No direct supabase-js imports inside modules',
    run: () => grep(['lib/modules'], /from\s+['"]@supabase\/supabase-js['"]/),
  },
];

let failed = false;
for (const c of checks) {
  const hits = c.run();
  if (hits.length) {
    console.error(`FAIL ${c.name}`);
    for (const h of hits) console.error('  ' + h);
    failed = true;
  } else {
    console.log(`PASS ${c.name}`);
  }
}
process.exit(failed ? 1 : 0);
