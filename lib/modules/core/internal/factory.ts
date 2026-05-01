import type { DbBoundary } from '@/lib/db/boundary';
import type { Core } from '../index';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createCore(_b: DbBoundary): Core {
  throw new Error('core: not implemented (module agent owns this)');
}
