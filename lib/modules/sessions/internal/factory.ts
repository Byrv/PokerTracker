import type { DbBoundary } from '@/lib/db/boundary';
import type { Sessions } from '../index';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createSessions(_b: DbBoundary): Sessions {
  throw new Error('sessions: not implemented (module agent owns this)');
}
