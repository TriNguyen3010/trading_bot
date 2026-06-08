import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BotConfigSetup, BotConfigConfigure } from './BotConfigStep';
import { useBuilderStore } from '../store/builder.store';

describe('BotConfigSetup leverage control', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('caps the slider and number input at 50x', () => {
    render(<BotConfigSetup />);

    const slider = screen.getByRole('slider', {
      name: 'Leverage',
    }) as HTMLInputElement;
    const input = screen.getByRole('spinbutton', {
      name: 'Leverage value',
    }) as HTMLInputElement;

    expect(slider.min).toBe('1');
    expect(slider.max).toBe('50');
    expect(input.min).toBe('1');
    expect(input.max).toBe('50');
  });

  it('syncs direct number entry back to the slider and clamps above 50x', () => {
    render(<BotConfigSetup />);

    const slider = screen.getByRole('slider', {
      name: 'Leverage',
    }) as HTMLInputElement;
    const input = screen.getByRole('spinbutton', {
      name: 'Leverage value',
    }) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '43' } });
    expect(useBuilderStore.getState().botConfig.leverage).toBe(43);
    expect(slider.value).toBe('43');

    fireEvent.change(input, { target: { value: '60' } });
    expect(useBuilderStore.getState().botConfig.leverage).toBe(50);
    expect(slider.value).toBe('50');
    expect(input.value).toBe('50');
  });
});

describe('BotConfigSetup pair → stake currency', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('aligns the stake currency to the pair quote when the pair changes', () => {
    // Default stake currency is USDT; switching to a USDC-quoted pair must
    // flip it to USDC so we never ship the USDT-stake-on-USDC-pair combo
    // that made the backend 500.
    expect(useBuilderStore.getState().botConfig.stakeCurrency).toBe('USDT');

    render(<BotConfigSetup />);
    // Open the pair combobox, search, and pick BTC-USDC.
    fireEvent.click(screen.getByRole('combobox', { name: 'Pair' }));
    fireEvent.change(screen.getByPlaceholderText('Search pair (e.g. BTC)'), {
      target: { value: 'btc' },
    });
    fireEvent.click(screen.getByRole('option', { name: /BTC-USDC/ }));

    const config = useBuilderStore.getState().botConfig;
    expect(config.pair).toBe('BTC-USDC');
    expect(config.stakeCurrency).toBe('USDC');
  });
});

describe('BotConfigConfigure — dry-run wallet not exposed at build time', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('does not render a Dry-run wallet field (sim wallet is fixed at create, set per-run later)', () => {
    render(<BotConfigConfigure />);
    expect(screen.queryByText(/dry-run wallet/i)).not.toBeInTheDocument();
  });

  it('keeps the default dryRunWallet of 1000 in store so the payload still matches BE', () => {
    expect(useBuilderStore.getState().botConfig.dryRunWallet).toBe(1000);
  });
});
