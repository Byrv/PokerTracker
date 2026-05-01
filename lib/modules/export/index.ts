import type { DbBoundary } from '@/lib/db/boundary';
import type { SessionId } from '@/lib/modules/core';
import { createExport } from './internal/factory';
export * from './types';

export interface ExportModule {
  exportSessionCSV(sessionId: SessionId): Promise<Blob>;
  exportSessionPDF(sessionId: SessionId): Promise<Blob>;
  exportFullHistoryCSV(): Promise<Blob>;
}

export const withBoundary = (b: DbBoundary): ExportModule => createExport(b);
