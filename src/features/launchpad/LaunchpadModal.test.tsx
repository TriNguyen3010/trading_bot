import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LaunchpadModal, type LaunchpadBot } from './LaunchpadModal';
import { launchBot } from './launch-actions';

vi.mock('./launch-actions', () => ({ launchBot: vi.fn() }));
vi.mock('@/features/bot-monitoring/bot.api', () => ({
  botApi: { sync: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockLaunch = vi.mocked(launchBot);

const bot: LaunchpadBot = {
  id: 42,
  name: 'Bollinger breakout',
  strategyName: 'BollingerBreakout',
  pair: 'BTC/USDT',
  timeframe: '5m',
  mode: 'PAUSED',
  errorMsg: null,
};

beforeEach(() => {
  mockLaunch
    .mockReset()
    .mockResolvedValue({ id: 42, status: 'starting' } as never);
});

describe('LaunchpadModal', () => {
  it('renders 3 mode cards + bot name', () => {
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={() => {}}
      />,
    );
    expect(screen.getByText('Bollinger breakout')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /run backtest/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start dry-run/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /live — phase 2b/i }),
    ).toBeInTheDocument();
  });

  it('dry-run launches immediately and calls onLaunched', async () => {
    const onLaunched = vi.fn();
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={onLaunched}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /start dry-run/i }));
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledWith(42, 'dry-run'));
    await waitFor(() => expect(onLaunched).toHaveBeenCalled());
  });

  it('Live card is disabled in Phase 2a (defer to Phase 2b)', () => {
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={() => {}}
      />,
    );
    const liveBtn = screen.getByRole('button', { name: /live — phase 2b/i });
    expect(liveBtn).toBeDisabled();
    fireEvent.click(liveBtn);
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  it('backtest card delegates to onBacktest', () => {
    const onBacktest = vi.fn();
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={onBacktest}
        onLaunched={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }));
    expect(onBacktest).toHaveBeenCalled();
  });
});
