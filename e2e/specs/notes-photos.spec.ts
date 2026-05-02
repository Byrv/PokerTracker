import { test } from '@playwright/test';

/**
 * Notes + photos. Owned by the session-pages agent (notes/photos UI lives on
 * the session detail page).
 */
test.describe('notes + photos', () => {
  test.fixme('participant adds a note; another participant sees it', async () => {
    // pending: session-pages agent.
  });

  test.fixme('author can edit + delete; non-author cannot', async () => {
    // pending: session-pages agent.
  });

  test.fixme('photo upload appears in gallery; oversize is rejected', async () => {
    // pending: session-pages agent + media module wiring.
  });
});
