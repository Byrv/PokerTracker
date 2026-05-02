import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import * as exportMod from '@/lib/modules/export';
import { asSessionId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '../../helpers/fixtures';
import { createFakeBoundary } from '../../helpers/fakeBoundary';
import { seedSession } from './helpers';

describe('export/csv-session', () => {
  it('produces a parseable CSV with the expected per-player rows', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await seedSession(b);
    b.__setCurrentUser('u-aman');

    const e = exportMod.withBoundary(b);
    const blob = await e.exportSessionCSV(asSessionId(session.id));

    expect(blob.type).toContain('text/csv');
    const text = await blob.text();

    // Header block precedes the table.
    expect(text).toContain(`# session_id,${session.id}`);
    expect(text).toContain('# played_on,2025-04-12');

    // Strip the leading metadata comment lines to reach the actual CSV body.
    const tableText = text
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .join('\n')
      .trim();

    const parsed = Papa.parse<Record<string, string>>(tableText, {
      header: true,
      skipEmptyLines: true,
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.meta.fields).toEqual([
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
    ]);

    const rows = parsed.data;
    expect(rows).toHaveLength(3);

    const aman = rows.find((r) => r.user_id === 'u-aman');
    expect(aman).toBeDefined();
    expect(aman!.total_buyins_paise).toBe('50000');
    expect(aman!.cashout_paise).toBe('80000');
    expect(aman!.net_paise).toBe('30000');
    expect(aman!.net_inr).toBe('300.00');

    const ravi = rows.find((r) => r.user_id === 'u-ravi');
    expect(ravi!.total_buyins_paise).toBe('100000');
    expect(ravi!.cashout_paise).toBe('40000');
    expect(ravi!.net_paise).toBe('-60000');

    const priya = rows.find((r) => r.user_id === 'u-priya');
    expect(priya!.total_buyins_paise).toBe('50000');
    expect(priya!.cashout_paise).toBe('80000');
    expect(priya!.net_paise).toBe('30000');

    // Reconciliation: nets sum to zero on a balanced session.
    const sumNets = rows.reduce((a, r) => a + Number(r.net_paise), 0);
    expect(sumNets).toBe(0);
  });

  it('rejects a non-participant for a session export', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await seedSession(b);

    // Karan is in FIXTURE_USERS but never joined this session.
    b.__setCurrentUser('u-karan');
    const e = exportMod.withBoundary(b);
    await expect(e.exportSessionCSV(asSessionId(session.id))).rejects.toThrow('forbidden');
  });

  it('rejects an unauthenticated caller', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await seedSession(b);
    b.__setCurrentUser(null);

    const e = exportMod.withBoundary(b);
    await expect(e.exportSessionCSV(asSessionId(session.id))).rejects.toThrow('not_authenticated');
  });
});

describe('export/csv-history', () => {
  it('returns just a header row when the user has no closed sessions', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const e = exportMod.withBoundary(b);
    const blob = await e.exportFullHistoryCSV();
    const text = await blob.text();
    // papaparse emits CRLF by default; strip trailing \r before comparing.
    expect(text.split('\n')[0]?.replace(/\r$/, '')).toBe(
      [
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
      ].join(','),
    );
  });

  it('emits one row per closed session for the current user', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    await seedSession(b, { sessionName: 'Game One' });
    await seedSession(b, { sessionName: 'Game Two' });

    b.__setCurrentUser('u-aman');
    const e = exportMod.withBoundary(b);
    const blob = await e.exportFullHistoryCSV();
    const text = await blob.text();

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toHaveLength(2);
    for (const row of parsed.data) {
      expect(row.user_id).toBe('u-aman');
      expect(row.net_paise).toBe('30000');
    }
  });

  it('rejects an unauthenticated caller for full history', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    await seedSession(b);
    b.__setCurrentUser(null);

    const e = exportMod.withBoundary(b);
    await expect(e.exportFullHistoryCSV()).rejects.toThrow('not_authenticated');
  });
});
