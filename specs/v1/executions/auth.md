# Auth Execution Runbook

Implements `plans/auth.md`. Single agent. Phase 1, parallel with module work, UI, PWA, deployment. Owns auth UI, middleware, callback route, sign-out.

Working directory: `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Step 1 — Middleware

Create `middleware.ts` at the project root:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/db/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sign-in|auth/callback|join|sign-out|manifest.webmanifest|sw.js|icons|splash|.*\\..*).*)",
  ],
};
```

The matcher excludes static files, sign-in flow, and PWA assets so they remain public.

---

## Step 2 — Sign-in page

Create `app/sign-in/page.tsx`:

```tsx
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
```

Create `app/sign-in/sign-in-form.tsx`:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "./actions";

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export function SignInForm() {
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") ?? "/sessions";
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit({ email }: FormData) {
    setError(null);
    try {
      await signInAction(email, redirectTo);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send link.");
    }
  }

  if (sent) {
    return (
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold mb-2">Check your email</h1>
        <p className="text-sm text-muted-foreground">We sent a magic sign-in link to your inbox.</p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email && <p className="text-sm text-destructive">Please enter a valid email.</p>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        Send magic link
      </Button>
    </form>
  );
}
```

Create `app/sign-in/actions.ts`:

```ts
"use server";

import { getModules } from "@/lib/modules";

export async function signInAction(email: string, redirectTo: string) {
  const { auth } = await getModules();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await auth.signInWithMagicLink(email, `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`);
}
```

---

## Step 3 — Auth callback

Create `app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/db/server";
import { getModules } from "@/lib/modules";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/sessions";

  if (code) {
    const supabase = await getServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Pending invite handling
  const pending = req.cookies.get("pending_invite")?.value;
  const res = NextResponse.redirect(new URL(next, req.url));
  if (pending) {
    res.cookies.delete("pending_invite");
    try {
      const { auth } = await getModules();
      const sessionId = await auth.joinSessionByToken(pending);
      return NextResponse.redirect(new URL(`/sessions/${sessionId}`, req.url));
    } catch {
      // fall through to next
    }
  }
  return res;
}
```

---

## Step 4 — Join page

Create `app/join/[token]/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getModules } from "@/lib/modules";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { auth } = await getModules();
  const me = await auth.getCurrentUser();

  if (me) {
    try {
      const sessionId = await auth.joinSessionByToken(token);
      redirect(`/sessions/${sessionId}`);
    } catch (e) {
      return (
        <main className="flex min-h-svh items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-2">
            <h1 className="text-2xl font-semibold">Invalid invite</h1>
            <p className="text-sm text-muted-foreground">This invite is no longer valid or the session has closed.</p>
          </div>
        </main>
      );
    }
  }

  // Stash the invite token and redirect to sign-in.
  const cookieStore = await cookies();
  cookieStore.set("pending_invite", token, { httpOnly: true, maxAge: 3600, path: "/" });
  redirect("/sign-in");
}
```

---

## Step 5 — Sign-out

Create `app/sign-out/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/db/server";

export async function POST() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}

export async function GET() {
  return POST();
}
```

---

## Step 6 — Tests

Auth-flow tests live in `e2e/specs/auth.spec.ts` per `executions/e2e.md`. The auth agent does not duplicate them here. The auth module unit tests are already in `executions/modules.md` under "Module: auth".

---

## Acceptance checklist

- [ ] `middleware.ts` exists and matches the patterns above.
- [ ] `app/sign-in/{page.tsx, sign-in-form.tsx, actions.ts}` exist and compile.
- [ ] `app/auth/callback/route.ts` exists and exchanges the code.
- [ ] `app/join/[token]/page.tsx` handles both signed-in and signed-out users.
- [ ] `app/sign-out/route.ts` exists.
- [ ] Manual smoke test:
  - [ ] Visit `/(app)/...` while signed out → redirects to `/sign-in`.
  - [ ] Submit valid email → "Check your email" state.
  - [ ] Click magic link from inbucket (`http://localhost:54324`) → lands on `/sessions`.
  - [ ] Visit `/join/<a-valid-token>` while signed out → cookie stashed, redirected to sign-in, then to the session after auth.
  - [ ] `POST /sign-out` clears cookie and redirects to `/`.
- [ ] `pnpm typecheck` and `pnpm lint` pass.

When all boxes green, commit as `feat: auth flow + middleware`.
