/**
 * Zod schemas mirroring `UnifiedBotStrategyCreate` / `UnifiedBotStrategyUpdate`
 * from `Data/openapi.json` — the new shape backend wants for
 * POST `/bot-strategy/create` and PATCH `/bot-strategy/{bot_id}`.
 *
 * See `Data/IMPLEMENTATION_PLAN.md` Step 3 + `Data/API_SPEC.md` §2–§6 for
 * the field-by-field reference. Cross-field rules (§3.3.3) are encoded as
 * `superRefine`s so backend doesn't have to re-validate them.
 *
 * NOTE: The legacy `bundle.schema.ts` + `serializer.ts` path still exists
 * for the current Export/Import flow. This file is the new entry point —
 * once a future export-flow PR migrates to UnifiedBotStrategyCreate, the
 * legacy bundle can be removed.
 */
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*  Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const stakeCurrencySchema = z.enum([
  'USDT',
  'USDC',
  'BTC',
  'ETH',
  'BNB',
  'BUSD',
]);

/** Top-level `timeframe` — note: spec §2.3 says NO `6h` here. */
export const timeframeSchema = z.enum([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
]);

/** Nested `StrategyConfigurations.timeframe` — spec §5 adds `6h`. */
export const strategyTimeframeSchema = z.enum([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
]);

export const tradingModeSchema = z.enum(['spot', 'margin', 'futures']);
export const marginModeSchema = z.enum(['cross', 'isolated']);
export const strategyTypeSchema = z.enum([
  'statistical',
  'ai_powered',
  'hybrid',
]);
export const fiatDisplayCurrencySchema = z.enum([
  // 33 fiat
  'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'CZK', 'DKK', 'EUR',
  'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'JPY', 'KRW', 'MXN',
  'MYR', 'NOK', 'NZD', 'PHP', 'PKR', 'PLN', 'RUB', 'UAH', 'SEK',
  'SGD', 'THB', 'TRY', 'TWD', 'ZAR', 'USD',
  // 6 crypto
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'BNB',
]);

/* -------------------------------------------------------------------------- */
/*  Telegram                                                                   */
/* -------------------------------------------------------------------------- */

const notificationLevelSchema = z.enum(['on', 'off', 'silent']);
const optionalNotificationSchema = notificationLevelSchema.nullable().optional();

export const telegramNotificationSettingsSchema = z.object({
  status: optionalNotificationSchema,
  warning: optionalNotificationSchema,
  startup: optionalNotificationSchema,
  entry: optionalNotificationSchema,
  entry_fill: notificationLevelSchema.default('off'),
  entry_cancel: optionalNotificationSchema,
  exit: optionalNotificationSchema,
  exit_fill: notificationLevelSchema.default('on'),
  exit_cancel: optionalNotificationSchema,
  protection_trigger: notificationLevelSchema.default('on'),
  protection_trigger_global: notificationLevelSchema.default('on'),
});

export const telegramConfigSchema = z.object({
  enabled: z.boolean().nullable().optional(),
  token: z.string().nullable().optional(),
  chat_id: z.string().nullable().optional(),
  topic_id: z.string().nullable().optional(),
  authorized_users: z.array(z.string()).nullable().optional(),
  allow_custom_messages: z.boolean().default(true),
  balance_dust_level: z.number().min(0).nullable().optional(),
  notification_settings: telegramNotificationSettingsSchema.optional(),
  reload: z.boolean().nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/*  Pricing / order-types / time-in-force / unfilled-timeout                  */
/*  (Loose objects — BE accepts additionalProperties; we keep them            */
/*  permissive until a UI form drives them.)                                  */
/* -------------------------------------------------------------------------- */

export const unfilledTimeoutConfigSchema = z.object({}).passthrough();
export const entryPricingConfigSchema = z.object({}).passthrough();
export const exitPricingConfigSchema = z.object({}).passthrough();

const orderTypeSideSchema = z.enum(['limit', 'market']);
export const orderTypesConfigSchema = z
  .object({
    entry: orderTypeSideSchema,
    exit: orderTypeSideSchema,
    stoploss: orderTypeSideSchema,
    stoploss_on_exchange: z.boolean(),
    force_exit: orderTypeSideSchema.nullable().optional(),
    force_entry: orderTypeSideSchema.nullable().optional(),
    emergency_exit: orderTypeSideSchema.default('market'),
    stoploss_on_exchange_interval: z.number().nullable().optional(),
    stoploss_on_exchange_limit_ratio: z.number().min(0).max(1).default(0.99),
  })
  .passthrough();

const tifValueSchema = z.enum([
  'GTC',
  'FOK',
  'IOC',
  'PO',
  'gtc',
  'fok',
  'ioc',
  'po',
]);
export const orderTimeInForceConfigSchema = z.object({
  entry: tifValueSchema,
  exit: tifValueSchema,
});

/* -------------------------------------------------------------------------- */
/*  Indicators                                                                 */
/* -------------------------------------------------------------------------- */

export const indicatorParameterSchema = z
  .object({
    timeperiod: z.number().int().nullable().optional(),
    window: z.number().int().nullable().optional(),
    nbdevup: z.number().nullable().optional(),
    nbdevdn: z.number().nullable().optional(),
    fastperiod: z.number().int().nullable().optional(),
    slowperiod: z.number().int().nullable().optional(),
    signalperiod: z.number().int().nullable().optional(),
    fastk_period: z.number().int().nullable().optional(),
    fastd_period: z.number().int().nullable().optional(),
  })
  .passthrough(); // BE allows extra TA params per indicator family

export const indicatorItemSchema = z.object({
  name: z.string().min(1),
  type: z.string().default('talib'),
  output: z.string().nullable().optional(),
  parameters: indicatorParameterSchema.nullable().optional(),
  pandas_ta_func: z.string().nullable().optional(),
  requires_datetime_index: z.boolean().default(false),
  timeframe: z.string().nullable().optional(),
});

export const customIndicatorItemSchema = z.object({
  name: z.string().min(1),
  source_type: z.enum(['ohlcv', 'indicator']).default('ohlcv'),
  source_col: z.string().nullable().optional(),
  source_field: z.string().default('close'),
  source_timeframe: z.string().nullable().optional(),
  operation: z
    .enum([
      'rolling_max',
      'rolling_min',
      'rolling_mean',
      'rolling_std',
      'rolling_sum',
      'shift',
      'pct_change',
      'diff',
    ])
    .default('rolling_max'),
  period: z.number().int().default(20),
});

/* -------------------------------------------------------------------------- */
/*  Condition tree                                                             */
/*                                                                             */
/*  See API_SPEC §8.bis Đính chính 2 — BE uses past tense `crossed_above`.    */
/*  We accept BOTH tenses (and both _below variants) until BE confirms a      */
/*  single canonical form.                                                     */
/* -------------------------------------------------------------------------- */

export const conditionOpSchema = z.enum([
  '>',
  '<',
  '>=',
  '<=',
  '==',
  // Present tense (legacy FE)
  'crosses_above',
  'crosses_below',
  // Past tense (production BE per §8.bis)
  'crossed_above',
  'crossed_below',
  'is_going_up',
  'is_going_down',
]);

export const conditionRightTypeSchema = z.enum([
  'indicator',
  'number',
  'none',
]);

const baseConditionSchema = z.object({
  left: z.string().min(1),
  op: conditionOpSchema,
  right_type: conditionRightTypeSchema,
  right_number: z.number().nullable(),
  right_indicator: z.string().nullable(),
  lookback: z.number().int().min(0).default(0),
  /** Boolean glue connecting this condition to the previous one in the array.
   * Per spec §8.bis: condition[0] has no `operator`; conditions[1..] do. */
  operator: z.enum(['AND', 'OR']).optional(),
  /** Only meaningful for unary ops (`is_going_up` / `is_going_down`). */
  percentage: z.number().optional(),
});

export const conditionItemSchema = baseConditionSchema.superRefine(
  (data, ctx) => {
    // Cross-field rules per IMPLEMENTATION_PLAN §3.3.2.
    if (data.right_type === 'number' && data.right_number === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['right_number'],
        message: 'Required when right_type=number',
      });
    }
    if (data.right_type === 'indicator' && !data.right_indicator) {
      ctx.addIssue({
        code: 'custom',
        path: ['right_indicator'],
        message: 'Required when right_type=indicator',
      });
    }
    if (
      data.right_type === 'none' &&
      (data.right_number !== null || data.right_indicator !== null)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['right_type'],
        message:
          'Both right_number and right_indicator must be null when right_type=none',
      });
    }
  },
);

export const logicSchema = z.object({
  type: z.enum(['AND', 'OR']),
  threshold: z.number().nullable(),
});

export const signalsBlockSchema = z.object({
  logic: logicSchema,
  conditions: z.array(conditionItemSchema),
});

export const signalsConfigSchema = z.object({
  candlestick: z.array(z.string()).default([]),
  indicators: z.array(indicatorItemSchema).default([]),
  entry_long: signalsBlockSchema.nullable().optional(),
  exit_long: signalsBlockSchema.nullable().optional(),
  entry_short: signalsBlockSchema.nullable().optional(),
  exit_short: signalsBlockSchema.nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/*  Risk / ROI / CustomExit                                                    */
/* -------------------------------------------------------------------------- */

export const riskConfigSchema = z
  .object({
    stoploss: z.number().default(-0.1),
    trailing_stop: z.boolean().default(false),
    trailing_stop_positive: z.number().min(0).max(1).nullable().optional(),
    trailing_stop_positive_offset: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .optional(),
    trailing_only_offset_is_reached: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    // §3.3.2 — if offset present, must be > positive
    if (
      data.trailing_stop_positive_offset != null &&
      data.trailing_stop_positive != null &&
      data.trailing_stop_positive_offset <= data.trailing_stop_positive
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['trailing_stop_positive_offset'],
        message:
          'trailing_stop_positive_offset must be > trailing_stop_positive',
      });
    }
  });

export const roiStepSchema = z.object({
  minutes: z.number().int(),
  roi: z.number(),
});

export const customExitPartialLevelSchema = z.object({
  profit: z.number(),
  amount: z.number(),
});

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const customExitConfigSchema = z.object({
  duration_enabled: z.boolean().default(false),
  duration_value: z.number().default(24),
  duration_unit: z.enum(['hours', 'days', 'candles']).default('hours'),
  profit_ratio_enabled: z.boolean().default(false),
  profit_ratio: z.number().default(2),
  max_duration_enabled: z.boolean().default(false),
  max_duration_value: z.number().default(72),
  max_duration_unit: z.enum(['hours', 'days', 'candles']).default('hours'),
  time_window_enabled: z.boolean().default(false),
  time_start: z.string().regex(HHMM_RE, 'Format must be HH:MM').default('23:00'),
  time_end: z.string().regex(HHMM_RE, 'Format must be HH:MM').default('23:59'),
  partial_enabled: z.boolean().default(false),
  partial_levels: z.array(customExitPartialLevelSchema).default([]),
});

/* -------------------------------------------------------------------------- */
/*  FreqAI (strategy-side, simpler)                                            */
/* -------------------------------------------------------------------------- */

export const strategyFreqAIConfigSchema = z.object({
  enabled: z.boolean().default(false),
  feature_indicators: z.array(z.string()).default([]),
  target_type: z.enum(['regression', 'classification']).default('regression'),
  target_candles: z.number().int().min(1).default(24),
});

/* -------------------------------------------------------------------------- */
/*  StrategyConfigurations + cross-field refinements                          */
/* -------------------------------------------------------------------------- */

const baseStrategyConfigurationsSchema = z.object({
  interface_version: z.number().int().default(3),
  strategy_type: strategyTypeSchema.default('statistical'),
  timeframe: strategyTimeframeSchema.default('5m'),
  startup_candle_count: z.number().int().positive().default(200),
  process_only_new_candles: z.boolean().default(true),
  informative_timeframes: z.array(z.string()).default([]),
  can_short: z.boolean().default(false),
  risk: riskConfigSchema.optional(),
  roi_steps: z.array(roiStepSchema).default([]),
  use_exit_signal: z.boolean().default(false),
  exit_profit_only: z.boolean().default(false),
  exit_profit_offset: z.number().default(0),
  ignore_roi_if_entry_signal: z.boolean().default(false),
  max_open_trades: z.number().int().default(-1),
  signals: signalsConfigSchema.default({
    candlestick: [],
    indicators: [],
    entry_long: undefined,
    exit_long: undefined,
    entry_short: undefined,
    exit_short: undefined,
  }),
  custom_indicator_items: z.array(customIndicatorItemSchema).default([]),
  informative_ohlcv_items: z.array(z.unknown()).default([]),
  freqai: strategyFreqAIConfigSchema.optional(),
  custom_exit: customExitConfigSchema.optional(),
  leverage: z.number().default(1),
  position_adjustment_enable: z.boolean().default(false),
  max_entry_position_adjustment: z.number().int().default(-1),
});

export const strategyConfigurationsSchema =
  baseStrategyConfigurationsSchema.superRefine((data, ctx) => {
    /* (1) Indicator references — DEFERRED.
     * Per API_SPEC §8.bis Đính chính 3, the production BE format for
     * `right_indicator` is significantly more complex than the FE-only
     * `${name}-${period}` shorthand (e.g. `"BBANDS (Upper Band) - 2.0, 2.0, 14"`).
     * Until BE shares the canonical formatter, we skip this refinement to
     * avoid false-positives on production payloads. Track in plan §10 Q2. */

    /* (2) roi_steps must be sorted by minutes ascending. */
    const minutes = data.roi_steps.map((s) => s.minutes);
    for (let i = 1; i < minutes.length; i++) {
      if (minutes[i] <= minutes[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          path: ['roi_steps', i, 'minutes'],
          message:
            'roi_steps must be sorted by `minutes` ascending (strictly increasing).',
        });
        break;
      }
    }

    /* (3) Short conditions imply can_short must be true. */
    const hasShortConditions =
      (data.signals.entry_short?.conditions?.length ?? 0) > 0 ||
      (data.signals.exit_short?.conditions?.length ?? 0) > 0;
    if (hasShortConditions && !data.can_short) {
      ctx.addIssue({
        code: 'custom',
        path: ['can_short'],
        message: 'Must enable can_short when short conditions are present.',
      });
    }

    /* (4) DROPPED — original plan rule: partial_enabled → position_adjustment_enable.
     * Production log shows BE accepts `partial_enabled=true` without the
     * adjustment flag set (Data/user_2_bot_strategy_create_POST_*.json status
     * 201). Enforcing this on FE would be stricter than BE, which is the
     * wrong direction. Re-enable only if BE confirms the constraint. */

    /* (5) custom_exit.partial_levels — total amount must be ≤ 100. */
    const partialLevels = data.custom_exit?.partial_levels ?? [];
    const totalAmount = partialLevels.reduce(
      (sum, lv) => sum + (lv.amount ?? 0),
      0,
    );
    if (totalAmount > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['custom_exit', 'partial_levels'],
        message: `Total amount = ${totalAmount}%, must be ≤ 100%.`,
      });
    }
  });

/* -------------------------------------------------------------------------- */
/*  UnifiedBotStrategyCreate (POST /bot-strategy/create)                      */
/* -------------------------------------------------------------------------- */

const stakeAmountSchema = z.union([
  z.number().positive(),
  z.literal('unlimited'),
]);

/** Top-level base before refinement. Kept as a separate const so the update
 * schema (`partial()`) can reuse the same shape without re-declaring. */
const baseUnifiedBotStrategyCreateSchema = z.object({
  // ─── 9 required ─────────────────────────────────────────────────
  bot_name: z.string().min(1),
  exchange_name: z.string().min(1),
  strategy_name: z.string().min(1),
  dry_run: z.boolean(),
  stake_currency: stakeCurrencySchema,
  stake_amount: stakeAmountSchema,
  max_open_trades: z.number().int().min(-1),
  timeframe: timeframeSchema,
  /** Per §8.bis Đính chính 1: BE accepts both `BTC/USDT` and the perpetual
   * `BTC/USDT:USDT`. We only enforce non-empty. */
  pair: z.string().min(1),

  // ─── 36 optional ────────────────────────────────────────────────
  exchange: z.record(z.unknown()).nullable().optional(),
  dry_run_wallet: z.number().min(0).nullable().optional(),
  fiat_display_currency: fiatDisplayCurrencySchema.nullable().optional(),
  stoploss: z.number().lt(0).nullable().optional(),
  trailing_stop: z.boolean().nullable().optional(),
  trailing_stop_positive: z.number().min(0).max(1).nullable().optional(),
  trailing_stop_positive_offset: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .optional(),
  trailing_only_offset_is_reached: z.boolean().nullable().optional(),
  minimal_roi: z.record(z.number()).nullable().optional(),
  use_exit_signal: z.boolean().nullable().optional(),
  exit_profit_only: z.boolean().nullable().optional(),
  exit_profit_offset: z.number().nullable().optional(),
  ignore_roi_if_entry_signal: z.boolean().nullable().optional(),
  ignore_buying_expired_candle_after: z.number().nullable().optional(),
  trading_mode: tradingModeSchema.nullable().optional(),
  margin_mode: marginModeSchema.nullable().optional(),
  liquidation_buffer: z.number().min(0).max(1).nullable().optional(),
  leverage: z.number().int().min(1).max(125).nullable().optional(),
  can_short: z.boolean().nullable().optional(),
  position_adjustment_enable: z.boolean().nullable().optional(),
  max_entry_position_adjustment: z.number().int().min(-1).nullable().optional(),
  cancel_open_orders_on_exit: z.boolean().nullable().optional(),
  process_only_new_candles: z.boolean().nullable().optional(),
  force_entry_enable: z.boolean().nullable().optional(),
  unfilledtimeout: unfilledTimeoutConfigSchema.nullable().optional(),
  entry_pricing: entryPricingConfigSchema.nullable().optional(),
  exit_pricing: exitPricingConfigSchema.nullable().optional(),
  order_types: orderTypesConfigSchema.nullable().optional(),
  order_time_in_force: orderTimeInForceConfigSchema.nullable().optional(),
  telegram: telegramConfigSchema.nullable().optional(),
  /** Top-level FreqAI is the FULL config (different schema from the nested
   * one inside StrategyConfigurations). We accept `passthrough()` until a
   * UI form drives this section. */
  freqai: z.object({}).passthrough().nullable().optional(),
  process_throttle_secs: z.number().int().nullable().optional(),
  strategy_description: z.string().nullable().optional(),
  strategy_type: strategyTypeSchema.default('statistical'),
  configurations: strategyConfigurationsSchema.optional(),
  /** ⚠️ Deprecated — prefer `strategy_type='ai_powered'`. Accepted but warned. */
  ai_powered: z.boolean().default(false),
});

export const unifiedBotStrategyCreateSchema =
  baseUnifiedBotStrategyCreateSchema.superRefine((data, ctx) => {
    // (T-1) trading_mode futures|margin → margin_mode required.
    if (
      (data.trading_mode === 'futures' || data.trading_mode === 'margin') &&
      data.margin_mode == null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['margin_mode'],
        message: 'margin_mode is required when trading_mode is futures or margin.',
      });
    }
    // (T-2) can_short=true requires futures.
    if (data.can_short === true && data.trading_mode !== 'futures') {
      ctx.addIssue({
        code: 'custom',
        path: ['can_short'],
        message: 'can_short=true requires trading_mode=futures.',
      });
    }
    // (T-3) leverage > 1 → trading_mode cannot be spot.
    if (
      data.leverage != null &&
      data.leverage > 1 &&
      data.trading_mode === 'spot'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['leverage'],
        message: 'leverage > 1 is not allowed in spot trading_mode.',
      });
    }
  });

/* -------------------------------------------------------------------------- */
/*  UnifiedBotStrategyUpdate (PATCH /bot-strategy/{bot_id})                   */
/*                                                                             */
/*  All fields optional. Per spec §3, PATCH does NOT enforce the enum on      */
/*  stake_currency / timeframe — we follow that to match BE behavior.         */
/* -------------------------------------------------------------------------- */

export const unifiedBotStrategyUpdateSchema = z.object({
  strategy_name: z.string().nullable().optional(),
  strategy_description: z.string().nullable().optional(),
  strategy_type: strategyTypeSchema.nullable().optional(),
  /** PATCH uses `strategy_configurations` (snake-case different from create's
   * `configurations`). Keep the nested shape. */
  strategy_configurations: strategyConfigurationsSchema.nullable().optional(),
  ai_powered: z.boolean().nullable().optional(),
  pair: z.string().min(1).nullable().optional(),
  stake_currency: z.string().nullable().optional(), // PATCH accepts free string
  stake_amount: z.number().positive().nullable().optional(),
  max_open_trades: z.number().int().min(-1).nullable().optional(),
  dry_run: z.boolean().nullable().optional(),
  timeframe: z.string().nullable().optional(), // PATCH accepts free string
  /** `optional` is a deep-merge bag for additional config (telegram /
   * config_overrides / discord / webhook / freqai). BE merges per spec §3.1. */
  optional: z.record(z.unknown()).nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/*  Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type UnifiedBotStrategyCreate = z.infer<
  typeof unifiedBotStrategyCreateSchema
>;
export type UnifiedBotStrategyUpdate = z.infer<
  typeof unifiedBotStrategyUpdateSchema
>;
export type StrategyConfigurations = z.infer<typeof strategyConfigurationsSchema>;
export type SignalsBlock = z.infer<typeof signalsBlockSchema>;
export type ConditionItem = z.infer<typeof conditionItemSchema>;
export type IndicatorItem = z.infer<typeof indicatorItemSchema>;
export type CustomIndicatorItem = z.infer<typeof customIndicatorItemSchema>;
export type CustomExitConfig = z.infer<typeof customExitConfigSchema>;
export type RiskConfig = z.infer<typeof riskConfigSchema>;
export type ROIStep = z.infer<typeof roiStepSchema>;
export type TelegramConfig = z.infer<typeof telegramConfigSchema>;
export type TelegramNotificationSettings = z.infer<
  typeof telegramNotificationSettingsSchema
>;
