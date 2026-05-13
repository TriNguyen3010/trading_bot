import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BotConfigSetup } from './BotConfigStep';
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
