import { describe, it, expect } from 'vitest';
import { derivePresentationalState } from '../presentational-state';

describe('derivePresentationalState', () => {
  it('returns the mode unchanged when running with a completed backtest', () => {
    expect(
      derivePresentationalState('DRY-RUN', {
        historyCount: 5,
        latestStatus: 'completed',
      }),
    ).toBe('DRY-RUN');
    expect(
      derivePresentationalState('LIVE', {
        historyCount: 0,
        latestStatus: null,
      }),
    ).toBe('LIVE');
  });

  it('BACKTESTING overlays any mode when latest backtest is running/pending', () => {
    expect(
      derivePresentationalState('PAUSED', {
        historyCount: 1,
        latestStatus: 'running',
      }),
    ).toBe('BACKTESTING');
    expect(
      derivePresentationalState('DRY-RUN', {
        historyCount: 1,
        latestStatus: 'pending',
      }),
    ).toBe('BACKTESTING');
  });

  it('NEW when paused with no backtest history', () => {
    expect(
      derivePresentationalState('PAUSED', {
        historyCount: 0,
        latestStatus: null,
      }),
    ).toBe('NEW');
  });

  it('BACKTEST_FAILED when paused and latest backtest failed', () => {
    expect(
      derivePresentationalState('PAUSED', {
        historyCount: 2,
        latestStatus: 'failed',
      }),
    ).toBe('BACKTEST_FAILED');
  });

  it('plain PAUSED when paused with a completed backtest', () => {
    expect(
      derivePresentationalState('PAUSED', {
        historyCount: 2,
        latestStatus: 'completed',
      }),
    ).toBe('PAUSED');
  });

  it('ERROR/STARTING/STOPPING pass through', () => {
    expect(
      derivePresentationalState('ERROR', {
        historyCount: 0,
        latestStatus: null,
      }),
    ).toBe('ERROR');
    expect(
      derivePresentationalState('STARTING', {
        historyCount: 0,
        latestStatus: null,
      }),
    ).toBe('STARTING');
  });
});
