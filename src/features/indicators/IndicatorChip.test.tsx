import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IndicatorChip } from './IndicatorChip';
import { makeIndicator } from './indicator-registry';

function renderChip(name: string) {
  const item = makeIndicator(name);
  render(<IndicatorChip item={item} onChange={vi.fn()} onRemove={vi.fn()} />);
  return item;
}

describe('IndicatorChip param panel', () => {
  it('shows BBANDS params (Period, Upper/Lower Deviation) when opened', async () => {
    renderChip('BBANDS');
    fireEvent.click(screen.getByLabelText(/edit bbands parameters/i));
    expect(await screen.findByText('Period')).toBeInTheDocument();
    expect(screen.getByText('Upper Deviation')).toBeInTheDocument();
    expect(screen.getByText('Lower Deviation')).toBeInTheDocument();
  });

  it('shows the chosen output in the chip summary for multi-output', () => {
    const item = { ...makeIndicator('BBANDS'), output: 'upperband' };
    render(<IndicatorChip item={item} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('BBANDS-20-2-2.upperband')).toBeInTheDocument();
  });

  it('shows no param fields for OBV (parameter-less indicator)', async () => {
    renderChip('OBV');
    fireEvent.click(screen.getByLabelText(/edit obv parameters/i));
    expect(await screen.findByText('OBV parameters')).toBeInTheDocument();
    expect(screen.queryByText('Period')).not.toBeInTheDocument();
  });
});
