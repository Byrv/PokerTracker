'use client';

import { useId, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { updateProfileAction } from './actions';

const schema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, 'Nickname is required.')
    .max(40, 'Nickname must be 40 characters or fewer.'),
  avatarUrl: z
    .string()
    .trim()
    .max(500, 'Avatar URL must be 500 characters or fewer.')
    .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Avatar URL must start with http(s)://.')
    .optional(),
});

type FormValues = z.infer<typeof schema>;

export function ProfileForm({
  defaultNickname,
  defaultAvatarUrl,
}: {
  defaultNickname: string;
  defaultAvatarUrl: string;
}) {
  const nicknameId = useId();
  const avatarId = useId();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nickname: defaultNickname, avatarUrl: defaultAvatarUrl },
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    setSavedAt(null);
    const fd = new FormData();
    fd.set('nickname', values.nickname);
    fd.set('avatarUrl', values.avatarUrl ?? '');
    startTransition(async () => {
      const result = await updateProfileAction(fd);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setSavedAt(Date.now());
      form.reset(values);
    });
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={nicknameId}>Nickname</Label>
        <Input
          id={nicknameId}
          autoComplete="nickname"
          aria-invalid={errors.nickname ? true : undefined}
          {...form.register('nickname')}
        />
        {errors.nickname ? (
          <p className="text-destructive text-xs">{errors.nickname.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={avatarId}>Avatar URL</Label>
        <Input
          id={avatarId}
          type="url"
          inputMode="url"
          placeholder="https://…"
          aria-invalid={errors.avatarUrl ? true : undefined}
          {...form.register('avatarUrl')}
        />
        {errors.avatarUrl ? (
          <p className="text-destructive text-xs">{errors.avatarUrl.message}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Optional. Paste a public image URL — leave blank to use initials.
          </p>
        )}
      </div>

      {serverError ? <p className="text-destructive text-xs">{serverError}</p> : null}
      {savedAt ? <p className="text-xs text-emerald-600">Profile saved.</p> : null}

      <Button type="submit" disabled={pending || form.formState.isSubmitting}>
        {pending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
