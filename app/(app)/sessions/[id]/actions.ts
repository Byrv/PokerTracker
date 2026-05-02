'use server';

import { revalidatePath } from 'next/cache';

import { getModules } from '@/lib/modules';
import { asChips, asPaise, asSessionId, asUserId } from '@/lib/modules/core';

export async function recordBuyinAction(input: {
  sessionId: string;
  userId: string;
  amountPaise: number;
}) {
  const { ledger } = await getModules();
  await ledger.recordBuyin({
    sessionId: asSessionId(input.sessionId),
    userId: asUserId(input.userId),
    amount: asPaise(input.amountPaise),
  });
  revalidatePath(`/sessions/${input.sessionId}`);
  revalidatePath('/sessions');
}

export async function submitCashoutAction(input: {
  sessionId: string;
  userId: string;
  chipCount: number;
}) {
  const { ledger } = await getModules();
  await ledger.submitCashout({
    sessionId: asSessionId(input.sessionId),
    userId: asUserId(input.userId),
    chipCount: asChips(input.chipCount),
  });
  revalidatePath(`/sessions/${input.sessionId}`);
}

export async function confirmCashoutAction(cashoutId: string, sessionId: string) {
  const { ledger } = await getModules();
  await ledger.confirmCashout(cashoutId);
  revalidatePath(`/sessions/${sessionId}`);
}

export async function closeSessionAction(sessionId: string) {
  const { sessions, badges } = await getModules();
  await sessions.closeSession(asSessionId(sessionId));
  await badges.evaluateBadgesForSession(asSessionId(sessionId));
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath('/sessions');
  revalidatePath('/leaderboard');
}
