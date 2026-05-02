'use client';

import { useTransition } from 'react';

import { MoneyAmount } from '@/components/shared/money-amount';
import { Button } from '@/components/ui/button';

import { confirmCashoutAction } from '../actions';

export type PendingCashout = {
  id: string;
  userId: string;
  nickname: string;
  amount: number;
};

export function ConfirmCashoutsList({
  sessionId,
  pending,
}: {
  sessionId: string;
  pending: PendingCashout[];
}) {
  const [isPending, startTransition] = useTransition();

  if (pending.length === 0) {
    return <p className="text-sm text-[var(--foreground)]/70">No pending cash-outs.</p>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Pending cash-outs</h3>
      <ul className="divide-y divide-[var(--border)]">
        {pending.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2">
            <div className="text-sm">
              <span className="font-medium">{c.nickname}</span>
              <span className="ml-2">
                <MoneyAmount value={c.amount} size="sm" />
              </span>
            </div>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await confirmCashoutAction(c.id, sessionId);
                })
              }
            >
              Confirm
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
