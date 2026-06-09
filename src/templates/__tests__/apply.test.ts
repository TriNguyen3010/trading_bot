import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock sonner so we can assert the toast payload (jsdom has no Toaster).
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';
import { applyTemplate } from '../apply';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { breakoutBtc15m } from '../catalog/breakout-btc-15m';
import { strings } from '@/i18n/en';

describe('applyTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBuilderStore.getState().resetAll();
  });

  it('snap-applies the template state synchronously without invoking any animation engine', async () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    await applyTemplate(breakoutBtc15m);

    const state = useBuilderStore.getState();
    expect(state.botName).toBe(breakoutBtc15m.state.botName);
    expect(state.botConfig).toEqual(breakoutBtc15m.state.botConfig);

    // Animation engine schedules setTimeout with sizeable delays (sleep/typewriter
    // ticks ≥ 100ms). Zustand's `persist` middleware uses delay 0 for storage
    // event dispatch — that's incidental and not what this test is guarding.
    const animationTimers = setTimeoutSpy.mock.calls.filter(
      ([, delay]) => typeof delay === 'number' && delay > 0,
    );
    expect(animationTimers).toEqual([]);

    setTimeoutSpy.mockRestore();
  });

  it('fires the "Applied" toast with the text-view hint as its description', async () => {
    await applyTemplate(breakoutBtc15m);

    expect(toast.success).toHaveBeenCalledWith(
      strings.templates.apply.loadedToast(breakoutBtc15m.name),
      { description: strings.templates.apply.textViewHint },
    );
  });
});
