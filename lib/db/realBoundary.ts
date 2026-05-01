import type { DbBoundary } from './boundary';

// Architecture agent fills this in. Foundation only ensures the file exists
// so the boundary import path is reserved.
export async function createRealBoundary(): Promise<DbBoundary> {
  throw new Error('realBoundary not yet implemented — architecture agent owns this');
}
