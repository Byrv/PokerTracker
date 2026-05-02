'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSessionAction } from './actions';

const schema = z
  .object({
    name: z.string().trim().max(80).optional(),
    location: z.string().trim().max(80).optional(),
    blindsSmallRupees: z
      .number({ message: 'Enter a number.' })
      .int('Must be a whole number.')
      .min(1, 'Must be at least ₹1'),
    blindsBigRupees: z
      .number({ message: 'Enter a number.' })
      .int('Must be a whole number.')
      .min(1, 'Must be at least ₹1'),
  })
  .refine((v) => v.blindsBigRupees >= v.blindsSmallRupees, {
    message: 'Big blind must be ≥ small blind.',
    path: ['blindsBigRupees'],
  });
type Form = z.infer<typeof schema>;

export function CreateSessionForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      location: '',
      blindsSmallRupees: 1,
      blindsBigRupees: 2,
    },
  });

  async function onSubmit(values: Form) {
    setSubmitError(null);
    try {
      const session = await createSessionAction({
        name: values.name && values.name.length > 0 ? values.name : undefined,
        location: values.location && values.location.length > 0 ? values.location : undefined,
        blinds: {
          smallPaise: values.blindsSmallRupees * 100,
          bigPaise: values.blindsBigRupees * 100,
        },
      });
      router.push(`/sessions/${session.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not create session.');
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Friday Night" {...form.register('name')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" placeholder="Aman's place" {...form.register('location')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="blindsSmallRupees">Small blind (₹)</Label>
          <Input
            id="blindsSmallRupees"
            type="number"
            inputMode="numeric"
            min={1}
            {...form.register('blindsSmallRupees', { valueAsNumber: true })}
          />
          {errors.blindsSmallRupees ? (
            <p className="text-xs text-[var(--loss)]">{errors.blindsSmallRupees.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="blindsBigRupees">Big blind (₹)</Label>
          <Input
            id="blindsBigRupees"
            type="number"
            inputMode="numeric"
            min={1}
            {...form.register('blindsBigRupees', { valueAsNumber: true })}
          />
          {errors.blindsBigRupees ? (
            <p className="text-xs text-[var(--loss)]">{errors.blindsBigRupees.message}</p>
          ) : null}
        </div>
      </div>

      {submitError ? <p className="text-sm text-[var(--loss)]">{submitError}</p> : null}

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Creating…' : 'Create session'}
      </Button>
    </form>
  );
}
