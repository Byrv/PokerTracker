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

import { editBuyinAction } from '../actions';

/**
 * House-only buyin editor. Two-step flow: open the dialog with the current
 * ₹ amount pre-filled, edit, then a final confirm gates the destructive
 * mutation. Uses a single Dialog with an inline confirm step rather than
 * stacked Dialog + AlertDialog (which base-ui handles awkwardly).
 */
export function EditBuyinDialog({
  buyinId,
  sessionId,
  nickname,
  currentAmountPaise,
}: {
  buyinId: string;
  sessionId: string;
  nickname: string;
  currentAmountPaise: number;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rupees, setRupees] = useState<number>(currentAmountPaise / 100);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setConfirming(false);
    setRupees(currentAmountPaise / 100);
    setError(null);
  };

  const requestConfirm = () => {
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError('Enter a positive amount.');
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const submit = () => {
    startTransition(async () => {
      try {
        await editBuyinAction({
          buyinId,
          sessionId,
          amountPaise: Math.round(rupees * 100),
        });
        setOpen(false);
        reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to edit buyin.');
        setConfirming(false);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
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
          <DialogTitle>Edit buyin for {nickname}</DialogTitle>
          <DialogDescription>
            {confirming
              ? `Confirm: change ${nickname}'s buyin from ₹${(currentAmountPaise / 100).toLocaleString('en-IN')} to ₹${rupees.toLocaleString('en-IN')}?`
              : 'Editing a buyin updates the ledger and is recorded in the audit log.'}
          </DialogDescription>
        </DialogHeader>
        {!confirming ? (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-buyin-${buyinId}`}>Amount (₹)</Label>
              <Input
                id={`edit-buyin-${buyinId}`}
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={rupees}
                onChange={(e) => setRupees(Number(e.target.value))}
              />
            </div>
            {error ? <p className="text-sm text-[var(--loss)]">{error}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={isPending}>
                Back
              </Button>
              <Button onClick={submit} disabled={isPending}>
                {isPending ? 'Saving…' : 'Yes, edit'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={requestConfirm}>Continue</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
