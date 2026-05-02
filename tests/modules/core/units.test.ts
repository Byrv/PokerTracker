import { describe, it, expect } from 'vitest';
import * as core from '@/lib/modules/core';
import { asChips, asPaise } from '@/lib/modules/core';
import { createFakeBoundary } from '../../helpers/fakeBoundary';

const c = core.withBoundary(createFakeBoundary());

describe('core/units', () => {
  it('round-trips chips↔paise at ratio=1', () => {
    const r = { chipsPerPaise: 1 };
    expect(c.paiseToChips(c.chipsToPaise(asChips(50000), r), r)).toBe(50000);
  });

  it('rounds to nearest paisa when chipsPerPaise=3', () => {
    const r = { chipsPerPaise: 3 };
    // 10 chips / 3 = 3.33 → rounds to 3 paise
    expect(c.chipsToPaise(asChips(10), r)).toBe(3);
  });

  it('handles zero chips', () => {
    const r = { chipsPerPaise: 1 };
    expect(c.chipsToPaise(asChips(0), r)).toBe(0);
    expect(c.paiseToChips(asPaise(0), r)).toBe(0);
  });

  it('round-trips at ratio=2 (2 chips per paisa)', () => {
    const r = { chipsPerPaise: 2 };
    // 100 chips / 2 = 50 paise; 50 paise * 2 = 100 chips
    expect(c.chipsToPaise(asChips(100), r)).toBe(50);
    expect(c.paiseToChips(asPaise(50), r)).toBe(100);
  });

  it('handles large numbers without overflow', () => {
    const r = { chipsPerPaise: 1 };
    const big = 1_000_000_000; // 10 lakh rupees in paise
    expect(c.paiseToChips(c.chipsToPaise(asChips(big), r), r)).toBe(big);
  });

  it('throws for invalid chip ratio of 0', () => {
    expect(() => c.chipsToPaise(asChips(10), { chipsPerPaise: 0 })).toThrow('invalid_chip_ratio');
  });
});
