import type { ConditionOp, ConditionRow } from '@/types/builder.types';

export const OP_LABEL: Record<ConditionOp, string> = {
  '>': '>',
  '<': '<',
  '>=': '≥',
  '<=': '≤',
  '==': '=',
  crosses_above: 'crosses above',
  crosses_below: 'crosses below',
  is_going_up: 'is going up',
  is_going_down: 'is going down',
};

/**
 * Render a ConditionRow back into a short human string, e.g.
 *   "RSI-14 < 30"
 *   "candle.close > MA-50"
 *   "MA-50 is going up"
 */
export function conditionToString(row: ConditionRow): string {
  const left = row.left || '?';
  const op = OP_LABEL[row.op] ?? row.op;
  if (row.right_type === 'none') {
    return `${left} ${op}`;
  }
  if (row.right_type === 'indicator') {
    return `${left} ${op} ${row.right_indicator ?? '?'}`;
  }
  const num =
    row.right_number === null || row.right_number === undefined
      ? '?'
      : String(row.right_number);
  return `${left} ${op} ${num}`;
}

export interface ConditionPreviewProps {
  row: ConditionRow;
  showOperator?: boolean;
}

export function ConditionPreview({ row, showOperator }: ConditionPreviewProps) {
  const text = conditionToString(row);
  return (
    <span
      title={text}
      className="inline-flex max-w-full items-center gap-1 truncate text-xs text-fg-secondary"
    >
      {showOperator && row.operator ? (
        <span className="text-2xs uppercase tracking-wide text-fg-muted">
          {row.operator}
        </span>
      ) : null}
      <span className="truncate font-mono">{text}</span>
    </span>
  );
}
