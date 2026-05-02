import type { DbBoundary } from '@/lib/db/boundary';
import type { ExportModule } from '../index';
import { exportSessionCSV } from './csv-session';
import { exportFullHistoryCSV } from './csv-history';
import { exportSessionPDF } from './pdf-session';

export function createExport(b: DbBoundary): ExportModule {
  return {
    exportSessionCSV: (sessionId) => exportSessionCSV(b, sessionId),
    exportSessionPDF: (sessionId) => exportSessionPDF(b, sessionId),
    exportFullHistoryCSV: () => exportFullHistoryCSV(b),
  };
}
