import { describe, expect, it, beforeEach } from 'vitest';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { buildBundle, buildUnifiedPayload, deserializeBundle } from './serializer';
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
      tradingMode: 'dry-run',
      leverage: 20,
      marketType: 'futures',
    });
    const rsi = makeIndicator('RSI');
    store.patchStrategy({
      name: 'Bollinger',
      candlestick: ['close', 'volume'],
      indicators: [rsi],
      entryConditions: {
        logic: { type: 'AND', threshold: null },
        conditions: [
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
    expect(
      bundle.strategy.configurations.custom_exit.partial_enabled,
    ).toBe(true);
    expect(
      bundle.strategy.configurations.custom_exit.partial_levels,
    ).toEqual([
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
    expect(payload.configurations?.signals.entry_long?.conditions).toHaveLength(1);
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
});
