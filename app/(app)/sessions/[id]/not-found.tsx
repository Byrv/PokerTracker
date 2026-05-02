import Link from 'next/link';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <EmptyState
      title="Session not found"
      description="This session may have been deleted or you may not have access."
      cta={<Button render={<Link href="/sessions">Back to sessions</Link>} />}
    />
  );
}
