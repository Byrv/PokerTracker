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

const subscribe = () => () => {};
const getSnapshot = () => 'client';
const getServerSnapshot = () => 'server';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

/**
 * Settings-scoped theme picker. Mirrors the ui-kit implementation but is its
 * own copy so we don't couple this page to the internal route. Persists the
 * user choice in the `theme` cookie that `ThemeInit` reads pre-paint.
 */
export function SettingsThemeToggle() {
  const [mode, setMode] = useState<Mode>(readPreferred);
  const phase = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const mounted = phase === 'client';

  useEffect(() => {
    if (mounted) apply(mode);
  }, [mode, mounted]);

  if (!mounted) {
    return <div aria-hidden className="h-9 w-full max-w-sm" />;
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex flex-wrap items-center gap-2">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <Button
            key={value}
            type="button"
            variant={active ? 'secondary' : 'outline'}
            size="sm"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setMode(value)}
            className={cn(active && 'ring-foreground/20 ring-1')}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Button>
        );
      })}
    </div>
  );
}
