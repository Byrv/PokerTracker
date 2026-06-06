# UI Execution Runbook

Implements `plans/ui.md`. Single agent. Phase 1, parallel with module work, auth, PWA, deployment. Owns design system, theme, shadcn primitives, shared components, AppShell.

Working directory: `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Step 1 — Theme tokens

Create `lib/theme/tokens.ts`:

```ts
export const colors = {
  feltGreen: { 50: "#E5F2EC", 100: "#BFE0D0", 500: "#0F6D40", 600: "#0B5732", 700: "#073D24" },
  cardRed:   { 50: "#FBE9E6", 100: "#F4C5BD", 500: "#C0392B", 600: "#A93226", 700: "#922B21" },
  cardBlack: { 500: "#1F1F1F" },
  cream:     { 50: "#FAF7EE", 100: "#F2EDDC" },
  ink:       { 700: "#1B1F23", 500: "#3A4048", 300: "#7A828D", 200: "#C2C8D0", 100: "#E6E9EE" },
  profit:    "#1B7F4F",
  loss:      "#C0392B",
} as const;

export const lightTheme = {
  bg: colors.cream[50],
  surface: "#FFFFFF",
  text: colors.ink[700],
  textMuted: colors.ink[500],
  border: colors.ink[100],
  accent: colors.feltGreen[500],
  accentForeground: "#FFFFFF",
  profit: colors.profit,
  loss: colors.loss,
};

export const darkTheme = {
  bg: colors.cardBlack[500],
  surface: "#262626",
  text: colors.cream[50],
  textMuted: colors.ink[300],
  border: "#333333",
  accent: colors.feltGreen[500],
  accentForeground: "#FFFFFF",
  profit: "#3DCB80",
  loss: "#FF6B5B",
};
```

Update `app/globals.css` (replace shadcn defaults):

```css
@import "tailwindcss";

@theme {
  --color-felt-green-50: #E5F2EC;
  --color-felt-green-500: #0F6D40;
  --color-felt-green-600: #0B5732;
  --color-felt-green-700: #073D24;
  --color-card-red-500: #C0392B;
  --color-card-red-600: #A93226;
  --color-cream-50: #FAF7EE;
  --color-ink-700: #1B1F23;
  --color-profit: #1B7F4F;
  --color-loss: #C0392B;
  --font-sans: var(--font-geist-sans, ui-sans-serif, system-ui);
  --font-mono: var(--font-geist-mono, ui-monospace);
}

:root {
  --background: var(--color-cream-50);
  --foreground: var(--color-ink-700);
  --surface: #FFFFFF;
  --border: #E6E9EE;
  --accent: var(--color-felt-green-500);
  --accent-foreground: #FFFFFF;
  --profit: var(--color-profit);
  --loss: var(--color-loss);
  --safe-top: env(safe-area-inset-top);
  --safe-bottom: env(safe-area-inset-bottom);
}

html.dark {
  --background: #1F1F1F;
  --foreground: #FAF7EE;
  --surface: #262626;
  --border: #333333;
  --profit: #3DCB80;
  --loss: #FF6B5B;
}

@layer base {
  body {
    background: var(--background);
    color: var(--foreground);
    font-family: var(--font-sans);
    padding-top: var(--safe-top);
    padding-bottom: var(--safe-bottom);
  }
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
```

Create `lib/theme/fonts.ts`:

```ts
import { Geist, Geist_Mono } from "next/font/google";

export const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
```

Create `lib/theme/theme-provider.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: "system", setTheme: () => {} });

export function ThemeProvider({ children, initial = "system" as Theme }: { children: ReactNode; initial?: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (t: Theme) => {
      const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
    };
    apply(theme);
    document.cookie = `theme=${theme}; path=/; max-age=31536000`;
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
```

---

## Step 2 — Update root layout

Replace `app/layout.tsx`:

```tsx
import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { geistMono, geistSans } from "@/lib/theme/fonts";
import { ThemeProvider } from "@/lib/theme/theme-provider";

export const metadata: Metadata = {
  title: "Poker Tracker",
  description: "Track your home poker games — buy-ins, cash-outs, leaderboard.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F6D40" },
    { media: "(prefers-color-scheme: dark)", color: "#0B5732" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme = (cookieStore.get("theme")?.value ?? "system") as "light" | "dark" | "system";

  return (
    <html lang="en" suppressHydrationWarning className={theme === "dark" ? "dark" : undefined}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

---

## Step 3 — Install shadcn primitives

```bash
pnpm dlx shadcn@latest add \
  button input label select textarea \
  card sheet dialog drawer alert-dialog \
  table tabs badge avatar tooltip \
  dropdown-menu separator skeleton \
  switch toggle scroll-area popover progress \
  form
```

After install, harmonize tap-target sizes. Edit `components/ui/button.tsx`:

```tsx
// Locate the size variants and update:
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90",
        destructive: "bg-[var(--loss)] text-white hover:opacity-90",
        outline: "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface)]/70",
        ghost: "hover:bg-[var(--surface)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",      // 44px tap target
        sm: "h-9 px-3",
        lg: "h-12 px-6",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

Apply similar `h-11` minimums to `Input`, `Select` triggers.

---

## Step 4 — Shared components

Create `components/shared/money-amount.tsx`:

```tsx
import { type Paise } from "@/lib/modules/core";
import { cn } from "@/lib/utils";

const formatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function MoneyAmount({
  value, variant = "neutral", size = "md", className,
}: {
  value: number;            // Paise
  variant?: "profit" | "loss" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const rupees = value / 100;
  const colorClass =
    variant === "profit" ? "text-[var(--profit)]" :
    variant === "loss"   ? "text-[var(--loss)]" : "text-[var(--foreground)]";
  const sizeClass = { sm: "text-sm", md: "text-base", lg: "text-2xl font-semibold" }[size];
  return (
    <span className={cn("font-mono tabular-nums", colorClass, sizeClass, className)}>
      {formatter.format(rupees)}
    </span>
  );
}
```

Create `components/shared/chip-amount.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function ChipAmount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {value.toLocaleString("en-IN")} chips
    </span>
  );
}
```

Create `components/shared/player-avatar.tsx`:

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function PlayerAvatar({ user, size = "md" }: { user: { nickname: string; avatarUrl?: string }; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base" };
  const initials = user.nickname.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Avatar className={sizes[size]}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.nickname} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
```

Create `components/shared/player-row.tsx`:

```tsx
import { type ReactNode } from "react";
import { PlayerAvatar } from "./player-avatar";

export function PlayerRow({
  user, amount, hint,
}: {
  user: { nickname: string; avatarUrl?: string };
  amount: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3">
        <PlayerAvatar user={user} size="sm" />
        <div>
          <div className="font-medium">{user.nickname}</div>
          {hint && <div className="text-xs text-[var(--foreground)]/60">{hint}</div>}
        </div>
      </div>
      <div>{amount}</div>
    </div>
  );
}
```

Create `components/shared/empty-state.tsx`:

```tsx
import { type ReactNode } from "react";

export function EmptyState({ icon, title, description, cta }: { icon?: ReactNode; title: string; description?: string; cta?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 gap-3 text-[var(--foreground)]/70">
      {icon && <div className="text-4xl">{icon}</div>}
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
      {description && <p className="text-sm">{description}</p>}
      {cta}
    </div>
  );
}
```

Create `components/shared/error-state.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center p-8 gap-3">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-[var(--foreground)]/70">{error.message}</p>
      {retry && <Button onClick={retry}>Try again</Button>}
    </div>
  );
}
```

Create `components/shared/loading-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton({ variant = "row" }: { variant?: "row" | "card" | "table" }) {
  if (variant === "card") return <Skeleton className="h-32 w-full rounded-lg" />;
  if (variant === "table") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }
  return <Skeleton className="h-10 w-full" />;
}
```

Create `components/shared/house-controls.tsx`:

```tsx
import type { ReactNode } from "react";

export function HouseControls({ isHouse, children }: { isHouse: boolean; children: ReactNode }) {
  if (!isHouse) return null;
  return <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">{children}</div>;
}
```

Create `components/shared/confirm-dialog.tsx`:

```tsx
"use client";

import { type ReactNode } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function ConfirmDialog({
  trigger, title, description, confirmLabel = "Confirm", onConfirm, destructive = false,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={destructive ? "bg-[var(--loss)] text-white" : undefined}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## Step 5 — AppShell

Create `components/shared/app-shell.tsx`:

```tsx
import Link from "next/link";
import { type ReactNode } from "react";
import { ScrollIcon, TrophyIcon, UserIcon, SettingsIcon } from "lucide-react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col">
      <TopBar />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-4 pb-24 lg:pb-4">{children}</main>
      <BottomNav />
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="mx-auto max-w-3xl px-4 h-12 flex items-center justify-between">
        <Link href="/sessions" className="font-semibold tracking-tight">Poker Tracker</Link>
        <nav className="hidden lg:flex items-center gap-4 text-sm">
          <Link href="/sessions">Sessions</Link>
          <Link href="/leaderboard">Board</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] lg:hidden pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        <NavItem href="/sessions" icon={<ScrollIcon className="size-5" />} label="Sessions" />
        <NavItem href="/leaderboard" icon={<TrophyIcon className="size-5" />} label="Board" />
        <NavItem href="/profile" icon={<UserIcon className="size-5" />} label="Profile" />
        <NavItem href="/settings" icon={<SettingsIcon className="size-5" />} label="Settings" />
      </ul>
    </nav>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <li>
      <Link href={href} className="flex flex-col items-center justify-center gap-1 py-3 text-xs text-[var(--foreground)]/80 hover:text-[var(--foreground)]">
        {icon}{label}
      </Link>
    </li>
  );
}
```

---

## Step 6 — UI kit demo page (development only)

Create `app/(internal)/ui-kit/page.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyAmount } from "@/components/shared/money-amount";
import { ChipAmount } from "@/components/shared/chip-amount";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { PlayerRow } from "@/components/shared/player-row";
import { EmptyState } from "@/components/shared/empty-state";

export default function UIKitPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">UI kit</h1>

      <Card>
        <CardHeader><CardTitle>Buttons</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Money</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          <MoneyAmount value={50000} variant="profit" size="lg" />
          <MoneyAmount value={-30000} variant="loss" />
          <MoneyAmount value={0} />
          <ChipAmount value={50000} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Player rows</CardTitle></CardHeader>
        <CardContent>
          <PlayerRow user={{ nickname: "Aman" }} amount={<MoneyAmount value={50000} variant="profit" />} hint="2 sessions" />
          <PlayerRow user={{ nickname: "Ravi" }} amount={<MoneyAmount value={-20000} variant="loss" />} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Empty / inputs</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Email" />
          <EmptyState title="No sessions yet" description="Create one to get started." />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Acceptance checklist

- [ ] `lib/theme/{tokens,fonts,theme-provider}.ts(x)` exist.
- [ ] `app/globals.css` updated with the `@theme` block.
- [ ] `app/layout.tsx` uses `ThemeProvider` and Geist fonts.
- [ ] All shadcn primitives listed installed under `components/ui/**`.
- [ ] Button height = 44px default; `Input`, `Select` similar.
- [ ] All shared components in `components/shared/**` exist and render in `/ui-kit`.
- [ ] `AppShell` renders correctly on mobile (375 px) and desktop (1280 px).
- [ ] Theme cookie persists `light|dark|system` and applies on reload without flash.
- [ ] Lighthouse a11y score ≥ 95 on `/ui-kit`.
- [ ] No raw hex colors in any component file (everything via tokens).
- [ ] No raw money formatting — every paise value renders through `<MoneyAmount>`.
- [ ] `pnpm typecheck` and `pnpm lint` pass.

When all boxes green, commit as `feat: design system + shared components + AppShell`.
