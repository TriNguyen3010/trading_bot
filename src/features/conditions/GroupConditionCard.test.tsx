import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupConditionCard } from './GroupConditionCard';
import type { ConditionGroupNode, ConditionRule } from '@/types/builder.types';

function rule(id: string, left = 'candle.close'): ConditionRule {
  return {
    id,
    left,
    op: '>',
    right_type: 'number',
    right_number: 0,
    right_indicator: null,
    lookback: 0,
  };
}

function group(
  rules: ConditionRule[],
  intra: 'AND' | 'OR' = 'AND',
): ConditionGroupNode {
  return { id: 'g1', intraConnector: intra, rules };
}

describe('GroupConditionCard', () => {
  it('renders header with auto-numbered name from `index`', () => {
    render(
      <GroupConditionCard
        index={2}
        group={group([rule('a')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/Group condition 3:/)).toBeInTheDocument();
  });

  it('shows the rule count badge with singular/plural agreement', () => {
    const { rerender } = render(
      <GroupConditionCard
        index={0}
        group={group([rule('a')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('1 RULE')).toBeInTheDocument();

    rerender(
      <GroupConditionCard
        index={0}
        group={group([rule('a'), rule('b')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('2 RULES')).toBeInTheDocument();
  });

  it('renders ONE intra-connector between every pair of rules and binds them all to intraConnector', () => {
    render(
      <GroupConditionCard
        index={0}
        group={group([rule('a'), rule('b'), rule('c')], 'OR')}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    // 3 rules → 2 connector pills → each pill has both AND + OR buttons
    expect(screen.getAllByText('AND')).toHaveLength(2);
    expect(screen.getAllByText('OR')).toHaveLength(2);
  });

  it('toggling intra-connector calls onChange with new connector for the whole group', () => {
    const onChange = vi.fn();
    render(
      <GroupConditionCard
        index={0}
        group={group([rule('a'), rule('b')], 'AND')}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('OR'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ intraConnector: 'OR' });
  });

  it('Add condition appends a new rule with default shape', () => {
    const onChange = vi.fn();
    render(
      <GroupConditionCard
        index={0}
        group={group([rule('a')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Add condition/i }));
    const next = onChange.mock.calls[0][0] as ConditionGroupNode;
    expect(next.rules).toHaveLength(2);
    expect(next.rules[1]).toMatchObject({
      left: 'candle.close',
      op: '>',
      right_type: 'number',
    });
  });

  it('renders remove button only when onRemove is provided', () => {
    const { rerender } = render(
      <GroupConditionCard
        index={0}
        group={group([rule('a')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    expect(
      screen.queryByLabelText(/Remove Group condition/),
    ).not.toBeInTheDocument();

    const onRemove = vi.fn();
    rerender(
      <GroupConditionCard
        index={0}
        group={group([rule('a')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Remove Group condition 1/));
    expect(onRemove).toHaveBeenCalled();
  });
});
