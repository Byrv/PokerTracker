import { describe, it, expect } from 'vitest';
import * as core from '@/lib/modules/core';
import { asUserId } from '@/lib/modules/core';
import { createFakeBoundary } from '../../helpers/fakeBoundary';

const c = core.withBoundary(createFakeBoundary());
const aman = asUserId('u-aman');
const ravi = asUserId('u-ravi');
const other = asUserId('u-other');

describe('core/permissions', () => {
  const session = { createdBy: aman, participants: [aman, ravi] };

  it('classifies the creator as house', () => {
    expect(c.permissionFor(aman, session)).toBe('house');
  });

  it('classifies a non-creator participant as participant', () => {
    expect(c.permissionFor(ravi, session)).toBe('participant');
  });

  it('classifies an outsider as none', () => {
    expect(c.permissionFor(other, session)).toBe('none');
  });

  it('returns none for empty participants when user is not the creator', () => {
    expect(c.permissionFor(ravi, { createdBy: aman, participants: [] })).toBe('none');
  });

  it('still returns house for the creator even if they are not in the participants list', () => {
    expect(c.permissionFor(aman, { createdBy: aman, participants: [] })).toBe('house');
  });
});
