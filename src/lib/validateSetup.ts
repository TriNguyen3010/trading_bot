import { z } from 'zod';
import type { BuilderState, StepId } from '@/types/builder.types';

// ── Bot Config Setup: pair + timeframe + tradingMode + leverage ──────────────
const botConfigSetupSchema = z.object({
  pair: z.string().min(3, 'Required'),
  timeframe: z.string().min(1, 'Required'),
  tradingMode: z.enum(['dry-run', 'live']),
  leverage: z.number().min(1).max(125),
});

// ── Entry Strategy Setup: ≥1 candlestick + ≥1 indicator + ≥1 condition ───────
const entryStrategySetupSchema = z.object({
  candlestick: z.array(z.string()).min(1, 'Select at least one price channel'),
  indicators: z.array(z.any()).min(1, 'Add at least one indicator'),
  entryConditions: z.object({
    conditions: z.array(z.any()).min(1, 'Add at least one condition'),
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
