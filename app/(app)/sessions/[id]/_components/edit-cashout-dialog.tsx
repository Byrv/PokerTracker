'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { editCashoutAction } from '../actions';

/**
 * House-only cashout editor. Pre-fills the current chip count, shows live
 * ₹ preview, and preserves status (re-confirms iff the cashout was already
 * confirmed when the dialog opened).
 */
export function EditCashoutDialog({
  cashoutId,
  sessionId,
  userId,
  nickname,
  currentChipCount,
  chipsPerPaise,
  wasConfirmed,
}: {
  cashoutId: string;
  sessionId: string;
  userId: string;
  nickname: string;
  currentChipCount: number;
  chipsPerPaise: number;
  wasConfirmed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [chips, setChips] = useState<number>(currentChipCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const previewPaise = Number.isFinite(chips) && chips > 0 ? chips * chipsPerPaise : 0;
  const previewRupees = previewPaise / 100;

  const submit = () => {
    if (!Number.isFinite(chips) || chips < 0) {
      setError('Enter a non-negative chip count.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await editCashoutAction({
          cashoutId,
          sessionId,
          userId,
          chipCount: Math.round(chips),
          wasConfirmed,
        });
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to edit cashout.');
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setChips(currentChipCount);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit cashout for {nickname}</DialogTitle>
          <DialogDescription>
            {wasConfirmed
              ? 'Cashout will stay confirmed after editing.'
              : 'Cashout will remain pending after editing.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor={`edit-cashout-${cashoutId}`}>Final chip count</Label>
            <Input
              id={`edit-cashout-${cashoutId}`}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
