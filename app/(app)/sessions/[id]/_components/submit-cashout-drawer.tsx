'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { submitCashoutAction } from '../actions';

export function SubmitCashoutDrawer({
  sessionId,
  userId,
  chipsPerPaise,
}: {
  sessionId: string;
  userId: string;
  chipsPerPaise: number;
}) {
  const [open, setOpen] = useState(false);
  const [chips, setChips] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const previewPaise = Number.isFinite(chips) && chips > 0 ? chips * chipsPerPaise : 0;
  const previewRupees = previewPaise / 100;

  function submit() {
    if (!Number.isFinite(chips) || chips < 0) {
      setError('Enter a non-negative chip count.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitCashoutAction({ sessionId, userId, chipCount: Math.round(chips) });
        setOpen(false);
        setChips(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to submit cashout.');
      }
    });
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="w-full">Submit your cashout</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Cashout</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-3 p-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="cashout-chips">Final chip count</Label>
            <Input
              id="cashout-chips"
              type="number"
              inputMode="numeric"
              min={0}
              value={chips}
              onChange={(e) => setChips(Number(e.target.value))}
            />
            <p className="text-xs text-[var(--foreground)]/70">
              ≈ ₹{previewRupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
          </div>
          {error ? <p className="text-sm text-[var(--loss)]">{error}</p> : null}
          <Button className="w-full" onClick={submit} disabled={isPending}>
            {isPending ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
