/**
 * Unit tests for the condition translator. The summarize.test.ts
 * snapshot suite covers 8-template integration; this file pins down
 * the operator × right_type matrix + edge cases that a translator
 * regression would otherwise hide inside a multi-line snapshot.
 */
import { describe, expect, it } from 'vitest';
import { translateConditionGroup } from '../translators/condition';
import type { ConditionGroup, ConditionRow } from '@/types/builder.types';
import type { TranslationGap } from '../types';

function flatten(lines: { text: string }[][]): string {
  return lines.map((l) => l.map((i) => i.text).join('')).join('\n');
}

function row(overrides: Partial<ConditionRow>): ConditionRow {
  return {
    id: 'test',
    left: 'RSI-14',
    op: '<',
    right_type: 'number',
    right_number: 30,
    right_indicator: null,
    lookback: 0,
    ...overrides,
  };
}

function group(...conditions: ConditionRow[]): ConditionGroup {
  return {
    logic: { type: 'AND', threshold: null },
    conditions,
  };
}

describe('condition translator — single condition', () => {
  it('binary number: RSI < 30', () => {
    const gaps: TranslationGap[] = [];
    const lines = translateConditionGroup(
      group(row({ op: '<', right_number: 30 })),
      {
        verb: 'Buys long when',
        emptyPhrase: 'no entry',
        section: 'entry',
        gaps,
      },
    );
    expect(flatten(lines)).toBe('Buys long when RSI(14) is below 30.');
    expect(gaps).toHaveLength(0);
  });

  it('binary number with > op', () => {
    const gaps: TranslationGap[] = [];
    const lines = translateConditionGroup(
      group(row({ op: '>', right_number: 70 })),
      {
        verb: 'Sells short when',
        emptyPhrase: '',
        section: 'entry',
        gaps,
      },
    );
    expect(flatten(lines)).toBe('Sells short when RSI(14) is above 70.');
  });

  it('crosses_above with indicator right side', () => {
    const gaps: TranslationGap[] = [];
    const lines = translateConditionGroup(
      group(
        row({
          left: 'candle.close',
          op: 'crosses_above',
          right_type: 'indicator',
          right_number: null,
          right_indicator: 'MA-50',
        }),
      ),
      { verb: 'Buys long when', emptyPhrase: '', section: 'entry', gaps },
    );
    expect(flatten(lines)).toBe(
      'Buys long when candle close crosses above the 50-period moving average.',
    );
  });

  it('unary is_going_up with percentage', () => {
    const gaps: TranslationGap[] = [];
    const lines = translateConditionGroup(
      group(
        row({
          left: 'candle.volume',
          op: 'is_going_up',
          right_type: 'none',
          right_number: null,
          right_indicator: null,
          percentage: 20,
        }),
      ),
      { verb: 'Buys long when', emptyPhrase: '', section: 'entry', gaps },
    );
    expect(flatten(lines)).toBe(
      'Buys long when candle volume is rising at least 20%.',
    );
  });

  it('unary is_going_down without percentage', () => {
    const gaps: TranslationGap[] = [];
    const lines = translateConditionGroup(
      group(
        row({
          left: 'candle.close',
          op: 'is_going_down',
          right_type: 'none',
          right_number: null,
          right_indicator: null,
        }),
      ),
      { verb: 'Sells short when', emptyPhrase: '', section: 'entry', gaps },
    );
    expect(flatten(lines)).toBe('Sells short when candle close is falling.');
  });

  it('null right_number on number type → gap + warning marker', () => {
    const gaps: TranslationGap[] = [];
    const lines = translateConditionGroup(
      group(row({ op: '<', right_type: 'number', right_number: null })),
      { verb: 'Buys long when', emptyPhrase: '', section: 'entry', gaps },
    );
    expect(flatten(lines)).toBe('Buys long when RSI(14) is below ?.');
    expect(gaps).toHaveLength(1);
    expect(gaps[0].field).toBe('right_number');
  });

  it('unknown indicator on left → gap', () => {
    const gaps: TranslationGap[] = [];
    translateConditionGroup(
      group(row({ left: 'WEIRD-99', op: '<', right_number: 5 })),
      { verb: 'Buys long when', emptyPhrase: '', section: 'entry', gaps },
    );
    expect(gaps.some((g) => g.rawValue === 'WEIRD-99')).toBe(true);
  });
});

describe('condition translator — group dispatch', () => {
  it('empty conditions → emptyPhrase as warning', () => {
    const gaps: TranslationGap[] = [];
    const lines = translateConditionGroup(group(), {
      verb: 'Buys long when',
      emptyPhrase: 'No conditions yet.',
      section: 'entry',
      gaps,
    });
    expect(flatten(lines)).toBe('No conditions yet.');
    expect(lines[0][0].tone).toBe('warning');
  });

  it('two AND conditions → "all of these are true" prefix', () => {
    const gaps: TranslationGap[] = [];
    const lines = translateConditionGroup(
      group(
        row({ op: '<', right_number: 30 }),
        row({
          left: 'candle.close',
          op: '>',
          right_type: 'indicator',
          right_number: null,
          right_indicator: 'MA-50',
          operator: 'AND',
        }),
      ),
      { verb: 'Buys long when', emptyPhrase: '', section: 'entry', gaps },
    );
    const text = flatten(lines);
    expect(text).toContain('Buys long when all of these are true:');
    expect(text).toContain('• RSI(14) is below 30');
    expect(text).toContain(
      '• candle close is above the 50-period moving average',
    );
  });

  it('two OR conditions → "any of these is true" prefix', () => {
    const gaps: TranslationGap[] = [];
    const lines = translateConditionGroup(
      group(
        row({ op: '<', right_number: 30 }),
        row({
          left: 'RSI-14',
          op: '>',
          right_number: 70,
          operator: 'OR',
        }),
      ),
      { verb: 'Sells short when', emptyPhrase: '', section: 'entry', gaps },
    );
    const text = flatten(lines);
    expect(text).toContain('Sells short when any of these is true:');
    expect(text).toContain('• RSI(14) is below 30');
    expect(text).toContain('• RSI(14) is above 70');
  });
});
