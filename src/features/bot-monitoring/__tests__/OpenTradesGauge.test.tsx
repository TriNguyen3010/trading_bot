import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpenTradesGauge } from '../OpenTradesGauge';

describe('OpenTradesGauge', () => {
  it('renders numeric open/max and one pip per slot when small', () => {
    const { container } = render(<OpenTradesGauge open={3} max={5} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-pip]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-pip="on"]')).toHaveLength(3);
  });

  it('shows em-dash when max is unknown', () => {
    render(<OpenTradesGauge open={null} max={null} />);
    expect(screen.getByText('—/—')).toBeInTheDocument();
  });

  it('caps pips at 8 but keeps the true numeric', () => {
    const { container } = render(<OpenTradesGauge open={1} max={10} />);
    expect(screen.getByText('1/10')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-pip]')).toHaveLength(8);
  });
});
