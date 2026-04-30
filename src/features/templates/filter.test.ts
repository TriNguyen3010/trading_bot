import { describe, expect, it } from 'vitest';
import { BUILT_IN_TEMPLATES } from '@/templates';
import {
  applyTemplateFilter,
  computeDimensionCounts,
  type TemplateFilter,
} from './filter';

/**
 * The catalog drives these tests, so summarising what's in it (verified
 * via `applyTemplateFilter` calls) makes failures self-documenting:
 *   beginner    × conservative → DCA / Grid / RSI-oversold
 *   intermediate × balanced    → Breakout / Cypheus default
 *   intermediate × aggressive  → MACD momentum
 *   advanced    × balanced     → Multi-TF trend
 *   advanced    × aggressive   → Scalping
 */
describe('computeDimensionCounts', () => {
  it('returns positive counts for every reachable dimension when no filter is applied', () => {
    const counts = computeDimensionCounts(BUILT_IN_TEMPLATES, {});
    expect(counts.difficulty.beginner).toBeGreaterThan(0);
    expect(counts.difficulty.intermediate).toBeGreaterThan(0);
    expect(counts.difficulty.advanced).toBeGreaterThan(0);
    expect(counts.risk.conservative).toBeGreaterThan(0);
    expect(counts.risk.balanced).toBeGreaterThan(0);
    expect(counts.risk.aggressive).toBeGreaterThan(0);
    // Every tag that appears in the catalog should have a positive count.
    for (const tag of Object.keys(counts.tag)) {
      expect(counts.tag[tag]).toBeGreaterThan(0);
    }
  });

  it('zeroes out unreachable risks when difficulty=advanced is selected', () => {
    // No advanced + conservative templates exist in the catalog.
    const filter: TemplateFilter = { difficulty: 'advanced' };
    const counts = computeDimensionCounts(BUILT_IN_TEMPLATES, filter);

    expect(counts.risk.conservative).toBe(0);
    expect(counts.risk.balanced).toBeGreaterThan(0);
    expect(counts.risk.aggressive).toBeGreaterThan(0);

    // Sanity-check: applyTemplateFilter agrees.
    expect(
      applyTemplateFilter(BUILT_IN_TEMPLATES, {
        difficulty: 'advanced',
        risk: 'conservative',
      }),
    ).toHaveLength(0);
  });

  it('zeroes out unreachable difficulties when risk=conservative is selected', () => {
    // Catalog only has beginner templates with conservative risk.
    const filter: TemplateFilter = { risk: 'conservative' };
    const counts = computeDimensionCounts(BUILT_IN_TEMPLATES, filter);

    expect(counts.difficulty.beginner).toBeGreaterThan(0);
    expect(counts.difficulty.intermediate).toBe(0);
    expect(counts.difficulty.advanced).toBe(0);
  });

  it("ignores its own dimension when computing that dimension's counts", () => {
    // If we computed difficulty counts using the current `filter.difficulty`,
    // siblings would always be 0 — but users need them populated so they
    // can SWITCH difficulty without first clearing it.
    const filter: TemplateFilter = { difficulty: 'beginner' };
    const counts = computeDimensionCounts(BUILT_IN_TEMPLATES, filter);

    // Other difficulties should still report their TOTAL counts (since
    // no other dimension is filtering).
    expect(counts.difficulty.beginner).toBeGreaterThan(0);
    expect(counts.difficulty.intermediate).toBeGreaterThan(0);
    expect(counts.difficulty.advanced).toBeGreaterThan(0);
  });

  it('shrinks the tag set to only those reachable under the current filter', () => {
    // advanced + balanced → only multi-tf-trend-alts (tags: sol, altcoin,
    // trend, multi-timeframe, futures, advanced).
    const filter: TemplateFilter = {
      difficulty: 'advanced',
      risk: 'balanced',
    };
    const counts = computeDimensionCounts(BUILT_IN_TEMPLATES, filter);

    // 'btc' is in many beginner/intermediate templates but not in
    // advanced+balanced — must be 0 (chip greyed out).
    expect(counts.tag.btc ?? 0).toBe(0);
    // 'sol' lives only on multi-tf-trend-alts → reachable.
    expect(counts.tag.sol).toBe(1);
    // 'futures' is on multi-tf-trend-alts → reachable.
    expect(counts.tag.futures).toBeGreaterThan(0);
  });

  it('per-tag count matches applyTemplateFilter result length under the same filter', () => {
    // Spot-check: for every tag, count should equal the number of
    // templates returned when that tag is added to the filter.
    const filter: TemplateFilter = { difficulty: 'beginner' };
    const counts = computeDimensionCounts(BUILT_IN_TEMPLATES, filter);

    for (const tag of Object.keys(counts.tag)) {
      const length = applyTemplateFilter(BUILT_IN_TEMPLATES, {
        ...filter,
        tag,
      }).length;
      expect(counts.tag[tag]).toBe(length);
    }
  });
});
