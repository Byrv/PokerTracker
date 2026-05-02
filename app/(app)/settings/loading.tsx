import { LoadingSkeleton } from '@/components/shared';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="card" />
    </div>
  );
}
