'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'install-dismissed';

// `useSyncExternalStore` lets us derive client-only state without calling
// `setState` synchronously inside `useEffect`, which keeps the
// `react-hooks/set-state-in-effect` lint rule happy and avoids hydration
// mismatches: SSR sees `false`, the client picks up the real value on mount.
function noopSubscribe() {
  return () => {};
}

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISMISSED_KEY) === '1';
}

function readIosHint(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari iOS legacy flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

function ssrFalse() {
  return false;
}

export function InstallButton() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  const dismissed = useSyncExternalStore(noopSubscribe, readDismissed, ssrFalse);
  const iosHint = useSyncExternalStore(noopSubscribe, readIosHint, ssrFalse);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => {
      window.localStorage.setItem(DISMISSED_KEY, '1');
      setEvt(null);
      setHidden(true);
    };
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const hide = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    }
    setHidden(true);
  }, []);

  const onInstall = useCallback(async () => {
    if (!evt) return;
    await evt.prompt();
    try {
      await evt.userChoice;
    } finally {
      setEvt(null);
    }
  }, [evt]);

  if (hidden || dismissed) return null;

  if (evt) {
    return (
      <div className="border-border bg-card flex items-center justify-between gap-3 rounded-lg border p-3">
        <span className="text-sm">Install Poker Tracker on your device</span>
        <div className="flex gap-2">
          <Button size="sm" onClick={onInstall}>
            Install
          </Button>
          <Button size="sm" variant="ghost" onClick={hide}>
            Hide
          </Button>
        </div>
      </div>
    );
  }

  if (iosHint) {
    return (
      <div className="border-border bg-card flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
        <span>
          Tap <span className="font-medium">Share</span> →{' '}
          <span className="font-medium">Add to Home Screen</span> to install Poker Tracker.
        </span>
        <Button size="sm" variant="ghost" onClick={hide}>
          Hide
        </Button>
      </div>
    );
  }

  return null;
}

export default InstallButton;
