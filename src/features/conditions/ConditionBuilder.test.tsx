import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConditionBuilder } from './ConditionBuilder';
import type { ConditionGroup, ConditionRow } from '@/types/builder.types';

function group(rows: ConditionRow[]): ConditionGroup {
  return { logic: { type: 'AND', threshold: null }, conditions: rows };
}

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

describe('ConditionBuilder', () => {
  it('auto-adds a default row on mount when defaultRowOnMount=true and group is empty', () => {
    const onChange = vi.fn();
    render(
      <ConditionBuilder
        group={group([])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
        defaultRowOnMount
      />,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ConditionGroup;
    expect(next.conditions).toHaveLength(1);
    expect(next.conditions[0].left).toBe('candle.close');
    expect(next.conditions[0].op).toBe('>');
    expect(next.conditions[0].right_type).toBe('number');
    expect(next.conditions[0].operator).toBeUndefined();
  });

  it('does NOT auto-add when defaultRowOnMount is omitted', () => {
    const onChange = vi.fn();
    render(
      <ConditionBuilder
        group={group([])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does NOT auto-add when defaultRowOnMount=true but group already has rows', () => {
    const onChange = vi.fn();
    render(
      <ConditionBuilder
        group={group([row('a')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
        defaultRowOnMount
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a ConditionConnector between adjacent rows', () => {
    render(
      <ConditionBuilder
        group={group([row('a'), row('b', 'AND'), row('c', 'OR')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    // 3 rows → 2 connectors → each connector has both AND + OR labels
    expect(screen.getAllByText('AND')).toHaveLength(2);
    expect(screen.getAllByText('OR')).toHaveLength(2);
  });

  it('wraps multi-row OR groups in a bordered sub-container', () => {
    render(
      <ConditionBuilder
        group={group([row('a'), row('b', 'OR'), row('c', 'OR')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    // The OR group should be rendered with a `data-or-group` marker (added by impl)
    const groupEls = document.querySelectorAll('[data-or-group="true"]');
    expect(groupEls).toHaveLength(1);
  });

  it('does NOT wrap single-row groups in a sub-container', () => {
    render(
      <ConditionBuilder
        group={group([row('a'), row('b', 'AND'), row('c', 'AND')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    // 3 AND-joined rows → 3 single-row groups → 0 borders
    expect(document.querySelectorAll('[data-or-group="true"]')).toHaveLength(0);
  });
});
