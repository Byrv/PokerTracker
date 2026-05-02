import type { DbBoundary } from '@/lib/db/boundary';
import type { ChipRatio } from '../types';

/**
 * The only file in `core` that touches `DbBoundary`. Backed by the singleton
 * `app_settings` row — no caching here so reads are always fresh.
 */
export function makeSettings(b: DbBoundary): {
  getChipRatio: () => Promise<ChipRatio>;
  setChipRatio: (r: ChipRatio) => Promise<void>;
} {
  return {
    async getChipRatio(): Promise<ChipRatio> {
      const row = await b.appSettings.get();
      return { chipsPerPaise: Number(row.chips_per_paise) };
    },
    async setChipRatio(r: ChipRatio): Promise<void> {
      await b.appSettings.update({ chips_per_paise: r.chipsPerPaise });
    },
  };
}
