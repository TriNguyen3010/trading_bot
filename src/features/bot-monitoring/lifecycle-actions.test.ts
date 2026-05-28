import { describe, it, expect } from 'vitest';
import {
  isTerminal,
  nextOptimisticStatus,
  formatStatusLabel,
} from './lifecycle-actions';

describe('isTerminal', () => {
  it('returns true for known terminal states', () => {
    expect(isTerminal('running')).toBe(true);
    expect(isTerminal('stopped')).toBe(true);
    expect(isTerminal('error')).toBe(true);
  });
  it('returns false for transition states', () => {
    expect(isTerminal('starting')).toBe(false);
    expect(isTerminal('stopping')).toBe(false);
  });
  it('treats unknown status as non-terminal (keep polling)', () => {
    expect(isTerminal('weird-new-state')).toBe(false);
  });
});

describe('nextOptimisticStatus', () => {
  it('start → starting', () => {
    expect(nextOptimisticStatus('start', 'stopped')).toBe('starting');
    expect(nextOptimisticStatus('start', 'error')).toBe('starting');
  });
  it('stop → stopping', () => {
    expect(nextOptimisticStatus('stop', 'running')).toBe('stopping');
  });
  it('sync → leaves status alone (server picks)', () => {
    expect(nextOptimisticStatus('sync', 'running')).toBe('running');
    expect(nextOptimisticStatus('sync', 'error')).toBe('error');
  });
});

describe('formatStatusLabel', () => {
  it('returns human label for known states', () => {
    expect(formatStatusLabel('running')).toBe('Running');
    expect(formatStatusLabel('stopped')).toBe('Stopped');
    expect(formatStatusLabel('starting')).toBe('Starting…');
    expect(formatStatusLabel('stopping')).toBe('Stopping…');
    expect(formatStatusLabel('error')).toBe('Error');
  });
  it('falls back to titlecase for unknown', () => {
    expect(formatStatusLabel('weird_new')).toBe('Weird new');
  });
});
