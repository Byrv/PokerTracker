import { Badge } from '@/components/ui/badge';
import { ChipAmount } from '@/components/shared/chip-amount';
import { MoneyAmount } from '@/components/shared/money-amount';

import { EditBuyinDialog } from './edit-buyin-dialog';
import { EditCashoutDialog } from './edit-cashout-dialog';

export type BuyinAdminRow = {
  id: string;
  userId: string;
  nickname: string;
  amountPaise: number;
  recordedAt: string;
};

export type CashoutAdminRow = {
  id: string;
  userId: string;
  nickname: string;
  chipCount: number;
  amountPaise: number;
  status: 'pending' | 'confirmed';
};

/**
 * House admin panel: list every buyin and cashout in the session with
 * Edit affordances. Buyin edits go through a confirm step (destructive
 * by default — every edit is auditable). Cashout edits preserve status.
 */
export function LedgerAdminPanel({
  sessionId,
  buyins,
  cashouts,
  chipsPerPaise,
}: {
  sessionId: string;
  buyins: BuyinAdminRow[];
  cashouts: CashoutAdminRow[];
  chipsPerPaise: number;
}) {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">All buy-ins</h3>
        {buyins.length === 0 ? (
          <p className="text-sm text-[var(--foreground)]/70">No buy-ins yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {buyins.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <div className="text-sm">
                  <span className="font-medium">{b.nickname}</span>
                  <span className="ml-2">
                    <MoneyAmount value={b.amountPaise} size="sm" />
                  </span>
                </div>
                <EditBuyinDialog
                  buyinId={b.id}
                  sessionId={sessionId}
                  nickname={b.nickname}
                  currentAmountPaise={b.amountPaise}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">All cash-outs</h3>
        {cashouts.length === 0 ? (
          <p className="text-sm text-[var(--foreground)]/70">No cash-outs yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {cashouts.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{c.nickname}</span>
                  <span className="font-mono tabular-nums">
                    <ChipAmount value={c.chipCount} size="sm" /> ·{' '}
                    <MoneyAmount value={c.amountPaise} size="sm" />
                  </span>
                  <Badge variant={c.status === 'confirmed' ? 'secondary' : 'outline'}>
                    {c.status}
                  </Badge>
                </div>
                <EditCashoutDialog
                  cashoutId={c.id}
                  sessionId={sessionId}
                  userId={c.userId}
                  nickname={c.nickname}
                  currentChipCount={c.chipCount}
                  chipsPerPaise={chipsPerPaise}
                  wasConfirmed={c.status === 'confirmed'}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
