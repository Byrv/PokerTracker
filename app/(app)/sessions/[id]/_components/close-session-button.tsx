'use client';

import { useTransition } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';

import { closeSessionAction } from '../actions';

export function CloseSessionButton({
  sessionId,
  canClose,
  reason,
}: {
  sessionId: string;
  canClose: boolean;
  reason?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <ConfirmDialog
        trigger={
          <Button variant="destructive" disabled={!canClose || isPending}>
            {isPending ? 'Closing…' : 'Close session'}
          </Button>
        }
        title="Close this session?"
        description="Final numbers will be locked and the session will appear in the leaderboard."
        confirmLabel="Close"
        destructive
        onConfirm={() =>
          startTransition(async () => {
            await closeSessionAction(sessionId);
          })
        }
      />
      {!canClose && reason ? <p className="text-xs text-[var(--foreground)]/70">{reason}</p> : null}
    </div>
  );
}
