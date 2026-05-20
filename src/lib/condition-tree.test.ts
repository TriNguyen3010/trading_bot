import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetIdSeq,
  deserializeBEToTree,
  emptyConditionTree,
  migrateLegacyGroup,
  serializeTreeToBE,
} from './condition-tree';
import type {
  ConditionGroup,
  ConditionRule,
  ConditionTree,
} from '@/types/builder.types';
import type { ConditionListItem, SignalGroup } from '@/schemas/strategy.schema';

// Factories ------------------------------------------------------------------

function rule(overrides: Partial<ConditionRule> = {}): ConditionRule {
  return {
    id: 'r-x',
    left: 'candle.close',
    op: '<',
    right_type: 'number',
    right_number: 30,
    right_indicator: null,
    lookback: 0,
    ...overrides,
  };
}

function plainBE(
  overrides: Partial<Extract<ConditionListItem, { left: string }>> = {},
): ConditionListItem {
  return {
    left: 'candle.close',
    op: '<',
    right_type: 'number',
    right_number: 30,
    right_indicator: null,
    lookback: 0,
    ...overrides,
  };
}

beforeEach(() => __resetIdSeq());

// Serialize -----------------------------------------------------------------

describe('serializeTreeToBE', () => {
  it('empty tree → empty conditions list', () => {
    const tree: ConditionTree = emptyConditionTree();
    expect(serializeTreeToBE(tree)).toEqual({
      logic: { type: 'AND', threshold: null },
      conditions: [],
    });
  });

  it('single-rule group flattens to a plain condition (no group wrap, no operator)', () => {
    const tree: ConditionTree = {
      groupConnector: 'AND',
      groups: [{ id: 'g1', intraConnector: 'AND', rules: [rule()] }],
    };
    const out = serializeTreeToBE(tree);
    expect(out.conditions).toEqual([plainBE()]);
  });

  it('multi-rule group wraps with {type:group}, intra-operator on rules 2+', () => {
    const tree: ConditionTree = {
      groupConnector: 'AND',
      groups: [
        {
          id: 'g1',
          intraConnector: 'OR',
          rules: [
            rule({ id: 'r1', left: 'a' }),
            rule({ id: 'r2', left: 'b' }),
            rule({ id: 'r3', left: 'c' }),
          ],
        },
      ],
    };
    const out = serializeTreeToBE(tree);
    expect(out.conditions).toEqual([
      {
        type: 'group',
        conditions: [
          plainBE({ left: 'a' }),
          { ...plainBE({ left: 'b' }), operator: 'OR' },
          { ...plainBE({ left: 'c' }), operator: 'OR' },
        ],
      },
    ]);
  });

  it('multiple groups: 2nd+ carries inter-group operator', () => {
    const tree: ConditionTree = {
      groupConnector: 'OR',
      groups: [
        { id: 'g1', intraConnector: 'AND', rules: [rule({ left: 'a' })] },
        {
          id: 'g2',
          intraConnector: 'AND',
          rules: [rule({ left: 'b' }), rule({ left: 'c' })],
        },
      ],
    };
    const out = serializeTreeToBE(tree);
    expect(out.conditions[0]).toEqual(plainBE({ left: 'a' })); // 1st: no operator
    expect(out.conditions[1]).toEqual({
      type: 'group',
      conditions: [
        plainBE({ left: 'b' }),
        { ...plainBE({ left: 'c' }), operator: 'AND' },
      ],
      operator: 'OR', // inter-group connector
    });
  });

  it('right_type=number nulls out right_indicator and vice versa', () => {
    const tree: ConditionTree = {
      groupConnector: 'AND',
      groups: [
        {
          id: 'g',
          intraConnector: 'AND',
          rules: [
            rule({
              right_type: 'indicator',
              right_indicator: 'RSI-14',
              right_number: 999, // should be nulled
            }),
          ],
        },
      ],
    };
    const out = serializeTreeToBE(tree);
    expect(out.conditions[0]).toMatchObject({
      right_type: 'indicator',
      right_indicator: 'RSI-14',
      right_number: null,
    });
  });

  it('preserves optional percentage field', () => {
    const tree: ConditionTree = {
      groupConnector: 'AND',
      groups: [
        {
          id: 'g',
          intraConnector: 'AND',
          rules: [rule({ percentage: 5 })],
        },
      ],
    };
    expect(serializeTreeToBE(tree).conditions[0]).toMatchObject({
      percentage: 5,
    });
  });
});

// Deserialize ---------------------------------------------------------------

describe('deserializeBEToTree', () => {
  it('empty BE list → empty tree', () => {
    const out = deserializeBEToTree({
      logic: { type: 'AND', threshold: null },
      conditions: [],
    });
    expect(out).toEqual({ groupConnector: 'AND', groups: [] });
  });

  it('flat all-AND list → 1 group AND', () => {
    const be: SignalGroup = {
      logic: { type: 'AND', threshold: null },
      conditions: [
        plainBE({ left: 'a' }),
        { ...plainBE({ left: 'b' }), operator: 'AND' },
        { ...plainBE({ left: 'c' }), operator: 'AND' },
      ],
    };
    const tree = deserializeBEToTree(be);
    expect(tree.groups).toHaveLength(1);
    expect(tree.groups[0].intraConnector).toBe('AND');
    expect(tree.groups[0].rules.map((r) => r.left)).toEqual(['a', 'b', 'c']);
  });

  it('flat mixed list splits into consecutive-run groups', () => {
    // [a, b AND, c OR, d OR, e AND]
    // → group1 (AND: a,b), group2 (OR: c,d), group3 (AND: e)
    // → groupConnector = first boundary = 'OR'
    const be: SignalGroup = {
      logic: { type: 'AND', threshold: null },
      conditions: [
        plainBE({ left: 'a' }),
        { ...plainBE({ left: 'b' }), operator: 'AND' },
        { ...plainBE({ left: 'c' }), operator: 'OR' },
        { ...plainBE({ left: 'd' }), operator: 'OR' },
        { ...plainBE({ left: 'e' }), operator: 'AND' },
      ],
    };
    const tree = deserializeBEToTree(be);
    expect(tree.groupConnector).toBe('OR');
    expect(tree.groups).toHaveLength(3);
    expect(tree.groups[0]).toMatchObject({ intraConnector: 'AND' });
    expect(tree.groups[0].rules.map((r) => r.left)).toEqual(['a', 'b']);
    expect(tree.groups[1]).toMatchObject({ intraConnector: 'OR' });
    expect(tree.groups[1].rules.map((r) => r.left)).toEqual(['c', 'd']);
    expect(tree.groups[2]).toMatchObject({ intraConnector: 'AND' });
    expect(tree.groups[2].rules.map((r) => r.left)).toEqual(['e']);
  });

  it('nested {type:group} item becomes one FE group; deeper nesting flattens', () => {
    // Mirrors Tuấn sample structure: 3 plain + 1 group containing 2 plain + 1 nested group
    const be: SignalGroup = {
      logic: { type: 'AND', threshold: null },
      conditions: [
        plainBE({ left: 'a' }),
        { ...plainBE({ left: 'b' }), operator: 'AND' },
        { ...plainBE({ left: 'c' }), operator: 'AND' },
        {
          type: 'group',
          conditions: [
            plainBE({ left: 'd' }),
            { ...plainBE({ left: 'e' }), operator: 'AND' },
            {
              type: 'group',
              conditions: [
                plainBE({ left: 'f' }),
                { ...plainBE({ left: 'g' }), operator: 'AND' },
              ],
              operator: 'AND',
            },
          ],
          operator: 'AND',
        },
      ],
    };
    const tree = deserializeBEToTree(be);
    // 2 FE groups: the consecutive AND plain run (a,b,c) and the wrapper group
    expect(tree.groups).toHaveLength(2);
    expect(tree.groups[0].rules.map((r) => r.left)).toEqual(['a', 'b', 'c']);
    expect(tree.groups[1].intraConnector).toBe('AND');
    // Deep nesting flattened: d, e, f, g
    expect(tree.groups[1].rules.map((r) => r.left)).toEqual([
      'd',
      'e',
      'f',
      'g',
    ]);
  });
});

// Roundtrip ------------------------------------------------------------------

describe('roundtrip tree → BE → tree', () => {
  it('preserves structure for a multi-group tree (ignoring ids)', () => {
    const tree: ConditionTree = {
      groupConnector: 'OR',
      groups: [
        {
          id: 'g1',
          intraConnector: 'AND',
          rules: [rule({ left: 'a' }), rule({ left: 'b' })],
        },
        {
          id: 'g2',
          intraConnector: 'OR',
          rules: [rule({ left: 'c' }), rule({ left: 'd' })],
        },
        {
          id: 'g3',
          intraConnector: 'AND',
          rules: [rule({ left: 'e' })],
        },
      ],
    };
    const be = serializeTreeToBE(tree);
    const back = deserializeBEToTree(be);
    // Compare without ids
    const stripIds = (t: ConditionTree) => ({
      groupConnector: t.groupConnector,
      groups: t.groups.map((g) => ({
        intraConnector: g.intraConnector,
        rules: g.rules.map((r) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...rest } = r;
          return rest;
        }),
      })),
    });
    expect(stripIds(back)).toEqual(stripIds(tree));
  });
});

// Legacy migration -----------------------------------------------------------

describe('migrateLegacyGroup', () => {
  it('empty legacy → empty tree', () => {
    const legacy: ConditionGroup = {
      logic: { type: 'AND', threshold: null },
      conditions: [],
    };
    expect(migrateLegacyGroup(legacy)).toEqual({
      groupConnector: 'AND',
      groups: [],
    });
  });

  it('all-AND legacy rows → 1 AND group', () => {
    const legacy: ConditionGroup = {
      logic: { type: 'AND', threshold: null },
      conditions: [
        {
          id: 'r1',
          left: 'a',
          op: '>',
          right_type: 'number',
          right_number: 1,
          right_indicator: null,
          lookback: 0,
        },
        {
          id: 'r2',
          left: 'b',
          op: '<',
          right_type: 'number',
          right_number: 2,
          right_indicator: null,
          lookback: 0,
          operator: 'AND',
        },
      ],
    };
    const tree = migrateLegacyGroup(legacy);
    expect(tree.groups).toHaveLength(1);
    expect(tree.groups[0].intraConnector).toBe('AND');
    expect(tree.groups[0].rules.map((r) => r.left)).toEqual(['a', 'b']);
  });

  it('mixed legacy AND/OR → groups split by consecutive runs (semantics preserved)', () => {
    const legacy: ConditionGroup = {
      logic: { type: 'AND', threshold: null },
      conditions: [
        {
          id: 'r1',
          left: 'a',
          op: '>',
          right_type: 'number',
          right_number: 0,
          right_indicator: null,
          lookback: 0,
        },
        {
          id: 'r2',
          left: 'b',
          op: '<',
          right_type: 'number',
          right_number: 0,
          right_indicator: null,
          lookback: 0,
          operator: 'OR',
        },
        {
          id: 'r3',
          left: 'c',
          op: '>',
          right_type: 'number',
          right_number: 0,
          right_indicator: null,
          lookback: 0,
          operator: 'AND',
        },
      ],
    };
    const tree = migrateLegacyGroup(legacy);
    // Expect: (OR: a,b), (AND: c)  ; groupConnector = AND (first boundary)
    expect(tree.groupConnector).toBe('AND');
    expect(tree.groups).toHaveLength(2);
    expect(tree.groups[0]).toMatchObject({ intraConnector: 'OR' });
    expect(tree.groups[0].rules.map((r) => r.left)).toEqual(['a', 'b']);
    expect(tree.groups[1]).toMatchObject({ intraConnector: 'AND' });
    expect(tree.groups[1].rules.map((r) => r.left)).toEqual(['c']);
  });
});
