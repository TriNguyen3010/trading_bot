import { describe, expect, it, beforeEach } from 'vitest';
import { useBuilderStore } from './builder.store';

describe('builder store', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('starts with all 4 steps in pending status', () => {
    const { stepStatus } = useBuilderStore.getState();
    expect(stepStatus['bot-config']).toBe('pending');
    expect(stepStatus['entry-strategy']).toBe('pending');
    expect(stepStatus['direction']).toBe('pending');
    expect(stepStatus['close-method']).toBe('pending');
  });

  it('marks bot dirty when bot name changes', () => {
    useBuilderStore.getState().setBotName('My Bot');
    const state = useBuilderStore.getState();
    expect(state.botName).toBe('My Bot');
    expect(state.isDirty).toBe(true);
    expect(state.lastSavedAt).not.toBeNull();
  });

  it('opens and closes a step drawer', () => {
    useBuilderStore.getState().setOpenStep('bot-config');
    expect(useBuilderStore.getState().openStep).toBe('bot-config');
    useBuilderStore.getState().setOpenStep(null);
    expect(useBuilderStore.getState().openStep).toBeNull();
  });

  it('reset returns the store to pristine state', () => {
    useBuilderStore.getState().setBotName('Bot A');
    useBuilderStore.getState().setStepStatus('bot-config', 'configured');
    useBuilderStore.getState().resetAll();
    const state = useBuilderStore.getState();
    expect(state.botName).toBe('Untitled bot');
    expect(state.stepStatus['bot-config']).toBe('pending');
    expect(state.isDirty).toBe(false);
  });
});
