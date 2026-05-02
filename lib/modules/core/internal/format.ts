import type { Paise } from '../types';

const INR_WITH_PAISE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_WHOLE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const DATE_FORMAT = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
const DATETIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Format paise as INR using en-IN locale. Drops trailing `.00` for whole rupees.
 */
export function formatINR(p: Paise): string {
  const paiseValue = p as number;
  const rupees = paiseValue / 100;
  if (paiseValue % 100 === 0) {
    return INR_WHOLE.format(rupees);
  }
  return INR_WITH_PAISE.format(rupees);
}

function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

export function formatDate(d: Date | string): string {
  return DATE_FORMAT.format(toDate(d));
}

export function formatDateTime(d: Date | string): string {
  return DATETIME_FORMAT.format(toDate(d));
}
