'use server';

import { revalidatePath } from 'next/cache';

import { getModules } from '@/lib/modules';
import { asPaise } from '@/lib/modules/core';

export async function createSessionAction(input: {
  name?: string;
  location?: string;
  blinds: { smallPaise: number; bigPaise: number };
}) {
  const { sessions } = await getModules();
  const session = await sessions.createSession({
    name: input.name,
    location: input.location,
    blinds: {
      small: asPaise(input.blinds.smallPaise),
      big: asPaise(input.blinds.bigPaise),
    },
  });
  revalidatePath('/sessions');
  return { id: session.id };
}
