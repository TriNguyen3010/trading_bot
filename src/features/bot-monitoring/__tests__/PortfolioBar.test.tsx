import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('renders capital, active/total, open trades', () => {
    render(<PortfolioBar stats={stats} loading={false} />);
    expect(screen.getByText('12,480.50')).toBeInTheDocument();
    expect(screen.getByText(/4\s*\/\s*9/)).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('renders the Fleet split labels', () => {
    render(<PortfolioBar stats={stats} loading={false} />);
    expect(screen.getByText('Fleet')).toBeInTheDocument();
    expect(screen.getByText(/idle/i)).toBeInTheDocument();
    expect(screen.getByText(/working/i)).toBeInTheDocument();
    expect(screen.getByText(/err/i)).toBeInTheDocument();
  });

  it('shows em-dashes (not raw zeros) while loading', () => {
    const zero: PortfolioStats = {
      capitalDeployed: 0,
      openTrades: 0,
      total: 0,
      active: 0,
      transitioning: 0,
      idle: 0,
      error: 0,
    };
    render(<PortfolioBar stats={zero} loading />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(6);
  });
});
