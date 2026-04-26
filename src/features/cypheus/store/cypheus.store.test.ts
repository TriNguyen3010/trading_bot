import { describe, expect, it, beforeEach } from 'vitest';
import { useCypheusStore } from './cypheus.store';

describe('cypheus store — drawer state', () => {
  beforeEach(() => {
    useCypheusStore.getState().resetAll();
  });

  it('defaults to closed drawer with no active step', () => {
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('closed');
    expect(s.cypheusActiveStepId).toBeNull();
  });

  it('startCypheusDrawer pins the drawer and sets first step', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('cypheus-pinned');
    expect(s.cypheusActiveStepId).toBe('bot-config');
  });

  it('switchCypheusStep updates active step but keeps mode pinned', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    useCypheusStore.getState().switchCypheusStep('entry-strategy');
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('cypheus-pinned');
    expect(s.cypheusActiveStepId).toBe('entry-strategy');
  });

  it('showCypheusSummary flips mode to summary, keeps last step', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    useCypheusStore.getState().switchCypheusStep('close-method');
    useCypheusStore.getState().showCypheusSummary();
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('cypheus-summary');
    expect(s.cypheusActiveStepId).toBe('close-method');
  });

  it('closeCypheusDrawer resets drawer and step', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    useCypheusStore.getState().closeCypheusDrawer();
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('closed');
    expect(s.cypheusActiveStepId).toBeNull();
  });

  it('resetAll clears drawer state', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    useCypheusStore.getState().resetAll();
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('closed');
    expect(s.cypheusActiveStepId).toBeNull();
  });
});
