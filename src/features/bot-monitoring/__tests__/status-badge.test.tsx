import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
  it('renders the human label for each state', () => {
    render(<StatusBadge state="DRY-RUN" />);
    expect(screen.getByText('Dry-run')).toBeInTheDocument();
  });

  it('maps LIVE to bullish color', () => {
    const { container } = render(<StatusBadge state="LIVE" />);
    expect(container.firstChild).toHaveClass('text-bullish');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders a spinner (not a dot) while BACKTESTING', () => {
    const { container } = render(<StatusBadge state="BACKTESTING" />);
    expect(screen.getByText('Backtesting')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('labels BACKTEST_FAILED as Paused', () => {
    render(<StatusBadge state="BACKTEST_FAILED" />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });
});
