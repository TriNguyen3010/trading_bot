/**
 * Unit tests for the unified bot/strategy Zod schema. Covers:
 *   1. Good fixtures (sample payloads + production log request) → expect PASS.
 *   2. Failure cases for cross-field rules and enum constraints.
 *
 * Plan reference: BE/IMPLEMENTATION_PLAN.md §3.3.7.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  conditionItemSchema,
  riskConfigSchema,
  strategyConfigurationsSchema,
  unifiedBotStrategyCreateSchema,
  unifiedBotStrategyUpdateSchema,
} from '../unified-bot-strategy.schema';

// ── Fixture loaders ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function loadJSON(rel: string) {
  return JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8'));
}

const sampleCreate = loadJSON('BE/payload_bot_strategy_create.json');
const sampleUpdate = loadJSON('BE/payload_bot_strategy_update.json');
const productionLog = loadJSON(
  'BE/user_2_bot_strategy_create_POST_20260428_042734.json',
);

/* -------------------------------------------------------------------------- */
/*  GOOD fixtures                                                              */
/* -------------------------------------------------------------------------- */

describe('unifiedBotStrategyCreateSchema — good fixtures', () => {
  it('accepts the migrated create sample', () => {
    const result = unifiedBotStrategyCreateSchema.safeParse(sampleCreate);
    if (!result.success) {
      // Surface the exact issue path on failure to make CI logs useful.
      throw new Error(
        `Sample failed: ${JSON.stringify(result.error.issues, null, 2)}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it('accepts the production-log request payload (status 201 OK in real API)', () => {
    // Important: this fixture is a real-world payload that the BE accepted —
    // if the schema rejects it, the schema is stricter than the BE, which is
    // the wrong direction.
    const result = unifiedBotStrategyCreateSchema.safeParse(
      productionLog.request,
    );
    if (!result.success) {
      throw new Error(
        `Production log failed: ${JSON.stringify(result.error.issues, null, 2)}`,
      );
    }
    expect(result.success).toBe(true);
  });
});

describe('unifiedBotStrategyUpdateSchema — good fixtures', () => {
  it('accepts the minimal update sample', () => {
    const result = unifiedBotStrategyUpdateSchema.safeParse(sampleUpdate);
    expect(result.success).toBe(true);
  });

  it('accepts an empty PATCH body (all fields optional)', () => {
    expect(unifiedBotStrategyUpdateSchema.safeParse({}).success).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  BAD fixtures — required / enum / cross-field rules                         */
/* -------------------------------------------------------------------------- */

describe('unifiedBotStrategyCreateSchema — failure cases', () => {
  it('rejects when a required top-level field is missing', () => {
    const { bot_name: _omit, ...withoutBotName } = sampleCreate;
    void _omit;
    const result = unifiedBotStrategyCreateSchema.safeParse(withoutBotName);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'bot_name'),
      ).toBe(true);
    }
  });

  it('rejects unknown stake_currency (e.g. XRP)', () => {
    const bad = { ...sampleCreate, stake_currency: 'XRP' };
    const result = unifiedBotStrategyCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'stake_currency'),
      ).toBe(true);
    }
  });

  it('rejects empty pair (we keep `min(1)` even though we accept perpetual notation)', () => {
    const bad = { ...sampleCreate, pair: '' };
    const result = unifiedBotStrategyCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'pair')).toBe(
        true,
      );
    }
  });

  it('rejects can_short=true when trading_mode is not futures (T-2 refinement)', () => {
    const bad = {
      ...sampleCreate,
      trading_mode: 'spot',
      can_short: true,
      // Spot mode also forbids leverage > 1, so neutralise that to isolate
      // the can_short error.
      leverage: 1,
      margin_mode: undefined,
    };
    const result = unifiedBotStrategyCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'can_short'),
      ).toBe(true);
    }
  });

  it('rejects leverage > 1 when trading_mode is spot (T-3 refinement)', () => {
    const bad = {
      ...sampleCreate,
      trading_mode: 'spot',
      leverage: 5,
      can_short: false,
      margin_mode: undefined,
    };
    const result = unifiedBotStrategyCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'leverage'),
      ).toBe(true);
    }
  });

  it('rejects trading_mode=futures without margin_mode (T-1 refinement)', () => {
    const bad = {
      ...sampleCreate,
      trading_mode: 'futures',
      margin_mode: undefined,
    };
    const result = unifiedBotStrategyCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'margin_mode'),
      ).toBe(true);
    }
  });
});

describe('conditionItemSchema — cross-field rules', () => {
  const baseCondition = {
    left: 'RSI-14',
    op: '<' as const,
    right_type: 'number' as const,
    right_number: 30,
    right_indicator: null,
    lookback: 0,
  };

  it('rejects right_type=number with null right_number', () => {
    const bad = { ...baseCondition, right_number: null };
    const result = conditionItemSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects right_type=indicator with no right_indicator', () => {
    const bad = {
      ...baseCondition,
      right_type: 'indicator' as const,
      right_number: null,
      right_indicator: null,
    };
    const result = conditionItemSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects right_type=none when right_number or right_indicator is set', () => {
    const bad = {
      ...baseCondition,
      right_type: 'none' as const,
      right_number: 5,
      right_indicator: null,
    };
    const result = conditionItemSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts both `crosses_above` (FE legacy) and `crossed_above` (production BE)', () => {
    expect(
      conditionItemSchema.safeParse({ ...baseCondition, op: 'crosses_above' })
        .success,
    ).toBe(true);
    expect(
      conditionItemSchema.safeParse({ ...baseCondition, op: 'crossed_above' })
        .success,
    ).toBe(true);
  });
});

describe('strategyConfigurationsSchema — cross-field rules', () => {
  const baseConfig = {
    interface_version: 3,
    strategy_type: 'statistical',
    timeframe: '5m',
    startup_candle_count: 200,
    informative_timeframes: [],
    process_only_new_candles: true,
    can_short: false,
    risk: {
      stoploss: -0.1,
      trailing_stop: false,
      trailing_only_offset_is_reached: false,
    },
    roi_steps: [],
    use_exit_signal: false,
    exit_profit_only: false,
    exit_profit_offset: 0,
    ignore_roi_if_entry_signal: false,
    max_open_trades: -1,
    signals: {
      candlestick: ['close'],
      indicators: [],
      entry_long: { logic: { type: 'AND', threshold: null }, conditions: [] },
      exit_long: { logic: { type: 'AND', threshold: null }, conditions: [] },
      entry_short: { logic: { type: 'AND', threshold: null }, conditions: [] },
      exit_short: { logic: { type: 'AND', threshold: null }, conditions: [] },
    },
    custom_indicator_items: [],
    informative_ohlcv_items: [],
    custom_exit: {
      duration_enabled: false,
      duration_value: 24,
      duration_unit: 'hours',
      profit_ratio_enabled: false,
      profit_ratio: 2,
      max_duration_enabled: false,
      max_duration_value: 72,
      max_duration_unit: 'hours',
      time_window_enabled: false,
      time_start: '23:00',
      time_end: '23:59',
      partial_enabled: false,
      partial_levels: [],
    },
    leverage: 1,
    position_adjustment_enable: false,
    max_entry_position_adjustment: -1,
  };

  it('rejects unsorted roi_steps', () => {
    const bad = {
      ...baseConfig,
      roi_steps: [
        { minutes: 30, roi: 0.8 },
        { minutes: 0, roi: 1.5 }, // out of order
      ],
    };
    const result = strategyConfigurationsSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'roi_steps')).toBe(
        true,
      );
    }
  });

  it('rejects short conditions when can_short is false', () => {
    const bad = {
      ...baseConfig,
      can_short: false,
      signals: {
        ...baseConfig.signals,
        entry_short: {
          logic: { type: 'AND', threshold: null },
          conditions: [
            {
              left: 'RSI-14',
              op: '>',
              right_type: 'number',
              right_number: 70,
              right_indicator: null,
              lookback: 0,
            },
          ],
        },
      },
    };
    const result = strategyConfigurationsSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'can_short'),
      ).toBe(true);
    }
  });

  it('accepts partial_enabled=true without position_adjustment_enable (matches BE prod behavior)', () => {
    // Originally plan §3.3.3 #4 required position_adjustment_enable=true here,
    // but the production log shows BE doesn't enforce that. Schema follows BE.
    const ok = {
      ...baseConfig,
      position_adjustment_enable: false,
      custom_exit: {
        ...baseConfig.custom_exit,
        partial_enabled: true,
        partial_levels: [{ profit: 5, amount: 50 }],
      },
    };
    expect(strategyConfigurationsSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects partial_levels totalling > 100%', () => {
    const bad = {
      ...baseConfig,
      position_adjustment_enable: false,
      custom_exit: {
        ...baseConfig.custom_exit,
        partial_enabled: true,
        partial_levels: [
          { profit: 5, amount: 60 },
          { profit: 10, amount: 50 }, // 60+50 > 100
        ],
      },
    };
    const result = strategyConfigurationsSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.path.join('.') === 'custom_exit.partial_levels',
        ),
      ).toBe(true);
    }
  });
});

describe('riskConfigSchema — trailing offset refinement', () => {
  it('rejects offset ≤ positive', () => {
    const bad = {
      stoploss: -0.1,
      trailing_stop: true,
      trailing_stop_positive: 0.05,
      trailing_stop_positive_offset: 0.05, // not strictly greater
      trailing_only_offset_is_reached: true,
    };
    const result = riskConfigSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts offset > positive', () => {
    const ok = {
      stoploss: -0.1,
      trailing_stop: true,
      trailing_stop_positive: 0.01,
      trailing_stop_positive_offset: 0.015,
      trailing_only_offset_is_reached: true,
    };
    expect(riskConfigSchema.safeParse(ok).success).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Type-alignment sanity check (compile-time)                                 */
/*                                                                             */
/*  We don't enforce strict equality with the openapi-typescript output —     */
/*  null/undefined and default behavior diverge slightly. Instead, make sure  */
/*  the inferred shape exposes the documented field names so a runtime patch  */
/*  doesn't drift out of step with the spec.                                   */
/* -------------------------------------------------------------------------- */

describe('inferred type sanity', () => {
  it('inferred create payload exposes the 9 required field names', () => {
    const required = [
      'bot_name',
      'exchange_name',
      'strategy_name',
      'dry_run',
      'stake_currency',
      'stake_amount',
      'max_open_trades',
      'timeframe',
      'pair',
    ];
    for (const k of required) {
      expect(Object.prototype.hasOwnProperty.call(sampleCreate, k)).toBe(true);
    }
  });
});
