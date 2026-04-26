import { describe, expect, it, beforeEach } from 'vitest';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { isStepSetupComplete } from './validator';

function snapshot() {
  return useBuilderStore.getState();
}

describe('isStepSetupComplete', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  describe('bot-config', () => {
    it('returns false when pair is empty', () => {
      expect(isStepSetupComplete('bot-config', snapshot())).toBe(false);
    });

    it('returns false when pair is malformed', () => {
      useBuilderStore.getState().patchBotConfig({ pair: 'NOTAPAIR' });
      expect(isStepSetupComplete('bot-config', snapshot())).toBe(false);
    });

    it('returns true when pair valid + timeframe + leverage in range', () => {
      useBuilderStore
        .getState()
        .patchBotConfig({ pair: 'BTC-USDC', timeframe: '5m', leverage: 1 });
      expect(isStepSetupComplete('bot-config', snapshot())).toBe(true);
    });

    it('returns false when leverage out of range', () => {
      useBuilderStore
        .getState()
        .patchBotConfig({ pair: 'BTC-USDC', timeframe: '5m', leverage: 0 });
      expect(isStepSetupComplete('bot-config', snapshot())).toBe(false);
    });
  });

  describe('entry-strategy', () => {
    it('returns false in pristine state (no source, no condition)', () => {
      expect(isStepSetupComplete('entry-strategy', snapshot())).toBe(false);
    });

    it('returns false with source but no condition', () => {
      useBuilderStore.getState().patchStrategy({ candlestick: ['close'] });
      expect(isStepSetupComplete('entry-strategy', snapshot())).toBe(false);
    });

    it('returns true with at least one source and one condition', () => {
      useBuilderStore.getState().patchStrategy({
        candlestick: ['close'],
        entryConditions: {
          logic: { type: 'AND', threshold: null },
          conditions: [
            {
              id: 'c1',
              left: 'candle.close',
              op: '>',
              right_type: 'number',
              right_number: 100,
              right_indicator: null,
              lookback: 0,
            },
          ],
        },
      });
      expect(isStepSetupComplete('entry-strategy', snapshot())).toBe(true);
    });
  });

  describe('direction', () => {
    it('returns true with default direction + orderType (both have defaults)', () => {
      // Pristine direction form already has 'long' + 'market', so setup-complete.
      expect(isStepSetupComplete('direction', snapshot())).toBe(true);
    });
  });

  describe('close-method', () => {
    it('returns true for any picked method (default tp_sl satisfies)', () => {
      expect(isStepSetupComplete('close-method', snapshot())).toBe(true);
    });

    it('returns true for manual immediately', () => {
      useBuilderStore.getState().patchCloseMethod({ type: 'manual' });
      expect(isStepSetupComplete('close-method', snapshot())).toBe(true);
    });
  });
});
