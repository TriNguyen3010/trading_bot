import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConditionRow } from './ConditionRow';
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
  /** Optional empty-state hint. */
  emptyHint?: string;
}

export function ConditionBuilder({
  group,
  indicators,
  candlestickChannels,
  onChange,
  label = 'Entry conditions',
  emptyHint = 'No conditions yet — add one to control when the bot enters.',
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

  const addRow = () => {
    const isFirst = group.conditions.length === 0;
    const next: ConditionRowType = {
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
    };
    onChange({ ...group, conditions: [...group.conditions, next] });
  };

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
        <ol className="flex flex-col gap-2">
          {group.conditions.map((row, idx) => (
            <li key={row.id}>
              <ConditionRow
                row={row}
                isFirst={idx === 0}
                indicators={indicators}
                candlestickChannels={candlestickChannels}
                onChange={(patch) => updateRow(row.id, patch)}
                onRemove={() => removeRow(row.id)}
              />
            </li>
          ))}
        </ol>
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
