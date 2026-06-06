# Foundation Plan

Scaffolds the repo. Runs **first**, **sequentially**, **single agent**. No other plan can begin until this is merged.

---

## Outputs

A clean Next.js + TypeScript repo with deps, folder layout, tooling, and scripts wired up. No business logic, no UI, no DB calls — just the skeleton.

---

## Stack & exact tooling

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | TypeScript strict mode |
| Runtime | React 19 | Server Components default |
| Package manager | pnpm | Faster, deterministic |
| Language | TypeScript 5.x | `strict: true`, `noUncheckedIndexedAccess: true` |
| Styling | Tailwind CSS v4 | + tailwind-merge, clsx (via cva) |
| Components | shadcn/ui (latest) | Radix primitives under the hood |
| Forms | react-hook-form + zod | Resolver: `@hookform/resolvers/zod` |
| State (client) | Zustand (only where needed) | Server Components are default |
| Charts | Recharts | Client-only |
| Icons | lucide-react | shadcn default |
| Linter | ESLint (Next.js + TypeScript configs) | + `eslint-plugin-import` for boundary rules |
| Formatter | Prettier + `prettier-plugin-tailwindcss` | Single source of formatting |
| Type-checker | `tsc --noEmit` | CI gate |
| Unit tests | Vitest | + `@testing-library/react` |
| E2E tests | Playwright | See `plans/e2e.md` |
| Git hooks | husky + lint-staged | Run lint + typecheck pre-commit |
| Node | 20 LTS | Pin in `.nvmrc` and `package.json#engines` |

---

## Commands the foundation agent runs

```bash
pnpm dlx create-next-app@latest poker-tracker \
  --typescript --tailwind --eslint --app --src-dir=false \
  --import-alias "@/*" --use-pnpm

cd poker-tracker
pnpm add zustand react-hook-form zod @hookform/resolvers \
  recharts lucide-react class-variance-authority tailwind-merge clsx
pnpm add -D vitest @vitejs/plugin-react @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event jsdom \
  prettier prettier-plugin-tailwindcss eslint-plugin-import \
  husky lint-staged @playwright/test
pnpm dlx shadcn@latest init
```

---

## Folder layout (final, agreed by all sub-plans)

```
poker-tracker/
├── app/                          # Next.js App Router (frontend agent territory)
│   ├── (marketing)/             # Landing / sign-in
│   ├── (app)/                   # Authenticated app shell
│   │   ├── sessions/
│   │   ├── leaderboard/
│   │   ├── profile/
│   │   └── settings/
│   ├── api/                     # Route handlers (Server Actions preferred)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn primitives (UI agent only)
│   └── shared/                   # Cross-page shared components (UI agent only)
├── lib/
│   ├── modules/                  # ALL DOMAIN MODULES LIVE HERE
│   │   └── <module>/
│   │       ├── index.ts          # PUBLIC INTERFACE — only export point
│   │       ├── types.ts          # Public types
│   │       ├── internal/         # Private; never imported outside this folder
│   │       └── README.md         # One-pager: what, inputs, outputs, deps, primitives, tests
│   ├── db/
│   │   ├── client.ts             # Supabase browser client
│   │   ├── server.ts             # Supabase server client (cookies)
│   │   ├── types.ts              # Generated from supabase
│   │   └── boundary.ts           # Boundary fake interface (used by tests)
│   ├── theme/                    # Tokens; UI agent owns
│   └── utils/                    # Tiny non-domain helpers (cn, etc.) ONLY
├── supabase/                     # DB agent territory
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── tests/
│   ├── modules/                  # Mirrors lib/modules — one folder per module
│   ├── helpers/                  # Boundary fakes shared across module tests
│   └── setup.ts
├── e2e/                          # E2E agent territory
│   ├── fixtures/
│   └── specs/
├── public/                       # PWA icons land here
├── styles/                       # Global styles only
├── .github/workflows/            # Deployment agent territory
├── eslint.config.mjs
├── prettier.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── next.config.ts
└── package.json
```

**Boundary rule (enforced by ESLint `import/no-restricted-paths`):**
- `app/**` may import from `lib/modules/<m>/index.ts` (interface only) and `components/**`.
- `app/**` may NOT import from `lib/modules/<m>/internal/**`.
- `lib/modules/<m>/**` may import from `lib/modules/<n>/index.ts` only.
- `tests/modules/<m>/**` may import only from `lib/modules/<m>/index.ts` and `tests/helpers/**`.

This rule is the architectural backbone. Make sure ESLint enforces it before the next phase begins.

---

## tsconfig (strictness)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## NPM scripts (all sub-plans rely on these names)

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
    "test:e2e": "playwright test",
    "db:gen-types": "supabase gen types typescript --local > lib/db/types.ts",
    "db:reset": "supabase db reset",
    "db:push": "supabase db push",
    "prepare": "husky"
  }
}
```

---

## Pre-commit hook (`.husky/pre-commit`)

```bash
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"
pnpm lint-staged
pnpm typecheck
```

`lint-staged` config: ESLint + Prettier on staged files only.

---

## Acceptance checklist (foundation agent done when…)

- [ ] `pnpm install` succeeds on a clean checkout.
- [ ] `pnpm dev` starts and the default page renders.
- [ ] `pnpm typecheck` passes with zero errors.
- [ ] `pnpm lint` passes with zero warnings.
- [ ] `pnpm test` runs Vitest and reports 0 tests run (no test files yet — that's expected).
- [ ] `pnpm test:e2e` opens Playwright and reports 0 tests (also expected).
- [ ] ESLint boundary rule is configured and rejects a sample violation (write a test file under `app/` that imports `lib/modules/foo/internal/x` — confirm it errors, then remove).
- [ ] Folder layout above exists exactly as specified (empty placeholder dirs OK).
- [ ] README.md at repo root explains how to run locally.

When all boxes are checked, foundation ships and Phase 0 advances to `database.md`.
