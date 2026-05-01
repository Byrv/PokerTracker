import type { DbBoundary } from '@/lib/db/boundary';
import type { Auth } from '../index';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createAuth(_b: DbBoundary): Auth {
  throw new Error('auth: not implemented (module agent owns this)');
}
