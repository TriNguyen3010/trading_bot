import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionTreeBuilder } from './ConditionTreeBuilder';
import type {
  ConditionGroupNode,
  ConditionRule,
  ConditionTree,
} from '@/types/builder.types';

function rule(id: string): ConditionRule {
  return {
    id,
    left: 'candle.close',
    op: '>',
    right_type: 'number',
    right_number: 0,
    right_indicator: null,
    lookback: 0,
  };
}

function gnode(
  id: string,
  rules: ConditionRule[],
  intra: 'AND' | 'OR' = 'AND',
): ConditionGroupNode {
  return { id, intraConnector: intra, rules };
}

function tree(
  groups: ConditionGroupNode[],
  groupConnector: 'AND' | 'OR' = 'AND',
): ConditionTree {
  return { groupConnector, groups };
}

describe('ConditionTreeBuilder', () => {
  it('auto-adds a default group on mount when defaultGroupOnMount=true and tree is empty', () => {
    const onChange = vi.fn();
    render(
      <ConditionTreeBuilder
        tree={tree([])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
        defaultGroupOnMount
      />,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ConditionTree;
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].rules).toHaveLength(1);
  });

  it('does NOT auto-add when defaultGroupOnMount is omitted', () => {
    const onChange = vi.fn();
    render(
      <ConditionTreeBuilder
        tree={tree([])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/No conditions yet/i)).toBeInTheDocument();
  });

  it('renders ONE inter-group connector between adjacent groups and binds to groupConnector', () => {
    render(
      <ConditionTreeBuilder
        tree={tree(
          [
            gnode('g1', [rule('a')]),
            gnode('g2', [rule('b')]),
            gnode('g3', [rule('c')]),
          ],
          'OR',
        )}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    // 3 single-rule groups → 2 inter-group connectors (no intra connectors
    // since each group has 1 rule). 2 AND buttons + 2 OR buttons.
    expect(screen.getAllByText('AND')).toHaveLength(2);
    expect(screen.getAllByText('OR')).toHaveLength(2);
  });

  it('toggling inter-group connector updates tree.groupConnector', () => {
    const onChange = vi.fn();
    render(
      <ConditionTreeBuilder
        tree={tree(
          [gnode('g1', [rule('a')]), gnode('g2', [rule('b')])],
          'AND',
        )}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('OR'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ groupConnector: 'OR' }),
    );
  });

  it('Add group condition appends a default group with one rule', () => {
    const onChange = vi.fn();
    render(
      <ConditionTreeBuilder
        tree={tree([gnode('g1', [rule('a')])])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Add group condition/i }),
    );
    const next = onChange.mock.calls[0][0] as ConditionTree;
    expect(next.groups).toHaveLength(2);
    expect(next.groups[1].intraConnector).toBe('AND');
    expect(next.groups[1].rules).toHaveLength(1);
  });

  it('group remove buttons are hidden when only one group is left', () => {
    render(
      <ConditionTreeBuilder
        tree={tree([gnode('g1', [rule('a')])])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    expect(
      screen.queryByLabelText(/Remove Group condition/),
    ).not.toBeInTheDocument();
  });

  it('removing a group calls onChange with that group dropped', () => {
    const onChange = vi.fn();
    render(
      <ConditionTreeBuilder
        tree={tree([gnode('g1', [rule('a')]), gnode('g2', [rule('b')])])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Remove Group condition 2/));
    const next = onChange.mock.calls[0][0] as ConditionTree;
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].id).toBe('g1');
  });

  it('total rule count badge reflects sum across all groups', () => {
    render(
      <ConditionTreeBuilder
        tree={tree([
          gnode('g1', [rule('a'), rule('b')]),
          gnode('g2', [rule('c')]),
        ])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('3 rules')).toBeInTheDocument();
  });
});
