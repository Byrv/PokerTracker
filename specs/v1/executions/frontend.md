# Frontend Execution Runbook

Implements `plans/frontend.md`. **Parallel work** — five page-group agents (auth-pages, session-pages, leaderboard-pages, profile-pages, settings-pages). Phase 2, after modules + UI ship.

The auth-pages agent's work is mostly already done in `executions/auth.md`. The remaining four agents are dispatched here.

Working directory: `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Shared step — App layout

Create `app/(app)/layout.tsx` (single agent runs this once before page-group fan-out):

```tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { getModules } from "@/lib/modules";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { auth } = await getModules();
  const me = await auth.getCurrentUser();
  if (!me) redirect("/sign-in");
  return <AppShell>{children}</AppShell>;
}
```

Create `app/page.tsx` (landing redirect):

```tsx
import { redirect } from "next/navigation";
import { getModules } from "@/lib/modules";

export default async function Landing() {
  const { auth } = await getModules();
  const me = await auth.getCurrentUser();
  redirect(me ? "/sessions" : "/sign-in");
}
```

---

## Agent: session-pages

Owns `app/(app)/sessions/**`.

### Step 1 — Sessions list

Create `app/(app)/sessions/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { MoneyAmount } from "@/components/shared/money-amount";
import { getModules } from "@/lib/modules";

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ status?: "open" | "closed" }> }) {
  const { sessions } = await getModules();
  const params = await searchParams;
  const list = await sessions.listSessions(params.status ? { status: params.status } : undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sessions</h1>
        <Button asChild><Link href="/sessions/new">New session</Link></Button>
      </div>

      <div className="flex gap-2">
        <Link href="/sessions" className="text-sm underline-offset-2 hover:underline">All</Link>
        <Link href="/sessions?status=open" className="text-sm">Open</Link>
        <Link href="/sessions?status=closed" className="text-sm">Closed</Link>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No sessions yet" description="Create one to get started." cta={<Button asChild><Link href="/sessions/new">Create</Link></Button>} />
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id}>
              <Link href={`/sessions/${s.id}`}>
                <Card className="hover:border-[var(--accent)]">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.name ?? `Session ${s.playedOn}`}</div>
                      <div className="text-sm text-[var(--foreground)]/70">{s.location ?? "—"} · {s.playedOn}</div>
                    </div>
                    <div className="text-sm">{s.status === "open" ? "Open" : "Closed"}</div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Step 2 — Create session

Create `app/(app)/sessions/new/page.tsx`:

```tsx
import { CreateSessionForm } from "./form";

export default function NewSessionPage() {
  return (
    <div className="max-w-md mx-auto py-6 space-y-4">
      <h1 className="text-xl font-semibold">New session</h1>
      <CreateSessionForm />
    </div>
  );
}
```

Create `app/(app)/sessions/new/form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSessionAction } from "./actions";

const schema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  blindsSmallRupees: z.coerce.number().int().min(1),
  blindsBigRupees: z.coerce.number().int().min(1),
});
type Form = z.infer<typeof schema>;

export function CreateSessionForm() {
  const router = useRouter();
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { blindsSmallRupees: 1, blindsBigRupees: 2 } });

  async function onSubmit(values: Form) {
    const session = await createSessionAction({
      name: values.name,
      location: values.location,
      blinds: { smallPaise: values.blindsSmallRupees * 100, bigPaise: values.blindsBigRupees * 100 },
    });
    router.push(`/sessions/${session.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-2"><Label>Name</Label><Input {...form.register("name")} placeholder="Friday Night" /></div>
      <div className="space-y-2"><Label>Location</Label><Input {...form.register("location")} placeholder="Aman's place" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Small blind (₹)</Label><Input type="number" {...form.register("blindsSmallRupees")} /></div>
        <div className="space-y-2"><Label>Big blind (₹)</Label><Input type="number" {...form.register("blindsBigRupees")} /></div>
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Create session</Button>
    </form>
  );
}
```

Create `app/(app)/sessions/new/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { asPaise } from "@/lib/modules/core";
import { getModules } from "@/lib/modules";

export async function createSessionAction(input: { name?: string; location?: string; blinds: { smallPaise: number; bigPaise: number } }) {
  const { sessions } = await getModules();
  const s = await sessions.createSession({
    name: input.name,
    location: input.location,
    blinds: { small: asPaise(input.blinds.smallPaise), big: asPaise(input.blinds.bigPaise) },
  });
  revalidatePath("/sessions");
  return s;
}
```

### Step 3 — Session detail

Create `app/(app)/sessions/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyAmount } from "@/components/shared/money-amount";
import { ChipAmount } from "@/components/shared/chip-amount";
import { HouseControls } from "@/components/shared/house-controls";
import { PlayerRow } from "@/components/shared/player-row";
import { getModules } from "@/lib/modules";
import { asSessionId } from "@/lib/modules/core";
import { RecordBuyinSheet } from "./record-buyin-sheet";
import { ConfirmCashoutsList } from "./confirm-cashouts-list";
import { CloseSessionButton } from "./close-session-button";
import { SubmitCashoutDrawer } from "./submit-cashout-drawer";

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessions, ledger, auth } = await getModules();
  const me = await auth.requireUser();
  let session;
  try { session = await sessions.getSession(asSessionId(id)); } catch { notFound(); }

  const [buyins, cashouts, sessionLedger, recon] = await Promise.all([
    ledger.listBuyins(session.id),
    ledger.listCashouts(session.id),
    ledger.getSessionLedger(session.id),
    ledger.getReconciliation(session.id),
  ]);

  const isHouse = session.createdBy === me.id;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{session.name ?? `Session ${session.playedOn}`}</h1>
        <p className="text-sm text-[var(--foreground)]/70">
          {session.location ?? "—"} · {session.playedOn} · blinds <MoneyAmount value={session.blinds.small} size="sm" />/<MoneyAmount value={session.blinds.big} size="sm" />
        </p>
        <p className="text-sm">Status: <span className="font-medium">{session.status}</span></p>
      </header>

      <Card>
        <CardContent className="p-4 divide-y divide-[var(--border)]">
          {sessionLedger.map((row) => (
            <PlayerRow
              key={row.userId}
              user={{ nickname: row.userId.slice(0, 6) }}
              amount={<MoneyAmount value={row.netPaise} variant={row.netPaise >= 0 ? "profit" : "loss"} />}
              hint={<ChipAmount value={row.cashoutPaise} />}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="text-sm">Reconciliation</div>
          <MoneyAmount value={recon.discrepancy} variant={recon.discrepancy === 0 ? "profit" : "loss"} />
        </CardContent>
      </Card>

      <HouseControls isHouse={isHouse}>
        <div className="space-y-3">
          <RecordBuyinSheet sessionId={session.id} participants={session.participants} />
          <ConfirmCashoutsList sessionId={session.id} cashouts={cashouts} />
          <CloseSessionButton sessionId={session.id} canClose={recon.discrepancy === 0 && cashouts.every((c) => c.status === "confirmed")} />
        </div>
      </HouseControls>

      {!isHouse && session.status === "open" && (
        <SubmitCashoutDrawer sessionId={session.id} userId={me.id} />
      )}
    </div>
  );
}
```

Create `app/(app)/sessions/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getModules } from "@/lib/modules";
import { asChips, asPaise, asSessionId, asUserId } from "@/lib/modules/core";

export async function recordBuyinAction(input: { sessionId: string; userId: string; amountPaise: number }) {
  const { ledger } = await getModules();
  await ledger.recordBuyin({
    sessionId: asSessionId(input.sessionId),
    userId: asUserId(input.userId),
    amount: asPaise(input.amountPaise),
  });
  revalidatePath(`/sessions/${input.sessionId}`);
}

export async function submitCashoutAction(input: { sessionId: string; userId: string; chipCount: number }) {
  const { ledger } = await getModules();
  await ledger.submitCashout({
    sessionId: asSessionId(input.sessionId),
    userId: asUserId(input.userId),
    chipCount: asChips(input.chipCount),
  });
  revalidatePath(`/sessions/${input.sessionId}`);
}

export async function confirmCashoutAction(cashoutId: string, sessionId: string) {
  const { ledger } = await getModules();
  await ledger.confirmCashout(cashoutId);
  revalidatePath(`/sessions/${sessionId}`);
}

export async function closeSessionAction(sessionId: string) {
  const { sessions, badges } = await getModules();
  await sessions.closeSession(asSessionId(sessionId));
  await badges.evaluateBadgesForSession(asSessionId(sessionId));
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/leaderboard");
}
```

Create `app/(app)/sessions/[id]/record-buyin-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordBuyinAction } from "./actions";

export function RecordBuyinSheet({ sessionId, participants }: { sessionId: string; participants: string[] }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [rupees, setRupees] = useState<number>(500);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!userId) return;
    setBusy(true);
    try { await recordBuyinAction({ sessionId, userId, amountPaise: rupees * 100 }); setOpen(false); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button>Record buy-in</Button></SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader><SheetTitle>Record buy-in</SheetTitle></SheetHeader>
        <div className="space-y-3 py-4">
          <div className="space-y-2">
            <Label>Player</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder="Pick player" /></SelectTrigger>
              <SelectContent>{participants.map((p) => <SelectItem key={p} value={p}>{p.slice(0, 6)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input type="number" value={rupees} onChange={(e) => setRupees(Number(e.target.value))} />
          </div>
          <Button className="w-full" onClick={submit} disabled={!userId || busy}>Record</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Create `app/(app)/sessions/[id]/confirm-cashouts-list.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { MoneyAmount } from "@/components/shared/money-amount";
import { confirmCashoutAction } from "./actions";

export function ConfirmCashoutsList({ sessionId, cashouts }: { sessionId: string; cashouts: Array<{ id: string; userId: string; amount: number; status: string }> }) {
  const pending = cashouts.filter((c) => c.status === "pending");
  if (pending.length === 0) return <div className="text-sm text-[var(--foreground)]/70">No pending cash-outs.</div>;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Pending cash-outs</h3>
      {pending.map((c) => (
        <div key={c.id} className="flex items-center justify-between border-b border-[var(--border)] py-2">
          <div className="text-sm">{c.userId.slice(0, 6)} — <MoneyAmount value={c.amount} size="sm" /></div>
          <Button size="sm" onClick={() => confirmCashoutAction(c.id, sessionId)}>Confirm</Button>
        </div>
      ))}
    </div>
  );
}
```

Create `app/(app)/sessions/[id]/close-session-button.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { closeSessionAction } from "./actions";

export function CloseSessionButton({ sessionId, canClose }: { sessionId: string; canClose: boolean }) {
  return (
    <ConfirmDialog
      trigger={<Button disabled={!canClose} variant="destructive">Close session</Button>}
      title="Close this session?"
      description="Final numbers will be locked and the session will appear in the leaderboard."
      confirmLabel="Close"
      onConfirm={() => closeSessionAction(sessionId)}
    />
  );
}
```

Create `app/(app)/sessions/[id]/submit-cashout-drawer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitCashoutAction } from "./actions";

export function SubmitCashoutDrawer({ sessionId, userId }: { sessionId: string; userId: string }) {
  const [chips, setChips] = useState<number>(0);
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild><Button className="w-full">Submit your cashout</Button></DrawerTrigger>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Cashout</DrawerTitle></DrawerHeader>
        <div className="p-4 space-y-3">
          <div className="space-y-2"><Label>Final chip count</Label><Input type="number" value={chips} onChange={(e) => setChips(Number(e.target.value))} /></div>
          <Button className="w-full" onClick={async () => { await submitCashoutAction({ sessionId, userId, chipCount: chips }); setOpen(false); }}>Submit</Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

### Step 4 — Notes + photos panels

Add a Tabs component at the bottom of `app/(app)/sessions/[id]/page.tsx` that shows:
- Notes panel (uses `media.listNotes`, server-rendered).
- Photos gallery (uses `media.listPhotos`).
- Audit log (uses `ledger.listAudit`).

(Detailed tab implementation follows the same shadcn `Tabs` + Server Component pattern. Implementer should consult `plans/frontend.md` for layout specifics.)

### Step 5 — Loading / error / not-found

Create `app/(app)/sessions/loading.tsx`:
```tsx
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
export default function Loading() { return <LoadingSkeleton variant="table" />; }
```

Create `app/(app)/sessions/error.tsx`:
```tsx
"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function Error({ error, reset }: { error: Error; reset: () => void }) { return <ErrorState error={error} retry={reset} />; }
```

Create `app/(app)/sessions/[id]/not-found.tsx`:
```tsx
import { EmptyState } from "@/components/shared/empty-state";
export default function NotFound() { return <EmptyState title="Session not found" description="This session may have been deleted." />; }
```

---

## Agent: leaderboard-pages

Create `app/(app)/leaderboard/page.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { MoneyAmount } from "@/components/shared/money-amount";
import { PlayerRow } from "@/components/shared/player-row";
import { EmptyState } from "@/components/shared/empty-state";
import { getModules } from "@/lib/modules";

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; sort?: string }> }) {
  const params = await searchParams;
  const { leaderboard } = await getModules();
  const board = await leaderboard.getLeaderboard(
    { from: params.from, to: params.to },
    (params.sort as "net" | "winRate" | "biggestWin") ?? "net",
  );

  if (board.length === 0) {
    return <EmptyState title="No closed sessions yet" description="Play a session to populate the leaderboard." />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Leaderboard</h1>
      <Card>
        <CardContent className="p-4 divide-y divide-[var(--border)]">
          {board.map((row, i) => (
            <PlayerRow
              key={row.userId}
              user={{ nickname: row.nickname }}
              amount={<MoneyAmount value={row.netPaise} variant={row.netPaise >= 0 ? "profit" : "loss"} />}
              hint={`#${i + 1} · ${row.sessionsPlayed} sessions · ${(row.winRate * 100).toFixed(0)}% win rate`}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Agent: profile-pages

Create `app/(app)/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getModules } from "@/lib/modules";

export default async function ProfileRedirect() {
  const { auth } = await getModules();
  const me = await auth.requireUser();
  redirect(`/profile/${me.id}`);
}
```

Create `app/(app)/profile/[userId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyAmount } from "@/components/shared/money-amount";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { getModules } from "@/lib/modules";
import { asUserId } from "@/lib/modules/core";
import { BankrollChart } from "./bankroll-chart";

export default async function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { profiles } = await getModules();
  let summary;
  try { summary = await profiles.getProfile(asUserId(userId)); } catch { notFound(); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <PlayerAvatar user={summary.user} size="lg" />
        <div>
          <h1 className="text-xl font-semibold">{summary.user.nickname}</h1>
          <MoneyAmount value={summary.lifetime.netPaise} variant={summary.lifetime.netPaise >= 0 ? "profit" : "loss"} size="lg" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Lifetime</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div>Sessions: {summary.lifetime.sessionsPlayed}</div>
          <div>Streak: {summary.lifetime.currentStreak}</div>
          <div>Biggest win: <MoneyAmount value={summary.lifetime.biggestWinPaise} variant="profit" size="sm" /></div>
          <div>Biggest loss: <MoneyAmount value={summary.lifetime.biggestLossPaise} variant="loss" size="sm" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bankroll over time</CardTitle></CardHeader>
        <CardContent><BankrollChart series={summary.bankrollSeries} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Badges</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {summary.badges.length === 0 && <p className="text-sm text-[var(--foreground)]/70">No badges yet.</p>}
          {summary.badges.map((b) => <div key={b.key + b.earnedAt} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">{b.key}</div>)}
        </CardContent>
      </Card>
    </div>
  );
}
```

Create `app/(app)/profile/[userId]/bankroll-chart.tsx`:

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

export function BankrollChart({ series }: { series: Array<{ at: string; cumulativeNetPaise: number }> }) {
  if (series.length === 0) return <p className="text-sm text-[var(--foreground)]/70">No data yet.</p>;
  const data = series.map((p) => ({ at: p.at, value: p.cumulativeNetPaise / 100 }));
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="at" tickFormatter={(d) => d.slice(5)} fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v: number) => `₹${v.toFixed(0)}`} />
          <Line type="monotone" dataKey="value" stroke="var(--accent)" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Agent: settings-pages

Create `app/(app)/settings/page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getModules } from "@/lib/modules";
import { setChipRatioAction, signOutAction } from "./actions";

export default async function SettingsPage() {
  const { core } = await getModules();
  const ratio = await core.getChipRatio();

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Chip ratio</CardTitle></CardHeader>
        <CardContent>
          <form action={setChipRatioAction} className="space-y-3">
            <p className="text-sm text-[var(--foreground)]/70">Affects future sessions only. Closed sessions retain their original ratio.</p>
            <Label htmlFor="chips_per_paise">Chips per paise</Label>
            <Input name="chips_per_paise" id="chips_per_paise" defaultValue={ratio.chipsPerPaise} type="number" min={1} />
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">Sign out</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

Create `app/(app)/settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getModules } from "@/lib/modules";
import { getServerSupabase } from "@/lib/db/server";

export async function setChipRatioAction(formData: FormData) {
  const value = Number(formData.get("chips_per_paise"));
  if (!Number.isFinite(value) || value < 1) return;
  const { core } = await getModules();
  await core.setChipRatio({ chipsPerPaise: value });
  revalidatePath("/settings");
}

export async function signOutAction() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
```

---

## Acceptance checklist (per page-group agent)

- [ ] All routes in your scope render against real modules in dev (`pnpm dev`).
- [ ] Loading / error / not-found boundaries present where listed.
- [ ] House view shows controls; player view hides them.
- [ ] All money values rendered through `<MoneyAmount>`.
- [ ] No direct Supabase imports in `app/**`.
- [ ] No imports from `lib/modules/**/internal/**`.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass.
- [ ] Visual check on mobile viewport (390 × 844) and desktop (1440 × 900).

When all five page-group agents report green, Phase 2 frontend is done. E2E + final integration follow.
