import Papa from 'papaparse';
import type { DbBoundary } from '@/lib/db/boundary';
import { requireUser } from './permission';
import { getSessionPlayerRows, paiseToInrString } from './data';

/**
 * One CSV row per (closed-session, participant) where the participant is the
 * current user. The friend-group history is shared, but Phase 1 keeps the
 * surface conservative: a user can only export their own per-session results.
 */
export async function exportFullHistoryCSV(b: DbBoundary): Promise<Blob> {
  const me = await requireUser(b);
  const closed = await b.sessions.list({ status: 'closed' });

  const rowObjects: Array<Record<string, string | number>> = [];
  for (const session of closed) {
    const players = await getSessionPlayerRows(b, session);
    const mine = players.find((p) => p.userId === me.userId);
    if (!mine) continue;
    rowObjects.push({
      session_id: session.id,
      played_on: session.played_on,
      name: session.name ?? '',
      location: session.location ?? '',
      user_id: mine.userId,
      nickname: mine.nickname,
      total_buyins_paise: mine.totalBuyinsPaise,
      cashout_paise: mine.cashoutPaise,
      net_paise: mine.netPaise,
      total_buyins_inr: paiseToInrString(mine.totalBuyinsPaise),
      cashout_inr: paiseToInrString(mine.cashoutPaise),
      net_inr: paiseToInrString(mine.netPaise),
    });
  }

  const columns = [
    'session_id',
    'played_on',
    'name',
    'location',
    'user_id',
    'nickname',
    'total_buyins_paise',
    'cashout_paise',
    'net_paise',
    'total_buyins_inr',
    'cashout_inr',
    'net_inr',
  ];

  // Papa.unparse on an empty array still emits an empty string; force the
  // header row so consumers always get a parseable CSV.
  const csv =
    rowObjects.length === 0
      ? Papa.unparse({ fields: columns, data: [] })
      : Papa.unparse(rowObjects, { columns });

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}
