import { z } from 'zod';

/**
 * Schemas mirror `Data/payload_create_strategy.json` exactly. Field names use
 * the backend's snake_case convention.
 */

export const conditionOpSchema = z.enum([
  '>',
  '<',
  '>=',
  '<=',
  '==',
  'crosses_above',
  'crosses_below',
  'is_going_up',
  'is_going_down',
]);

export const conditionRightTypeSchema = z.enum(['indicator', 'number', 'none']);

// `lookback` is required (BE always emits it; FE always sets it). Avoid
// `.default(0)` so the inferred input/output types match the manually-declared
// recursive `ConditionListItem` union below.
export const conditionPlainSchema = z.object({
  left: z.string(),
  op: conditionOpSchema,
  right_type: conditionRightTypeSchema,
  right_number: z.number().nullable(),
  right_indicator: z.string().nullable(),
  lookback: z.number().int().min(0),
  percentage: z.number().optional(),
  operator: z.enum(['AND', 'OR']).optional(),
});

// BE accepts list items that are EITHER a plain condition OR a nested group
// (`{type:'group', conditions:[...], operator?}`). Groups can nest recursively.
export type ConditionListItem =
  | z.infer<typeof conditionPlainSchema>
  | { type: 'group'; conditions: ConditionListItem[]; operator?: 'AND' | 'OR' };

export const conditionListItemSchema: z.ZodType<ConditionListItem> = z.lazy(
  () =>
    z.union([
      conditionPlainSchema,
      z.object({
        type: z.literal('group'),
        conditions: z.array(conditionListItemSchema),
        operator: z.enum(['AND', 'OR']).optional(),
      }),
    ]),
);

// Backwards-compat alias — callers that only emit plain items keep using this.
export const conditionItemSchema = conditionPlainSchema;

export const logicSchema = z.object({
  type: z.enum(['AND', 'OR']),
  threshold: z.number().nullable(),
});

export const signalGroupSchema = z.object({
  logic: logicSchema,
  conditions: z.array(conditionListItemSchema),
});

export const indicatorSchema = z.object({
  name: z.string(),
  type: z.enum(['talib', 'pandas_ta', 'custom']),
  parameters: z.record(z.union([z.number(), z.string()])),
});

export const customIndicatorItemSchema = z.object({
  name: z.string(),
  source_type: z.string(),
  source_col: z.string(),
  source_field: z.string(),
  source_timeframe: z.string(),
  operation: z.string(),
  period: z.number(),
});

export const partialLevelSchema = z.object({
  profit: z.number(),
  amount: z.number(),
});

export const customExitSchema = z.object({
  duration_enabled: z.boolean(),
  profit_ratio_enabled: z.boolean(),
  profit_ratio: z.number(),
  max_duration_enabled: z.boolean(),
  time_window_enabled: z.boolean(),
  partial_enabled: z.boolean(),
  partial_levels: z.array(partialLevelSchema),
});

export const riskSchema = z.object({
  stoploss: z.number(),
  trailing_stop: z.boolean(),
  trailing_stop_positive: z.number(),
  trailing_stop_positive_offset: z.number(),
  trailing_only_offset_is_reached: z.boolean(),
});

export const roiStepSchema = z.object({
  minutes: z.number(),
  roi: z.number(),
});

export const signalsSchema = z.object({
  candlestick: z.array(z.string()),
  indicators: z.array(indicatorSchema),
  entry_long: signalGroupSchema,
  exit_long: signalGroupSchema,
  entry_short: signalGroupSchema,
  exit_short: signalGroupSchema,
});

export const strategyConfigurationsSchema = z.object({
  strategy_type: z.literal('statistical'),
  startup_candle_count: z.number().int().positive(),
  informative_timeframes: z.array(z.string()),
  risk: riskSchema,
  roi_steps: z.array(roiStepSchema),
  use_exit_signal: z.boolean(),
  exit_profit_only: z.boolean(),
  exit_profit_offset: z.number(),
  ignore_roi_if_entry_signal: z.boolean(),
  max_open_trades: z.number().int(),
  signals: signalsSchema,
  custom_indicator_items: z.array(customIndicatorItemSchema),
  informative_ohlcv_items: z.array(z.unknown()),
  custom_exit: customExitSchema,
});

export const strategyPayloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  strategy_type: z.literal('statistical'),
  configurations: strategyConfigurationsSchema,
  bot_id: z.number().int(),
  ai_powered: z.boolean(),
});

export type StrategyPayload = z.infer<typeof strategyPayloadSchema>;
export type ConditionItem = z.infer<typeof conditionItemSchema>;
export type SignalGroup = z.infer<typeof signalGroupSchema>;
