import { describe, it, expect, beforeEach } from 'vitest';
import { useCypheusStore } from './cypheus.store';

describe('cypheus.store (slim surface)', () => {
  beforeEach(() => {
    useCypheusStore.getState().resetAll();
  });

  it('exposes only the slim surface: phase, messages, resetAll', () => {
    const s = useCypheusStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.messages).toEqual([]);
    expect(typeof s.setPhase).toBe('function');
    expect(typeof s.pushMessage).toBe('function');
    expect(typeof s.clearMessages).toBe('function');
    expect(typeof s.resetAll).toBe('function');
  });

  it('does NOT expose magic-build or panel-tab surface', () => {
    const s = useCypheusStore.getState() as unknown as Record<string, unknown>;
    expect(s.panelTab).toBeUndefined();
    expect(s.jsonViewedAt).toBeUndefined();
    expect(s.drawerMode).toBeUndefined();
    expect(s.cypheusActiveStepId).toBeUndefined();
    expect(s.startCypheusDrawer).toBeUndefined();
    expect(s.switchCypheusStep).toBeUndefined();
    expect(s.showCypheusSummary).toBeUndefined();
    expect(s.closeCypheusDrawer).toBeUndefined();
  });

  it('setPhase updates the phase', () => {
    useCypheusStore.getState().setPhase('active');
    expect(useCypheusStore.getState().phase).toBe('active');
    useCypheusStore.getState().setPhase('completed');
    expect(useCypheusStore.getState().phase).toBe('completed');
  });

  it('pushMessage appends a message with a generated id + timestamp', () => {
    const id = useCypheusStore
      .getState()
      .pushMessage({ role: 'cypheus', text: 'hi' });
    const messages = useCypheusStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(id);
    expect(messages[0].text).toBe('hi');
    expect(messages[0].ts).toBeGreaterThan(0);
  });

  it('resetAll clears messages and phase', () => {
    useCypheusStore.getState().pushMessage({ role: 'cypheus', text: 'x' });
    useCypheusStore.getState().setPhase('active');
    useCypheusStore.getState().resetAll();
    expect(useCypheusStore.getState().messages).toEqual([]);
    expect(useCypheusStore.getState().phase).toBe('idle');
  });
});
