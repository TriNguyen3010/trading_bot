import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Slider } from './slider';

describe('Slider', () => {
  it('renders the input with the given value', () => {
    render(
      <Slider
        value={25}
        onValueChange={() => {}}
        min={1}
        max={50}
        ariaLabel="Leverage"
      />,
    );
    const input = screen.getByRole('slider', {
      name: 'Leverage',
    }) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('25');
  });

  it('fires onValueChange with a number when user moves the slider', () => {
    const onValueChange = vi.fn();
    render(
      <Slider
        value={1}
        onValueChange={onValueChange}
        min={1}
        max={50}
        ariaLabel="Leverage"
      />,
    );
    const input = screen.getByRole('slider', {
      name: 'Leverage',
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    expect(onValueChange).toHaveBeenCalledWith(50);
    expect(typeof onValueChange.mock.calls[0][0]).toBe('number');
  });

  it('displays the value with the suffix beside the slider', () => {
    render(
      <Slider
        value={10}
        onValueChange={() => {}}
        min={1}
        max={50}
        suffix="x"
        ariaLabel="Leverage"
      />,
    );
    expect(screen.getByText('10x')).toBeInTheDocument();
  });

  it('can hide the rendered value for composed controls', () => {
    render(
      <Slider
        value={10}
        onValueChange={() => {}}
        min={1}
        max={50}
        suffix="x"
        ariaLabel="Leverage"
        showValue={false}
      />,
    );
    expect(screen.queryByText('10x')).toBeNull();
  });
});
