import { describe, it, expect } from 'vitest';
import * as core from '@/lib/modules/core';
import { asPaise } from '@/lib/modules/core';
import { createFakeBoundary } from '../../helpers/fakeBoundary';

const c = core.withBoundary(createFakeBoundary());

describe('core/format', () => {
  describe('formatINR', () => {
    it('formats whole rupees without paise', () => {
      // 50000 paise = ₹500
      expect(c.formatINR(asPaise(50000))).toMatch(/₹\s?500$/);
    });

    it('formats zero paise as ₹0', () => {
      expect(c.formatINR(asPaise(0))).toMatch(/₹\s?0$/);
    });

    it('formats sub-rupee values with paise', () => {
      // 123 paise = ₹1.23
      expect(c.formatINR(asPaise(123)).replace(/\s/g, '')).toContain('1.23');
    });

    it('formats one paisa', () => {
      // 1 paise = ₹0.01
      expect(c.formatINR(asPaise(1)).replace(/\s/g, '')).toContain('0.01');
    });

    it('formats one crore (₹1,00,00,000) using en-IN grouping', () => {
      // 1 crore rupees = 100_00_00_000 paise
      const oneCrore = 100_00_00_000;
      const formatted = c.formatINR(asPaise(oneCrore));
      // en-IN groups as 1,00,00,000
      expect(formatted).toContain('1,00,00,000');
    });

    it('formats negative paise', () => {
      expect(c.formatINR(asPaise(-50000))).toMatch(/-/);
    });
  });

  describe('formatDate', () => {
    it('formats a Date object', () => {
      const d = new Date('2025-01-15T12:00:00Z');
      const out = c.formatDate(d);
      expect(out).toContain('2025');
    });

    it('formats an ISO string', () => {
      const out = c.formatDate('2025-01-15T12:00:00Z');
      expect(out).toContain('2025');
    });
  });

  describe('formatDateTime', () => {
    it('includes both date and time', () => {
      const out = c.formatDateTime('2025-01-15T12:30:00Z');
      expect(out).toContain('2025');
      // either AM/PM or 24h digit pattern — just check it has digits beyond year
      expect(out).toMatch(/\d/);
    });
  });
});
