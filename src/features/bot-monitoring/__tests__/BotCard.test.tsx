import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  onRemove: noop,
  onBacktest: noop,
};

describe('BotCard', () => {
  it('running bot: balance, numeric gauge, integer win-rate', () => {
    render(<BotCard bot={base} {...handlers} />);
    expect(screen.getByText('967.94')).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*10/)).toBeInTheDocument();
    expect(screen.getByText('44%')).toBeInTheDocument(); // rounded, not 44.2%
  });

  it('formats a negative net in the bearish color', () => {
    render(<BotCard bot={base} {...handlers} />);
    const net = screen.getByText('-36.59');
    expect(net.className).toMatch(/text-bearish/);
  });

  it('NEW: "not started" gauge + Run first backtest, no lifecycle button', () => {
    render(
      <BotCard
        bot={{
          ...base,
          mode: 'PAUSED',
          state: 'NEW',
          balance: null,
          lastBacktest: null,
        }}
        {...handlers}
      />,
    );
    expect(screen.getByText('not started')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /run first backtest/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^start$/i }),
    ).not.toBeInTheDocument();
  });

  it('ERROR: "— stopped" gauge, Stake/TF, Status head + error message, Start', () => {
    render(
      <BotCard
        bot={{
          ...base,
          mode: 'ERROR',
          state: 'ERROR',
          balance: null,
          errorMsg: 'boom',
        }}
        {...handlers}
      />,
    );
    expect(screen.getByText('— stopped')).toBeInTheDocument();
    expect(screen.getByText('Stake')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^start$/i }),
    ).toBeInTheDocument();
  });

  it('BACKTEST_FAILED: shows the failed note', () => {
    render(
      <BotCard
        bot={{
          ...base,
          mode: 'PAUSED',
          state: 'BACKTEST_FAILED',
          lastBacktest: { ...base.lastBacktest!, status: 'failed' },
        }}
        {...handlers}
      />,
    );
    expect(screen.getByText(/Backtest failed/i)).toBeInTheDocument();
  });

  it('BACKTESTING: spinner note (no %) + disabled Running… button', () => {
    render(
      <BotCard
        bot={{ ...base, mode: 'PAUSED', state: 'BACKTESTING' }}
        {...handlers}
      />,
    );
    expect(screen.getByText(/Backtesting…/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /running/i })).toBeDisabled();
  });

  it('a running bot in BACKTESTING still shows Stop (action follows mode)', () => {
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

  it('disabled spinner button while STARTING', () => {
    render(
      <BotCard
        bot={{ ...base, mode: 'STARTING', state: 'STARTING' }}
        {...handlers}
      />,
    );
    expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled();
  });

  it('fires onStop and does not bubble to the card onClick', () => {
    const onStop = vi.fn();
    const onClick = vi.fn();
    render(
      <BotCard bot={base} {...handlers} onStop={onStop} onClick={onClick} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(onStop).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Enter on a footer button does not navigate the card', () => {
    const onClick = vi.fn();
    render(<BotCard bot={base} {...handlers} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /^stop$/i }), {
      key: 'Enter',
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Enter on the card itself navigates', () => {
    const onClick = vi.fn();
    render(<BotCard bot={base} {...handlers} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('link'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('PAUSED shows Start, LIVE shows Stop', () => {
    const { rerender } = render(
      <BotCard
        bot={{ ...base, mode: 'PAUSED', state: 'PAUSED' }}
        {...handlers}
      />,
    );
    expect(
      screen.getByRole('button', { name: /^start$/i }),
    ).toBeInTheDocument();
    rerender(
      <BotCard bot={{ ...base, mode: 'LIVE', state: 'LIVE' }} {...handlers} />,
    );
    expect(screen.getByRole('button', { name: /^stop$/i })).toBeInTheDocument();
  });

  it('STOPPING shows a disabled spinner button', () => {
    render(
      <BotCard
        bot={{ ...base, mode: 'STOPPING', state: 'STOPPING' }}
        {...handlers}
      />,
    );
    expect(screen.getByRole('button', { name: /stopping/i })).toBeDisabled();
  });

  it('running card shows the gray equity placeholder "No data yet"', () => {
    render(<BotCard bot={base} {...handlers} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('running bot with no backtest shows a run-backtest prompt', () => {
    render(
      <BotCard
        bot={{ ...base, mode: 'LIVE', state: 'LIVE', lastBacktest: null }}
        {...handlers}
      />,
    );
    expect(screen.getByText(/No backtest yet/i)).toBeInTheDocument();
  });
});
