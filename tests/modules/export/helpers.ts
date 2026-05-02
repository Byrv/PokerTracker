import type { DbBoundary } from '@/lib/db/boundary';

/**
 * Seed a small session through the fake boundary so each export test starts
 * from the same shape: 3 participants, mixed buy-ins, cashouts upserted with
 * 1:1 chips-per-paise ratio (boundary default).
 */
export async function seedSession(
  b: DbBoundary & { __setCurrentUser: (id: string | null) => void },
  options: {
    creatorId?: string;
    sessionName?: string;
    blindsSmallPaise?: number;
    blindsBigPaise?: number;
  } = {},
) {
  const creatorId = options.creatorId ?? 'u-aman';

  // Create the session as the creator.
  b.__setCurrentUser(creatorId);
  const session = await b.sessions.create({
    created_by: creatorId,
    name: options.sessionName ?? 'Friday Night',
    location: 'Aman home',
    played_on: '2025-04-12',
    blinds_small: options.blindsSmallPaise ?? 100,
    blinds_big: options.blindsBigPaise ?? 200,
    chips_per_paise: 1,
  });

  // Ravi & Priya join via invite.
  b.__setCurrentUser('u-ravi');
  await b.auth.joinSessionWithToken(session.invite_token);
  b.__setCurrentUser('u-priya');
  await b.auth.joinSessionWithToken(session.invite_token);

  // Aman records buy-ins for everyone.
  b.__setCurrentUser(creatorId);
  await b.buyins.create({
    session_id: session.id,
    user_id: 'u-aman',
    amount_paise: 50_000,
    chips: 50_000,
    recorded_by: creatorId,
  });
  await b.buyins.create({
    session_id: session.id,
    user_id: 'u-ravi',
    amount_paise: 50_000,
    chips: 50_000,
    recorded_by: creatorId,
  });
  await b.buyins.create({
    session_id: session.id,
    user_id: 'u-ravi',
    amount_paise: 50_000,
    chips: 50_000,
    recorded_by: creatorId,
  });
  await b.buyins.create({
    session_id: session.id,
    user_id: 'u-priya',
    amount_paise: 50_000,
    chips: 50_000,
    recorded_by: creatorId,
  });

  // Cashouts (chip = paise → 1:1).
  await b.cashouts.upsert({
    session_id: session.id,
    user_id: 'u-aman',
    chip_count: 80_000,
    amount_paise: 0,
    submitted_by: creatorId,
  });
  await b.cashouts.upsert({
    session_id: session.id,
    user_id: 'u-ravi',
    chip_count: 40_000,
    amount_paise: 0,
    submitted_by: creatorId,
  });
  await b.cashouts.upsert({
    session_id: session.id,
    user_id: 'u-priya',
    chip_count: 80_000,
    amount_paise: 0,
    submitted_by: creatorId,
  });

  // Confirm all and close.
  const cashouts = await b.cashouts.listForSession(session.id);
  for (const c of cashouts) await b.cashouts.confirm(c.id, creatorId);
  await b.sessions.update(session.id, { status: 'closed', closed_at: new Date().toISOString() });

  return session;
}
