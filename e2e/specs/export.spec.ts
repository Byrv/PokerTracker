import { test } from '@playwright/test';

/**
 * CSV / PDF export. Owned by the session-pages agent (export buttons live on
 * the session detail page once the session is closed).
 */
test.describe('export', () => {
  test.fixme('CSV download from a closed session has the expected rows', async () => {
    // pending: session-pages agent.
  });

  test.fixme('PDF download is non-empty and has the right MIME', async () => {
    // pending: session-pages agent.
  });

  test.fixme('non-participant gets 403 / hidden CTA', async () => {
    // pending: session-pages agent.
  });
});
