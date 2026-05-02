import type { DbBoundary } from '@/lib/db/boundary';
import type { Core } from '../index';
import { chipsToPaise, paiseToChips } from './units';
import { formatDate, formatDateTime, formatINR } from './format';
import { computeNetPL } from './pl';
import { assertSessionOpen, permissionFor } from './permissions';
import { makeSettings } from './settings';

export function createCore(b: DbBoundary): Core {
  const settings = makeSettings(b);
  return {
    chipsToPaise,
    paiseToChips,
    formatINR,
    formatDate,
    formatDateTime,
    computeNetPL,
    assertSessionOpen,
    permissionFor,
    getChipRatio: settings.getChipRatio,
    setChipRatio: settings.setChipRatio,
  };
}
