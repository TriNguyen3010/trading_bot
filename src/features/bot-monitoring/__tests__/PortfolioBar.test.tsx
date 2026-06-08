import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortfolioBar } from '../PortfolioBar';
import type { PortfolioStats } from '../portfolio-stats';

const stats: PortfolioStats = {
  capitalDeployed: 12480.5,
  openTrades: 6,
  total: 9,
  active: 4,
  transitioning: 1,
  idle: 1,
  error: 1,
};

describe('PortfolioBar', () => {
  it('renders capital deployed and KPI counts', () => {
    render(<PortfolioBar stats={stats} loading={false} onRefresh={() => {}} />);
    expect(screen.getByText('12,480.50')).toBeInTheDocument();
    expect(screen.getByText(/4\s*\/\s*9/)).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('calls onRefresh when the refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(
      <PortfolioBar stats={stats} loading={false} onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('disables refresh while loading', () => {
    render(<PortfolioBar stats={stats} loading onRefresh={() => {}} />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });
});
