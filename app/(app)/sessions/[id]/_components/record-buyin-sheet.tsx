'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

import { recordBuyinAction } from '../actions';

export type Participant = { id: string; nickname: string };

export function RecordBuyinSheet({
  sessionId,
  participants,
}: {
  sessionId: string;
  participants: Participant[];
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [rupees, setRupees] = useState<number>(500);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setUserId(null);
    setRupees(500);
    setError(null);
  }

  function submit() {
    if (!userId) {
      setError('Pick a player.');
      return;
    }
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError('Enter a positive amount.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await recordBuyinAction({
          sessionId,
          userId,
          amountPaise: Math.round(rupees * 100),
        });
        setOpen(false);
        reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to record buy-in.');
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <SheetTrigger render={<Button>Record buy-in</Button>} />
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto pb-6">
        <SheetHeader>
          <SheetTitle>Record buy-in</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="buyin-player">Player</Label>
            <Select
              value={userId ?? ''}
              onValueChange={(value) => setUserId(value === '' ? null : (value as string))}
            >
              <SelectTrigger id="buyin-player" className="w-full">
                <SelectValue placeholder="Pick a player" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nickname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyin-amount">Amount (₹)</Label>
            <Input
              id="buyin-amount"
              type="number"
              inputMode="numeric"
              min={1}
              value={rupees}
              onChange={(e) => setRupees(Number(e.target.value))}
            />
          </div>
          {error ? <p className="text-sm text-[var(--loss)]">{error}</p> : null}
          <Button className="w-full" onClick={submit} disabled={isPending || !userId}>
            {isPending ? 'Recording…' : 'Record'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
