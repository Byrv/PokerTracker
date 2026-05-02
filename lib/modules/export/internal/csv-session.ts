import Papa from 'papaparse';
import type { DbBoundary } from '@/lib/db/boundary';
import { assertSessionAccess } from './permission';
import { getSessionPlayerRows, paiseToInrString } from './data';

/**
 * Build a CSV blob for a single session containing a header block (session
 * metadata) followed by per-user ledger rows.
 *
 * Columns (per-user rows):
 *   session_id, played_on, user_id, nickname,
 *   total_buyins_paise, cashout_paise, net_paise,
 *   total_buyins_inr, cashout_inr, net_inr
 */
export async function exportSessionCSV(b: DbBoundary, sessionId: string): Promise<Blob> {
  await assertSessionAccess(b, sessionId);

  const session = await b.sessions.get(sessionId);
  if (!session) throw new Error('session_not_found');

  const rows = await getSessionPlayerRows(b, session);

  const playerObjects = rows.map((r) => ({
    session_id: session.id,
    played_on: session.played_on,
    user_id: r.userId,
    nickname: r.nickname,
    total_buyins_paise: r.totalBuyinsPaise,
    cashout_paise: r.cashoutPaise,
    net_paise: r.netPaise,
    total_buyins_inr: paiseToInrString(r.totalBuyinsPaise),
    cashout_inr: paiseToInrString(r.cashoutPaise),
    net_inr: paiseToInrString(r.netPaise),
  }));

  const playerCsv = Papa.unparse(playerObjects, {
    columns: [
      'session_id',
      'played_on',
      'user_id',
      'nickname',
      'total_buyins_paise',
      'cashout_paise',
      'net_paise',
      'total_buyins_inr',
      'cashout_inr',
      'net_inr',
    ],
  });

  // A short metadata header block prepended to the per-user rows.
  const headerLines = [
    `# session_id,${session.id}`,
    `# played_on,${session.played_on}`,
    `# name,${session.name ?? ''}`,
    `# location,${session.location ?? ''}`,
    `# blinds_small_paise,${session.blinds_small}`,
    `# blinds_big_paise,${session.blinds_big}`,
    `# chips_per_paise,${session.chips_per_paise}`,
    `# status,${session.status}`,
    '',
  ].join('\n');

  return new Blob([headerLines + playerCsv], { type: 'text/csv;charset=utf-8;' });
}
