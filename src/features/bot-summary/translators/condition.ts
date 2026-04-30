/**
 * Translate a `ConditionGroup` (entry conditions or indicator-exit
 * conditions) into one or more `SummaryLine`s of plain English.
 *
 * Examples:
 *   single AND, 1 condition →
 *     "Buys long when RSI(14) is below 30."
 *   2 AND conditions →
 *     "Buys long when all of these are true: RSI(14) is below 30,
 *      AND price closes above the 50-period moving average."
 *   2 OR conditions →
 *     "Sells short when any of these is true: RSI(14) is above 70,
 *      OR Stochastic %K crosses below 80."
 *
 * Mixed AND/OR within the same flat array is rare in practice (the FE
 * UI doesn't expose nesting), but we honor each `condition.operator`
 * so the rendered text matches the actual evaluation semantics.
 */
import type {
  ConditionGroup,
  ConditionOp,
  ConditionRow,
} from '@/types/builder.types';
import type {
  SummaryBlockId,
  SummaryInline,
  SummaryLine,
  TranslationGap,
} from '../types';
import { t, line } from '../types';
import { translateIndicatorRef } from './indicator-name';

/* -------------------------------------------------------------------------- */
/*  Operator translation                                                       */
/* -------------------------------------------------------------------------- */

/** English mapping for binary operators (where right_type is number or
 * indicator). Past-tense `crossed_*` variants from production logs map
 * to the same English as `crosses_*`. */
function translateBinaryOp(op: ConditionOp): string {
  switch (op) {
    case '<':
      return 'is below';
    case '>':
      return 'is above';
    case '<=':
      return 'is at or below';
    case '>=':
      return 'is at or above';
    case '==':
      return 'equals';
    case 'crosses_above':
      // Past-tense `crossed_above` from production logs (per
      // unified-bot-strategy.schema accepts both) is not in the FE type
      // union — translator only handles what the FE emits.
      return 'crosses above';
    case 'crosses_below':
      return 'crosses below';
    case 'is_going_up':
    case 'is_going_down':
      // Unary — shouldn't be called via this path. Fallback safely.
      return op;
    default: {
      const _exhaustive: never = op;
      void _exhaustive;
      return op;
    }
  }
}

/** English for unary operators (`is_going_up` / `is_going_down`). When
 * `percentage` is set on the condition, it appends "at least N%". */
function translateUnaryOp(
  op: ConditionOp,
  percentage: number | undefined,
): string {
  let verb: string;
  if (op === 'is_going_up') verb = 'is rising';
  else if (op === 'is_going_down') verb = 'is falling';
  else return op;

  if (percentage != null && Number.isFinite(percentage)) {
    return `${verb} at least ${percentage}%`;
  }
  return verb;
}

/* -------------------------------------------------------------------------- */
/*  Single condition translation                                               */
/* -------------------------------------------------------------------------- */

export function translateConditionInline(
  cond: ConditionRow,
  section: SummaryBlockId,
  gaps: TranslationGap[],
): SummaryInline[] {
  const left = translateIndicatorRef(cond.left, {
    section,
    field: 'left',
    gaps,
  });

  const isUnary = cond.op === 'is_going_up' || cond.op === 'is_going_down';

  // Unary: `<left> <verb> [at least X%]`
  if (isUnary) {
    const verb = translateUnaryOp(cond.op, cond.percentage);
    return [...left, t(' '), t(verb)];
  }

  // Binary: `<left> <verb> <right>`
  const verb = translateBinaryOp(cond.op);

  if (cond.right_type === 'number') {
    if (cond.right_number === null || cond.right_number === undefined) {
      gaps.push({
        section,
        field: 'right_number',
        rawValue: 'null',
        reason: `Numeric value missing for "${cond.left} ${cond.op} ?"`,
      });
      return [...left, t(' '), t(verb), t(' ?', 'warning')];
    }
    return [...left, t(' '), t(verb), t(` ${cond.right_number}`)];
  }

  if (cond.right_type === 'indicator') {
    if (!cond.right_indicator) {
      gaps.push({
        section,
        field: 'right_indicator',
        rawValue: 'null',
        reason: `Indicator reference missing for "${cond.left} ${cond.op} ?"`,
      });
      return [...left, t(' '), t(verb), t(' ?', 'warning')];
    }
    const right = translateIndicatorRef(cond.right_indicator, {
      section,
      field: 'right_indicator',
      gaps,
    });
    return [...left, t(' '), t(verb), t(' '), ...right];
  }

  // right_type === 'none' but op is binary — invalid combo. Defensive.
  gaps.push({
    section,
    field: 'right_type',
    rawValue: 'none',
    reason: `Unexpected right_type=none for binary op "${cond.op}"`,
  });
  return [...left, t(' '), t(verb), t(' ?', 'warning')];
}

/* -------------------------------------------------------------------------- */
/*  Group translation                                                          */
/* -------------------------------------------------------------------------- */

export interface TranslateGroupOpts {
  /** Verb that introduces the group, e.g. "Buys long when" / "Sells short when". */
  verb: string;
  /** Phrase shown when there are zero conditions. */
  emptyPhrase: string;
  section: SummaryBlockId;
  gaps: TranslationGap[];
}

/**
 * Render a group's condition list. Single condition → one line. Multiple
 * → "all/any of these are true" prefix when homogeneous; mixed AND/OR
 * keeps explicit connectors between conditions.
 */
export function translateConditionGroup(
  group: ConditionGroup,
  opts: TranslateGroupOpts,
): SummaryLine[] {
  const conditions = group.conditions;

  if (conditions.length === 0) {
    return [line(t(opts.emptyPhrase, 'warning'))];
  }

  if (conditions.length === 1) {
    const inlines = translateConditionInline(
      conditions[0],
      opts.section,
      opts.gaps,
    );
    return [
      line(t(`${opts.verb} `), ...inlines, t('.')),
    ];
  }

  // Multi-condition. The first row never has `operator`; rows 1..n-1 do.
  // Determine homogeneity — if every operator is the same, use the
  // "all/any of these" prefix. Otherwise fall back to explicit per-row
  // connectors.
  const operators = conditions.slice(1).map((c) => c.operator ?? 'AND');
  const allAnd = operators.every((o) => o === 'AND');
  const allOr = operators.every((o) => o === 'OR');

  if (allAnd || allOr) {
    const prefix = allAnd
      ? `${opts.verb} all of these are true:`
      : `${opts.verb} any of these is true:`;
    const lines: SummaryLine[] = [line(t(prefix))];
    conditions.forEach((cond) => {
      const inlines = translateConditionInline(cond, opts.section, opts.gaps);
      lines.push([t('• '), ...inlines]);
    });
    return lines;
  }

  // Mixed AND/OR — preserve the actual evaluation semantics by
  // interleaving the connector explicitly. Less prose-y but accurate.
  const lines: SummaryLine[] = [];
  conditions.forEach((cond, i) => {
    const inlines = translateConditionInline(cond, opts.section, opts.gaps);
    const prefix = i === 0 ? `${opts.verb} ` : `  ${cond.operator ?? 'AND'} `;
    lines.push([t(prefix), ...inlines]);
  });
  // Tail period
  if (lines.length > 0) {
    lines[lines.length - 1] = [...lines[lines.length - 1], t('.')];
  }
  return lines;
}
