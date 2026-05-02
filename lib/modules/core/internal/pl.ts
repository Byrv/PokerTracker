import { asPaise, type Paise } from '../types';

/**
 * Pure P&L: net = cashout − total buy-ins (all in paise).
 */
export function computeNetPL(totalBuyinsPaise: Paise, cashoutPaise: Paise): Paise {
  return asPaise((cashoutPaise as number) - (totalBuyinsPaise as number));
}
