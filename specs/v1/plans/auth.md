# Auth Plan

End-to-end authentication, invite-onboarding, and route protection. Lives at the seam between the `auth` module and the frontend. Runs **in parallel** with `ui.md`, `pwa.md`, and Phase 1 module work.

---

## Scope

This plan covers:
- Magic-link sign-in flow (UI + module wiring).
- First-time onboarding via session invite link.
- Route protection (which routes are public vs. authenticated).
- Server-side current-user resolution for Server Components.
- Sign-out flow.
- Session-cookie handling between Next.js Server Components and Supabase.

Out of scope (handled elsewhere):
- The `auth` module's domain implementation → `plans/modules.md` → "auth".
- Profile editing → `profiles` module.

---

## Tooling

- Supabase Auth (email magic link only; no passwords, no OAuth in v1).
- `@supabase/ssr` for Next.js cookie-based auth (server clients use `cookies()` from `next/headers`).
- `next/headers` and middleware for route protection.

---

## Flows

### Flow A — first-time user via session invite

```
1. House sends Ravi a link: /join/<invite_token>
2. Ravi clicks → page renders sign-in form (since no session cookie).
   - The invite_token is stashed in a cookie ("pending_invite") for 1 hour.
3. Ravi enters email → magic link is sent with redirect to /auth/callback.
4. Ravi clicks link in email → /auth/callback exchanges code, sets session cookie.
5. /auth/callback reads "pending_invite" cookie:
   - If present, calls auth.joinSessionByToken(token) and redirects to /sessions/<id>.
   - Else redirects to /.
6. profiles row is auto-created with nickname = email local-part on first auth.
   Ravi can rename later in /profile.
```

### Flow B — returning user

```
1. Ravi visits any /(app)/* route → middleware checks cookie.
   - No cookie → redirect to /sign-in?redirectTo=<path>.
2. Ravi enters email → magic link → /auth/callback → redirect to <path>.
```

### Flow C — sign-out

```
1. /sign-out is a Server Action that calls supabase.auth.signOut() and clears cookie.
2. Redirect to /.
```

---

## Routes

| Route | Public? | Notes |
|---|---|---|
| `/` | public | Landing page. If authenticated, redirect to `/sessions`. |
| `/sign-in` | public | Magic-link form. Accepts `?redirectTo`. |
| `/auth/callback` | public | Handles code exchange + post-auth redirect. |
| `/join/[token]` | public | Stashes pending_invite cookie, then redirects to `/sign-in`. If already authenticated, calls `joinSessionByToken` directly. |
| `/(app)/**` | authenticated | Middleware redirects to `/sign-in` if no session. |

Middleware lives at `middleware.ts` (project root) and matches `/(app)/:path*`.

---

## Files this plan owns

```
app/sign-in/page.tsx
app/sign-in/sign-in-form.tsx
app/auth/callback/route.ts
app/join/[token]/page.tsx
app/sign-out/route.ts
middleware.ts
lib/db/server.ts                  # the server-side Supabase client (cookies wired)
lib/db/client.ts                  # the client-side Supabase client
```

Note: `lib/db/server.ts` and `lib/db/client.ts` are foundation territory — but the auth agent finalizes them since they're the seam this plan owns.

---

## Implementation notes

### `middleware.ts`

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/db/middleware';   // helper from @supabase/ssr docs

export async function middleware(req: NextRequest) {
  return updateSession(req);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sign-in|auth/callback|join|sign-out).*)',
  ],
};
```

`updateSession` refreshes the access token and, if missing, redirects authenticated paths to `/sign-in?redirectTo=<originalPath>`.

### `app/sign-in/sign-in-form.tsx`

Client component. Uses `react-hook-form` + `zod` (email regex). On submit:
- Reads `redirectTo` from URL.
- Calls `auth.signInWithMagicLink(email, ${origin}/auth/callback?next=${redirectTo})`.
- Shows "Check your email" success state.

### `app/auth/callback/route.ts`

```ts
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/sessions';
  if (code) {
    const supabase = createServerClient(...);
    await supabase.auth.exchangeCodeForSession(code);
  }
  // Pending invite handling
  const cookies = req.cookies;
  const pending = cookies.get('pending_invite')?.value;
  if (pending) {
    cookies.delete('pending_invite');
    try { await joinSessionByToken(pending); } catch {}
    return NextResponse.redirect(new URL(`/sessions`, req.url));
  }
  return NextResponse.redirect(new URL(next, req.url));
}
```

### `app/join/[token]/page.tsx`

Server Component:
- If user is authenticated → call `auth.joinSessionByToken(token)`, redirect to `/sessions/<id>`.
- If not authenticated → set `pending_invite` cookie (httpOnly, 1-hour TTL) and redirect to `/sign-in`.

### Profile auto-create

Add a Postgres trigger in the DB plan (or a server-side hook on first auth event) that inserts a `profiles` row with `nickname = split_part(email, '@', 1)` when a new `auth.users` row is created.

---

## UX requirements (handed to UI agent)

- `/sign-in` — single email input, primary button, post-submit success state ("Check your email — we've sent a magic link"). Error state for invalid email or rate-limit.
- `/auth/callback` — full-page loader while exchanging code. No flash of unauth content.
- `/join/[token]` — if invite is invalid/closed, show a clear error page with a CTA back to home.

---

## Tests

Auth-flow tests live in `e2e/specs/auth.spec.ts` (see `plans/e2e.md`):
- Sign-in via magic link (Playwright fakes the link click using Supabase test API).
- First-time onboarding via invite link.
- Returning user with valid session can hit `/(app)/*` routes.
- Returning user with no session is redirected from `/(app)/*`.
- Sign-out clears session.

Unit tests for the `auth` module live in `tests/modules/auth/` (covered in `plans/modules.md` → auth section).

---

## Acceptance checklist

- [ ] All routes above exist and behave as described.
- [ ] Middleware blocks `/(app)/*` for unauth users; allows when signed in.
- [ ] First-time invite flow auto-creates `profiles` row and adds user to session.
- [ ] Sign-out works from anywhere.
- [ ] No client component reads cookies directly — all goes through `lib/db/server.ts` or `lib/db/client.ts`.
- [ ] Playwright auth specs pass.
