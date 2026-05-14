import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToggleGroup } from './toggle-group';

describe('ToggleGroup', () => {
  it('does not re-emit changes for the active option', () => {
    const onChange = vi.fn();

    render(
      <ToggleGroup
        value="market"
        onChange={onChange}
        ariaLabel="Order type"
        options={[
          { value: 'market', label: 'Market' },
          { value: 'limit', label: 'Limit' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Market' }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: 'Limit' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('limit');
  });

  it('does not transition background color when active state changes', () => {
    render(
      <ToggleGroup
        value="market"
        onChange={() => undefined}
        ariaLabel="Order type"
        options={[
          { value: 'market', label: 'Market' },
          { value: 'limit', label: 'Limit' },
        ]}
      />,
    );

    const market = screen.getByRole('radio', { name: 'Market' });

    expect(market.className).toContain('transition-[color,border-color]');
    expect(market.className).not.toContain('transition-colors');
  });
});
