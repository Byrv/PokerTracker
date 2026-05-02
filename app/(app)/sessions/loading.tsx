import { LoadingSkeleton } from '@/components/shared/loading-skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <LoadingSkeleton variant="row" className="h-8 w-40" />
      <LoadingSkeleton variant="table" count={5} />
    </div>
  );
}
