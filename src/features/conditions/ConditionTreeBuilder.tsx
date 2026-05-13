import { Fragment, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GroupConditionCard } from './GroupConditionCard';
import { ConditionConnector } from './ConditionConnector';
import { emptyConditionTree } from '@/lib/condition-tree';
import type {
  ConditionGroupNode,
  ConditionRule,
  ConditionTree,
  IndicatorItem,
} from '@/types/builder.types';

export interface ConditionTreeBuilderProps {
  tree: ConditionTree;
  indicators: IndicatorItem[];
  candlestickChannels: ('open' | 'close' | 'high' | 'low' | 'volume')[];
  onChange: (tree: ConditionTree) => void;
  /** Optional title rendered above the tree. */
  label?: string;
  /** Optional empty-state hint. Used only when `defaultGroupOnMount` is false. */
  emptyHint?: string;
  /**
   * Auto-add one default group with one default rule on mount when the
   * tree is empty. Pass true for entry conditions (a bot must have at
   * least one); leave false for the optional indicator exit form.
   */
  defaultGroupOnMount?: boolean;
}

function makeDefaultRule(
  channels: ConditionTreeBuilderProps['candlestickChannels'],
): ConditionRule {
  return {
    id: crypto.randomUUID(),
    left: channels.includes('close')
      ? 'candle.close'
      : channels[0]
        ? `candle.${channels[0]}`
        : 'candle.close',
    op: '>',
    right_type: 'number',
    right_number: 0,
    right_indicator: null,
    lookback: 0,
  };
}

function makeDefaultGroup(
  channels: ConditionTreeBuilderProps['candlestickChannels'],
): ConditionGroupNode {
  return {
    id: crypto.randomUUID(),
    intraConnector: 'AND',
    rules: [makeDefaultRule(channels)],
  };
}

/**
 * Top-level container for the named-group condition builder. Renders a
 * sequence of `GroupConditionCard`s joined by ONE shared inter-group
 * AND/OR pill (toggling any pill flips the tree's `groupConnector`).
 *
 * `+ Add group condition` appends an empty group with one default rule.
 * The remove button on each group card disappears when only one group is
 * left, so the user cannot leave the tree in an empty state through the
 * card UI alone.
 */
export function ConditionTreeBuilder({
  tree,
  indicators,
  candlestickChannels,
  onChange,
  label = 'Entry conditions',
  emptyHint = 'No conditions yet — add one group to control when the bot enters.',
  defaultGroupOnMount = false,
}: ConditionTreeBuilderProps) {
  const updateGroup = (idx: number, next: ConditionGroupNode) => {
    onChange({
      ...tree,
      groups: tree.groups.map((g, i) => (i === idx ? next : g)),
    });
  };

  const removeGroup = (idx: number) => {
    onChange({
      ...tree,
      groups: tree.groups.filter((_, i) => i !== idx),
    });
  };

  const addGroup = () => {
    onChange({
      ...tree,
      groups: [...tree.groups, makeDefaultGroup(candlestickChannels)],
    });
  };

  const updateInter = (next: 'AND' | 'OR') => {
    onChange({ ...tree, groupConnector: next });
  };

  // Auto-add a starter group on mount when empty and caller opted in.
  const didAutoAdd = useRef(false);
  useEffect(() => {
    if (
      defaultGroupOnMount &&
      !didAutoAdd.current &&
      tree.groups.length === 0
    ) {
      didAutoAdd.current = true;
      onChange({
        ...emptyConditionTree(),
        groups: [makeDefaultGroup(candlestickChannels)],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRules = tree.groups.reduce((sum, g) => sum + g.rules.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-fg-secondary">{label}</h4>
        <span className="text-2xs uppercase tracking-wide text-fg-muted">
          {totalRules} rule{totalRules === 1 ? '' : 's'}
        </span>
      </div>

      {tree.groups.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-canvas/40 p-4 text-center text-xs text-fg-muted">
          {emptyHint}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {tree.groups.map((g, gi) => (
            <Fragment key={g.id}>
              {gi > 0 && (
                <div className="flex justify-start">
                  <ConditionConnector
                    operator={tree.groupConnector}
                    onChange={updateInter}
                  />
                </div>
              )}
              <GroupConditionCard
                index={gi}
                group={g}
                indicators={indicators}
                candlestickChannels={candlestickChannels}
                onChange={(next) => updateGroup(gi, next)}
                onRemove={
                  tree.groups.length > 1 ? () => removeGroup(gi) : undefined
                }
              />
            </Fragment>
          ))}
        </div>
      )}

      <div>
        <Button variant="ghost" size="sm" onClick={addGroup}>
          <Plus className="h-3.5 w-3.5" />
          Add group condition
        </Button>
      </div>
    </div>
  );
}
