'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Mode = 'light' | 'dark' | 'system';

function readPreferred(): Mode {
  if (typeof document === 'undefined') return 'system';
  const cookie = document.cookie.split('; ').find((c) => c.startsWith('theme='));
  const value = cookie?.split('=')[1];
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function apply(mode: Mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark =
    mode === 'dark' ||
    (mode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', prefersDark);
  document.cookie = `theme=${mode}; path=/; max-age=31536000`;
}

// Subscribe-free external store: emits "client" once mounted. This lets us
// gate the render on hydration without writing to state inside an effect
// (which the `react-hooks/set-state-in-effect` rule flags).
const subscribe = () => () => {};
const getSnapshot = () => 'client';
const getServerSnapshot = () => 'server';

/**
 * Compact light/dark/system toggle used on the UI kit page so reviewers
 * can sanity-check both palettes without wiring a global provider here.
 *
 * Initial state is computed once via the lazy initialiser (which returns
 * `'system'` during SSR, the cookie value on the client). We render a
 * placeholder until mounted to avoid hydration mismatch.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(readPreferred);
  const phase = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const mounted = phase === 'client';

  useEffect(() => {
    if (mounted) apply(mode);
  }, [mode, mounted]);

  if (!mounted) {
    // Reserve the layout slot so the toggle doesn't pop in.
    return <div aria-hidden className="h-8 w-[200px]" />;
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex items-center gap-1">
      {(
        [
          { value: 'light', label: 'Light', Icon: Sun },
          { value: 'dark', label: 'Dark', Icon: Moon },
          { value: 'system', label: 'System', Icon: Monitor },
        ] as const
      ).map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <Button
            key={value}
            variant={active ? 'secondary' : 'ghost'}
            size="sm"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setMode(value)}
            className={cn(active && 'ring-foreground/20 ring-1')}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        );
      })}
    </div>
  );
}
