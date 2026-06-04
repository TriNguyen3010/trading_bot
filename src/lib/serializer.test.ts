import { describe, expect, it, beforeEach } from 'vitest';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import {
  buildBundle,
  buildUnifiedPayload,
  deserializeBundle,
  deserializeUnifiedPayload,
  toPythonClassName,
} from './serializer';
import { bundleSchema } from '@/schemas/bundle.schema';
import { unifiedBotStrategyCreateSchema } from '@/schemas/unified-bot-strategy.schema';
import { makeIndicator } from '@/features/indicators/indicator-registry';

describe('serializer', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  function applyBollingerLong() {
    const store = useBuilderStore.getState();
    store.setBotName('Bollinger Breakout');
    store.patchBotConfig({
      pair: 'BTC-USDC',
      timeframe: '5m',
      leverage: 20,
      marketType: 'futures',
    });
    const rsi = makeIndicator('RSI');
    store.patchStrategy({
      name: 'Bollinger',
      candlestick: ['close', 'volume'],
      indicators: [rsi],
      entryConditions: {
        groupConnector: 'AND',
        groups: [
          {
            id: 'g1',
            intraConnector: 'AND',
            rules: [
              {
                id: 'c1',
                left: 'RSI-14',
                op: '<',
                right_type: 'number',
                right_number: 30,
                right_indicator: null,
                lookback: 0,
              },
            ],
          },
        ],
      },
    });
    store.patchDirection({ direction: 'long', orderType: 'market' });
    store.patchCloseMethod({
      type: 'tp_sl',
      tpEnabled: true,
      tpLevels: [
        { profit: 5, amount: 50 },
        { profit: 10, amount: 25 },
      ],
      slEnabled: true,
      slValue: -3,
    });
  }

  it('produces a bundle that conforms to the Zod schema', () => {
    applyBollingerLong();
    const bundle = buildBundle(useBuilderStore.getState());
    const result = bundleSchema.safeParse(bundle);
    expect(result.success).toBe(true);
  });

  it('converts UI pair "BTC-USDC" futures to "BTC/USDC:USDC"', () => {
    applyBollingerLong();
    const bundle = buildBundle(useBuilderStore.getState());
    expect(bundle.bot.pair).toBe('BTC/USDC:USDC');
  });

  it('sanitizes strategy_name to a Python class name in the unified payload', () => {
    const store = useBuilderStore.getState();
    store.resetAll();
    store.patchStrategy({ name: 'my BTC scalper v2' });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    expect(payload.strategy_name).toBe('MyBTCScalperV2');
  });

  it('puts conditions on entry_long when direction is long', () => {
    applyBollingerLong();
    const bundle = buildBundle(useBuilderStore.getState());
    expect(
      bundle.strategy.configurations.signals.entry_long.conditions.length,
    ).toBe(1);
    expect(
      bundle.strategy.configurations.signals.entry_short.conditions.length,
    ).toBe(0);
    expect(bundle.bot.can_short).toBe(false);
  });

  it('flips to entry_short + can_short when direction is short', () => {
    applyBollingerLong();
    useBuilderStore.getState().patchDirection({ direction: 'short' });
    const bundle = buildBundle(useBuilderStore.getState());
    expect(
      bundle.strategy.configurations.signals.entry_short.conditions.length,
    ).toBe(1);
    expect(
      bundle.strategy.configurations.signals.entry_long.conditions.length,
    ).toBe(0);
    expect(bundle.bot.can_short).toBe(true);
  });

  it('serializes TP levels into custom_exit.partial_levels', () => {
    applyBollingerLong();
    const bundle = buildBundle(useBuilderStore.getState());
    expect(bundle.strategy.configurations.custom_exit.partial_enabled).toBe(
      true,
    );
    expect(bundle.strategy.configurations.custom_exit.partial_levels).toEqual([
      { profit: 5, amount: 50 },
      { profit: 10, amount: 25 },
    ]);
  });

  it('buildUnifiedPayload conforms to UnifiedBotStrategyCreate schema', () => {
    applyBollingerLong();
    // Direction default in applyBollingerLong is 'long' on 'futures', which
    // would trip the can_short=true → futures-only refinement only when set
    // explicitly. Force long to keep can_short=false.
    useBuilderStore.getState().patchDirection({ direction: 'long' });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    const result = unifiedBotStrategyCreateSchema.safeParse(payload);
    if (!result.success) {
      throw new Error(
        `buildUnifiedPayload schema check failed: ${JSON.stringify(
          result.error.issues,
          null,
          2,
        )}`,
      );
    }
    // Sanity checks on key fields.
    expect(payload.bot_name).toBe('Bollinger Breakout');
    expect(payload.pair).toBe('BTC/USDC:USDC');
    expect(payload.trading_mode).toBe('futures');
    expect(payload.margin_mode).toBe('cross');
    expect(payload.configurations?.signals.entry_long?.conditions).toHaveLength(
      1,
    );
  });

  it('short bot passes UnifiedBotStrategyCreate schema (top-level can_short)', () => {
    // Regression: BE checks can_short at TOP-LEVEL (see BE source-of-truth
    // samples — configurations carries no can_short). The FE schema must not
    // reject a short bot just because configurations.can_short is unset.
    applyBollingerLong();
    useBuilderStore.getState().patchDirection({ direction: 'short' });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    expect(payload.can_short).toBe(true);
    const result = unifiedBotStrategyCreateSchema.safeParse(payload);
    if (!result.success) {
      throw new Error(
        `short bot rejected by schema: ${JSON.stringify(result.error.issues, null, 2)}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it('unified payload emits past-tense cross ops (crossed_above); legacy bundle keeps present tense', () => {
    const store = useBuilderStore.getState();
    store.resetAll();
    store.patchBotConfig({ pair: 'BTC-USDC', marketType: 'futures' });
    store.patchStrategy({
      name: 'X',
      indicators: [makeIndicator('BB')],
      entryConditions: {
        groupConnector: 'AND',
        groups: [
          {
            id: 'g1',
            intraConnector: 'AND',
            rules: [
              {
                id: 'c1',
                left: 'candle.close',
                op: 'crosses_above',
                right_type: 'indicator',
                right_number: null,
                right_indicator: 'BB-20',
                lookback: 0,
              },
            ],
          },
        ],
      },
    });
    store.patchDirection({ direction: 'long', orderType: 'market' });

    const unified = buildUnifiedPayload(useBuilderStore.getState());
    const uCond = unified.configurations?.signals.entry_long?.conditions[0] as {
      op: string;
    };
    expect(uCond.op).toBe('crossed_above');

    // Legacy bundle path must stay present-tense (its schema only allows present).
    const bundle = buildBundle(useBuilderStore.getState());
    const bCond = bundle.strategy.configurations.signals.entry_long
      .conditions[0] as { op: string };
    expect(bCond.op).toBe('crosses_above');
  });

  it('does not inject configurations defaults absent from BE create samples', () => {
    // BE create samples carry these at TOP-LEVEL (or omit them); their
    // configurations block has none of them. Zod .default() must not inject
    // them — esp. configurations.leverage=1 which would contradict the
    // top-level leverage the bot actually runs at.
    applyBollingerLong(); // leverage 20, futures, long
    useBuilderStore.getState().patchDirection({ direction: 'long' });
    const wire = unifiedBotStrategyCreateSchema.parse(
      buildUnifiedPayload(useBuilderStore.getState()),
    );
    const cfg = wire.configurations as Record<string, unknown>;
    for (const key of [
      'interface_version',
      'timeframe',
      'process_only_new_candles',
      'can_short',
      'leverage',
      'position_adjustment_enable',
      'max_entry_position_adjustment',
    ]) {
      expect(key in cfg).toBe(false);
    }
    // Top-level still carries the real values.
    expect(wire.leverage).toBe(20);
  });

  it('sends telegram as null when the wizard has no telegram config', () => {
    // The wizard exposes no telegram fields, so the token is always null.
    // The BE MERGES a provided telegram block into the Freqtrade config, and
    // a null token there crashes it (HTTP 500). The proven-good payload simply
    // omits telegram — so we must send null, not a block with a null token.
    applyBollingerLong();
    useBuilderStore.getState().patchDirection({ direction: 'long' });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    expect(payload.telegram).toBeNull();
  });

  it('round-trips a bundle through deserializeBundle', () => {
    applyBollingerLong();
    const bundle = buildBundle(useBuilderStore.getState());
    const restored = deserializeBundle(bundle);
    expect(restored.botName).toBe('Bollinger Breakout');
    expect(restored.botConfig.pair).toBe('BTC-USDC');
    expect(restored.botConfig.leverage).toBe(20);
    expect(restored.directionForm.direction).toBe('long');
    expect(restored.closeMethod.type).toBe('tp_sl');
    expect(restored.closeMethod.tpLevels).toHaveLength(2);
  });

  it('round-trips a unified payload through deserializeUnifiedPayload', () => {
    applyBollingerLong();
    useBuilderStore.getState().patchDirection({ direction: 'long' });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    // Stringify+parse to mimic export → file → import (verifies the
    // FE-only fields survive the JSON encoding round-trip).
    const wire = JSON.parse(JSON.stringify(payload));
    const restored = deserializeUnifiedPayload(wire);

    expect(restored.botName).toBe('Bollinger Breakout');
    expect(restored.botConfig.pair).toBe('BTC-USDC');
    expect(restored.botConfig.timeframe).toBe('5m');
    expect(restored.botConfig.leverage).toBe(20);
    expect(restored.botConfig.marketType).toBe('futures');
    expect(restored.directionForm.direction).toBe('long');
    expect(restored.directionForm.orderType).toBe('market');
    expect(restored.closeMethod.type).toBe('tp_sl');
    expect(restored.closeMethod.tpLevels).toEqual([
      { profit: 5, amount: 50 },
      { profit: 10, amount: 25 },
    ]);
    expect(restored.closeMethod.slEnabled).toBe(true);
    expect(restored.closeMethod.slValue).toBeCloseTo(-3, 5);
    expect(restored.strategy.indicators).toHaveLength(1);
    expect(restored.strategy.entryConditions.groups[0].rules).toHaveLength(1);
  });

  it('preserves limit order details across unified round-trip', () => {
    applyBollingerLong();
    useBuilderStore.getState().patchDirection({
      direction: 'long',
      orderType: 'limit',
      limitOffsetPct: 0.25,
    });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    const wire = JSON.parse(JSON.stringify(payload));
    const restored = deserializeUnifiedPayload(wire);

    expect(restored.directionForm.orderType).toBe('limit');
    expect(restored.directionForm.limitOffsetPct).toBe(0.25);
  });

  it('flips entry_short and recovers can_short=true direction on unified round-trip', () => {
    applyBollingerLong();
    useBuilderStore.getState().patchDirection({ direction: 'short' });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    const wire = JSON.parse(JSON.stringify(payload));
    const restored = deserializeUnifiedPayload(wire);

    expect(restored.directionForm.direction).toBe('short');
    expect(restored.strategy.entryConditions.groups[0].rules).toHaveLength(1);
  });

  it('infers close_method_type=roi when the FE-only field is missing', () => {
    applyBollingerLong();
    useBuilderStore.getState().patchCloseMethod({
      type: 'roi',
      roiSteps: [
        { minutes: 0, roi: 5 },
        { minutes: 60, roi: 2 },
      ],
    });
    useBuilderStore.getState().patchDirection({ direction: 'long' });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    const wire = JSON.parse(JSON.stringify(payload));
    // Drop the FE round-trip hint to simulate a non-FE source.
    delete wire.close_method_type;
    const restored = deserializeUnifiedPayload(wire);

    expect(restored.closeMethod.type).toBe('roi');
    expect(restored.closeMethod.roiSteps).toEqual([
      { minutes: 0, roi: 5 },
      { minutes: 60, roi: 2 },
    ]);
  });

  it('buildUnifiedPayload always sends dry_run: true regardless of store state', () => {
    applyBollingerLong();
    // Mode is decided at launch (Launchpad flips dry_run); create always ships dry.
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    expect(payload.dry_run).toBe(true);
  });

  // F1: the trailing offset>positive refinement must NOT fire when trailing is
  // disabled — those fields are inert then, and Freqtrade ignores them.
  it('passes schema with trailing disabled even when offset <= positive', () => {
    applyBollingerLong();
    useBuilderStore.getState().patchCloseMethod({
      trailingEnabled: false,
      trailingPositive: 5, // 0.05
      trailingOffset: 2, // 0.02 — would violate offset>positive IF trailing were on
    });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    const result = unifiedBotStrategyCreateSchema.safeParse(payload);
    if (!result.success) {
      throw new Error(
        `expected pass (trailing off): ${JSON.stringify(result.error.issues)}`,
      );
    }
    expect(result.success).toBe(true);
  });

  // ...but it MUST still fire when trailing is ENABLED with a bad offset.
  it('rejects schema with trailing enabled and offset <= positive', () => {
    applyBollingerLong();
    useBuilderStore.getState().patchCloseMethod({
      trailingEnabled: true,
      trailingPositive: 5,
      trailingOffset: 2,
    });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    expect(unifiedBotStrategyCreateSchema.safeParse(payload).success).toBe(
      false,
    );
  });

  // F2: a tp_sl bot with SL turned OFF must round-trip back as slEnabled:false
  // (not silently re-enabled at the -0.4 sentinel).
  it('round-trips a tp_sl bot with SL disabled as slEnabled:false', () => {
    applyBollingerLong();
    useBuilderStore.getState().patchCloseMethod({ slEnabled: false });
    useBuilderStore.getState().patchDirection({ direction: 'long' });
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    expect(payload.stoploss).toBeNull(); // top-level stoploss null when SL off
    const wire = JSON.parse(JSON.stringify(payload));
    const restored = deserializeUnifiedPayload(wire);
    expect(restored.closeMethod.slEnabled).toBe(false);
  });

  // Hyperliquid is perp-only + the builder locks futures, so a payload missing
  // trading_mode must decode to futures (not spot, which + leverage>1 fails T-3).
  it('deserialize defaults marketType to futures when trading_mode is absent', () => {
    applyBollingerLong();
    const payload = buildUnifiedPayload(useBuilderStore.getState());
    const wire = JSON.parse(JSON.stringify(payload));
    delete wire.trading_mode;
    const restored = deserializeUnifiedPayload(wire);
    expect(restored.botConfig.marketType).toBe('futures');
  });

  describe('toPythonClassName', () => {
    it('PascalCases a space-separated name', () => {
      expect(toPythonClassName('Bollinger Breakout')).toBe('BollingerBreakout');
    });

    it('strips non-alphanumeric chars (dashes, dots, slashes)', () => {
      expect(toPythonClassName('my-bot.v2')).toBe('MyBotV2');
    });

    it('handles Vietnamese diacritics by NFD-normalizing them', () => {
      expect(toPythonClassName('Bot tăng giá')).toBe('BotTangGia');
      expect(toPythonClassName('Chiến lược RSI')).toBe('ChienLuocRSI');
    });

    it('preserves uppercase acronyms when user types them', () => {
      expect(toPythonClassName('My RSI strategy')).toBe('MyRSIStrategy');
    });

    it('prepends S when name starts with a digit', () => {
      expect(toPythonClassName('1bot')).toBe('S1bot');
    });

    it('falls back to MyStrategy when input has no alphanumerics', () => {
      expect(toPythonClassName('  --  ')).toBe('MyStrategy');
      expect(toPythonClassName('')).toBe('MyStrategy');
    });

    it('keeps an already-valid PascalCase identifier intact', () => {
      expect(toPythonClassName('MyRSIStrategy')).toBe('MyRSIStrategy');
    });
  });
});
