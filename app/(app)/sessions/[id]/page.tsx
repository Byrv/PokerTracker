import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ChipAmount } from '@/components/shared/chip-amount';
import { HouseControls } from '@/components/shared/house-controls';
import { MoneyAmount } from '@/components/shared/money-amount';
import { PlayerAvatar } from '@/components/shared/player-avatar';
import { PlayerRow } from '@/components/shared/player-row';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getModules } from '@/lib/modules';
import { asSessionId, type UserId } from '@/lib/modules/core';

import { CloseSessionButton } from './_components/close-session-button';
import { ConfirmCashoutsList } from './_components/confirm-cashouts-list';
import { LedgerAdminPanel } from './_components/ledger-admin-panel';
import { RecordBuyinSheet } from './_components/record-buyin-sheet';
import { SessionTabs } from './_components/session-tabs';
import { SubmitCashoutDrawer } from './_components/submit-cashout-drawer';

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessions, ledger, media, auth, profiles } = await getModules();

  const me = await auth.requireUser();

  const session = await sessions.getSession(asSessionId(id)).catch(() => null);
  if (!session) notFound();

  const [buyins, cashouts, sessionLedger, recon, notes, photos, audit] = await Promise.all([
    ledger.listBuyins(session.id),
    ledger.listCashouts(session.id),
    ledger.getSessionLedger(session.id),
    ledger.getReconciliation(session.id),
    media.listNotes(session.id),
    media.listPhotos(session.id),
    ledger.listAudit(session.id),
  ]);

  // Build a userId -> nickname map for participants + anyone showing up in
  // ledger / cashouts / audit (covers users who left the session).
  const userIds = new Set<UserId>();
  for (const p of session.participants) userIds.add(p);
  for (const row of sessionLedger) userIds.add(row.userId);
  for (const c of cashouts) userIds.add(c.userId);
  for (const b of buyins) userIds.add(b.userId);

  type UserMeta = { nickname: string; avatarUrl?: string };
  const profileEntries: Array<[UserId, UserMeta]> = await Promise.all(
    Array.from(userIds).map(async (uid): Promise<[UserId, UserMeta]> => {
      try {
        const p = await profiles.getProfile(uid);
        return [uid, { nickname: p.user.nickname, avatarUrl: p.user.avatarUrl }];
      } catch {
        return [uid, { nickname: uid.slice(0, 6) }];
      }
    }),
  );
  const nameByUser = new Map<UserId, UserMeta>(profileEntries);
  const nicknameOf = (uid: UserId) => nameByUser.get(uid)?.nickname ?? uid.slice(0, 6);
  const avatarOf = (uid: UserId) => nameByUser.get(uid)?.avatarUrl;

  const isHouse = session.createdBy === me.id;
  const allCashedOut =
    session.participants.length > 0 &&
    session.participants.every((uid) =>
      cashouts.some((c) => c.userId === uid && c.status === 'confirmed'),
    );
  const canClose = session.status === 'open' && recon.discrepancy === 0 && allCashedOut;

  let cantCloseReason: string | undefined;
  if (session.status === 'open' && !canClose) {
    if (!allCashedOut) cantCloseReason = 'All players must have a confirmed cashout first.';
    else if (recon.discrepancy !== 0)
      cantCloseReason = 'Reconciliation must be zero before closing.';
  }

  // The house IS a player too — they get auto-added as a participant on session
  // creation and submit their own cashout the same way everyone else does. Only
  // OPERATOR actions (recording buyins for others, confirming cashouts, closing)
  // are gated behind isHouse via HouseControls.
  const myCashout = cashouts.find((c) => c.userId === me.id);
  const showSubmitCashout =
    session.status === 'open' &&
    session.participants.includes(me.id) &&
    myCashout?.status !== 'confirmed';

  // Buy-in totals per user, for the ledger row hint.
  const buyinTotalByUser = new Map<UserId, number>();
  for (const b of buyins) {
    buyinTotalByUser.set(b.userId, (buyinTotalByUser.get(b.userId) ?? 0) + b.amount);
  }

  const pendingCashouts = cashouts
    .filter((c) => c.status === 'pending')
    .map((c) => ({
      id: c.id,
      userId: c.userId,
      nickname: nicknameOf(c.userId),
      amount: c.amount,
    }));

  const adminBuyins = buyins.map((b) => ({
    id: b.id,
    userId: b.userId as unknown as string,
    nickname: nicknameOf(b.userId),
    amountPaise: b.amount,
    recordedAt: b.recordedAt,
  }));
  const adminCashouts = cashouts.map((c) => ({
    id: c.id,
    userId: c.userId as unknown as string,
    nickname: nicknameOf(c.userId),
    chipCount: c.chipCount,
    amountPaise: c.amount,
    status: c.status,
  }));

  const participantOptions = session.participants.map((uid) => ({
    id: uid,
    nickname: nicknameOf(uid),
  }));

  const ledgerNode = (
    <>
      <Card>
        <CardContent className="divide-y divide-[var(--border)] p-4">
          {sessionLedger.length === 0 ? (
            <p className="text-sm text-[var(--foreground)]/70">No buy-ins yet.</p>
          ) : (
            sessionLedger.map((row) => {
              const totalBuyin = row.totalBuyinsPaise;
              return (
                <PlayerRow
                  key={row.userId}
                  user={{ nickname: nicknameOf(row.userId), avatarUrl: avatarOf(row.userId) }}
                  highlight={row.userId === me.id}
                  amount={
                    <MoneyAmount
                      value={row.netPaise}
                      variant={row.netPaise >= 0 ? 'profit' : 'loss'}
                      showSign
                    />
                  }
                  hint={
                    <span className="font-mono tabular-nums">
                      <MoneyAmount value={totalBuyin} size="sm" /> in /{' '}
                      <MoneyAmount value={row.cashoutPaise} size="sm" /> out
                    </span>
                  }
                />
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-medium">Reconciliation</div>
            <div className="text-xs text-[var(--foreground)]/70">
              Expected <MoneyAmount value={recon.expected} size="sm" /> · Actual{' '}
              <MoneyAmount value={recon.actual} size="sm" />
            </div>
          </div>
          <MoneyAmount
            value={recon.discrepancy}
            variant={recon.discrepancy === 0 ? 'profit' : 'loss'}
            showSign
          />
        </CardContent>
      </Card>

      <HouseControls isHouse={isHouse}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <RecordBuyinSheet sessionId={session.id} participants={participantOptions} />
            <CloseSessionButton
              sessionId={session.id}
              canClose={canClose}
              reason={cantCloseReason}
            />
          </div>
          <ConfirmCashoutsList sessionId={session.id} pending={pendingCashouts} />
          {session.status === 'open' ? (
            <LedgerAdminPanel
              sessionId={session.id}
              buyins={adminBuyins}
              cashouts={adminCashouts}
              chipsPerPaise={session.chipsPerPaise}
            />
          ) : null}
        </div>
      </HouseControls>

      {showSubmitCashout ? (
        <div className="pt-2">
          <SubmitCashoutDrawer
            sessionId={session.id}
            userId={me.id}
            chipsPerPaise={session.chipsPerPaise}
          />
          {myCashout?.status === 'pending' ? (
            <p className="pt-2 text-xs text-[var(--foreground)]/70">
              Cashout submitted — waiting for the house to confirm{' '}
              <ChipAmount value={myCashout.chipCount} size="sm" />.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const notesNode =
    notes.length === 0 ? (
      <p className="text-sm text-[var(--foreground)]/70">No notes yet.</p>
    ) : (
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id}>
            <Card>
              <CardContent className="space-y-1 p-4">
                <div className="flex items-center gap-2">
                  <PlayerAvatar
                    user={{
                      nickname: nicknameOf(n.authorUserId),
                      avatarUrl: avatarOf(n.authorUserId),
                    }}
                    size="sm"
                  />
                  <span className="text-sm font-medium">{nicknameOf(n.authorUserId)}</span>
                  <span className="text-xs text-[var(--foreground)]/60">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    );

  const photosNode =
    photos.length === 0 ? (
      <p className="text-sm text-[var(--foreground)]/70">No photos yet.</p>
    ) : (
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-lg ring-1 ring-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption ?? 'session photo'}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
          </li>
        ))}
      </ul>
    );

  const auditNode =
    audit.length === 0 ? (
      <p className="text-sm text-[var(--foreground)]/70">No audit entries yet.</p>
    ) : (
      <ul className="space-y-2">
        {audit.map((a) => (
          <li key={a.id} className="rounded-md border border-[var(--border)] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{a.action}</span>
              <span className="text-[var(--foreground)]/60">
                {new Date(a.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-0.5 text-[var(--foreground)]/70">by {nicknameOf(a.actor)}</div>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <Link href="/sessions" className="text-xs text-[var(--foreground)]/60 hover:underline">
            ← All sessions
          </Link>
          <span
            className={
              session.status === 'open'
                ? 'rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-medium ring-1 ring-[var(--accent)]'
                : 'rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-medium ring-1 ring-[var(--border)]'
            }
          >
            {session.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
        <h1 className="text-xl font-semibold">{session.name ?? `Session ${session.playedOn}`}</h1>
        <p className="text-sm text-[var(--foreground)]/70">
          {session.location ?? '—'} · {session.playedOn} · blinds{' '}
          <MoneyAmount value={session.blinds.small} size="sm" />/
          <MoneyAmount value={session.blinds.big} size="sm" /> · {session.chipsPerPaise} chip
          {session.chipsPerPaise === 1 ? '' : 's'}/paise
        </p>
      </header>

      {session.status === 'closed' ? (
        <Card>
          <CardHeader>
            <CardTitle>Settlement</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-[var(--border)] p-4 pt-0">
            {sessionLedger.map((row) => (
              <PlayerRow
                key={`settle-${row.userId}`}
                user={{ nickname: nicknameOf(row.userId), avatarUrl: avatarOf(row.userId) }}
                amount={
                  <MoneyAmount
                    value={row.netPaise}
                    variant={row.netPaise >= 0 ? 'profit' : 'loss'}
                    showSign
                  />
                }
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <SessionTabs ledger={ledgerNode} notes={notesNode} photos={photosNode} audit={auditNode} />
    </div>
  );
}
