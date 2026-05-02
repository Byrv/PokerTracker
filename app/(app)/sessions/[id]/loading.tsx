import { LoadingSkeleton } from '@/components/shared/loading-skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <LoadingSkeleton variant="row" className="h-6 w-48" />
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="table" count={4} />
    </div>
  );
}
