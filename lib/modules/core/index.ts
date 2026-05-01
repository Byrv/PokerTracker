import type { DbBoundary } from '@/lib/db/boundary';
import { createCore } from './internal/factory';
export * from './types';

export interface Core {
  chipsToPaise(
    chips: import('./types').Chips,
    ratio: import('./types').ChipRatio,
  ): import('./types').Paise;
  paiseToChips(
    paise: import('./types').Paise,
    ratio: import('./types').ChipRatio,
  ): import('./types').Chips;
  formatINR(p: import('./types').Paise): string;
  formatDate(d: Date | string): string;
  formatDateTime(d: Date | string): string;
  computeNetPL(
    totalBuyinsPaise: import('./types').Paise,
    cashoutPaise: import('./types').Paise,
  ): import('./types').Paise;
  assertSessionOpen(s: { status: 'open' | 'closed' }): void;
  getChipRatio(): Promise<import('./types').ChipRatio>;
  setChipRatio(r: import('./types').ChipRatio): Promise<void>;
  permissionFor(
    userId: import('./types').UserId,
    session: { createdBy: import('./types').UserId; participants: import('./types').UserId[] },
  ): import('./types').Permission;
}

export const withBoundary = (b: DbBoundary): Core => createCore(b);
