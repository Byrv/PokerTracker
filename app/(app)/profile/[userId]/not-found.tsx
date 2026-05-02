import { EmptyState } from '@/components/shared';

export default function NotFound() {
  return (
    <EmptyState
      title="Profile not found"
      description="This player does not exist or has not joined yet."
    />
  );
}
