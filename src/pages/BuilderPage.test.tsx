import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BuilderPage } from './BuilderPage';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';

// jsdom doesn't implement matchMedia; DotGridSpotlight reads it during
// its mount effect to detect reduced-motion / no-hover environments.
// Install a noop stub so rendering BuilderPage doesn't crash.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('BuilderPage — dock phase trigger', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
    useCypheusStore.getState().resetAll();
  });

  it('transitions cypheus phase idle → active the first time openStep changes', () => {
    render(
      <MemoryRouter>
        <BuilderPage />
      </MemoryRouter>,
    );

    expect(useCypheusStore.getState().phase).toBe('idle');

    act(() => {
      useBuilderStore.getState().setOpenStep('bot-config');
    });

    expect(useCypheusStore.getState().phase).toBe('active');
  });

  it('does not flip back to active after completed', () => {
    render(
      <MemoryRouter>
        <BuilderPage />
      </MemoryRouter>,
    );

    act(() => {
      useCypheusStore.getState().setPhase('completed');
      useBuilderStore.getState().setOpenStep('bot-config');
    });

    expect(useCypheusStore.getState().phase).toBe('completed');
  });
});
