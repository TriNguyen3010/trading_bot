import { Fragment } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ConditionRow } from './ConditionRow';
import { ConditionConnector } from './ConditionConnector';
import type {
  ConditionGroupNode,
  ConditionRow as ConditionRowType,
  ConditionRule,
  IndicatorItem,
} from '@/types/builder.types';

export interface GroupConditionCardProps {
  /** 0-based; the card header shows `Group condition {index + 1}`. */
  index: number;
  group: ConditionGroupNode;
  indicators: IndicatorItem[];
  candlestickChannels: ('open' | 'close' | 'high' | 'low' | 'volume')[];
  onChange: (group: ConditionGroupNode) => void;
  /** Hide the remove control when the parent forbids deleting the last group. */
  onRemove?: () => void;
}

function makeDefaultRule(
  channels: GroupConditionCardProps['candlestickChannels'],
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

/**
 * One group in the named-group condition builder. Renders a card with:
 *   - Header: `Group condition N:` + rule-count badge + optional remove btn
 *   - Body: rules joined by ONE shared intra-group AND/OR pill (toggling
 *     any pill flips the group's `intraConnector` for every join)
 *   - Footer: `+ Add condition` button
 */
export function GroupConditionCard({
  index,
  group,
  indicators,
  candlestickChannels,
  onChange,
  onRemove,
}: GroupConditionCardProps) {
  const updateRule = (id: string, patch: Partial<ConditionRowType>) => {
    onChange({
      ...group,
      rules: group.rules.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ) as ConditionRule[],
    });
  };

  const removeRule = (id: string) => {
    onChange({
      ...group,
      rules: group.rules.filter((r) => r.id !== id),
    });
  };

  const addRule = () => {
    onChange({
      ...group,
      rules: [...group.rules, makeDefaultRule(candlestickChannels)],
    });
  };

  const updateIntra = (next: 'AND' | 'OR') => {
    onChange({ ...group, intraConnector: next });
  };

  const ruleCount = group.rules.length;

  return (
    <div className="rounded-xl border border-border bg-canvas/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-fg">
          Group condition {index + 1}:
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wide text-fg-muted">
            {ruleCount} RULE{ruleCount === 1 ? '' : 'S'}
          </span>
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove Group condition ${index + 1}`}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors',
                'hover:bg-bearish/10 hover:text-bearish focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Rules section: group width unchanged, but each rule card +
       * connector sits inset on the left to read as nested under the
       * group header. */}
      <div className="flex flex-col gap-2 pl-8">
        {group.rules.map((rule, ri) => (
          <Fragment key={rule.id}>
            {ri > 0 && (
              <div className="flex justify-start">
                <ConditionConnector
                  operator={group.intraConnector}
                  onChange={updateIntra}
                />
              </div>
            )}
            <ConditionRow
              row={rule as ConditionRowType}
              isFirst={ri === 0}
              indicators={indicators}
              candlestickChannels={candlestickChannels}
              onChange={(patch) => updateRule(rule.id, patch)}
              onRemove={() => removeRule(rule.id)}
            />
          </Fragment>
        ))}
      </div>

      <div className="mt-3 pl-8">
        <Button variant="ghost" size="sm" onClick={addRule}>
          <Plus className="h-3.5 w-3.5" />
          Add condition
        </Button>
      </div>
    </div>
  );
}
