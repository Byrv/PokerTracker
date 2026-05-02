'use client';

import { useId, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/shared';

import { setChipRatioAction } from './actions';

const schema = z.object({
  chipsPerPaise: z
    .number({ message: 'Chips per paise must be a number.' })
    .int('Chips per paise must be a whole number.')
    .min(1, 'Chips per paise must be at least 1.')
    .max(1_000_000, 'Chips per paise is too large.'),
});

type FormValues = z.infer<typeof schema>;

/**
 * Edit the global chips-per-paise ratio. Submitting opens a confirm dialog
 * because the change affects all *future* sessions; closed sessions keep
 * their original snapshot and are unaffected. Any RLS / permission failure
 * surfaces as a server-error message below the form.
 */
export function ChipRatioForm({ defaultChipsPerPaise }: { defaultChipsPerPaise: number }) {
  const inputId = useId();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { chipsPerPaise: defaultChipsPerPaise },
  });

  const errors = form.formState.errors;
  const dirty = form.formState.isDirty;

  function submit(values: FormValues) {
    setServerError(null);
    setSavedAt(null);
    const fd = new FormData();
    fd.set('chipsPerPaise', String(values.chipsPerPaise));
    startTransition(async () => {
      const result = await setChipRatioAction(fd);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setSavedAt(Date.now());
      form.reset(values);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        // Prevent native submission — confirmation goes through ConfirmDialog.
        e.preventDefault();
      }}
      className="space-y-3"
      noValidate
    >
      <p className="text-muted-foreground text-sm">
        Affects future sessions only. Closed sessions retain their original ratio.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor={inputId}>Chips per paise</Label>
        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          aria-invalid={errors.chipsPerPaise ? true : undefined}
          {...form.register('chipsPerPaise', { valueAsNumber: true })}
        />
        {errors.chipsPerPaise ? (
          <p className="text-destructive text-xs">{errors.chipsPerPaise.message}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            One paise (₹0.01) maps to this many chips. Higher = denser chip stacks.
          </p>
        )}
      </div>

      {serverError ? <p className="text-destructive text-xs">{serverError}</p> : null}
      {savedAt ? <p className="text-xs text-emerald-600">Chip ratio updated.</p> : null}

      <ConfirmDialog
        trigger={
          <Button type="button" disabled={!dirty || pending}>
            {pending ? 'Saving…' : 'Save ratio'}
          </Button>
        }
        title="Update chip ratio?"
        description="The new ratio will apply to all future sessions. Closed sessions keep their original ratio."
        confirmLabel="Update ratio"
        cancelLabel="Cancel"
        onConfirm={() => form.handleSubmit(submit)()}
      />
    </form>
  );
}
