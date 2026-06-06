# Foundation Execution Runbook

Implements `plans/foundation.md`. Single agent. No prior dependencies. **All other agents wait on this.**

Working directory at start: `c:\Users\linga\Documents\poker_tracker\`. After Step 1, all subsequent steps run inside `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Step 1 — Scaffold the Next.js app

```bash
cd c:\Users\linga\Documents\poker_tracker
pnpm dlx create-next-app@latest poker-tracker --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-pnpm --no-turbo
cd poker-tracker
```

**Verify:**
```bash
pnpm dev
# Open http://localhost:3000 → see default Next.js page → Ctrl+C to stop.
```

---

## Step 2 — Pin Node and add `.nvmrc`

Create `.nvmrc`:
```
20
```

Edit `package.json` to add `engines`:
```jsonc
{
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

## Step 3 — Install runtime dependencies

```bash
pnpm add zustand react-hook-form zod @hookform/resolvers \
  recharts lucide-react class-variance-authority tailwind-merge clsx \
  @supabase/supabase-js @supabase/ssr \
  papaparse @react-pdf/renderer
```

```bash
pnpm add -D vitest @vitest/coverage-v8 @vitejs/plugin-react \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  jsdom \
  prettier prettier-plugin-tailwindcss \
  eslint-plugin-import \
  husky lint-staged \
  @playwright/test \
  madge \
  next-pwa pwa-asset-generator \
  @types/papaparse
```

**Verify:**
```bash
pnpm install
# Lockfile updated, no errors.
```

---

## Step 4 — Initialize shadcn/ui

```bash
pnpm dlx shadcn@latest init
```

When prompted:
- Style: **New York**
- Base color: **Neutral**
- CSS variables: **Yes**

This creates `components.json`, `app/globals.css` (already exists, will be updated), `lib/utils.ts`. Don't add components yet — UI agent does that in Phase 1.

---

## Step 5 — Replace `tsconfig.json`

Overwrite `tsconfig.json` exactly:
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Verify:**
```bash
pnpm exec tsc --noEmit
# zero errors
```

---

## Step 6 — ESLint config (with boundary rule)

Create `eslint.config.mjs` (replaces any `.eslintrc.json` from create-next-app):
```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import importPlugin from "eslint-plugin-import";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { import: importPlugin },
    rules: {
      "import/no-restricted-paths": ["error", {
        zones: [
          // Pages may not import module internals.
          { target: "./app", from: "./lib/modules/*/internal" },
          // Modules may not import other modules' internals.
          { target: "./lib/modules/*/internal", from: "./lib/modules/*/internal" },
          { target: "./lib/modules/*", from: "./lib/modules/*/internal", except: ["./internal"] },
          // Tests may not import module internals.
          { target: "./tests", from: "./lib/modules/*/internal" },
          // Modules may not import directly from supabase-js (use DbBoundary).
          { target: "./lib/modules", from: "./node_modules/@supabase/supabase-js" },
        ],
      }],
      "no-restricted-imports": ["error", {
        paths: [
          { name: "@supabase/supabase-js", message: "Import via lib/db/* only — modules use DbBoundary." }
        ],
        patterns: [
          { group: ["@/lib/modules/*/internal/*"], message: "Internal-folder imports are forbidden — use the module's index.ts." }
        ],
      }],
    },
  },
];
```

**Verify with a smoke test:**
1. Create `tmp-smoke.ts` in `app/` containing: `import "@/lib/modules/foo/internal/x";`
2. Run `pnpm lint` — should error.
3. Delete `tmp-smoke.ts`. Re-run `pnpm lint` — clean.

---

## Step 7 — Prettier

Create `prettier.config.mjs`:
```js
export default {
  semi: true,
  singleQuote: true,
  trailingComma: "all",
  printWidth: 100,
  plugins: ["prettier-plugin-tailwindcss"],
};
```

Create `.prettierignore`:
```
.next
node_modules
public
pnpm-lock.yaml
*.md
supabase/.branches
supabase/.temp
```

**Verify:**
```bash
pnpm exec prettier --check .
# May report formatting needed; run --write once and commit.
pnpm exec prettier --write .
```

---

## Step 8 — Vitest config

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/modules/**/index.ts", "lib/modules/**/internal/**"],
      exclude: ["**/*.test.ts", "**/types.ts"],
      thresholds: { lines: 80, branches: 75, functions: 80 },
    },
  },
});
```

Create `tests/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// Make any unhandled console.error fail the test.
const originalError = console.error;
console.error = (...args: unknown[]) => {
  originalError(...args);
  throw new Error("console.error was called: " + JSON.stringify(args));
};

vi.stubGlobal("crypto", crypto);  // ensure available
```

**Verify:**
```bash
pnpm test
# "No test files found" — expected, exit 0.
```

---

## Step 9 — Playwright config

Create `playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.CI
    ? {
        command: "pnpm build && pnpm start",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    { name: "chromium-mobile", use: { ...devices["iPhone 13"] } },
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
```

```bash
pnpm dlx playwright install --with-deps chromium
```

---

## Step 10 — Husky + lint-staged

```bash
pnpm exec husky init
```

Replace `.husky/pre-commit` with:
```bash
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"
pnpm exec lint-staged
pnpm typecheck
```

Add to `package.json`:
```jsonc
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

---

## Step 11 — `package.json` scripts

Update `scripts` section in `package.json` to exactly:
```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "db:gen-types": "supabase gen types typescript --local > lib/db/types.ts",
    "db:reset": "supabase db reset",
    "db:push": "supabase db push",
    "cycles": "madge --circular lib/modules",
    "audit:imports": "node scripts/audit-imports.mjs",
    "prepare": "husky"
  }
}
```

Create `scripts/audit-imports.mjs`:
```js
import { execSync } from "child_process";

const checks = [
  {
    name: "No internal imports outside the owning module",
    cmd: "grep -RE \"from ['\\\"]@?\\.?/?lib/modules/[^/]+/internal\" app/ lib/modules/ tests/ || true",
    requireEmpty: true,
  },
  {
    name: "No direct supabase-js imports inside modules",
    cmd: "grep -R \"from '@supabase/supabase-js'\" lib/modules/ || true",
    requireEmpty: true,
  },
];

let failed = false;
for (const c of checks) {
  const out = execSync(c.cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  if (c.requireEmpty && out) {
    console.error(`❌ ${c.name}\n${out}`);
    failed = true;
  } else {
    console.log(`✅ ${c.name}`);
  }
}
process.exit(failed ? 1 : 0);
```

---

## Step 12 — Folder layout

Create the agreed folder structure (empty placeholder files where needed so git tracks the dirs):

```bash
mkdir -p app/(marketing) app/(app)/sessions app/(app)/leaderboard app/(app)/profile app/(app)/settings app/api
mkdir -p components/ui components/shared
mkdir -p lib/modules lib/db lib/theme lib/utils
mkdir -p supabase/migrations
mkdir -p tests/modules tests/helpers tests/integration
mkdir -p e2e/specs e2e/fixtures e2e/pages e2e/utils
mkdir -p public/icons public/splash
mkdir -p styles
mkdir -p .github/workflows
mkdir -p scripts
```

Create empty placeholders so empty dirs are committed:
```bash
touch lib/modules/.gitkeep lib/db/.gitkeep lib/theme/.gitkeep
touch tests/modules/.gitkeep tests/helpers/.gitkeep tests/integration/.gitkeep
touch e2e/specs/.gitkeep e2e/fixtures/.gitkeep e2e/pages/.gitkeep e2e/utils/.gitkeep
touch public/icons/.gitkeep public/splash/.gitkeep
```

---

## Step 13 — `.env.example`

Create `.env.example`:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# E2E (optional, used by Playwright)
E2E_BASE_URL=
E2E_SUPABASE_URL=
E2E_SUPABASE_ANON_KEY=
```

Update `.gitignore` to ensure `.env.local` and `.env*.local` are ignored (default Next.js gitignore covers this).

---

## Step 14 — README.md

Create `README.md`:
```markdown
# Poker Tracker

Web app for tracking home/private poker games. See [requirments.md](requirments.md) for product spec, [plan.md](plan.md) for implementation plan, [execution.md](execution.md) for build runbook.

## Local development

```bash
pnpm install
supabase start
pnpm db:reset
pnpm dev
```

Visit http://localhost:3000.

## Common scripts

See `package.json` `scripts` for the full list. Key ones:
- `pnpm dev` — start the app
- `pnpm test` — unit + integration
- `pnpm test:e2e` — Playwright
- `pnpm typecheck` / `pnpm lint` — gates

## Architecture

See [plans/architecture.md](plans/architecture.md) for the module map and dependency rules.
```

---

## Step 15 — Final acceptance run

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm cycles
node scripts/audit-imports.mjs
```

All must exit 0.

```bash
pnpm dev
# Visit http://localhost:3000 — Next.js default page renders.
# Ctrl+C
```

---

## Acceptance checklist (run before declaring done)

- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm dev` starts and renders the default page.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm lint` exits 0 (zero warnings).
- [ ] `pnpm format:check` exits 0.
- [ ] `pnpm test` exits 0 with "No test files".
- [ ] `pnpm test:e2e` exits 0 with no specs.
- [ ] `pnpm cycles` reports no circular deps (empty `lib/modules` is fine).
- [ ] `node scripts/audit-imports.mjs` exits 0.
- [ ] ESLint smoke test from Step 6 confirms boundary rule fires.
- [ ] All folders from Step 12 exist.
- [ ] `.env.example` exists with all keys above.
- [ ] `README.md` exists and explains local dev.

When all boxes green, **commit** as `chore: foundation scaffold` and signal Phase 0 Step 0.2 (database) can begin.
