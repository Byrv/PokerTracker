'use client';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';

/**
 * Catalog wrapper for ConfirmDialog. The dialog needs an `onConfirm`
 * function — closures can't cross the server/client boundary, so we
 * keep the demo in a client component.
 */
export function ConfirmDialogDemo() {
  return (
    <ConfirmDialog
      trigger={<Button variant="destructive">Close session</Button>}
      title="Close this session?"
      description="Players can no longer add buy-ins. Cash-outs may still be recorded."
      confirmLabel="Close session"
      destructive
      onConfirm={() => {
        /* demo only */
      }}
    />
  );
}
