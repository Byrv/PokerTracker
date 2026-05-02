'use client';

import { ErrorState } from '@/components/shared';

export default function LeaderboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} retry={reset} title="Couldn't load the leaderboard" />;
}
