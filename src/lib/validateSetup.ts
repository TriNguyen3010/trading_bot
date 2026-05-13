import { z } from 'zod';
import { LEVERAGE_MAX, LEVERAGE_MIN } from '@/lib/constants';
import type { BuilderState, StepId } from '@/types/builder.types';

// ── Bot Config Setup: pair + timeframe + tradingMode + leverage ──────────────
const botConfigSetupSchema = z.object({
  pair: z.string().min(3, 'Required'),
  timeframe: z.string().min(1, 'Required'),
  tradingMode: z.enum(['dry-run', 'live']),
  leverage: z.number().min(LEVERAGE_MIN).max(LEVERAGE_MAX),
});

// ── Entry Strategy Setup: ≥1 candlestick + ≥1 indicator + ≥1 condition ───────
const entryStrategySetupSchema = z.object({
  candlestick: z.array(z.string()).min(1, 'Select at least one price channel'),
  indicators: z.array(z.any()).min(1, 'Add at least one indicator'),
  entryConditions: z.object({
    groups: z
      .array(
        z.object({
          rules: z.array(z.any()),
        }),
      )
      .refine((gs) => gs.some((g) => g.rules.length > 0), {
        message: 'Add at least one condition',
      }),
  }),
});

// ── Direction Setup: direction (always set) + orderType (always set) ──────────
// Both fields always have a default value, so they always pass.
// We still define the schema for consistency.
const directionSetupSchema = z.object({
  direction: z.enum(['long', 'short']),
  orderType: z.enum(['market', 'limit']),
});

// ── Close Method Setup: just need a type selected (always has default) ────────
const closeMethodSetupSchema = z.object({
  type: z.enum(['manual', 'tp_sl', 'indicator', 'roi']),
});

export function validateSetup(stepId: StepId, state: BuilderState): boolean {
  switch (stepId) {
    case 'bot-config':
      return botConfigSetupSchema.safeParse(state.botConfig).success;
    case 'entry-strategy':
      return entryStrategySetupSchema.safeParse(state.strategy).success;
    case 'direction':
      return directionSetupSchema.safeParse(state.directionForm).success;
    case 'close-method':
      return closeMethodSetupSchema.safeParse(state.closeMethod).success;
    default:
      return false;
  }
}
