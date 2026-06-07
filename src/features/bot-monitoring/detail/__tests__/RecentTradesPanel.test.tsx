import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentTradesPanel } from '../RecentTradesPanel';

const trades = [
  {
    pair: 'BTC/USDC:USDC',
    is_short: false,
    leverage: 10,
    open_rate: 78938,
    close_rate: 79088,
    profit_abs: 0.98,
    profit_ratio: 0.0098,
    funding_fees: -0.02,
    close_timestamp: 1,
  },
  {
    pair: 'BTC/USDC:USDC',
    is_short: true,
    leverage: 10,
    open_rate: 77716,
    close_rate: 76662,
    profit_abs: 12.71,
    profit_ratio: 0.127,
    funding_fees: 0.047,
    close_timestamp: 2,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

describe('RecentTradesPanel', () => {
  it('renders LONG/SHORT rows', () => {
    render(<RecentTradesPanel trades={trades} />);
    expect(screen.getByText('LONG')).toBeInTheDocument();
    expect(screen.getByText('SHORT')).toBeInTheDocument();
    expect(screen.getByText(/78,?938/)).toBeInTheDocument();
  });
  it('shows empty hint when no trades', () => {
    render(<RecentTradesPanel trades={[]} />);
    expect(screen.getByText(/No trades yet/i)).toBeInTheDocument();
  });
});
