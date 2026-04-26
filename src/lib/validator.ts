import type { BuilderState, StepId } from '@/types/builder.types';
import { parseUiPair } from './pair-format';

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
    issues.push({ stepId: 'bot-config', message: 'Pick a pair (e.g. BTC-USDC).' });
  } else if (!parseUiPair(c.pair)) {
    issues.push({
      stepId: 'bot-config',
      message: 'Pair must be in BASE-QUOTE format, e.g. BTC-USDC.',
    });
  }
  if (!c.timeframe) {
    issues.push({ stepId: 'bot-config', message: 'Pick a timeframe.' });
  }
  if (c.leverage < 1) {
    issues.push({ stepId: 'bot-config', message: 'Leverage must be ≥ 1.' });
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
  if (s.entryConditions.conditions.length === 0) {
    issues.push({
      stepId: 'entry-strategy',
      message: 'Add at least one entry condition.',
    });
  } else {
    for (const cond of s.entryConditions.conditions) {
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
        message: 'Enable take profit or stop loss (or pick a different method).',
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
  if (cm.type === 'indicator' && cm.exitConditions.conditions.length === 0) {
    issues.push({
      stepId: 'close-method',
      message: 'Add at least one exit condition.',
    });
  }

  return issues;
}
