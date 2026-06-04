import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Combobox } from './combobox';

const OPTS = ['BTC-USDC', 'ETH-USDC', 'SOL-USDC', 'kPEPE-USDC'];

describe('Combobox', () => {
  it('shows the current value on the trigger', () => {
    render(<Combobox value="SOL-USDC" onChange={() => {}} options={OPTS} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('SOL-USDC');
  });

  it('opens, filters by search, and selects an option', () => {
    const onChange = vi.fn();
    render(
      <Combobox
        value=""
        onChange={onChange}
        options={OPTS}
        placeholder="Select pair"
        searchPlaceholder="Search pair"
      />,
    );
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByPlaceholderText('Search pair'), {
      target: { value: 'eth' },
    });
    expect(screen.queryByRole('option', { name: /BTC-USDC/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /ETH-USDC/ }));
    expect(onChange).toHaveBeenCalledWith('ETH-USDC');
  });

  it('search is case-insensitive and matches special tokens', () => {
    const onChange = vi.fn();
    render(<Combobox value="" onChange={onChange} options={OPTS} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'kpepe' },
    });
    fireEvent.click(screen.getByRole('option', { name: /kPEPE-USDC/ }));
    expect(onChange).toHaveBeenCalledWith('kPEPE-USDC');
  });

  it('shows a no-results message when nothing matches', () => {
    render(<Combobox value="" onChange={() => {}} options={OPTS} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'zzzz' },
    });
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });
});
