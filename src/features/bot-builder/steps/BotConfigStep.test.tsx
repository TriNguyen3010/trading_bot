import { describe, expect, it, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { BotConfigSetup, BotConfigComposite } from './BotConfigStep';
import { useBuilderStore } from '../store/builder.store';

describe('BotConfigComposite (Phase 1 — Scheme D grouping)', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  function getSectionButton(title: RegExp) {
    return screen.getByRole('button', { name: title });
  }

  it('renders three sections — Name, Market, Capital — in that order', () => {
    render(<BotConfigComposite />);

    const headings = screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => /Name|Market|Capital/i.test(t));

    expect(headings.length).toBeGreaterThanOrEqual(3);
    expect(headings[0]).toMatch(/^Name/i);
    expect(headings[1]).toMatch(/^Market/i);
    expect(headings[2]).toMatch(/^Capital/i);
  });

  it('Name section contains the Bot name input', () => {
    render(<BotConfigComposite />);
    // All sections default-open, so labels render directly.
    expect(screen.getByText(/^Bot name$/)).toBeInTheDocument();
  });

  it('Market section contains Pair, Timeframe, Exchange and Market type', () => {
    render(<BotConfigComposite />);
    expect(screen.getByText(/^Pair$/)).toBeInTheDocument();
    expect(screen.getByText(/^Timeframe$/)).toBeInTheDocument();
    expect(screen.getByText(/^Exchange$/)).toBeInTheDocument();
    expect(screen.getByText(/^Market type$/)).toBeInTheDocument();
  });

  it('Capital section contains Trading mode, Margin mode, Leverage, Max open trades, Stake currency, Stake amount', () => {
    render(<BotConfigComposite />);
    expect(screen.getByText(/^Trading mode$/)).toBeInTheDocument();
    expect(screen.getByText(/^Margin mode$/)).toBeInTheDocument();
    expect(screen.getByText(/^Leverage$/)).toBeInTheDocument();
    expect(screen.getByText(/^Max open trades$/)).toBeInTheDocument();
    expect(screen.getByText(/^Stake currency$/)).toBeInTheDocument();
    expect(screen.getByText(/^Stake amount$/)).toBeInTheDocument();
  });

  it('Dry-run wallet appears in Capital section only when tradingMode is dry-run', () => {
    render(<BotConfigComposite />);
    expect(screen.getByText(/^Dry-run wallet$/)).toBeInTheDocument();

    // Flip to live trade — Dry-run wallet hides.
    act(() => {
      useBuilderStore.getState().patchBotConfig({ tradingMode: 'live' });
    });
    expect(screen.queryByText(/^Dry-run wallet$/)).not.toBeInTheDocument();
  });

  it('shows field-count hints on each section when collapsed', () => {
    render(<BotConfigComposite />);

    // Collapse all three.
    fireEvent.click(getSectionButton(/Name/i));
    fireEvent.click(getSectionButton(/Market/i));
    fireEvent.click(getSectionButton(/Capital/i));

    // Default state is dry-run → Capital has 7 user-editable fields.
    const nameBtn = getSectionButton(/Name/i);
    expect(within(nameBtn).getByText('1 field')).toBeInTheDocument();
    const marketBtn = getSectionButton(/Market/i);
    expect(within(marketBtn).getByText('4 fields')).toBeInTheDocument();
    const capitalBtn = getSectionButton(/Capital/i);
    expect(within(capitalBtn).getByText('7 fields')).toBeInTheDocument();
  });

  it('Capital field count drops to 6 in live trade mode (Dry-run wallet hidden)', () => {
    render(<BotConfigComposite />);
    useBuilderStore.getState().patchBotConfig({ tradingMode: 'live' });

    fireEvent.click(getSectionButton(/Capital/i));
    const capitalBtn = getSectionButton(/Capital/i);
    expect(within(capitalBtn).getByText('6 fields')).toBeInTheDocument();
  });
});

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
