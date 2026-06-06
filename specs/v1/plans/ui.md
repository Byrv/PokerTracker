# UI Plan

Design system, theme tokens, shadcn primitives, layout shell, and shared components. Runs **in parallel** with `auth.md`, `pwa.md`, and Phase 1 module work.

This plan owns `components/ui/**`, `components/shared/**`, `lib/theme/**`, and `styles/**`. Frontend page agents consume these — they don't redefine.

---

## Goals

- Standard poker palette (felt-green primary, card-red and card-black accents, cream/white canvas), applied tastefully — not a casino skin.
- Phone-first, one-handed-friendly. Big tap targets. Numbers as the visual hero.
- Dark mode required and feels native (not a desaturated light theme).
- Pull components from the web (shadcn) — don't design from scratch.

---

## Theme

### Palette tokens (`lib/theme/tokens.ts`)

```ts
export const colors = {
  // Brand / poker
  feltGreen: { 50: '...', 500: '#0F6D40', 600: '#0B5732', 700: '#073D24' },  // primary
  cardRed:   { 50: '...', 500: '#C0392B', 600: '#A93226', 700: '#922B21' },
  cardBlack: { 500: '#1F1F1F' },
  cream:     { 50:  '#FAF7EE', 100: '#F2EDDC' },                            // light bg

  // Neutrals tuned for tabular numbers
  ink:       { 700: '#1B1F23', 500: '#3A4048', 300: '#7A828D', 200: '#C2C8D0', 100: '#E6E9EE' },

  // Semantic for P&L
  profit:    '#1B7F4F',
  loss:      '#C0392B',
};
```

CSS variables are emitted from these tokens via Tailwind v4's `@theme` block. Every component uses Tailwind classes; no inline hex.

### Light vs dark

| Token | Light | Dark |
|---|---|---|
| `--bg` | `cream.50` | `cardBlack.500` |
| `--surface` | `#FFFFFF` | `#262626` |
| `--text` | `ink.700` | `cream.50` |
| `--accent` | `feltGreen.500` | `feltGreen.500` |
| `--profit` | `profit` | `#3DCB80` |
| `--loss` | `loss` | `#FF6B5B` |

Theme toggle stored in cookie (`theme=light|dark|system`); SSR reads cookie to render correctly without flash.

### Typography (`lib/theme/fonts.ts`)

- Sans: **Geist Sans** (via `next/font/google`).
- Mono (numbers): **Geist Mono**, Tailwind class `font-mono tabular-nums`.
- Scale: a constrained set — `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl` (no random sizes).
- Numeric values **always** use `font-mono tabular-nums` so tables align.

---

## shadcn primitives to install

```bash
pnpm dlx shadcn@latest add \
  button input label select textarea form \
  card sheet dialog drawer alert-dialog \
  table tabs badge avatar tooltip toast \
  dropdown-menu navigation-menu separator skeleton \
  switch toggle scroll-area popover progress
```

Customize each after install:
- Buttons: 44 px min height (mobile tap target).
- Inputs: 44 px min height, large numeric input variant for chips/INR.
- Cards: subtle felt-green left-border accent for "your row" affordance.
- Toast: bottom-center on mobile, top-right on desktop.

---

## Shared components (`components/shared/`)

Reusable composites built from shadcn primitives. UI agent owns all of them.

| Component | Purpose |
|---|---|
| `<MoneyAmount value={paise} variant="profit|loss|neutral" size="sm|md|lg" />` | Formats paise with `core.formatINR`, applies color and tabular-mono. The single way money is rendered anywhere. |
| `<ChipAmount value={chips} />` | Same, for chip values. |
| `<PlayerAvatar user={...} size="sm|md|lg" />` | Avatar with nickname tooltip. Falls back to initials on missing avatar. |
| `<PlayerRow user={...} amount={...} hint={...} />` | Standard list row used in leaderboard, ledger, settle-up. |
| `<EmptyState icon={...} title="..." description="..." cta={...} />` | Empty/zero-data states. |
| `<ErrorState error={Error} retry={...} />` | Generic error UI. |
| `<LoadingSkeleton variant="row|card|table" />` | Skeleton loaders matching the real component shapes. |
| `<AppShell>` | Top-level layout: nav + content + bottom-bar (mobile). Server Component. |
| `<HouseControls session={...}>{children}</HouseControls>` | Wrapper that renders children only if current user is the session house. Cuts house-only UI cleanly. |
| `<ConfirmDialog title="..." description="..." onConfirm={...} />` | Alert-dialog convenience for destructive actions. |

These components consume **only** `core` (for formatting/permissions) and shadcn primitives. They do not import from any feature module.

---

## Layout shell

### Mobile (default)

```
┌──────────────────────────┐
│  [logo]   Poker Tracker  │   ← top bar (sticky, slim)
├──────────────────────────┤
│                          │
│        page content      │
│                          │
├──────────────────────────┤
│ Sessions  Board  Profile │   ← bottom nav, 4 tabs incl Settings
└──────────────────────────┘
```

### Desktop (≥ 1024px)

```
┌──────────────────────────┐
│  Logo │ Sessions ▼ Board │   ← top bar (full nav)
│       │ Profile  Settings│
├──────────────────────────┤
│                          │
│      page content        │
│        (max-w-3xl)       │
│                          │
└──────────────────────────┘
```

Bottom nav hidden on `lg:` breakpoint; top nav shows full menu instead.

---

## House vs player UI distinction

Both UIs use the same shell. The differences are:

- **House view of an open session**: shows `<HouseControls>` block — record-buyin button, pending-cashouts approval queue, close-session button, edit pencils on existing buy-ins.
- **Player view of an open session**: read-only ledger; "Submit your cashout" button when session is in cashout phase. No edit pencils, no close button.

The `<HouseControls>` wrapper does this gating in one place. Pages don't have to branch — they always render house controls inside the wrapper, and the wrapper hides them for non-house viewers.

---

## Accessibility baseline

- All interactive elements reachable by keyboard.
- Focus rings visible (don't strip default outlines).
- Contrast ≥ AA on profit/loss colors against both light and dark surfaces (verify with a token-aware contrast script in CI).
- Bottom nav elements are min 48 px tall.
- Reduced-motion media query respected (skeletons don't pulse aggressively).

---

## Files this plan owns

```
components/ui/                    # shadcn primitives
components/shared/                # composites listed above
lib/theme/
├── tokens.ts
├── fonts.ts
└── theme-provider.tsx
styles/globals.css
app/layout.tsx                    # shared with frontend agent — UI agent ships the initial version
```

---

## Acceptance checklist

- [ ] Tailwind v4 `@theme` block includes all tokens; dark mode toggles via class on `<html>`.
- [ ] All shadcn primitives listed above are installed and adjusted (min heights, color usage).
- [ ] All shared components have a Storybook-style demo page at `app/(internal)/ui-kit/` (development-only) showing every variant.
- [ ] No raw hex colors in any component file — all reference tokens.
- [ ] No raw money-formatting strings — every monetary render uses `<MoneyAmount>`.
- [ ] AppShell renders correctly on mobile (375 px) and desktop (1280 px) viewports.
- [ ] Theme toggle persists across reload via cookie.
- [ ] Lighthouse a11y score ≥ 95 on the UI-kit page.
