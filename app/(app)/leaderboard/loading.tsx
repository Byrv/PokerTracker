import { LoadingSkeleton } from '@/components/shared';

export default function LeaderboardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-40">
        <LoadingSkeleton variant="row" />
      </div>
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="table" count={6} />
    </div>
  );
}
