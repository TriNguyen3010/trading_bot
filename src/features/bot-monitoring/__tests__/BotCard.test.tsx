import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BotCard, type BotCardData } from '../BotCard';

const base: BotCardData = {
  id: 86,
  name: 'Gamma',
  pair: 'BTC/USDC:USDC',
  timeframe: '5m',
  createdAt: '2026-05-15',
  stakeAmount: 100,
  maxOpenTrades: 10,
  balance: 967.94,
  openTrades: 1,
  lastBacktest: {
    winRate: 44.2,
    trades: 104,
    netAbs: -36.59,
    status: 'completed',
  },
  mode: 'DRY-RUN',
  state: 'DRY-RUN',
  errorMsg: null,
};

const noop = () => {};
const handlers = {
  onClick: noop,
  onStart: noop,
  onStop: noop,
  onSync: noop,
  onRemove: noop,
  onBacktest: noop,
};

describe('BotCard', () => {
  it('renders balance + micro stats for a running bot', () => {
    render(<BotCard bot={base} {...handlers} />);
    expect(screen.getByText('967.94')).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*10/)).toBeInTheDocument();
    expect(screen.getByText('44.2%')).toBeInTheDocument();
  });

  it('renders NEW empty hint + Run first backtest', () => {
    render(
      <BotCard
        bot={{ ...base, state: 'NEW', balance: null, lastBacktest: null }}
        {...handlers}
      />,
    );
    expect(screen.getByText(/Run first backtest/i)).toBeInTheDocument();
  });

  it('renders error_message for ERROR state', () => {
    render(
      <BotCard
        bot={{
          ...base,
          state: 'ERROR',
          errorMsg: 'Insufficient agent allowance',
        }}
        {...handlers}
      />,
    );
    expect(
      screen.getByText(/Insufficient agent allowance/),
    ).toBeInTheDocument();
  });

  it('renders backtest-failed message', () => {
    render(
      <BotCard
        bot={{
          ...base,
          state: 'BACKTEST_FAILED',
          lastBacktest: { ...base.lastBacktest!, status: 'failed' },
        }}
        {...handlers}
      />,
    );
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  it('shows a spinner + status text while BACKTESTING (no %)', () => {
    render(
      <BotCard
        bot={{ ...base, mode: 'PAUSED', state: 'BACKTESTING' }}
        {...handlers}
      />,
    );
    expect(screen.getByText('Backtesting…')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('a running bot in BACKTESTING overlay still shows Stop (action follows mode)', () => {
    render(
      <BotCard
        bot={{ ...base, mode: 'DRY-RUN', state: 'BACKTESTING' }}
        {...handlers}
      />,
    );
    expect(screen.getByRole('button', { name: /^stop$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^start$/i }),
    ).not.toBeInTheDocument();
  });
});
