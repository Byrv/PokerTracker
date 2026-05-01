import type { DbBoundary } from '@/lib/db/boundary';
import type { ExportModule } from '../index';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createExport(_b: DbBoundary): ExportModule {
  throw new Error('export: not implemented');
}
