import { describe, expect, it, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { useExportDialogStore } from '@/features/export-import/export-dialog.store';
import { SetupProgress } from './SetupProgress';

function fillValidBotConfig() {
  useBuilderStore.getState().patchBotConfig({
    pair: 'BTC-USDC',
    timeframe: '5m',
    leverage: 1,
    stakeAmount: 100,
  });
}

function fillValidEntryStrategy() {
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
}

function fillValidDirection() {
  useBuilderStore.getState().patchDirection({
    direction: 'long',
    orderType: 'market',
    limitOffsetPct: null,
    slippageTolerance: 0.5,
  });
}

function fillValidCloseMethod() {
  useBuilderStore.getState().patchCloseMethod({
    type: 'tp_sl',
    tpEnabled: true,
    tpLevels: [{ profit: 5, amount: 50 }],
    slEnabled: true,
    slValue: -3,
  });
}

function markAllConfigured() {
  const { setStepStatus } = useBuilderStore.getState();
  setStepStatus('bot-config', 'configured');
  setStepStatus('entry-strategy', 'configured');
  setStepStatus('direction', 'configured');
  setStepStatus('close-method', 'configured');
}

describe('SetupProgress', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
    useExportDialogStore.setState({ open: false });
    useCypheusStore.getState().resetAll();
  });

  it('renders empty state when nothing configured', () => {
    render(<SetupProgress />);
    expect(screen.getByText(/Set up your bot to get started/i)).toBeInTheDocument();
    // No CTA, no pill row, no Export button.
    expect(screen.queryByRole('button', { name: /export bot/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /open bot phase/i })).toBeNull();
  });

  it('shows in-progress counter after partial phase config', () => {
    fillValidBotConfig();
    useBuilderStore.getState().setStepStatus('bot-config', 'configured');
    render(<SetupProgress />);
    // Phrase changed from "X / 4 steps" to "X / 2 phases" for the 2-phase UI.
    expect(screen.getByText(/1 \/ 2 phases configured/i)).toBeInTheDocument();
    // Pills render in in-progress / error mode.
    expect(screen.getByRole('button', { name: /open bot phase/i })).toBeInTheDocument();
  });

  it('renders ready state with Export CTA when all phases configured and no issues', () => {
    fillValidBotConfig();
    fillValidEntryStrategy();
    fillValidDirection();
    fillValidCloseMethod();
    markAllConfigured();

    render(<SetupProgress />);
    expect(screen.getByText(/Ready to export/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export bot/i })).toBeInTheDocument();
    // Pills hidden in ready state.
    expect(screen.queryByRole('button', { name: /open strategy phase/i })).toBeNull();
  });

  it('shows error state with Fix CTA when configured but validation fails', () => {
    // Configure all but leave entry strategy invalid (no candlestick / no conditions).
    fillValidBotConfig();
    fillValidDirection();
    fillValidCloseMethod();
    markAllConfigured();

    render(<SetupProgress />);
    expect(screen.getByText(/block(s)? export/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^fix$/i })).toBeInTheDocument();
    // No Export CTA in error mode.
    expect(screen.queryByRole('button', { name: /export bot/i })).toBeNull();
  });

  it('clicking a phase pill routes the drawer to the matching step', () => {
    fillValidBotConfig();
    useBuilderStore.getState().setStepStatus('bot-config', 'configured');
    render(<SetupProgress />);

    // Strategy phase pill → opens the composite drawer (routes via
    // openStep='entry-strategy', the canonical sub-step that the
    // StepDrawer dispatches into composite mode for).
    fireEvent.click(
      screen.getByRole('button', { name: /open strategy phase/i }),
    );
    expect(useBuilderStore.getState().openStep).toBe('entry-strategy');
  });

  it('clicking the Bot phase pill opens the bot-config drawer', () => {
    fillValidBotConfig();
    useBuilderStore.getState().setStepStatus('bot-config', 'configured');
    render(<SetupProgress />);

    fireEvent.click(
      screen.getByRole('button', { name: /open bot phase/i }),
    );
    expect(useBuilderStore.getState().openStep).toBe('bot-config');
  });

  it('clicking Export CTA opens shared export dialog store', () => {
    fillValidBotConfig();
    fillValidEntryStrategy();
    fillValidDirection();
    fillValidCloseMethod();
    markAllConfigured();

    render(<SetupProgress />);
    fireEvent.click(screen.getByRole('button', { name: /export bot/i }));
    expect(useExportDialogStore.getState().open).toBe(true);
  });

  it('clicking Fix CTA opens drawer for the first failing step', () => {
    fillValidBotConfig();
    fillValidDirection();
    fillValidCloseMethod();
    markAllConfigured();

    render(<SetupProgress />);
    fireEvent.click(screen.getByRole('button', { name: /^fix$/i }));
    // First failing step should be entry-strategy (since direction & close & bot are valid).
    expect(useBuilderStore.getState().openStep).toBe('entry-strategy');
  });

  it('shows pills row in in_progress and error modes only', () => {
    // empty mode: no pills
    const { rerender, container } = render(<SetupProgress />);
    expect(
      within(container).queryByRole('button', { name: /open bot phase/i }),
    ).toBeNull();

    // in_progress: pills shown
    act(() => {
      fillValidBotConfig();
      useBuilderStore.getState().setStepStatus('bot-config', 'configured');
    });
    rerender(<SetupProgress />);
    expect(
      within(container).getByRole('button', { name: /open bot phase/i }),
    ).toBeInTheDocument();
  });

  it('disables interactions when Cypheus is building', () => {
    fillValidBotConfig();
    useBuilderStore.getState().setStepStatus('bot-config', 'configured');
    useCypheusStore.setState({ state: 'building' });

    const { container } = render(<SetupProgress />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('pointer-events-none');
    expect(wrapper.className).toContain('opacity-60');
  });

  it('enables interactions when Cypheus is not building', () => {
    fillValidBotConfig();
    useBuilderStore.getState().setStepStatus('bot-config', 'configured');
    useCypheusStore.setState({ state: 'idle' });

    const { container } = render(<SetupProgress />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).not.toContain('pointer-events-none');
  });
});
