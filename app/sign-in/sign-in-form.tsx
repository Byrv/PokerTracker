'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInAction } from './actions';

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export function SignInForm() {
  const params = useSearchParams();
  const redirectTo = params.get('redirectTo') ?? '/sessions';
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit({ email }: FormData) {
    setError(null);
    try {
      await signInAction(email, redirectTo);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send link.');
    }
  }

  if (sent) {
    return (
      <div className="max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-neutral-500">We sent a magic sign-in link to your inbox.</p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none"
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-600">Please enter a valid email.</p>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        disabled={form.formState.isSubmitting}
      >
        Send magic link
      </button>
    </form>
  );
}
