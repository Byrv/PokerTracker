import { describe, it, expect } from 'vitest';
import * as core from '@/lib/modules/core';
import { createFakeBoundary } from '../../helpers/fakeBoundary';

describe('core/settings', () => {
  it('get returns the default chip ratio', async () => {
    const b = createFakeBoundary({ appSettings: { chipsPerPaise: 1 } });
    const c = core.withBoundary(b);
    const r = await c.getChipRatio();
    expect(r.chipsPerPaise).toBe(1);
  });

  it('set updates the chip ratio and a subsequent get reflects it', async () => {
    const b = createFakeBoundary({ appSettings: { chipsPerPaise: 1 } });
    const c = core.withBoundary(b);
    await c.setChipRatio({ chipsPerPaise: 5 });
    expect((await c.getChipRatio()).chipsPerPaise).toBe(5);
  });

  it('supports concurrent reads returning the latest value', async () => {
    const b = createFakeBoundary({ appSettings: { chipsPerPaise: 2 } });
    const c = core.withBoundary(b);
    const [a, twoMore] = await Promise.all([c.getChipRatio(), c.getChipRatio()]);
    expect(a.chipsPerPaise).toBe(2);
    expect(twoMore.chipsPerPaise).toBe(2);
  });

  it('round-trips a non-integer chip ratio', async () => {
    const b = createFakeBoundary({ appSettings: { chipsPerPaise: 1 } });
    const c = core.withBoundary(b);
    await c.setChipRatio({ chipsPerPaise: 0.5 });
    expect((await c.getChipRatio()).chipsPerPaise).toBe(0.5);
  });
});
