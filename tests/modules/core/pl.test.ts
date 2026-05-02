import { describe, it, expect } from 'vitest';
import * as core from '@/lib/modules/core';
import { asPaise } from '@/lib/modules/core';
import { createFakeBoundary } from '../../helpers/fakeBoundary';

const c = core.withBoundary(createFakeBoundary());

describe('core/pl', () => {
  it('net = cashout − buy-ins (positive)', () => {
    expect(c.computeNetPL(asPaise(10000), asPaise(15000))).toBe(5000);
  });

  it('net is negative when buy-ins exceed cashout', () => {
    expect(c.computeNetPL(asPaise(20000), asPaise(5000))).toBe(-15000);
  });

  it('net is zero when balanced', () => {
    expect(c.computeNetPL(asPaise(10000), asPaise(10000))).toBe(0);
  });

  it('net is zero with both zero', () => {
    expect(c.computeNetPL(asPaise(0), asPaise(0))).toBe(0);
  });

  it('handles large amounts', () => {
    expect(c.computeNetPL(asPaise(1_000_000), asPaise(2_500_000))).toBe(1_500_000);
  });

  describe('assertSessionOpen', () => {
    it('does not throw when session is open', () => {
      expect(() => c.assertSessionOpen({ status: 'open' })).not.toThrow();
    });

    it('throws session_closed when session is closed', () => {
      expect(() => c.assertSessionOpen({ status: 'closed' })).toThrow('session_closed');
    });
  });
});
