import { test } from '@playwright/test';

/**
 * Ledger-edit + audit-log checks. All flow through the session detail page.
 */
test.describe('ledger edits', () => {
  test.fixme('house edits a buy-in mid-session — audit log shows before/after', async () => {
    // pending: session-pages agent.
  });

  test.fixme('house deletes a buy-in — audit log shows the deletion', async () => {
    // pending: session-pages agent.
  });

  test.fixme('cashout edited after confirmation flips back to pending', async () => {
    // pending: session-pages agent.
  });

  test.fixme('discrepancy in reconciliation surfaces in the UI', async () => {
    // pending: session-pages agent.
  });
});
