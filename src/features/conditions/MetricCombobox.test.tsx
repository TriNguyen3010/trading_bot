import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MetricCombobox, type MetricOption } from './MetricCombobox';

const OPTIONS: MetricOption[] = [
  { value: 'candle.close', label: 'candle.close', category: 'Candle' },
  { value: 'candle.high', label: 'candle.high', category: 'Candle' },
  {
    value: 'RSI-14',
    label: 'RSI-14',
    category: 'Momentum',
    description: 'Relative Strength Index',
  },
  {
    value: 'MACD-12-26-9',
    label: 'MACD-12-26-9',
    category: 'Momentum',
  },
  { value: 'MA-50', label: 'MA-50', category: 'Trend' },
  { value: 'BB-20', label: 'BB-20', category: 'Volatility' },
];

describe('MetricCombobox', () => {
  it("trigger shows the current value's label", () => {
    render(
      <MetricCombobox
        value="RSI-14"
        onChange={() => {}}
        options={OPTIONS}
        ariaLabel="Metric"
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Metric' });
    expect(trigger).toHaveTextContent('RSI-14');
  });

  it('opens a popover listing every option grouped by category when triggered', () => {
    render(
      <MetricCombobox
        value="candle.close"
        onChange={() => {}}
        options={OPTIONS}
        ariaLabel="Metric"
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Metric' }));

    // Category headers render inside the options listbox (chip strip
    // duplicates the names — we scope to the list, not the chips).
    const listbox = screen.getByRole('listbox');
    for (const cat of ['Candle', 'Momentum', 'Trend', 'Volatility']) {
      expect(
        listbox.textContent ?? '',
        `category header missing: ${cat}`,
      ).toContain(cat);
    }

    // Every option is listed.
    for (const opt of OPTIONS) {
      // Search and trigger also show the label string; the list items have
      // role="option" so we scope to those.
      const option = screen
        .getAllByRole('option')
        .find((el) => el.textContent?.includes(opt.label));
      expect(option, `option missing for ${opt.value}`).toBeTruthy();
    }
  });

  it('filters the visible options by case-insensitive substring of the search query', () => {
    render(
      <MetricCombobox
        value="candle.close"
        onChange={() => {}}
        options={OPTIONS}
        ariaLabel="Metric"
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Metric' }));

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'rsi' },
    });

    expect(screen.getAllByRole('option').map((el) => el.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('RSI-14')]),
    );
    expect(
      screen
        .getAllByRole('option')
        .map((el) => el.textContent ?? '')
        .some((t) => t.includes('candle.close')),
    ).toBe(false);
  });

  it('narrows the list to a single category when a category chip is clicked', () => {
    render(
      <MetricCombobox
        value="candle.close"
        onChange={() => {}}
        options={OPTIONS}
        ariaLabel="Metric"
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Metric' }));

    fireEvent.click(screen.getByRole('button', { name: /Volatility/i }));

    const optionTexts = screen
      .getAllByRole('option')
      .map((el) => el.textContent ?? '');
    expect(optionTexts.some((t) => t.includes('BB-20'))).toBe(true);
    expect(optionTexts.some((t) => t.includes('RSI-14'))).toBe(false);
    expect(optionTexts.some((t) => t.includes('candle.close'))).toBe(false);
  });

  it('selecting an option fires onChange with its value and closes the popover', () => {
    const onChange = vi.fn();
    render(
      <MetricCombobox
        value="candle.close"
        onChange={onChange}
        options={OPTIONS}
        ariaLabel="Metric"
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Metric' }));

    const option = screen
      .getAllByRole('option')
      .find((el) => el.textContent?.includes('RSI-14'));
    fireEvent.click(option!);

    expect(onChange).toHaveBeenCalledWith('RSI-14');
    // Popover closes: no more option role nodes in the document.
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows an empty state when nothing matches the search', () => {
    render(
      <MetricCombobox
        value="candle.close"
        onChange={() => {}}
        options={OPTIONS}
        ariaLabel="Metric"
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Metric' }));

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'zzz-no-such-metric' },
    });

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(/no metrics/i)).toBeInTheDocument();
  });

  it("falls back to placeholder when value isn't in options", () => {
    render(
      <MetricCombobox
        value=""
        onChange={() => {}}
        options={OPTIONS}
        ariaLabel="Metric"
        placeholder="Select metric…"
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Metric' })).toHaveTextContent(
      /Select metric…/,
    );
  });
});
