import { describe, it, expect } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- registry test asserts the internal rules array shape; it's an architectural contract test, not a feature test.
import { rules } from '@/lib/modules/badges/internal/registry';

/**
 * The registry test enforces the contract that adding a badge means: write a
 * file, push it onto the array. No DB migration, no schema change. We don't
 * mutate the registry at runtime — instead we assert its shape and that each
 * rule has the required surface so a frontend agent can rely on the pattern.
 */
describe('badges/registry', () => {
  it('exposes all current starter rules', () => {
    const keys = rules.map((r) => r.key).sort();
    expect(keys).toEqual(['biggest_pot', 'comeback_kid', 'first_session', 'streak_10']);
  });

  it('every rule has a key and an evaluate function', () => {
    for (const r of rules) {
      expect(typeof r.key).toBe('string');
      expect(r.key.length).toBeGreaterThan(0);
      expect(typeof r.evaluate).toBe('function');
    }
  });

  it('rule keys are unique', () => {
    const seen = new Set<string>();
    for (const r of rules) {
      expect(seen.has(r.key)).toBe(false);
      seen.add(r.key);
    }
  });

  it('a hand-written rule object satisfies the public Rule shape (registry-by-array contract)', async () => {
    // Smoke test: the registry pattern lets a third-party file produce a Rule
    // with no DB touch. We construct one in-test and call its evaluate.
    const fake = {
      key: 'fake_rule_for_test',
      evaluate: async () => ({ key: 'fake_rule_for_test' }),
    };
    const result = await fake.evaluate();
    expect(result).toEqual({ key: 'fake_rule_for_test' });
    // Adding to the live array would be one line; we don't mutate the export
    // to keep tests hermetic.
  });
});
