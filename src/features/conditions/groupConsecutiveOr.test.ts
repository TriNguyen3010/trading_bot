import { describe, it, expect } from 'vitest';
import { groupConsecutiveOr } from './groupConsecutiveOr';
import type { ConditionRow } from '@/types/builder.types';

function row(id: string, operator?: 'AND' | 'OR'): ConditionRow {
  return {
    id,
    left: 'candle.close',
    op: '>',
    right_type: 'number',
    right_number: 0,
    right_indicator: null,
    lookback: 0,
    operator,
  };
}

describe('groupConsecutiveOr', () => {
  it('returns empty array for empty input', () => {
    expect(groupConsecutiveOr([])).toEqual([]);
  });

  it('returns a single one-row group for one row', () => {
    const r = row('a');
    expect(groupConsecutiveOr([r])).toEqual([[r]]);
  });

  it('returns one group per row when all joins are AND', () => {
    const rows = [row('a'), row('b', 'AND'), row('c', 'AND')];
    const groups = groupConsecutiveOr(rows);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toEqual([rows[0]]);
    expect(groups[1]).toEqual([rows[1]]);
    expect(groups[2]).toEqual([rows[2]]);
  });

  it('bundles a chain of OR joins into one group', () => {
    const rows = [row('a'), row('b', 'OR'), row('c', 'OR'), row('d', 'OR')];
    const groups = groupConsecutiveOr(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(rows);
  });

  it('splits OR runs whenever an AND appears', () => {
    // r1 AND r2 OR r3 AND r4 OR r5  →  [r1] [r2,r3] [r4,r5]
    const rows = [
      row('r1'),
      row('r2', 'AND'),
      row('r3', 'OR'),
      row('r4', 'AND'),
      row('r5', 'OR'),
    ];
    const groups = groupConsecutiveOr(rows);
    expect(groups).toHaveLength(3);
    expect(groups[0].map((r) => r.id)).toEqual(['r1']);
    expect(groups[1].map((r) => r.id)).toEqual(['r2', 'r3']);
    expect(groups[2].map((r) => r.id)).toEqual(['r4', 'r5']);
  });

  it('treats undefined operator on row 0 like AND (always starts a new group)', () => {
    // First row has no operator. It always starts the first group.
    const rows = [row('a'), row('b', 'OR')];
    const groups = groupConsecutiveOr(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(rows);
  });
});
