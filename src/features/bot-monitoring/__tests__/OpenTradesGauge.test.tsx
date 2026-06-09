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

  it('lights at least one pip when open > 0 even if max is large', () => {
    const { container } = render(<OpenTradesGauge open={1} max={20} />);
    expect(screen.getByText('1/20')).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-pip="on"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('shows a placeholder string with no lit pips', () => {
    const { container } = render(
      <OpenTradesGauge open={null} max={3} placeholder="— paused" />,
    );
    expect(screen.getByText('— paused')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-pip="on"]')).toHaveLength(0);
    expect(screen.queryByText(/\d\/\d/)).not.toBeInTheDocument();
  });

  it('colors lit pips blue for the dry-run tone', () => {
    const { container } = render(
      <OpenTradesGauge open={2} max={4} tone="dryrun" />,
    );
    expect(container.querySelector('[data-pip="on"]')).toHaveClass('bg-info');
  });

  it('colors lit pips green for the live tone (default)', () => {
    const { container } = render(
      <OpenTradesGauge open={2} max={4} tone="live" />,
    );
    expect(container.querySelector('[data-pip="on"]')).toHaveClass(
      'bg-bullish',
    );
  });
});
