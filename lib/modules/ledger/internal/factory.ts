import type { DbBoundary } from '@/lib/db/boundary';
import type { Ledger } from '../index';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createLedger(_b: DbBoundary): Ledger {
  throw new Error('ledger: not implemented (module agent owns this)');
}
