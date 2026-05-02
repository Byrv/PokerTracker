'use client';

import { ErrorState } from '@/components/shared';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl p-4 md:p-6">
      <ErrorState error={error} retry={reset} title="Couldn't load settings" />
    </div>
  );
}
