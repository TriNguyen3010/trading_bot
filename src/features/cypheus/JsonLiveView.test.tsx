import { describe, expect, it, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { JsonLiveView } from './JsonLiveView';

describe('JsonLiveView', () => {
  beforeEach(() => {
    act(() => {
      useBuilderStore.getState().resetAll();
      useCypheusStore.getState().resetAll();
    });
  });

  it('shows empty placeholder when no step is configured', () => {
    render(<JsonLiveView />);
    expect(screen.getByText(/Your bot's JSON will live here/i)).toBeInTheDocument();
    expect(screen.getByText(/Configure any step to see the live preview/i)).toBeInTheDocument();
    // No JSON <pre> element
    expect(screen.queryByRole('code')).toBeNull();
    // No Copy / Download buttons
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
  });

  it('shows JSON pane after a step is configured', () => {
    act(() => {
      useBuilderStore.getState().patchBotConfig({
        pair: 'BTC-USDC',
        timeframe: '5m',
        leverage: 1,
        stakeAmount: 100,
      });
      useBuilderStore.getState().setStepStatus('bot-config', 'configured');
    });

    render(<JsonLiveView />);
    // Empty state should be gone
    expect(screen.queryByText(/Your bot's JSON will live here/i)).toBeNull();
    // JSON tabs visible
    expect(screen.getByText('bot.json')).toBeInTheDocument();
    expect(screen.getByText('strategy.json')).toBeInTheDocument();
    // Copy and Download available
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('returns to empty state after resetAll', () => {
    act(() => {
      useBuilderStore.getState().setStepStatus('bot-config', 'configured');
    });

    const { rerender } = render(<JsonLiveView />);
    expect(screen.queryByText(/Your bot's JSON will live here/i)).toBeNull();

    act(() => {
      useBuilderStore.getState().resetAll();
    });

    rerender(<JsonLiveView />);
    expect(screen.getByText(/Your bot's JSON will live here/i)).toBeInTheDocument();
  });

  it('"Open Bot Config" CTA sets openStep to bot-config', () => {
    render(<JsonLiveView />);
    fireEvent.click(screen.getByRole('button', { name: /Open Bot Config/i }));
    expect(useBuilderStore.getState().openStep).toBe('bot-config');
  });

  it('"Ask Cypheus" CTA switches panel tab to cypheus', () => {
    act(() => {
      useCypheusStore.getState().setPanelTab('json');
    });

    render(<JsonLiveView />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Cypheus/i }));
    expect(useCypheusStore.getState().panelTab).toBe('cypheus');
  });
});
