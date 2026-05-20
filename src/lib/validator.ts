import type { BuilderState, StepId } from '@/types/builder.types';
import { LEVERAGE_MAX, LEVERAGE_MIN } from './constants';
import { parseUiPair } from './pair-format';
import { allRules, ruleCount } from './condition-tree';

export interface BuilderIssue {
  stepId: StepId;
  message: string;
}

/**
 * Lightweight, per-step validation. Returns the list of human-readable issues
 * grouped by step. Empty list = exportable.
 *
 * The serialized payload is also re-validated against the Zod schema at
 * export time as a defence-in-depth, but most issues should surface here
 * with friendlier copy.
 */
export function validateBuilder(state: BuilderState): BuilderIssue[] {
  const issues: BuilderIssue[] = [];

  // Bot config -------------------------------------------------------------
  const c = state.botConfig;
  if (!c.pair.trim()) {
    issues.push({
      stepId: 'bot-config',
      message: 'Pick a pair (e.g. BTC-USDC).',
    });
  } else if (!parseUiPair(c.pair)) {
    issues.push({
      stepId: 'bot-config',
      message: 'Pair must be in BASE-QUOTE format, e.g. BTC-USDC.',
    });
  }
  if (!c.timeframe) {
    issues.push({ stepId: 'bot-config', message: 'Pick a timeframe.' });
  }
  if (c.leverage < LEVERAGE_MIN) {
    issues.push({ stepId: 'bot-config', message: 'Leverage must be ≥ 1.' });
  } else if (c.leverage > LEVERAGE_MAX) {
    issues.push({
      stepId: 'bot-config',
      message: `Leverage must be ≤ ${LEVERAGE_MAX}.`,
    });
  }
  if (c.stakeAmount <= 0) {
    issues.push({
      stepId: 'bot-config',
      message: 'Stake amount must be greater than 0.',
    });
  }

  // Entry strategy ---------------------------------------------------------
  const s = state.strategy;
  if (s.candlestick.length === 0 && s.indicators.length === 0) {
    issues.push({
      stepId: 'entry-strategy',
      message: 'Pick at least one candle channel or indicator.',
    });
  }
  if (ruleCount(s.entryConditions) === 0) {
    issues.push({
      stepId: 'entry-strategy',
      message: 'Add at least one entry condition.',
    });
  } else {
    for (const cond of allRules(s.entryConditions)) {
      if (
        cond.right_type === 'number' &&
        (cond.right_number === null || Number.isNaN(cond.right_number))
      ) {
        issues.push({
          stepId: 'entry-strategy',
          message: `Condition "${cond.left} ${cond.op} …" is missing a value.`,
        });
        break; // one message per step is enough
      }
      if (cond.right_type === 'indicator' && !cond.right_indicator) {
        issues.push({
          stepId: 'entry-strategy',
          message: `Condition "${cond.left} ${cond.op} …" is missing an indicator.`,
        });
        break;
      }
    }
  }

  // Direction --------------------------------------------------------------
  const d = state.directionForm;
  if (
    d.orderType === 'limit' &&
    (d.limitOffsetPct === null || Number.isNaN(d.limitOffsetPct))
  ) {
    issues.push({
      stepId: 'direction',
      message: 'Limit offset is required when using limit orders.',
    });
  }

  // Close method -----------------------------------------------------------
  const cm = state.closeMethod;
  if (cm.type === 'tp_sl') {
    if (!cm.tpEnabled && !cm.slEnabled) {
      issues.push({
        stepId: 'close-method',
        message:
          'Enable take profit or stop loss (or pick a different method).',
      });
    }
    if (cm.tpEnabled && cm.tpLevels.length === 0) {
      issues.push({
        stepId: 'close-method',
        message: 'Add at least one take-profit level.',
      });
    }
    const total = cm.tpLevels.reduce((sum, l) => sum + (l.amount || 0), 0);
    if (total > 100) {
      issues.push({
        stepId: 'close-method',
        message: `Take-profit close % totals ${total}% — must be ≤ 100%.`,
      });
    }
  }
  if (cm.type === 'roi' && cm.roiSteps.length === 0) {
    issues.push({
      stepId: 'close-method',
      message: 'Add at least one ROI step.',
    });
  }
  if (cm.type === 'indicator' && ruleCount(cm.exitConditions) === 0) {
    issues.push({
      stepId: 'close-method',
      message: 'Add at least one exit condition.',
    });
  }

  return issues;
}

/**
 * Per-step "setup gate" — returns true when the **required** Setup-tab fields
 * for `stepId` are filled to a level that lets the wizard unlock the
 * Configure tab and enable the primary CTA in the drawer footer.
 *
 * NOTE: this is intentionally looser than {@link validateBuilder} (which is
 * the export-time check). The wizard only blocks tab progression — it doesn't
 * enforce that *every* downstream constraint is satisfied. Example:
 * Close Method's setup is just "pick a method"; the per-method TP / ROI
 * details live in the Configure tab and are checked by `validateBuilder` at
 * export time.
 */
export function isStepSetupComplete(
  stepId: StepId,
  state: BuilderState,
): boolean {
  switch (stepId) {
    case 'bot-config': {
      const c = state.botConfig;
      if (!c.pair.trim()) return false;
      if (!parseUiPair(c.pair)) return false;
      if (!c.timeframe) return false;
      if (c.leverage < LEVERAGE_MIN || c.leverage > LEVERAGE_MAX) return false;
      return true;
    }
    case 'entry-strategy': {
      const s = state.strategy;
      const hasSource = s.candlestick.length > 0 || s.indicators.length > 0;
      const hasCondition = ruleCount(s.entryConditions) > 0;
      return hasSource && hasCondition;
    }
    case 'direction': {
      const d = state.directionForm;
      return Boolean(d.direction) && Boolean(d.orderType);
    }
    case 'close-method': {
      // Setup gate = a method has been picked. Per-method specifics
      // (TP levels, ROI rows, exit conditions) live in Configure and are
      // checked at export time by validateBuilder.
      return Boolean(state.closeMethod.type);
    }
  }
}
