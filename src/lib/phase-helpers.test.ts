import { describe, expect, it, beforeEach } from 'vitest';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import {
  PHASE_IDS,
  STRATEGY_SUB_STEPS,
  configuredPhaseCount,
  derivePhaseStatus,
  isPhaseSetupComplete,
  stepIdToPhase,
} from './phase-helpers';
import type { StepId, StepStatus } from '@/types/builder.types';

function snapshot() {
  return useBuilderStore.getState();
}

/** Bring all 4 steps into a "valid setup" baseline so we can exercise
 * `isPhaseSetupComplete` without fighting the validator. */
function fillAllSetupValid() {
  const s = useBuilderStore.getState();
  s.patchBotConfig({
    pair: 'BTC-USDC',
    timeframe: '5m',
    leverage: 1,
  });
  s.patchStrategy({
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
  // direction + close-method already pass setup gate by default.
}

describe('phase-helpers', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  /* ─── stepIdToPhase ──────────────────────────────────────────────── */

  describe('stepIdToPhase', () => {
    it.each([
      ['bot-config', 'bot-basics'],
      ['entry-strategy', 'strategy'],
      ['direction', 'strategy'],
      ['close-method', 'strategy'],
    ] as const)('maps %s → %s', (stepId, expected) => {
      expect(stepIdToPhase(stepId as StepId)).toBe(expected);
    });
  });

  /* ─── derivePhaseStatus: bot-basics passthrough ──────────────────── */

  describe('derivePhaseStatus(bot-basics)', () => {
    it.each<StepStatus>(['pending', 'editing', 'configured', 'error'])(
      'passes through bot-config status: %s',
      (status) => {
        useBuilderStore.getState().setStepStatus('bot-config', status);
        expect(derivePhaseStatus(snapshot(), 'bot-basics')).toBe(status);
      },
    );
  });

  /* ─── derivePhaseStatus(strategy) — composite priority ───────────── */

  describe('derivePhaseStatus(strategy)', () => {
    it('returns "configured" only when ALL 3 sub-steps are configured', () => {
      const { setStepStatus } = useBuilderStore.getState();
      setStepStatus('entry-strategy', 'configured');
      setStepStatus('direction', 'configured');
      // close-method still pending → not yet
      expect(derivePhaseStatus(snapshot(), 'strategy')).toBe('pending');

      setStepStatus('close-method', 'configured');
      expect(derivePhaseStatus(snapshot(), 'strategy')).toBe('configured');
    });

    it('returns "error" if ANY sub-step is error (priority 1, beats editing)', () => {
      const { setStepStatus } = useBuilderStore.getState();
      setStepStatus('entry-strategy', 'editing');
      setStepStatus('direction', 'configured');
      setStepStatus('close-method', 'error');
      expect(derivePhaseStatus(snapshot(), 'strategy')).toBe('error');
    });

    it('returns "editing" if any sub editing and none error (priority 2)', () => {
      const { setStepStatus } = useBuilderStore.getState();
      setStepStatus('entry-strategy', 'editing');
      setStepStatus('direction', 'configured');
      setStepStatus('close-method', 'pending');
      expect(derivePhaseStatus(snapshot(), 'strategy')).toBe('editing');
    });

    it('returns "pending" for the pristine 3-pending baseline', () => {
      // beforeEach resetAll → all 4 steps pending
      expect(derivePhaseStatus(snapshot(), 'strategy')).toBe('pending');
    });

    it('returns "pending" for a mix of pending + configured (no editing/error)', () => {
      const { setStepStatus } = useBuilderStore.getState();
      setStepStatus('entry-strategy', 'configured');
      setStepStatus('direction', 'pending');
      setStepStatus('close-method', 'configured');
      expect(derivePhaseStatus(snapshot(), 'strategy')).toBe('pending');
    });
  });

  /* ─── isPhaseSetupComplete ───────────────────────────────────────── */

  describe('isPhaseSetupComplete', () => {
    it('bot-basics: false in pristine state (empty pair)', () => {
      expect(isPhaseSetupComplete(snapshot(), 'bot-basics')).toBe(false);
    });

    it('bot-basics: true once required fields are filled', () => {
      useBuilderStore.getState().patchBotConfig({
        pair: 'BTC-USDC',
        timeframe: '5m',
        leverage: 1,
      });
      expect(isPhaseSetupComplete(snapshot(), 'bot-basics')).toBe(true);
    });

    it('strategy: false in pristine state (entry conditions empty)', () => {
      // direction + close-method default-pass; entry-strategy is the gate.
      expect(isPhaseSetupComplete(snapshot(), 'strategy')).toBe(false);
    });

    it('strategy: true once entry-strategy gate is satisfied', () => {
      fillAllSetupValid();
      expect(isPhaseSetupComplete(snapshot(), 'strategy')).toBe(true);
    });
  });

  /* ─── configuredPhaseCount ───────────────────────────────────────── */

  describe('configuredPhaseCount', () => {
    it('returns 0 when nothing is configured', () => {
      expect(configuredPhaseCount(snapshot())).toBe(0);
    });

    it('returns 1 when only bot-basics is configured', () => {
      useBuilderStore.getState().setStepStatus('bot-config', 'configured');
      expect(configuredPhaseCount(snapshot())).toBe(1);
    });

    it('returns 2 only when both phases are configured', () => {
      const { setStepStatus } = useBuilderStore.getState();
      setStepStatus('bot-config', 'configured');
      setStepStatus('entry-strategy', 'configured');
      setStepStatus('direction', 'configured');
      // close-method still pending → strategy phase not configured
      expect(configuredPhaseCount(snapshot())).toBe(1);

      setStepStatus('close-method', 'configured');
      expect(configuredPhaseCount(snapshot())).toBe(2);
    });
  });

  /* ─── exported constants — sanity ────────────────────────────────── */

  describe('module exports', () => {
    it('exposes the 3 strategy sub-steps in canonical order', () => {
      expect([...STRATEGY_SUB_STEPS]).toEqual([
        'entry-strategy',
        'direction',
        'close-method',
      ]);
    });

    it('exposes the 2 phase ids', () => {
      expect([...PHASE_IDS]).toEqual(['bot-basics', 'strategy']);
    });
  });
});
