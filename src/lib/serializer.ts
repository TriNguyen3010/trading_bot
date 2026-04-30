import type { BotPayload } from '@/schemas/bot.schema';
import type {
  ConditionItem,
  SignalGroup,
  StrategyPayload,
} from '@/schemas/strategy.schema';
import type {
  BuilderState,
  CloseMethodForm,
  ConditionGroup,
  ConditionRow,
  IndicatorItem,
} from '@/types/builder.types';
import type { Bundle } from '@/schemas/bundle.schema';
import { uiPairToJson, jsonPairToUi } from './pair-format';
import {
  INDICATOR_REGISTRY,
  indicatorOutputId,
} from '@/features/indicators/indicator-registry';

const APP_VERSION = '0.1.0';

const EMPTY_GROUP: SignalGroup = {
  logic: { type: 'AND', threshold: null },
  conditions: [],
};

function serializeConditionRow(row: ConditionRow): ConditionItem {
  const out: ConditionItem = {
    left: row.left,
    op: row.op,
    right_type: row.right_type,
    right_number: row.right_type === 'number' ? row.right_number : null,
    right_indicator:
      row.right_type === 'indicator' ? row.right_indicator : null,
    lookback: row.lookback,
  };
  if (row.percentage !== undefined) out.percentage = row.percentage;
  if (row.operator) out.operator = row.operator;
  return out;
}

function serializeGroup(group: ConditionGroup): SignalGroup {
  return {
    logic: { type: group.logic.type, threshold: group.logic.threshold },
    conditions: group.conditions.map(serializeConditionRow),
  };
}

function serializeIndicators(indicators: IndicatorItem[]) {
  return indicators.map((ind) => ({
    name: ind.name,
    type: ind.type,
    parameters: ind.parameters,
  }));
}

interface RiskShape {
  stoploss: number;
  trailing_stop: boolean;
  trailing_stop_positive: number;
  trailing_stop_positive_offset: number;
  trailing_only_offset_is_reached: boolean;
}

interface CustomExitShape {
  duration_enabled: boolean;
  profit_ratio_enabled: boolean;
  profit_ratio: number;
  max_duration_enabled: boolean;
  time_window_enabled: boolean;
  partial_enabled: boolean;
  partial_levels: { profit: number; amount: number }[];
}

function buildRisk(close: CloseMethodForm): RiskShape {
  // SL value in % (e.g. -3) -> ratio (-0.03). Default to -0.4 (=−40%) when
  // SL is disabled for the manual / indicator close methods.
  const sloss =
    close.type === 'tp_sl' && close.slEnabled
      ? close.slValue / 100
      : -0.4;
  return {
    stoploss: sloss,
    trailing_stop: close.type === 'tp_sl' && close.trailingEnabled,
    trailing_stop_positive: close.trailingPositive / 100,
    trailing_stop_positive_offset: close.trailingOffset / 100,
    trailing_only_offset_is_reached: true,
  };
}

function buildCustomExit(close: CloseMethodForm): CustomExitShape {
  return {
    duration_enabled: false,
    profit_ratio_enabled: false,
    profit_ratio: 2.0,
    max_duration_enabled: false,
    time_window_enabled: false,
    partial_enabled: close.type === 'tp_sl' && close.tpEnabled,
    partial_levels:
      close.type === 'tp_sl'
        ? close.tpLevels.map((l) => ({ profit: l.profit, amount: l.amount }))
        : [],
  };
}

export function buildBotPayload(state: BuilderState): BotPayload {
  const c = state.botConfig;
  const market = c.marketType;
  const dryRun = c.tradingMode === 'dry-run';

  return {
    bot_name: state.botName,
    exchange_name: c.exchange,
    strategy_name: state.strategy.name || state.botName,
    dry_run: dryRun,
    stake_currency: c.stakeCurrency,
    stake_amount: c.stakeAmount,
    max_open_trades: c.maxOpenTrades,
    timeframe: c.timeframe,
    pair: uiPairToJson(c.pair, market),
    dry_run_wallet: c.dryRunWallet,
    trading_mode: market,
    margin_mode: c.marginMode,
    liquidation_buffer: 0.05,
    leverage: c.leverage,
    can_short: state.directionForm.direction === 'short',
    position_adjustment_enable: false,
    max_entry_position_adjustment: -1,
    cancel_open_orders_on_exit: true,
    process_only_new_candles: false,
    force_entry_enable: false,
    telegram: {
      enabled: false,
      token: '',
      chat_id: '',
      allow_custom_messages: false,
      notification_settings: {
        entry_fill: 'off',
        exit_fill: 'on',
        protection_trigger: 'on',
        protection_trigger_global: 'on',
      },
    },
    process_throttle_secs: 60,
    order_type: state.directionForm.orderType,
    limit_offset_pct:
      state.directionForm.orderType === 'limit'
        ? state.directionForm.limitOffsetPct
        : null,
    close_method_type: state.closeMethod.type,
  };
}

export function buildStrategyPayload(state: BuilderState): StrategyPayload {
  const dir = state.directionForm.direction;
  const isShort = dir === 'short';

  const entryGroup = serializeGroup(state.strategy.entryConditions);
  const exitGroup =
    state.closeMethod.type === 'indicator'
      ? serializeGroup(state.closeMethod.exitConditions)
      : EMPTY_GROUP;

  return {
    name: state.strategy.name || state.botName,
    description: null,
    strategy_type: 'statistical',
    configurations: {
      strategy_type: 'statistical',
      startup_candle_count: state.strategy.startupCandleCount,
      informative_timeframes: state.strategy.informativeTimeframes,
      risk: buildRisk(state.closeMethod),
      roi_steps:
        state.closeMethod.type === 'roi'
          ? state.closeMethod.roiSteps.map((s) => ({
              minutes: s.minutes,
              roi: s.roi / 100,
            }))
          : [],
      use_exit_signal: state.closeMethod.type === 'indicator',
      exit_profit_only: false,
      exit_profit_offset: 0,
      ignore_roi_if_entry_signal: false,
      max_open_trades: -1,
      signals: {
        candlestick: state.strategy.candlestick,
        indicators: serializeIndicators(state.strategy.indicators),
        entry_long: isShort ? EMPTY_GROUP : entryGroup,
        exit_long: isShort ? EMPTY_GROUP : exitGroup,
        entry_short: isShort ? entryGroup : EMPTY_GROUP,
        exit_short: isShort ? exitGroup : EMPTY_GROUP,
      },
      custom_indicator_items: [],
      informative_ohlcv_items: [],
      custom_exit: buildCustomExit(state.closeMethod),
    },
    bot_id: 0,
    ai_powered: false,
  };
}

export function buildBundle(state: BuilderState): Bundle {
  return {
    bot: buildBotPayload(state),
    strategy: buildStrategyPayload(state),
    meta: {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      builder_version: APP_VERSION,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Deserializer (Bundle → BuilderState patch)                                 */
/* -------------------------------------------------------------------------- */

import type {
  Direction,
  TpLevel,
} from '@/types/builder.types';
import type { BotConfigForm, EntryStrategyForm } from '@/types/builder.types';

interface DeserializedState {
  botName: string;
  botConfig: BotConfigForm;
  strategy: EntryStrategyForm;
  directionForm: BuilderState['directionForm'];
  closeMethod: CloseMethodForm;
}

function deserializeGroup(g: SignalGroup): ConditionGroup {
  return {
    logic: { type: g.logic.type, threshold: g.logic.threshold },
    conditions: g.conditions.map((c) => ({
      id: crypto.randomUUID(),
      left: c.left,
      op: c.op,
      right_type: c.right_type,
      right_number: c.right_number,
      right_indicator: c.right_indicator,
      lookback: c.lookback ?? 0,
      percentage: c.percentage,
      operator: c.operator,
    })),
  };
}

function deserializeIndicators(
  list: { name: string; type: string; parameters: Record<string, number | string> }[],
): IndicatorItem[] {
  return list.map((i) => ({
    id: crypto.randomUUID(),
    name: i.name,
    type: (INDICATOR_REGISTRY[i.name]?.type ?? 'custom') as
      | 'talib'
      | 'pandas_ta'
      | 'custom',
    parameters: i.parameters,
  }));
}

export function deserializeBundle(bundle: Bundle): DeserializedState {
  const { bot, strategy } = bundle;
  const direction: Direction =
    strategy.configurations.signals.entry_short.conditions.length > 0
      ? 'short'
      : 'long';
  const isShort = direction === 'short';

  const entryGroup = isShort
    ? strategy.configurations.signals.entry_short
    : strategy.configurations.signals.entry_long;
  const exitGroup = isShort
    ? strategy.configurations.signals.exit_short
    : strategy.configurations.signals.exit_long;

  const closeType = bot.close_method_type ?? 'tp_sl';
  const customExit = strategy.configurations.custom_exit;
  const risk = strategy.configurations.risk;
  const roiSteps = strategy.configurations.roi_steps.map((s) => ({
    minutes: s.minutes,
    roi: s.roi * 100,
  }));
  const tpLevels: TpLevel[] = customExit.partial_levels.map((l) => ({
    profit: l.profit,
    amount: l.amount,
  }));

  return {
    botName: bot.bot_name,
    botConfig: {
      pair: jsonPairToUi(bot.pair),
      timeframe: bot.timeframe,
      tradingMode: bot.dry_run ? 'dry-run' : 'live',
      leverage: bot.leverage,
      exchange: bot.exchange_name,
      marketType: bot.trading_mode,
      marginMode: bot.margin_mode,
      maxOpenTrades: bot.max_open_trades,
      stakeCurrency: bot.stake_currency,
      stakeAmount: bot.stake_amount,
      dryRunWallet: bot.dry_run_wallet,
    },
    strategy: {
      id: 'strategy-1',
      name: strategy.name,
      candlestick: strategy.configurations.signals.candlestick.filter(
        (c): c is 'open' | 'close' | 'high' | 'low' | 'volume' =>
          ['open', 'close', 'high', 'low', 'volume'].includes(c),
      ),
      indicators: deserializeIndicators(
        strategy.configurations.signals.indicators,
      ),
      entryConditions: deserializeGroup(entryGroup),
      startupCandleCount: strategy.configurations.startup_candle_count,
      informativeTimeframes: strategy.configurations.informative_timeframes,
    },
    directionForm: {
      direction,
      orderType: bot.order_type ?? 'market',
      limitOffsetPct: bot.limit_offset_pct ?? null,
      slippageTolerance: 0.5,
    },
    closeMethod: {
      type: closeType,
      tpEnabled: customExit.partial_enabled,
      tpLevels,
      slEnabled: risk.stoploss > -0.4 || closeType === 'tp_sl',
      slValue: risk.stoploss * 100,
      trailingEnabled: risk.trailing_stop,
      trailingPositive: risk.trailing_stop_positive * 100,
      trailingOffset: risk.trailing_stop_positive_offset * 100,
      roiSteps,
      exitConditions: deserializeGroup(exitGroup),
    },
  };
}

// Use indicatorOutputId during validation/lints later.
void indicatorOutputId;

/* -------------------------------------------------------------------------- */
/*  Unified payload builder (UnifiedBotStrategyCreate)                        */
/*                                                                             */
/*  New entry point per Data/IMPLEMENTATION_PLAN.md Step 3. Produces the      */
/*  flat unified payload that the BE wants for POST /bot-strategy/create.    */
/*  The legacy `buildBundle()` above is kept while the Export/Import UI is   */
/*  still on the old shape; once it migrates this becomes the only           */
/*  serializer entry point.                                                   */
/* -------------------------------------------------------------------------- */

import type { UnifiedBotStrategyCreate } from '@/schemas/unified-bot-strategy.schema';

/**
 * UnifiedBundle = UnifiedBotStrategyCreate + 3 FE-only round-trip fields the
 * builder needs to re-hydrate state after import. BE ignores them (they're
 * stripped silently by the unified Zod schema since `z.object` defaults to
 * stripping unknown keys).
 *
 * Why these 3?
 *   - `order_type` / `limit_offset_pct`: live in DirectionForm. Not part of
 *     the BE create payload — BE infers via `order_types.entry`.
 *   - `close_method_type`: a 3-way FE switch (tp_sl | roi | indicator) that
 *     gates which subset of `configurations` is meaningful.
 *
 * Without these the round-trip would lose data the user typed in.
 */
export interface UnifiedBundle extends UnifiedBotStrategyCreate {
  /** FE-only — DirectionForm.orderType. */
  order_type?: 'market' | 'limit';
  /** FE-only — DirectionForm.limitOffsetPct (when orderType === 'limit'). */
  limit_offset_pct?: number | null;
  /** FE-only — CloseMethodForm.type. Inferred on import if missing. */
  close_method_type?: 'tp_sl' | 'roi' | 'indicator';
}

export function buildUnifiedPayload(
  state: BuilderState,
): UnifiedBundle {
  const bot = buildBotPayload(state);
  const strategy = buildStrategyPayload(state);
  const close = state.closeMethod;

  // Map the legacy `{bot, strategy}` split into the flat unified shape.
  // Anything not represented in the BuilderState today is omitted (BE
  // applies its defaults).
  return {
    // ── 9 required ──────────────────────────────────────────────
    bot_name: bot.bot_name,
    exchange_name: bot.exchange_name,
    strategy_name: bot.strategy_name,
    dry_run: bot.dry_run,
    stake_currency: bot.stake_currency as UnifiedBotStrategyCreate['stake_currency'],
    stake_amount: bot.stake_amount,
    max_open_trades: bot.max_open_trades,
    timeframe: bot.timeframe as UnifiedBotStrategyCreate['timeframe'],
    pair: bot.pair,

    // ── Bot runtime fields ──────────────────────────────────────
    dry_run_wallet: bot.dry_run_wallet,
    trading_mode: bot.trading_mode,
    margin_mode: bot.margin_mode,
    liquidation_buffer: bot.liquidation_buffer,
    leverage: bot.leverage,
    can_short: bot.can_short,
    position_adjustment_enable: bot.position_adjustment_enable,
    max_entry_position_adjustment: bot.max_entry_position_adjustment,
    cancel_open_orders_on_exit: bot.cancel_open_orders_on_exit,
    process_only_new_candles: bot.process_only_new_candles,
    force_entry_enable: bot.force_entry_enable,
    process_throttle_secs: bot.process_throttle_secs,

    // Risk fields are also exposed at top-level per UnifiedBotStrategyCreate,
    // but the Source-of-truth lives inside `configurations.risk`. Lift the
    // SL setting up so simple BE consumers without StrategyConfigurations
    // still see it.
    stoploss:
      close.type === 'tp_sl' && close.slEnabled ? close.slValue / 100 : null,
    trailing_stop: close.type === 'tp_sl' && close.trailingEnabled,

    telegram: {
      enabled: false,
      token: null,
      chat_id: null,
      allow_custom_messages: false,
      notification_settings: {
        // Initialise the 11-event matrix with conservative defaults so the
        // BE doesn't have to pick.
        status: 'on',
        warning: 'on',
        startup: 'on',
        entry: 'on',
        entry_fill: 'off',
        entry_cancel: 'on',
        exit: 'on',
        exit_fill: 'on',
        exit_cancel: 'on',
        protection_trigger: 'on',
        protection_trigger_global: 'on',
      },
    },

    // ── Strategy fields ─────────────────────────────────────────
    strategy_description: null,
    strategy_type: 'statistical',

    // The legacy `buildStrategyPayload()` already returns a configurations
    // object with the right shape — reuse it. We cast because the Zod
    // inferred type carries `defaults` whereas the legacy type doesn't, but
    // the runtime values are equivalent.
    configurations: strategy.configurations as unknown as UnifiedBotStrategyCreate['configurations'],

    // Deprecated, but the BE accepts it. Emit `false` explicitly for clarity.
    ai_powered: false,

    // ── FE-only round-trip fields ───────────────────────────────
    // These survive export → import so the builder fully re-hydrates.
    // Stripped silently by `unifiedBotStrategyCreateSchema.parse` when
    // BE validates, so they don't pollute the BE create call.
    order_type: state.directionForm.orderType,
    limit_offset_pct:
      state.directionForm.orderType === 'limit'
        ? state.directionForm.limitOffsetPct
        : null,
    close_method_type: state.closeMethod.type,
  };
}

/* -------------------------------------------------------------------------- */
/*  Deserializer (UnifiedBundle → BuilderState patch)                          */
/*                                                                             */
/*  Mirror of `deserializeBundle` for the unified shape. Once the legacy      */
/*  Export/Import flow is removed, only this entry point will be used.        */
/* -------------------------------------------------------------------------- */

const EMPTY_DESERIALIZED_GROUP: ConditionGroup = {
  logic: { type: 'AND', threshold: null },
  conditions: [],
};

export function deserializeUnifiedPayload(
  payload: UnifiedBundle,
): DeserializedState {
  const cfg = payload.configurations;
  if (!cfg) {
    throw new Error(
      'Unified payload missing `configurations`. Cannot reconstruct strategy.',
    );
  }

  const direction: Direction =
    (cfg.signals.entry_short?.conditions.length ?? 0) > 0 ? 'short' : 'long';
  const isShort = direction === 'short';

  const entryGroup = isShort
    ? cfg.signals.entry_short
    : cfg.signals.entry_long;
  const exitGroup = isShort
    ? cfg.signals.exit_short
    : cfg.signals.exit_long;

  // Prefer the explicit FE round-trip field; fall back to inferring from
  // the strategy configuration so files exported from a non-FE source
  // (or a future FE that drops the field) still load reasonably.
  const closeType: CloseMethodForm['type'] =
    payload.close_method_type ??
    (cfg.roi_steps.length > 0
      ? 'roi'
      : cfg.use_exit_signal
      ? 'indicator'
      : 'tp_sl');

  const customExit = cfg.custom_exit;
  const risk = cfg.risk;
  const roiSteps = cfg.roi_steps.map((s) => ({
    minutes: s.minutes,
    roi: s.roi * 100,
  }));
  const tpLevels: TpLevel[] =
    customExit?.partial_levels.map((l) => ({
      profit: l.profit,
      amount: l.amount,
    })) ?? [];

  const stakeAmount =
    typeof payload.stake_amount === 'number' ? payload.stake_amount : 0;

  return {
    botName: payload.bot_name,
    botConfig: {
      pair: jsonPairToUi(payload.pair),
      timeframe: payload.timeframe as BotConfigForm['timeframe'],
      tradingMode: payload.dry_run ? 'dry-run' : 'live',
      leverage: payload.leverage ?? 1,
      exchange: payload.exchange_name,
      marketType: (payload.trading_mode ??
        'spot') as BotConfigForm['marketType'],
      marginMode: (payload.margin_mode ??
        'cross') as BotConfigForm['marginMode'],
      maxOpenTrades: payload.max_open_trades,
      stakeCurrency:
        payload.stake_currency as BotConfigForm['stakeCurrency'],
      stakeAmount,
      dryRunWallet: payload.dry_run_wallet ?? 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: payload.strategy_name,
      candlestick: cfg.signals.candlestick.filter(
        (c): c is 'open' | 'close' | 'high' | 'low' | 'volume' =>
          ['open', 'close', 'high', 'low', 'volume'].includes(c),
      ),
      indicators: deserializeIndicators(
        cfg.signals.indicators.map((i) => ({
          name: i.name,
          type: i.type,
          parameters: (i.parameters ?? {}) as Record<
            string,
            number | string
          >,
        })),
      ),
      entryConditions: entryGroup
        ? deserializeGroup(entryGroup)
        : EMPTY_DESERIALIZED_GROUP,
      startupCandleCount: cfg.startup_candle_count,
      informativeTimeframes: cfg.informative_timeframes,
    },
    directionForm: {
      direction,
      orderType: payload.order_type ?? 'market',
      limitOffsetPct: payload.limit_offset_pct ?? null,
      slippageTolerance: 0.5,
    },
    closeMethod: {
      type: closeType,
      tpEnabled: customExit?.partial_enabled ?? false,
      tpLevels,
      slEnabled:
        (risk?.stoploss ?? -0.4) > -0.4 || closeType === 'tp_sl',
      slValue: (risk?.stoploss ?? -0.04) * 100,
      trailingEnabled: risk?.trailing_stop ?? false,
      trailingPositive: (risk?.trailing_stop_positive ?? 0) * 100,
      trailingOffset: (risk?.trailing_stop_positive_offset ?? 0) * 100,
      roiSteps,
      exitConditions: exitGroup
        ? deserializeGroup(exitGroup)
        : EMPTY_DESERIALIZED_GROUP,
    },
  };
}
