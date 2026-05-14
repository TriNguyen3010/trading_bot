import { Fragment, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConditionRow } from './ConditionRow';
import { ConditionConnector } from './ConditionConnector';
import { groupConsecutiveOr } from './groupConsecutiveOr';
import type {
  ConditionGroup,
  ConditionRow as ConditionRowType,
  IndicatorItem,
} from '@/types/builder.types';

export interface ConditionBuilderProps {
  group: ConditionGroup;
  indicators: IndicatorItem[];
  candlestickChannels: ('open' | 'close' | 'high' | 'low' | 'volume')[];
  onChange: (group: ConditionGroup) => void;
  /** Optional title rendered above the condition list. */
  label?: string;
  /** Optional empty-state hint. Only used when `defaultRowOnMount` is false. */
  emptyHint?: string;
  /**
   * When true, the builder auto-adds one default row on mount if the
   * group is empty. Pass true for entry conditions (a bot must have
   * at least one); leave false for optional condition lists like the
   * indicator exit form.
   */
  defaultRowOnMount?: boolean;
}

export function ConditionBuilder({
  group,
  indicators,
  candlestickChannels,
  onChange,
  label = 'Entry conditions',
  emptyHint = 'No conditions yet — add one to control when the bot enters.',
  defaultRowOnMount = false,
}: ConditionBuilderProps) {
  const updateRow = (id: string, patch: Partial<ConditionRowType>) => {
    onChange({
      ...group,
      conditions: group.conditions.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    });
  };

  const removeRow = (id: string) => {
    onChange({
      ...group,
      conditions: group.conditions
        .filter((c) => c.id !== id)
        .map((c, idx) => (idx === 0 ? { ...c, operator: undefined } : c)),
    });
  };

  const makeDefaultRow = (isFirst: boolean): ConditionRowType => ({
    id: crypto.randomUUID(),
    left: candlestickChannels.includes('close')
      ? 'candle.close'
      : candlestickChannels[0]
        ? `candle.${candlestickChannels[0]}`
        : 'candle.close',
    op: '>',
    right_type: 'number',
    right_number: 0,
    right_indicator: null,
    lookback: 0,
    operator: isFirst ? undefined : 'AND',
  });

  const addRow = () => {
    const isFirst = group.conditions.length === 0;
    onChange({ ...group, conditions: [...group.conditions, makeDefaultRow(isFirst)] });
  };

  // Auto-add a default row on mount when the group is empty and the
  // caller opted in. Runs only once per mount (no auto-readd if the
  // user later empties the list).
  const didAutoAdd = useRef(false);
  useEffect(() => {
    if (
      defaultRowOnMount &&
      !didAutoAdd.current &&
      group.conditions.length === 0
    ) {
      didAutoAdd.current = true;
      onChange({
        ...group,
        conditions: [makeDefaultRow(true)],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = groupConsecutiveOr(group.conditions);

  return (
    <div className="rounded-xl border border-border bg-canvas/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-fg-secondary">{label}</h4>
        <span className="text-2xs uppercase tracking-wide text-fg-muted">
          {group.conditions.length} rule{group.conditions.length === 1 ? '' : 's'}
        </span>
      </div>

      {group.conditions.length === 0 ? (
        <p className="mb-3 rounded-md border border-dashed border-border bg-canvas/40 p-4 text-center text-xs text-fg-muted">
          {emptyHint}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g, gi) => {
            const multi = g.length > 1;
            const isAbsoluteFirstGroup = gi === 0;
            return (
              <Fragment key={g[0].id}>
                {!isAbsoluteFirstGroup && (
                  <div className="flex justify-center">
                    <ConditionConnector
                      operator={g[0].operator ?? 'AND'}
                      onChange={(op) => updateRow(g[0].id, { operator: op })}
                    />
                  </div>
                )}
                <div
                  data-or-group={multi ? 'true' : 'false'}
                  className={
                    multi
                      ? 'flex flex-col gap-2 rounded-xl border border-border-subtle p-2'
                      : ''
                  }
                >
                  {g.map((r, ri) => (
                    <Fragment key={r.id}>
                      {ri > 0 && (
                        <div className="flex justify-center">
                          <ConditionConnector
                            operator={r.operator ?? 'OR'}
                            onChange={(op) => updateRow(r.id, { operator: op })}
                          />
                        </div>
                      )}
                      <ConditionRow
                        row={r}
                        indicators={indicators}
                        candlestickChannels={candlestickChannels}
                        onChange={(patch) => updateRow(r.id, patch)}
                        onRemove={() => removeRow(r.id)}
                      />
                    </Fragment>
                  ))}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" />
          Add condition
        </Button>
      </div>
    </div>
  );
}
