import { asChips, asPaise, type ChipRatio, type Chips, type Paise } from '../types';

/**
 * Convert chips to paise. `chipsPerPaise` is the number of chips that map to one paisa,
 * so paise = round(chips / chipsPerPaise).
 */
export function chipsToPaise(chips: Chips, ratio: ChipRatio): Paise {
  if (ratio.chipsPerPaise === 0) {
    throw new Error('invalid_chip_ratio');
  }
  return asPaise(Math.round((chips as number) / ratio.chipsPerPaise));
}

/**
 * Convert paise back to chips: chips = round(paise * chipsPerPaise).
 */
export function paiseToChips(paise: Paise, ratio: ChipRatio): Chips {
  return asChips(Math.round((paise as number) * ratio.chipsPerPaise));
}
