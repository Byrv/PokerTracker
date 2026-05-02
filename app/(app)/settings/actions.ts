'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getModules } from '@/lib/modules';

export type ActionResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, 'Nickname is required.')
    .max(40, 'Nickname must be 40 characters or fewer.'),
  avatarUrl: z
    .string()
    .trim()
    .url('Avatar URL must be a valid URL.')
    .max(500, 'Avatar URL must be 500 characters or fewer.')
    .or(z.literal(''))
    .optional(),
});

const chipRatioSchema = z.object({
  chipsPerPaise: z
    .number({ message: 'Chips per paise must be a number.' })
    .int('Chips per paise must be an integer.')
    .min(1, 'Chips per paise must be at least 1.')
    .max(1_000_000, 'Chips per paise is too large.'),
});

function formatZodError(err: z.ZodError): string {
  const first = err.issues[0];
  return first?.message ?? 'Invalid input.';
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const rawAvatar = String(formData.get('avatarUrl') ?? '').trim();
  const parsed = profileSchema.safeParse({
    nickname: String(formData.get('nickname') ?? ''),
    avatarUrl: rawAvatar,
  });
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  try {
    const { profiles } = await getModules();
    const patch: { nickname?: string; avatarUrl?: string } = { nickname: parsed.data.nickname };
    if (parsed.data.avatarUrl) patch.avatarUrl = parsed.data.avatarUrl;
    await profiles.updateProfile(patch);
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Failed to update profile.') };
  }

  revalidatePath('/settings');
  revalidatePath('/profile');
  return { ok: true };
}

export async function setChipRatioAction(formData: FormData): Promise<ActionResult> {
  const value = Number(formData.get('chipsPerPaise'));
  const parsed = chipRatioSchema.safeParse({ chipsPerPaise: value });
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  try {
    const { core } = await getModules();
    await core.setChipRatio({ chipsPerPaise: parsed.data.chipsPerPaise });
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Failed to update chip ratio.') };
  }

  revalidatePath('/settings');
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const { auth } = await getModules();
  await auth.signOut();
  redirect('/');
}
